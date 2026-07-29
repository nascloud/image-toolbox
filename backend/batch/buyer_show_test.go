package batch

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

func TestValidateBuyerShowSetRequiresBasisChoice(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = ""
	set.BasisSlotIndex = 0
	if _, err := validateBuyerShowSet(set); err == nil {
		t.Fatal("validateBuyerShowSet() accepted an unselected basis")
	}
}

func TestValidateBuyerShowSetWhiteBasis(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = model.BuyerShowBasisWhiteBackground
	set.BasisSlotIndex = 1
	path, err := validateBuyerShowSet(set)
	if err != nil {
		t.Fatalf("validateBuyerShowSet() error = %v", err)
	}
	if path != set.Slots[0].SourcePath {
		t.Fatalf("basis path = %q", path)
	}
}

func TestBuyerShowOutputPathIsVersioned(t *testing.T) {
	set := validBuyerShowSet(t)
	set.SetName = `产品:A/01`
	path := buyerShowOutputPath(t.TempDir(), set, 4, 2, "jpeg")
	if filepath.Base(path) != "04_buyer_show_v002.jpg" {
		t.Fatalf("output name = %q", filepath.Base(path))
	}
	if strings.Contains(filepath.Base(filepath.Dir(path)), ":") {
		t.Fatalf("output dir contains unsafe character: %q", filepath.Dir(path))
	}
}

func TestNextBuyerShowRevisionUsesExistingFiles(t *testing.T) {
	set := validBuyerShowSet(t)
	root := t.TempDir()
	existing := buyerShowOutputPath(root, set, 3, 4, "png")
	if err := os.MkdirAll(filepath.Dir(existing), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(existing, []byte("existing"), 0644); err != nil {
		t.Fatal(err)
	}
	if revision := nextBuyerShowRevision(root, set, 3); revision != 5 {
		t.Fatalf("next revision = %d, want 5", revision)
	}
}

func TestValidateBuyerShowSetRejectsMismatchedSlotMetadata(t *testing.T) {
	set := validBuyerShowSet(t)
	set.Slots[1].Index = 3
	if _, err := validateBuyerShowSet(set); err == nil {
		t.Fatal("validateBuyerShowSet() accepted mismatched slot index")
	}
}

func TestValidateBuyerShowSetRejectsMissingScene(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = model.BuyerShowBasisExistingScene
	set.BasisSlotIndex = 3
	set.Slots[2].SourcePath = ""
	if _, err := validateBuyerShowSet(set); err == nil {
		t.Fatal("validateBuyerShowSet() accepted empty scene slot")
	}
}

func TestResolveBuyerShowBasisPathsSupportsMultipleScenes(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = model.BuyerShowBasisExistingScene
	set.BasisSlotIndex = 2
	set.BasisSlotIndices = []int{2, 4, 2}
	second := writeBuyerShowBasisFile(t, set.FolderPath, "scene-2.png")
	fourthSource := writeBuyerShowBasisFile(t, set.FolderPath, "scene-4-source.png")
	fourthOutput := writeBuyerShowBasisFile(t, set.FolderPath, "scene-4-output.png")
	set.Slots[1].SourcePath = second
	set.Slots[3].SourcePath = fourthSource
	set.Slots[3].OutputPath = fourthOutput

	paths, err := resolveBuyerShowBasisPaths(set)
	if err != nil {
		t.Fatalf("resolveBuyerShowBasisPaths() error = %v", err)
	}
	if len(paths) != 2 || paths[0] != second || paths[1] != fourthOutput {
		t.Fatalf("basis paths = %#v", paths)
	}
}

func TestResolveBuyerShowBasisPathsFallsBackToLegacyIndex(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = model.BuyerShowBasisExistingScene
	set.BasisSlotIndex = 3
	set.Slots[2].SourcePath = writeBuyerShowBasisFile(t, set.FolderPath, "scene-3.png")
	paths, err := resolveBuyerShowBasisPaths(set)
	if err != nil {
		t.Fatalf("resolveBuyerShowBasisPaths() error = %v", err)
	}
	if len(paths) != 1 || paths[0] != set.Slots[2].SourcePath {
		t.Fatalf("basis paths = %#v", paths)
	}
}

func TestResolveBuyerShowBasisPathsRejectsInvalidSceneIndex(t *testing.T) {
	set := validBuyerShowSet(t)
	set.BasisMode = model.BuyerShowBasisExistingScene
	set.BasisSlotIndices = []int{1, 2}
	if _, err := resolveBuyerShowBasisPaths(set); err == nil {
		t.Fatal("resolveBuyerShowBasisPaths() accepted white slot as scene basis")
	}
}

func TestRunBuyerShowBatchRunsSetsConcurrentlyAndSlotsSeriallyWithRelay(t *testing.T) {
	resultImage := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			resultImage.Set(x, y, color.RGBA{R: 70, G: 120, B: 90, A: 255})
		}
	}
	var resultBuffer bytes.Buffer
	if err := png.Encode(&resultBuffer, resultImage); err != nil {
		t.Fatal(err)
	}
	resultBase64 := base64.StdEncoding.EncodeToString(resultBuffer.Bytes())

	var active int32
	var maximumActive int32
	activeBySet := make(map[string]int)
	maximumBySet := make(map[string]int)
	referenceCounts := make(map[string][]int)
	var stateMu sync.Mutex
	bothSetsStarted := make(chan struct{})
	var bothSetsOnce sync.Once

	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		prompt, _ := payload["prompt"].(string)
		setName := "套装-A"
		if strings.Contains(prompt, "套装-B") {
			setName = "套装-B"
		}
		imageCount := 1
		if images, ok := payload["image"].([]any); ok {
			imageCount = len(images)
		}

		currentActive := atomic.AddInt32(&active, 1)
		defer atomic.AddInt32(&active, -1)
		for {
			maximum := atomic.LoadInt32(&maximumActive)
			if currentActive <= maximum || atomic.CompareAndSwapInt32(&maximumActive, maximum, currentActive) {
				break
			}
		}

		stateMu.Lock()
		activeBySet[setName]++
		if activeBySet[setName] > maximumBySet[setName] {
			maximumBySet[setName] = activeBySet[setName]
		}
		referenceCounts[setName] = append(referenceCounts[setName], imageCount)
		if activeBySet["套装-A"] > 0 && activeBySet["套装-B"] > 0 {
			bothSetsOnce.Do(func() { close(bothSetsStarted) })
		}
		stateMu.Unlock()

		select {
		case <-bothSetsStarted:
		case <-time.After(2 * time.Second):
			t.Error("two sets did not enter the provider concurrently")
		}
		time.Sleep(5 * time.Millisecond)

		stateMu.Lock()
		activeBySet[setName]--
		stateMu.Unlock()
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(model.AIImageResponse{Data: []struct {
			URL     string `json:"url,omitempty"`
			B64JSON string `json:"b64_json,omitempty"`
			Size    string `json:"size,omitempty"`
			Error   *struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error,omitempty"`
		}{{B64JSON: resultBase64}}})
	}))
	defer server.Close()

	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := config.SaveProviderConfig(configPath, "seedream", "test-key", server.URL); err != nil {
		t.Fatal(err)
	}
	setA := validBuyerShowSet(t)
	setA.SetID = "set-a"
	setA.SetName = "套装-A"
	setA.Product.Name = "套装-A"
	setB := validBuyerShowSet(t)
	setB.SetID = "set-b"
	setB.SetName = "套装-B"
	setB.Product.Name = "套装-B"

	result := RunBuyerShowBatch(context.Background(), model.BuyerShowBatchRequest{
		Options: model.BuyerShowGenerationOptions{
			Provider: "seedream", Model: "doubao-seedream-5-0-lite-260128", Size: "2K",
			OutputFormat: "png", Concurrent: 2, OutputDir: t.TempDir(),
		},
		Sets: []model.BuyerShowGenerateSet{setA, setB},
	}, configPath, nil)
	if result.Error != "" || result.Success != 10 || result.Failed != 0 {
		t.Fatalf("batch result = %+v", result)
	}
	if maximumActive < 2 {
		t.Fatalf("maximum concurrent sets = %d, want at least 2", maximumActive)
	}
	stateMu.Lock()
	defer stateMu.Unlock()
	for _, setName := range []string{"套装-A", "套装-B"} {
		if maximumBySet[setName] != 1 {
			t.Fatalf("%s provider concurrency = %d, want 1", setName, maximumBySet[setName])
		}
		counts := referenceCounts[setName]
		expected := []int{1, 2, 3, 4, 5}
		if len(counts) != len(expected) {
			t.Fatalf("%s request counts = %#v", setName, counts)
		}
		for index := range expected {
			if counts[index] != expected[index] {
				t.Fatalf("%s request %d image count = %d, want %d", setName, index, counts[index], expected[index])
			}
		}
	}
}

func TestRunBuyerShowBatchContinuesAfterSlotFailureWithoutRelayingFailure(t *testing.T) {
	resultImage := image.NewRGBA(image.Rect(0, 0, 4, 4))
	var resultBuffer bytes.Buffer
	if err := png.Encode(&resultBuffer, resultImage); err != nil {
		t.Fatal(err)
	}
	resultBase64 := base64.StdEncoding.EncodeToString(resultBuffer.Bytes())
	var callCount int
	var imageCounts []int
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		callCount++
		imageCount := 1
		if images, ok := payload["image"].([]any); ok {
			imageCount = len(images)
		}
		imageCounts = append(imageCounts, imageCount)
		if callCount == 2 {
			writer.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(writer).Encode(map[string]any{"error": map[string]string{"code": "test_failure", "message": "forced failure"}})
			return
		}
		_ = json.NewEncoder(writer).Encode(model.AIImageResponse{Data: []struct {
			URL     string `json:"url,omitempty"`
			B64JSON string `json:"b64_json,omitempty"`
			Size    string `json:"size,omitempty"`
			Error   *struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			} `json:"error,omitempty"`
		}{{B64JSON: resultBase64}}})
	}))
	defer server.Close()

	configPath := filepath.Join(t.TempDir(), "config.json")
	if err := config.SaveProviderConfig(configPath, "seedream", "test-key", server.URL); err != nil {
		t.Fatal(err)
	}
	set := validBuyerShowSet(t)
	result := RunBuyerShowBatch(context.Background(), model.BuyerShowBatchRequest{
		Options: model.BuyerShowGenerationOptions{
			Provider: "seedream", Model: "doubao-seedream-5-0-lite-260128", Size: "2K",
			OutputFormat: "png", Concurrent: 1, OutputDir: t.TempDir(),
		},
		Sets: []model.BuyerShowGenerateSet{set},
	}, configPath, nil)
	if result.Success != 4 || result.Failed != 1 {
		t.Fatalf("batch result = %+v", result)
	}
	expected := []int{1, 2, 2, 3, 4}
	if len(imageCounts) != len(expected) {
		t.Fatalf("image counts = %#v", imageCounts)
	}
	for index := range expected {
		if imageCounts[index] != expected[index] {
			t.Fatalf("request %d image count = %d, want %d", index, imageCounts[index], expected[index])
		}
	}
}

func TestAppendUniqueBuyerShowPath(t *testing.T) {
	paths := []string{filepath.Join("root", "Image.PNG")}
	paths = appendUniqueBuyerShowPath(paths, filepath.Join("root", "image.png"))
	if len(paths) != 1 {
		t.Fatalf("duplicate path was appended: %#v", paths)
	}
	paths = appendUniqueBuyerShowPath(paths, filepath.Join("root", "next.png"))
	if len(paths) != 2 {
		t.Fatalf("new path was not appended: %#v", paths)
	}
}

func writeBuyerShowBasisFile(t *testing.T, dir, name string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, []byte(name), 0644); err != nil {
		t.Fatal(err)
	}
	return path
}

func writeBuyerShowTestPNG(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			img.Set(x, y, color.RGBA{R: 80, G: 120, B: 90, A: 255})
		}
	}
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(file, img); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
}

func validBuyerShowSet(t *testing.T) model.BuyerShowGenerateSet {
	t.Helper()
	dir := t.TempDir()
	basis := filepath.Join(dir, "basis.png")
	writeBuyerShowTestPNG(t, basis)
	slots := make([]model.BuyerShowSlot, 6)
	for index := range slots {
		role := model.BuyerShowSlotBuyer
		if index == 0 {
			role = model.BuyerShowSlotWhite
		}
		slots[index] = model.BuyerShowSlot{Index: index + 1, Role: role, Status: "empty"}
	}
	slots[0].SourcePath = basis
	slots[0].Status = "local"
	return model.BuyerShowGenerateSet{
		SetID: "set-1234567890abcdef", SetName: "产品", FolderPath: dir,
		BasisMode: model.BuyerShowBasisWhiteBackground, BasisSlotIndex: 1, Slots: slots,
	}
}

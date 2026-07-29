package ai

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
	"testing"

	imgpkg "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

func TestResizeImageBytesResizesToDownloadWidth(t *testing.T) {
	src := image.NewRGBA(image.Rect(0, 0, 100, 50))
	for y := 0; y < 50; y++ {
		for x := 0; x < 100; x++ {
			src.Set(x, y, color.RGBA{R: 10, G: 20, B: 30, A: 255})
		}
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, src); err != nil {
		t.Fatal(err)
	}

	resized, err := imgpkg.ResizeImageBytes(buf.Bytes(), 20)
	if err != nil {
		t.Fatal(err)
	}
	img, err := png.Decode(bytes.NewReader(resized))
	if err != nil {
		t.Fatal(err)
	}
	if img.Bounds().Dx() != 20 || img.Bounds().Dy() != 10 {
		t.Fatalf("expected 20x10 image, got %dx%d", img.Bounds().Dx(), img.Bounds().Dy())
	}
}

func TestProcessSingleImagesSavesAllReturnedImages(t *testing.T) {
	srcPath := filepath.Join(t.TempDir(), "source.png")
	src := image.NewRGBA(image.Rect(0, 0, 20, 20))
	var srcBuf bytes.Buffer
	if err := png.Encode(&srcBuf, src); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(srcPath, srcBuf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	resultA := image.NewRGBA(image.Rect(0, 0, 16, 16))
	resultB := image.NewRGBA(image.Rect(0, 0, 18, 18))
	var bufA, bufB bytes.Buffer
	if err := png.Encode(&bufA, resultA); err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(&bufB, resultB); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: base64.StdEncoding.EncodeToString(bufA.Bytes())},
				{B64JSON: base64.StdEncoding.EncodeToString(bufB.Bytes())},
			},
		})
	}))
	defer server.Close()

	provider := NewSeedreamProvider("test-key", server.URL)
	outDir := t.TempDir()
	outPaths, err := ProcessSingleImagesWithContext(context.Background(), provider, srcPath, outDir, model.AIBatchRequest{
		Model:          "doubao-seedream-5-0-lite-260128",
		Prompt:         "test",
		Size:           "2K",
		OutputFormat:   "png",
		ResponseFormat: "b64_json",
	}, filepath.Join(outDir, "source_ai.png"))
	if err != nil {
		t.Fatal(err)
	}
	if len(outPaths) != 2 {
		t.Fatalf("expected 2 output paths, got %d: %+v", len(outPaths), outPaths)
	}
	if filepath.Base(outPaths[0]) != "source_ai.png" || filepath.Base(outPaths[1]) != "source_ai_02.png" {
		t.Fatalf("unexpected output paths: %+v", outPaths)
	}
	for _, outPath := range outPaths {
		if _, err := os.Stat(outPath); err != nil {
			t.Fatalf("expected saved output %s: %v", outPath, err)
		}
	}
}

func TestProcessSingleImagesUsesDetectedOutputExtension(t *testing.T) {
	srcPath := filepath.Join(t.TempDir(), "source.png")
	src := image.NewRGBA(image.Rect(0, 0, 20, 20))
	var srcBuf bytes.Buffer
	if err := png.Encode(&srcBuf, src); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(srcPath, srcBuf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	result := image.NewRGBA(image.Rect(0, 0, 16, 16))
	var resultBuf bytes.Buffer
	if err := png.Encode(&resultBuf, result); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v1/models" {
			json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]string{{"id": "gpt-image-2"}},
			})
			return
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: base64.StdEncoding.EncodeToString(resultBuf.Bytes())},
			},
		})
	}))
	defer server.Close()

	provider := NewChatGPT2APIProvider("test-key", server.URL)
	outDir := t.TempDir()
	outPaths, err := ProcessSingleImagesWithContext(context.Background(), provider, srcPath, outDir, model.AIBatchRequest{
		Model:  "gpt-image-2",
		Prompt: "test",
	}, filepath.Join(outDir, "source_ai.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	if len(outPaths) != 1 {
		t.Fatalf("expected 1 output path, got %d", len(outPaths))
	}
	if filepath.Ext(outPaths[0]) != ".png" {
		t.Fatalf("expected detected .png extension, got %s", outPaths[0])
	}
}

func TestProcessSingleImagesPassesMultipleReferenceImagesInOrder(t *testing.T) {
	dir := t.TempDir()
	mainPath := writeSolidPNG(t, dir, "main.png", color.RGBA{R: 200, A: 255})
	refOnePath := writeSolidPNG(t, dir, "ref-one.png", color.RGBA{G: 180, A: 255})
	refTwoPath := writeSolidPNG(t, dir, "ref-two.png", color.RGBA{B: 160, A: 255})
	resultPath := writeSolidPNG(t, dir, "result.png", color.RGBA{R: 80, G: 80, B: 80, A: 255})
	resultData, err := os.ReadFile(resultPath)
	if err != nil {
		t.Fatal(err)
	}

	provider := &captureImageProvider{responseData: resultData}
	_, err = ProcessSingleImagesWithContext(context.Background(), provider, mainPath, t.TempDir(), model.AIBatchRequest{
		Model: "capture-model", Prompt: "test", ReferenceImages: []string{refOnePath, refTwoPath}, OutputFormat: "png",
	}, "")
	if err != nil {
		t.Fatalf("ProcessSingleImagesWithContext() error = %v", err)
	}
	if !strings.HasPrefix(provider.request.Image, "data:image/png;base64,") {
		t.Fatalf("main image was not encoded: %q", provider.request.Image)
	}
	if len(provider.request.ReferenceImages) != 2 {
		t.Fatalf("reference count = %d", len(provider.request.ReferenceImages))
	}
	refOneData, _ := os.ReadFile(refOnePath)
	refTwoData, _ := os.ReadFile(refTwoPath)
	if provider.request.ReferenceImages[0] != "data:image/png;base64,"+base64.StdEncoding.EncodeToString(refOneData) ||
		provider.request.ReferenceImages[1] != "data:image/png;base64,"+base64.StdEncoding.EncodeToString(refTwoData) {
		t.Fatalf("reference images were not passed in path order")
	}
}

type captureImageProvider struct {
	request      model.AIImageRequest
	responseData []byte
}

func (provider *captureImageProvider) Name() string { return "capture" }

func (provider *captureImageProvider) Generate(_ context.Context, request model.AIImageRequest) (*model.AIImageResponse, error) {
	provider.request = request
	response := &model.AIImageResponse{}
	response.Data = append(response.Data, struct {
		URL     string `json:"url,omitempty"`
		B64JSON string `json:"b64_json,omitempty"`
		Size    string `json:"size,omitempty"`
		Error   *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}{B64JSON: base64.StdEncoding.EncodeToString(provider.responseData)})
	return response, nil
}

func (provider *captureImageProvider) Models() []model.ModelInfo { return nil }

func (provider *captureImageProvider) ModelCapabilities(_ string) model.ModelCapabilities {
	return model.ModelCapabilities{SupportsImageInput: true, SupportsOutputFormat: true, DefaultOutputFormat: "png"}
}

func writeSolidPNG(t *testing.T, dir, name string, fill color.Color) string {
	t.Helper()
	path := filepath.Join(dir, name)
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for y := 0; y < 4; y++ {
		for x := 0; x < 4; x++ {
			img.Set(x, y, fill)
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
	return path
}

func TestProcessSingleImagesRejectsModelWithoutImageInput(t *testing.T) {
	srcPath := filepath.Join(t.TempDir(), "source.png")
	src := image.NewRGBA(image.Rect(0, 0, 20, 20))
	var srcBuf bytes.Buffer
	if err := png.Encode(&srcBuf, src); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(srcPath, srcBuf.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}

	provider := NewSeedreamProvider("test-key", "")
	_, err := ProcessSingleImagesWithContext(context.Background(), provider, srcPath, t.TempDir(), model.AIBatchRequest{
		Model:  "doubao-seedream-3-0-t2i-250415",
		Prompt: "test",
	}, "")
	if err == nil {
		t.Fatal("expected unsupported image input error")
	}
	if !strings.Contains(err.Error(), "does not support image input") {
		t.Fatalf("unexpected error: %v", err)
	}
}

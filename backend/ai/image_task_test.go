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

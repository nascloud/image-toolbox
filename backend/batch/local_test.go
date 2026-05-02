package batch

import (
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"image-toolbox/backend/model"
)

func createTestPNG(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	for y := 0; y < 10; y++ {
		for x := 0; x < 10; x++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	f, _ := os.Create(path)
	defer f.Close()
	png.Encode(f, img)
}

func TestRunLocalBatch(t *testing.T) {
	dir := t.TempDir()
	outDir := filepath.Join(dir, "out")
	os.Mkdir(outDir, 0755)
	createTestPNG(t, filepath.Join(dir, "a.png"))
	createTestPNG(t, filepath.Join(dir, "b.png"))

	req := model.BatchRequest{
		SourcePaths: []string{
			filepath.Join(dir, "a.png"),
			filepath.Join(dir, "b.png"),
		},
		OutputDir:        outDir,
		ConvertTo:        "jpg",
		PreserveOriginal: true,
	}

	progressCh := make(chan model.ProgressUpdate, 10)
	result := RunLocalBatch(context.Background(), req, progressCh)
	close(progressCh)

	if result.Total != 2 {
		t.Errorf("expected total 2, got %d", result.Total)
	}
	if result.Success != 2 {
		t.Errorf("expected success 2, got %d", result.Success)
	}
	if result.Failed != 0 {
		t.Errorf("expected failed 0, got %d", result.Failed)
	}
}

package ai

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func createTestPNGFile(t *testing.T, path string) {
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

func TestEncodeImageToBase64(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.png")
	createTestPNGFile(t, path)

	data, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(data, "data:image/png;base64,") {
		t.Errorf("expected data URI prefix, got %s", data[:30])
	}
	if len(data) < 100 {
		t.Errorf("encoded data too short: %d", len(data))
	}
}

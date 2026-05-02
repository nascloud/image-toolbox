package image

import (
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func createTestImage(t *testing.T, path string, width, height int) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	f, _ := os.Create(path)
	defer f.Close()
	png.Encode(f, img)
}

func TestConvertToJPEG(t *testing.T) {
	src := filepath.Join(t.TempDir(), "test.png")
	out := filepath.Join(t.TempDir(), "test.jpg")
	createTestImage(t, src, 100, 100)

	converted, err := ConvertImage(src, out, "jpg", nil)
	if err != nil {
		t.Fatal(err)
	}
	if converted != out {
		t.Errorf("expected path %s, got %s", out, converted)
	}

	f, _ := os.Open(out)
	defer f.Close()
	_, err = jpeg.Decode(f)
	if err != nil {
		t.Fatal("decoding converted jpeg:", err)
	}
}

func TestConvertToPNG(t *testing.T) {
	src := filepath.Join(t.TempDir(), "test.jpg")
	out := filepath.Join(t.TempDir(), "test.png")
	createTestImage(t, src, 100, 100)

	converted, err := ConvertImage(src, out, "png", nil)
	if err != nil {
		t.Fatal(err)
	}
	if converted != out {
		t.Errorf("expected path %s, got %s", out, converted)
	}

	f, _ := os.Open(out)
	defer f.Close()
	_, err = png.Decode(f)
	if err != nil {
		t.Fatal("decoding converted png:", err)
	}
}

func TestConvertUnsupportedFormat(t *testing.T) {
	src := filepath.Join(t.TempDir(), "test.png")
	out := filepath.Join(t.TempDir(), "test.bmp")
	createTestImage(t, src, 100, 100)

	_, err := ConvertImage(src, out, "bmp", nil)
	if err == nil {
		t.Error("expected error for unsupported format, got nil")
	}
}

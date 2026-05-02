package image

import (
	"image"
	"image/color"
	"testing"
)

func createSolidImage(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{100, 150, 200, 255})
		}
	}
	return img
}

func TestResizeByRatio(t *testing.T) {
	img := createSolidImage(t, 200, 100)
	opts := ResizeOptions{Mode: ResizeModeRatio, Value: 0.5}
	result := ResizeImage(img, opts)
	bounds := result.Bounds()
	if bounds.Dx() != 100 || bounds.Dy() != 50 {
		t.Errorf("expected 100x50, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

func TestResizeByDimensions(t *testing.T) {
	img := createSolidImage(t, 200, 100)
	opts := ResizeOptions{Mode: ResizeModeDimensions, Width: 50, Height: 50}
	result := ResizeImage(img, opts)
	bounds := result.Bounds()
	if bounds.Dx() != 50 || bounds.Dy() != 50 {
		t.Errorf("expected 50x50, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

func TestResizeMaxEdge(t *testing.T) {
	img := createSolidImage(t, 200, 100)
	opts := ResizeOptions{Mode: ResizeModeMaxEdge, MaxEdge: 100}
	result := ResizeImage(img, opts)
	bounds := result.Bounds()
	if bounds.Dx() != 100 || bounds.Dy() != 50 {
		t.Errorf("expected 100x50, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

func TestResizePreservesAspectRatio(t *testing.T) {
	img := createSolidImage(t, 300, 200)
	opts := ResizeOptions{Mode: ResizeModeMaxEdge, MaxEdge: 150}
	result := ResizeImage(img, opts)
	bounds := result.Bounds()
	if bounds.Dx() != 150 || bounds.Dy() != 100 {
		t.Errorf("expected 150x100, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

func TestResizeUpscale(t *testing.T) {
	img := createSolidImage(t, 50, 50)
	opts := ResizeOptions{Mode: ResizeModeRatio, Value: 2.0}
	result := ResizeImage(img, opts)
	bounds := result.Bounds()
	if bounds.Dx() != 100 || bounds.Dy() != 100 {
		t.Errorf("expected 100x100, got %dx%d", bounds.Dx(), bounds.Dy())
	}
}

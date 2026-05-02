package image

import (
	"image"
	"image/color"
	"testing"
)

func createTestImageForSlice(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{100, 150, 200, 255})
		}
	}
	return img
}

func TestSliceImageCount(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 25, 1.0, 1.0)
	if len(slices) != 25 {
		t.Errorf("expected 25 slices, got %d", len(slices))
	}
}

func TestSliceHeightsSum(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 10, 1.0, 1.0)
	totalH := 0
	for _, s := range slices {
		totalH += s.Bounds().Dy()
	}
	if totalH != 300 {
		t.Errorf("expected total height 300, got %d", totalH)
	}
}

func TestSliceMinHeight(t *testing.T) {
	img := createTestImageForSlice(t, 100, 60)
	slices := SliceImage(img, 10, 1.0, 1.0)
	for i, s := range slices {
		if s.Bounds().Dy() < 1 {
			t.Errorf("slice %d has height %d", i, s.Bounds().Dy())
		}
	}
}

func TestSliceWidthPreserved(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 5, 1.0, 1.0)
	for i, s := range slices {
		if s.Bounds().Dx() != 200 {
			t.Errorf("slice %d width = %d, want 200", i, s.Bounds().Dx())
		}
	}
}

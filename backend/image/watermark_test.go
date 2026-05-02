package image

import (
	"image"
	"image/color"
	"testing"
)

func createWMImage(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{100, 150, 200, 255})
		}
	}
	return img
}

func createWatermarkPattern(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{255, 255, 255, 200})
		}
	}
	return img
}

func TestImageWatermarkTiled(t *testing.T) {
	base := createWMImage(t, 200, 200)
	wm := createWatermarkPattern(t, 50, 50)
	result := AddImageWatermark(base, wm, 0.5, "tile")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed: %dx%d", result.Bounds().Dx(), result.Bounds().Dy())
	}
}

func TestImageWatermarkCentered(t *testing.T) {
	base := createWMImage(t, 200, 200)
	wm := createWatermarkPattern(t, 50, 50)
	result := AddImageWatermark(base, wm, 0.5, "center")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed")
	}
}

func TestTextWatermark(t *testing.T) {
	base := createWMImage(t, 200, 200)
	result := AddTextWatermark(base, "Test", 0.5, "bottomRight", 12, "#ffffff")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed")
	}
}

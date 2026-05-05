package ai

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"
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

	resized, err := resizeImageBytes(buf.Bytes(), 20, "png")
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

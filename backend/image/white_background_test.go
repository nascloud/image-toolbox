package image

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func TestAnalyzeWhiteBackground(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "product.png")
	writeWhiteBackgroundTestImage(t, path, color.RGBA{255, 255, 255, 255}, color.RGBA{30, 60, 90, 255})

	result, err := AnalyzeWhiteBackground(path, DefaultWhiteBackgroundOptions())
	if err != nil {
		t.Fatalf("AnalyzeWhiteBackground() error = %v", err)
	}
	if !result.IsWhiteBackground {
		t.Fatalf("IsWhiteBackground = false, score=%v", result.Score)
	}
	if result.BorderWhiteRatio < 0.95 || result.ForegroundRatio <= 0.03 {
		t.Fatalf("unexpected ratios: %+v", result)
	}
}

func TestAnalyzeWhiteBackgroundRejectsScene(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "scene.png")
	writeWhiteBackgroundTestImage(t, path, color.RGBA{60, 90, 70, 255}, color.RGBA{150, 90, 55, 255})

	result, err := AnalyzeWhiteBackground(path, DefaultWhiteBackgroundOptions())
	if err != nil {
		t.Fatalf("AnalyzeWhiteBackground() error = %v", err)
	}
	if result.IsWhiteBackground {
		t.Fatalf("scene classified as white background: %+v", result)
	}
}

func TestSamplePositionsIncludesBothEdges(t *testing.T) {
	positions := samplePositions(0, 100000, 391)
	if len(positions) < 2 || positions[0] != 0 || positions[len(positions)-1] != 99999 {
		t.Fatalf("sample positions do not include both edges: first=%d last=%d", positions[0], positions[len(positions)-1])
	}
}

func TestAnalyzeWhiteBackgroundRejectsEmptyCanvas(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "empty.png")
	writeWhiteBackgroundTestImage(t, path, color.White, color.White)

	result, err := AnalyzeWhiteBackground(path, DefaultWhiteBackgroundOptions())
	if err != nil {
		t.Fatalf("AnalyzeWhiteBackground() error = %v", err)
	}
	if result.IsWhiteBackground {
		t.Fatalf("empty canvas classified as product image: %+v", result)
	}
}

func writeWhiteBackgroundTestImage(t *testing.T, path string, border, center color.Color) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 120, 120))
	for y := 0; y < 120; y++ {
		for x := 0; x < 120; x++ {
			pixel := border
			if x > 30 && x < 90 && y > 24 && y < 98 {
				pixel = center
			}
			img.Set(x, y, pixel)
		}
	}
	output, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer output.Close()
	if err := png.Encode(output, img); err != nil {
		t.Fatal(err)
	}
}

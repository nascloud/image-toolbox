package ai

import (
	"bytes"
	"encoding/base64"
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
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	defer file.Close()
	if err := png.Encode(file, img); err != nil {
		t.Fatal(err)
	}
}

func TestEncodeImageToBase64KeepsNormalImageUnchanged(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.png")
	createTestPNGFile(t, path)
	original, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}

	value, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(value, "data:image/png;base64,") {
		t.Fatalf("expected PNG data URI, got %.30s", value)
	}
	encoded := strings.TrimPrefix(value, "data:image/png;base64,")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != string(original) {
		t.Fatal("normal image should pass through without re-encoding")
	}
}

func TestEncodeImageToBase64PreprocessesOversizedDimensions(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "oversized.png")
	img := image.NewRGBA(image.Rect(0, 0, aiLargeImageMaxLongEdge+1, 1))
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

	value, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(value, "data:image/jpeg;base64,") {
		t.Fatalf("expected oversized image to become JPEG, got %.30s", value)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, "data:image/jpeg;base64,"))
	if err != nil {
		t.Fatal(err)
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(decoded))
	if err != nil {
		t.Fatal(err)
	}
	if format != "jpeg" {
		t.Fatalf("expected JPEG output, got %s", format)
	}
	if config.Width > aiLargeImageMaxLongEdge || config.Height > aiLargeImageMaxLongEdge {
		t.Fatalf("image was not resized: %dx%d", config.Width, config.Height)
	}
}

func TestEncodeImageToBase64OversizedTransparentImageUsesWhiteBackground(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "transparent.png")
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
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
	padding := make([]byte, aiLargeImageMaxBytes+1)
	file, err = os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(padding); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	value, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimPrefix(value, "data:image/jpeg;base64,"))
	if err != nil {
		t.Fatal(err)
	}
	result, _, err := image.Decode(bytes.NewReader(decoded))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := result.At(0, 0).RGBA()
	if r < 0xf000 || g < 0xf000 || b < 0xf000 {
		t.Fatalf("expected white background, got rgb16=(%d,%d,%d)", r, g, b)
	}
}

func TestEncodeImageToBase64PreprocessesOversizedFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large-file.png")
	createTestPNGFile(t, path)
	padding := make([]byte, aiLargeImageMaxBytes+1)
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_APPEND, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(padding); err != nil {
		file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}

	value, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(value, "data:image/jpeg;base64,") {
		t.Fatalf("expected oversized file to become JPEG, got %.30s", value)
	}
}

package file

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"

	"image-toolbox/backend/model"
)

func TestScanBuyerShowSetsParentMode(t *testing.T) {
	root := t.TempDir()
	setTwo := filepath.Join(root, "产品2")
	setTen := filepath.Join(root, "产品10")
	if err := os.MkdirAll(setTwo, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(setTen, 0755); err != nil {
		t.Fatal(err)
	}
	writeBuyerShowScanImage(t, filepath.Join(setTwo, "01-white.png"), color.White, color.RGBA{30, 60, 90, 255})
	writeBuyerShowScanImage(t, filepath.Join(setTwo, "02-scene.png"), color.RGBA{60, 90, 70, 255}, color.RGBA{120, 80, 50, 255})
	writeBuyerShowScanImage(t, filepath.Join(setTen, "scene.png"), color.RGBA{50, 80, 60, 255}, color.RGBA{140, 90, 50, 255})
	if err := os.WriteFile(filepath.Join(setTwo, "评价.txt"), []byte("  很好用，实际效果不错。\r\n"), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := ScanBuyerShowSets(modelScanRequest(root, "parent"))
	if err != nil {
		t.Fatalf("ScanBuyerShowSets() error = %v", err)
	}
	if len(result.Sets) != 2 {
		t.Fatalf("sets = %d, want 2", len(result.Sets))
	}
	if result.Sets[0].Name != "产品2" {
		t.Fatalf("first set = %q", result.Sets[0].Name)
	}
	if len(result.Sets[0].Slots) != 6 {
		t.Fatalf("slots = %d", len(result.Sets[0].Slots))
	}
	if result.Sets[0].Slots[0].SourcePath == "" {
		t.Fatal("white slot was not assigned")
	}
	if result.Sets[0].Slots[1].SourcePath == "" {
		t.Fatal("buyer slot was not assigned")
	}
	if result.Sets[0].BasisMode != "" {
		t.Fatalf("basis mode = %q, want empty", result.Sets[0].BasisMode)
	}
	if result.Sets[0].ReviewText != "很好用，实际效果不错。" {
		t.Fatalf("review = %q", result.Sets[0].ReviewText)
	}
}

func TestScanBuyerShowSetsSingleStableID(t *testing.T) {
	dir := t.TempDir()
	writeBuyerShowScanImage(t, filepath.Join(dir, "scene.png"), color.RGBA{40, 80, 60, 255}, color.RGBA{120, 80, 50, 255})
	first, err := ScanBuyerShowSets(modelScanRequest(dir, "single"))
	if err != nil {
		t.Fatal(err)
	}
	second, err := ScanBuyerShowSets(modelScanRequest(dir, "single"))
	if err != nil {
		t.Fatal(err)
	}
	if first.Sets[0].ID != second.Sets[0].ID {
		t.Fatalf("unstable IDs: %q != %q", first.Sets[0].ID, second.Sets[0].ID)
	}
}

func modelScanRequest(root, mode string) model.BuyerShowScanRequest {
	return model.BuyerShowScanRequest{RootPath: root, Mode: mode}
}

func writeBuyerShowScanImage(t *testing.T, path string, border, center color.Color) {
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

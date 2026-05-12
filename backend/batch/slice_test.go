package batch

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"image-toolbox/backend/model"
)

func TestRunSliceBatchUsesSortableOriginalNameSuffix(t *testing.T) {
	dir := t.TempDir()
	outDir := filepath.Join(dir, "out")
	src := filepath.Join(dir, "photo.png")
	createTestPNG(t, src)

	req := model.SliceRequest{
		SourcePaths: []string{src},
		OutputDir:   outDir,
		SliceMode:   "count",
		SliceCount:  3,
		Contrast:    1,
		Saturation:  1,
	}

	result := RunSliceBatch(context.Background(), req, nil)
	if result.Success != 1 {
		t.Fatalf("expected success 1, got result: %+v", result)
	}

	expected := []string{
		filepath.Join(outDir, "photo_S001.png"),
		filepath.Join(outDir, "photo_S002.png"),
		filepath.Join(outDir, "photo_S003.png"),
	}
	for _, path := range expected {
		if _, err := os.Stat(path); err != nil {
			t.Fatalf("expected slice output %s to exist: %v", path, err)
		}
	}
	if result.Results[0].OutputPath != expected[0] {
		t.Fatalf("expected first output path %s, got %s", expected[0], result.Results[0].OutputPath)
	}
}

func TestRunSliceBatchByHeight(t *testing.T) {
	dir := t.TempDir()
	outDir := filepath.Join(dir, "out")
	src := filepath.Join(dir, "photo.png")
	createTestPNG(t, src)

	req := model.SliceRequest{
		SourcePaths: []string{src},
		OutputDir:   outDir,
		SliceMode:   "height",
		SliceHeight: 100,
		Contrast:    1,
		Saturation:  1,
	}

	result := RunSliceBatch(context.Background(), req, nil)
	if result.Success != 1 {
		t.Fatalf("expected success 1, got result: %+v", result)
	}

	// Test image is 10x10; sliceHeight=100 exceeds image height → 1 slice of 10px
	expected := filepath.Join(outDir, "photo_S001.png")
	if _, err := os.Stat(expected); err != nil {
		t.Fatalf("expected slice output %s to exist: %v", expected, err)
	}
}

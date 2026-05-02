package batch

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// RunSliceBatch processes images with the slicing operation.
func RunSliceBatch(req model.SliceRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	jobFn := func(srcPath string) (string, error) {
		f, err := os.Open(srcPath)
		if err != nil {
			return "", fmt.Errorf("open: %w", err)
		}
		defer f.Close()

		img, _, err := image.Decode(f)
		if err != nil {
			return "", fmt.Errorf("decode: %w", err)
		}

		slices := backendImage.SliceImage(img, req.SliceCount, req.Contrast, req.Saturation)
		if len(slices) == 0 {
			return "", fmt.Errorf("slice returned 0 slices")
		}

		base := filepath.Base(srcPath)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)

		for i, slice := range slices {
			outPath := filepath.Join(req.OutputDir, fmt.Sprintf("%s_slice_%d.png", name, i+1))
			if err := savePNG(slice, outPath); err != nil {
				return "", fmt.Errorf("save slice %d: %w", i, err)
			}
		}
		return filepath.Join(req.OutputDir, fmt.Sprintf("%s_slice_1.png", name)), nil
	}

	results := RunConcurrent(req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}

func savePNG(img image.Image, path string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}

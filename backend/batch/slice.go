package batch

import (
	"context"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"image-toolbox/backend/file"
	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// RunSliceBatch processes images with the slicing operation.
func RunSliceBatch(ctx context.Context, req model.SliceRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	basePaths := uniqueOutputPaths(req.SourcePaths, func(srcPath string) string {
		return file.ResolveOutputPath(srcPath, req.OutputDir, req.SaveMode, req.PrefixName, req.SubdirName, "png", "")
	})

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

		// Use the resolved base output path to derive all slice filenames.
		basePath := basePaths[srcPath]
		outDir := filepath.Dir(basePath)
		outBase := strings.TrimSuffix(filepath.Base(basePath), ".png")

		for i, slice := range slices {
			outPath := sliceOutputPath(outDir, outBase, i+1)
			if err := savePNG(slice, outPath); err != nil {
				return "", fmt.Errorf("save slice %d: %w", i, err)
			}
		}
		return sliceOutputPath(outDir, outBase, 1), nil
	}

	results := RunConcurrent(ctx, req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}

func sliceOutputPath(outDir, outBase string, index int) string {
	return filepath.Join(outDir, fmt.Sprintf("%s_S%03d.png", outBase, index))
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

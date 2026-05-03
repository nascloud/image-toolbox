package batch

import (
	"context"
	"os"
	"path/filepath"
	"strings"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/file"
	"image-toolbox/backend/model"
)

// RunLocalBatch processes a batch of images with convert/resize operations.
func RunLocalBatch(ctx context.Context, req model.BatchRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	jobFn := func(srcPath string) (string, error) {
		var ext string
		if req.ConvertTo != "" {
			ext = req.ConvertTo
		} else {
			baseName := filepath.Base(srcPath)
			ext = strings.TrimPrefix(filepath.Ext(baseName), ".")
		}

		// _resized suffix only for custom mode resize (backward compat)
		suffix := ""
		if (req.SaveMode == "" || req.SaveMode == "custom") && req.ConvertTo == "" && req.ResizeMode != "" {
			suffix = "_resized"
		}

		outPath := file.ResolveOutputPath(srcPath, req.OutputDir, req.SaveMode, req.PrefixName, req.SubdirName, ext, suffix)

		var resizeOpts *backendImage.ResizeOptions
		switch req.ResizeMode {
		case "ratio":
			resizeOpts = &backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeRatio, Value: req.ResizeValue,
			}
		case "dimensions":
			resizeOpts = &backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeDimensions, Width: req.ResizeWidth, Height: req.ResizeHeight,
			}
		case "maxEdge":
			resizeOpts = &backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeMaxEdge, MaxEdge: int(req.ResizeValue),
			}
		case "width":
			resizeOpts = &backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeWidth, Width: req.ResizeWidth,
			}
		}

		outDir := filepath.Dir(outPath)
		if err := os.MkdirAll(outDir, 0755); err != nil {
			return "", err
		}

		resultPath, err := backendImage.ConvertImage(srcPath, outPath, ext, resizeOpts)
		if err != nil {
			return "", err
		}

		// Remove original only in overwrite mode
		if req.SaveMode == "overwrite" {
			os.Remove(srcPath)
		}

		return resultPath, nil
	}

	results := RunConcurrent(ctx, req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}

// aggregateResults summarises a slice of ImageResult into a BatchResult.
func aggregateResults(results []model.ImageResult) model.BatchResult {
	successCount := 0
	failedCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failedCount++
		}
	}
	return model.BatchResult{
		Total:   len(results),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	}
}

package batch

import (
	"context"
	"fmt"
	"image"
	"os"
	"path/filepath"
	"strings"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// RunWatermarkBatch processes images with watermark operation.
func RunWatermarkBatch(ctx context.Context, req model.WatermarkRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	var wmImage image.Image
	if req.WatermarkImage != "" {
		f, err := os.Open(req.WatermarkImage)
		if err != nil {
			return model.BatchResult{Error: fmt.Sprintf("open watermark image: %v", err)}
		}
		defer f.Close()
		wmImage, _, err = image.Decode(f)
		if err != nil {
			return model.BatchResult{Error: fmt.Sprintf("decode watermark image: %v", err)}
		}
	}

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

		// Apply uniform input width if specified
		workingImg := img
		if req.UniformWidth > 0 {
			workingImg = backendImage.ResizeImage(img, backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeMaxEdge, MaxEdge: req.UniformWidth,
			})
		}

		var result *image.RGBA
		if wmImage != nil {
			result = backendImage.AddImageWatermark(workingImg, wmImage, req.Opacity, req.Position)
		} else if req.WatermarkText != "" {
			result = backendImage.AddTextWatermark(workingImg, req.WatermarkText, req.Opacity, req.Position, req.FontSize, req.FontColor)
		} else {
			return "", fmt.Errorf("no watermark image or text provided")
		}

		// Apply uniform output width if specified
		outputImg := result
		if req.OutputWidth > 0 {
			resized := backendImage.ResizeImage(result, backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeMaxEdge, MaxEdge: req.OutputWidth,
			})
			outputImg = image.NewRGBA(resized.Bounds())
			for y := 0; y < resized.Bounds().Dy(); y++ {
				for x := 0; x < resized.Bounds().Dx(); x++ {
					outputImg.Set(x, y, resized.At(x, y))
				}
			}
		}

		base := filepath.Base(srcPath)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		outPath := filepath.Join(req.OutputDir, name+"_watermarked.png")

		if err := savePNG(outputImg, outPath); err != nil {
			return "", fmt.Errorf("save: %w", err)
		}
		return outPath, nil
	}

	results := RunConcurrent(ctx, req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}

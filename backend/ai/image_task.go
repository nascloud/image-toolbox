package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"

	"image-toolbox/backend/model"
)

// ProcessSingleImage handles one image through the AI generation pipeline.
func ProcessSingleImage(client *Client, srcPath, outputDir string, opts model.AIBatchRequest) (string, error) {
	outPaths, err := ProcessSingleImagesWithContext(context.Background(), client, srcPath, outputDir, opts, "")
	if err != nil {
		return "", err
	}
	if len(outPaths) == 0 {
		return "", nil
	}
	return outPaths[0], nil
}

// ProcessSingleImageWithContext handles one image through the AI generation pipeline.
func ProcessSingleImageWithContext(ctx context.Context, client *Client, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) (string, error) {
	outPaths, err := ProcessSingleImagesWithContext(ctx, client, srcPath, outputDir, opts, outputPath)
	if err != nil {
		return "", err
	}
	if len(outPaths) == 0 {
		return "", nil
	}
	return outPaths[0], nil
}

// ProcessSingleImagesWithContext handles one image through the AI generation pipeline and saves every returned image.
func ProcessSingleImagesWithContext(ctx context.Context, client *Client, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) ([]string, error) {
	caps := CapabilitiesForModel(opts.Model)
	effectiveOutputFormat := EffectiveOutputFormat(opts.Model, opts.OutputFormat)

	var imgData string
	var refs []string
	if caps.SupportsImageInput {
		var err error
		imgData, err = EncodeImageToBase64(srcPath)
		if err != nil {
			return nil, fmt.Errorf("encode input: %w", err)
		}

		for _, refPath := range opts.ReferenceImages {
			refData, err := EncodeImageToBase64(refPath)
			if err != nil {
				return nil, fmt.Errorf("encode reference %s: %w", refPath, err)
			}
			refs = append(refs, refData)
		}
	}

	req := model.AIImageRequest{
		Model:                     opts.Model,
		Prompt:                    BuildPrompt(opts.Prompt),
		Size:                      opts.Size,
		Image:                     imgData,
		ReferenceImages:           refs,
		Seed:                      opts.Seed,
		OutputFormat:              effectiveOutputFormat,
		Watermark:                 opts.Watermark,
		GuidanceScale:             opts.GuidanceScale,
		ResponseFormat:            opts.ResponseFormat,
		Stream:                    opts.Stream,
		SequentialImageGeneration: opts.SequentialImageGeneration,
		MaxImages:                 opts.MaxImages,
		OptimizePromptMode:        opts.OptimizePromptMode,
		WebSearch:                 opts.WebSearch,
	}

	resp, err := client.GenerateWithContext(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("API call: %w", err)
	}

	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no images returned")
	}

	outExt := ".png"
	if effectiveOutputFormat == "jpeg" {
		outExt = ".jpg"
	}

	outPaths := make([]string, 0, len(resp.Data))
	for idx, item := range resp.Data {
		if item.Error != nil {
			if len(outPaths) == 0 {
				return nil, fmt.Errorf("generation error: %s", item.Error.Message)
			}
			continue
		}

		imageData, err := responseImageBytes(ctx, item.URL, item.B64JSON)
		if err != nil {
			if len(outPaths) == 0 {
				return nil, err
			}
			continue
		}

		if opts.DownloadWidth > 0 {
			resized, err := resizeImageBytes(imageData, opts.DownloadWidth, effectiveOutputFormat)
			if err != nil {
				if len(outPaths) == 0 {
					return nil, fmt.Errorf("resize download: %w", err)
				}
				continue
			}
			imageData = resized
		}

		outPath := indexedOutputPath(srcPath, outputDir, outputPath, outExt, idx)
		if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
			return nil, fmt.Errorf("create output dir: %w", err)
		}

		if err := os.WriteFile(outPath, imageData, 0644); err != nil {
			if len(outPaths) == 0 {
				return nil, fmt.Errorf("save: %w", err)
			}
			continue
		}
		outPaths = append(outPaths, outPath)
	}

	if len(outPaths) == 0 {
		return nil, fmt.Errorf("no images saved")
	}

	return outPaths, nil
}

func responseImageBytes(ctx context.Context, url, b64JSON string) ([]byte, error) {
	if url != "" {
		data, err := DownloadImageWithContext(ctx, url)
		if err != nil {
			return nil, fmt.Errorf("download: %w", err)
		}
		return data, nil
	}
	if b64JSON != "" {
		b64 := b64JSON
		if idx := strings.Index(b64, ","); idx >= 0 {
			b64 = b64[idx+1:]
		}
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return nil, fmt.Errorf("decode b64: %w", err)
		}
		return data, nil
	}
	return nil, fmt.Errorf("no image data in response")
}

func indexedOutputPath(srcPath, outputDir, firstOutputPath, outExt string, idx int) string {
	outPath := firstOutputPath
	if outPath == "" {
		base := filepath.Base(srcPath)
		name := strings.TrimSuffix(base, filepath.Ext(base))
		outPath = filepath.Join(outputDir, name+"_ai"+outExt)
	}
	if idx == 0 {
		return outPath
	}
	ext := filepath.Ext(outPath)
	base := strings.TrimSuffix(outPath, ext)
	return fmt.Sprintf("%s_%02d%s", base, idx+1, ext)
}

func resizeImageBytes(data []byte, targetWidth int, outputFormat string) ([]byte, error) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}
	if targetWidth <= 0 || img.Bounds().Dx() == targetWidth {
		return data, nil
	}

	bounds := img.Bounds()
	ratio := float64(targetWidth) / float64(bounds.Dx())
	targetHeight := int(float64(bounds.Dy())*ratio + 0.5)
	if targetHeight < 1 {
		targetHeight = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), img, bounds, draw.Over, nil)

	var buf bytes.Buffer
	if outputFormat == "jpeg" {
		if err := jpeg.Encode(&buf, dst, &jpeg.Options{Quality: 95}); err != nil {
			return nil, fmt.Errorf("encode jpeg: %w", err)
		}
	} else {
		if err := png.Encode(&buf, dst); err != nil {
			return nil, fmt.Errorf("encode png: %w", err)
		}
	}
	return buf.Bytes(), nil
}

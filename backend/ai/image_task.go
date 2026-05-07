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
	return ProcessSingleImageWithContext(context.Background(), client, srcPath, outputDir, opts, "")
}

// ProcessSingleImageWithContext handles one image through the AI generation pipeline.
func ProcessSingleImageWithContext(ctx context.Context, client *Client, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) (string, error) {
	caps := CapabilitiesForModel(opts.Model)
	effectiveOutputFormat := EffectiveOutputFormat(opts.Model, opts.OutputFormat)

	var imgData string
	var refs []string
	if caps.SupportsImageInput {
		var err error
		imgData, err = EncodeImageToBase64(srcPath)
		if err != nil {
			return "", fmt.Errorf("encode input: %w", err)
		}

		for _, refPath := range opts.ReferenceImages {
			refData, err := EncodeImageToBase64(refPath)
			if err != nil {
				return "", fmt.Errorf("encode reference %s: %w", refPath, err)
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
		return "", fmt.Errorf("API call: %w", err)
	}

	if len(resp.Data) == 0 {
		return "", fmt.Errorf("no images returned")
	}

	first := resp.Data[0]
	if first.Error != nil {
		return "", fmt.Errorf("generation error: %s", first.Error.Message)
	}

	var imageData []byte
	if first.URL != "" {
		data, err := DownloadImageWithContext(ctx, first.URL)
		if err != nil {
			return "", fmt.Errorf("download: %w", err)
		}
		imageData = data
	} else if first.B64JSON != "" {
		b64 := first.B64JSON
		if idx := strings.Index(b64, ","); idx >= 0 {
			b64 = b64[idx+1:]
		}
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return "", fmt.Errorf("decode b64: %w", err)
		}
		imageData = data
	} else {
		return "", fmt.Errorf("no image data in response")
	}

	outExt := ".png"
	if effectiveOutputFormat == "jpeg" {
		outExt = ".jpg"
	}
	if opts.DownloadWidth > 0 {
		resized, err := resizeImageBytes(imageData, opts.DownloadWidth, effectiveOutputFormat)
		if err != nil {
			return "", fmt.Errorf("resize download: %w", err)
		}
		imageData = resized
	}

	outPath := outputPath
	if outPath == "" {
		base := filepath.Base(srcPath)
		name := strings.TrimSuffix(base, filepath.Ext(base))
		outPath = filepath.Join(outputDir, name+"_ai"+outExt)
	}

	if err := os.MkdirAll(filepath.Dir(outPath), 0755); err != nil {
		return "", fmt.Errorf("create output dir: %w", err)
	}

	if err := os.WriteFile(outPath, imageData, 0644); err != nil {
		return "", fmt.Errorf("save: %w", err)
	}

	return outPath, nil
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

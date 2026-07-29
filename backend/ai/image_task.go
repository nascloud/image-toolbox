package ai

import (
	"context"
	"encoding/base64"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"image-toolbox/backend/model"
)

// ProcessSingleImage handles one image through the AI generation pipeline.
func ProcessSingleImage(provider Provider, srcPath, outputDir string, opts model.AIBatchRequest) (string, error) {
	outPaths, err := ProcessSingleImagesWithContext(context.Background(), provider, srcPath, outputDir, opts, "")
	if err != nil {
		return "", err
	}
	if len(outPaths) == 0 {
		return "", nil
	}
	return outPaths[0], nil
}

// ProcessSingleImageWithContext handles one image through the AI generation pipeline with a context.
func ProcessSingleImageWithContext(ctx context.Context, provider Provider, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) (string, error) {
	outPaths, err := ProcessSingleImagesWithContext(ctx, provider, srcPath, outputDir, opts, outputPath)
	if err != nil {
		return "", err
	}
	if len(outPaths) == 0 {
		return "", nil
	}
	return outPaths[0], nil
}

// ProcessSingleImagesWithContext handles one image through the AI generation pipeline and saves every returned image.
func ProcessSingleImagesWithContext(ctx context.Context, provider Provider, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) ([]string, error) {
	caps := ProviderCapabilities(provider, opts.Model)
	if !caps.SupportsImageInput {
		return nil, fmt.Errorf("model %s does not support image input", opts.Model)
	}

	var imgData string
	var refs []string
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

	outExt := outputFileExtension(caps, opts.OutputFormat)

	req := model.AIImageRequest{
		Model:                     opts.Model,
		Prompt:                    BuildPrompt(opts.Prompt),
		NegativePrompt:            opts.NegativePrompt,
		Size:                      opts.Size,
		Quality:                   opts.Quality,
		Image:                     imgData,
		ReferenceImages:           refs,
		Seed:                      opts.Seed,
		OutputFormat:              opts.OutputFormat,
		Watermark:                 opts.Watermark,
		GuidanceScale:             opts.GuidanceScale,
		ResponseFormat:            opts.ResponseFormat,
		Stream:                    opts.Stream,
		SequentialImageGeneration: opts.SequentialImageGeneration,
		MaxImages:                 opts.MaxImages,
		OptimizePromptMode:        opts.OptimizePromptMode,
		WebSearch:                 opts.WebSearch,
		N:                         opts.N,
	}

	resp, err := provider.Generate(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("API call: %w", err)
	}

	if len(resp.Data) == 0 {
		return nil, fmt.Errorf("no images returned")
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

		outPath := withImageDataExtension(indexedOutputPath(srcPath, outputDir, outputPath, outExt, idx), imageData)
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

func ProviderCapabilities(provider Provider, modelID string) model.ModelCapabilities {
	return provider.ModelCapabilities(modelID)
}

func outputFileExtension(caps model.ModelCapabilities, requestedFormat string) string {
	if requestedFormat == "png" || (requestedFormat == "" && caps.DefaultOutputFormat == "png") {
		return ".png"
	}
	return ".jpg"
}

func withImageDataExtension(path string, imageData []byte) string {
	ext := extensionForImageBytes(imageData)
	if ext == "" || strings.EqualFold(filepath.Ext(path), ext) {
		return path
	}
	base := strings.TrimSuffix(path, filepath.Ext(path))
	return base + ext
}

func extensionForImageBytes(imageData []byte) string {
	contentType := http.DetectContentType(imageData)
	switch contentType {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ""
	}
}

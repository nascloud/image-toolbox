package ai

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"image-toolbox/backend/model"
)

// ProcessSingleImage handles one image through the AI generation pipeline.
func ProcessSingleImage(client *Client, srcPath, outputDir string, opts model.AIBatchRequest) (string, error) {
	imgData, err := EncodeImageToBase64(srcPath)
	if err != nil {
		return "", fmt.Errorf("encode input: %w", err)
	}

	var refs []string
	for _, refPath := range opts.ReferenceImages {
		refData, err := EncodeImageToBase64(refPath)
		if err != nil {
			return "", fmt.Errorf("encode reference %s: %w", refPath, err)
		}
		refs = append(refs, refData)
	}

	req := model.AIImageRequest{
		Model:           opts.Model,
		Prompt:          BuildPrompt(opts.Prompt),
		Size:            opts.Size,
		Image:           imgData,
		ReferenceImages: refs,
		Seed:            opts.Seed,
		OutputFormat:    opts.OutputFormat,
		Watermark:       opts.Watermark,
		GuidanceScale:   opts.GuidanceScale,
	}

	resp, err := client.Generate(req)
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
		data, err := DownloadImage(first.URL)
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
	if opts.OutputFormat == "jpeg" {
		outExt = ".jpg"
	}

	base := filepath.Base(srcPath)
	name := strings.TrimSuffix(base, filepath.Ext(base))
	outPath := filepath.Join(outputDir, name+"_ai"+outExt)

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return "", fmt.Errorf("create output dir: %w", err)
	}

	if err := os.WriteFile(outPath, imageData, 0644); err != nil {
		return "", fmt.Errorf("save: %w", err)
	}

	return outPath, nil
}

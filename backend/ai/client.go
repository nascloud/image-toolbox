package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"image-toolbox/backend/model"
)

const defaultBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
const defaultTimeout = 120 * time.Second

// Client handles communication with the AI image generation API.
type Client struct {
	BaseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new AI API client.
func NewClient(apiKey string) *Client {
	return &Client{
		BaseURL: defaultBaseURL,
		apiKey:  apiKey,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

// Generate sends an image generation request and returns the response.
func (c *Client) Generate(req model.AIImageRequest) (*model.AIImageResponse, error) {
	return c.GenerateWithContext(context.Background(), req)
}

// GenerateWithContext sends an image generation request bound to ctx.
func (c *Client) GenerateWithContext(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	caps := CapabilitiesForModel(req.Model)
	body := map[string]any{
		"model":     req.Model,
		"prompt":    req.Prompt,
		"watermark": req.Watermark,
	}

	if req.Size != "" {
		if isPixelSize(req.Size) || caps.AllowedSizes[req.Size] {
			body["size"] = req.Size
		}
	}

	if req.Stream && caps.SupportsStream {
		body["stream"] = req.Stream
	}

	// Response format
	if req.ResponseFormat != "" {
		body["response_format"] = req.ResponseFormat
	} else {
		body["response_format"] = "url"
	}

	// Image and reference images
	if req.Image != "" && caps.SupportsImageInput {
		if len(req.ReferenceImages) > 0 {
			images := append([]string{req.Image}, req.ReferenceImages...)
			body["image"] = images
		} else {
			body["image"] = req.Image
		}
	}

	// Seed
	if req.Seed >= -1 && caps.SupportsGuidanceScale {
		body["seed"] = req.Seed
	}

	// Output format
	if req.OutputFormat != "" && caps.SupportsOutputFormat {
		body["output_format"] = req.OutputFormat
	}

	// Guidance scale is only accepted by Seedream 3.0 text-to-image models.
	if req.GuidanceScale > 0 && caps.SupportsGuidanceScale {
		body["guidance_scale"] = req.GuidanceScale
	}

	// Sequential image generation (组图)
	if req.SequentialImageGeneration != "" && req.SequentialImageGeneration != "disabled" && caps.SupportsSequential {
		body["sequential_image_generation"] = req.SequentialImageGeneration
		if req.MaxImages > 0 {
			maxImages := req.MaxImages
			if inputCount := 1 + len(req.ReferenceImages); inputCount > 0 {
				if allowed := 15 - inputCount; allowed > 0 && maxImages > allowed {
					maxImages = allowed
				}
			}
			body["sequential_image_generation_options"] = map[string]int{
				"max_images": maxImages,
			}
		}
	}

	// Optimize prompt mode
	if req.OptimizePromptMode != "" && req.OptimizePromptMode != "standard" {
		if req.OptimizePromptMode == "fast" && caps.SupportsFastPromptOptimize {
			body["optimize_prompt_options"] = map[string]string{
				"mode": req.OptimizePromptMode,
			}
		}
	}

	// Web search (tools)
	if req.WebSearch && caps.SupportsWebSearch {
		body["tools"] = []map[string]string{
			{"type": "web_search"},
		}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/images/generations", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var result model.AIImageResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		if result.Error != nil {
			return nil, fmt.Errorf("API error (%s): %s", result.Error.Code, result.Error.Message)
		}
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	return &result, nil
}

// DownloadImage downloads an image from URL and returns the bytes.
func DownloadImage(url string) ([]byte, error) {
	return DownloadImageWithContext(context.Background(), url)
}

// DownloadImageWithContext downloads an image from URL and returns the bytes.
func DownloadImageWithContext(ctx context.Context, url string) ([]byte, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create download request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read download: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download HTTP %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

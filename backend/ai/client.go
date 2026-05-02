package ai

import (
	"bytes"
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
	body := map[string]any{
		"model":          req.Model,
		"prompt":         req.Prompt,
		"size":           req.Size,
		"stream":         req.Stream,
		"watermark":      req.Watermark,
	}

	// Response format
	if req.ResponseFormat != "" {
		body["responseFormat"] = req.ResponseFormat
	} else {
		body["responseFormat"] = "url"
	}

	// Image and reference images
	if req.Image != "" {
		if len(req.ReferenceImages) > 0 {
			images := append([]string{req.Image}, req.ReferenceImages...)
			body["image"] = images
		} else {
			body["image"] = req.Image
		}
	}

	// Seed
	if req.Seed > 0 {
		body["seed"] = req.Seed
	}

	// Output format
	if req.OutputFormat != "" {
		body["output_format"] = req.OutputFormat
	}

	// Guidance scale
	if req.GuidanceScale > 0 {
		body["guidance_scale"] = req.GuidanceScale
	}

	// Sequential image generation (组图)
	if req.SequentialImageGeneration != "" && req.SequentialImageGeneration != "disabled" {
		body["sequential_image_generation"] = req.SequentialImageGeneration
		if req.MaxImages > 0 {
			body["sequential_image_generation_options"] = map[string]int{
				"max_images": req.MaxImages,
			}
		}
	}

	// Optimize prompt mode
	if req.OptimizePromptMode != "" && req.OptimizePromptMode != "standard" {
		body["optimize_prompt_options"] = map[string]string{
			"mode": req.OptimizePromptMode,
		}
	}

	// Web search (tools)
	if req.WebSearch {
		body["tools"] = []map[string]string{
			{"type": "web_search"},
		}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.BaseURL+"/images/generations", bytes.NewReader(payload))
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
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read download: %w", err)
	}
	return data, nil
}

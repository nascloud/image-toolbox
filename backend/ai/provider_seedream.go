package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"image-toolbox/backend/model"
)

// ---------------------------------------------------------------------------
// SeedreamProvider — new implementation
// ---------------------------------------------------------------------------

type SeedreamProvider struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func NewSeedreamProvider(apiKey, baseURL string) *SeedreamProvider {
	if baseURL == "" {
		baseURL = DefaultSeedreamBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &SeedreamProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

func (p *SeedreamProvider) Name() string { return ProviderSeedream }

func (p *SeedreamProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	caps := seedreamCapabilities(req.Model)

	body := map[string]any{
		"model":     req.Model,
		"prompt":    req.Prompt,
		"watermark": req.Watermark,
	}

	if req.Size != "" {
		sizesMap := allowedSizesMap(caps.AllowedSizes)
		if isPixelSize(req.Size) || sizesMap[req.Size] {
			body["size"] = req.Size
		}
	}

	if req.Stream && caps.SupportsStream {
		body["stream"] = req.Stream
	}

	if req.ResponseFormat != "" {
		body["response_format"] = req.ResponseFormat
	} else {
		body["response_format"] = "url"
	}

	if req.Image != "" && caps.SupportsImageInput {
		if len(req.ReferenceImages) > 0 {
			images := append([]string{req.Image}, req.ReferenceImages...)
			body["image"] = images
		} else {
			body["image"] = req.Image
		}
	}

	if req.Seed >= -1 && caps.SupportsSeed {
		body["seed"] = req.Seed
	}

	if req.OutputFormat != "" && caps.SupportsOutputFormat {
		body["output_format"] = req.OutputFormat
	}

	if req.GuidanceScale > 0 && caps.SupportsGuidanceScale {
		body["guidance_scale"] = req.GuidanceScale
	}

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

	if req.OptimizePromptMode != "" && req.OptimizePromptMode != "standard" {
		if req.OptimizePromptMode == "fast" && caps.SupportsFastPromptOptimize {
			body["optimize_prompt_options"] = map[string]string{
				"mode": req.OptimizePromptMode,
			}
		}
	}

	if req.WebSearch && caps.SupportsWebSearch {
		body["tools"] = []map[string]string{
			{"type": "web_search"},
		}
	}

	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/images/generations", bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
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

func (p *SeedreamProvider) Models() []model.ModelInfo {
	infos := make([]model.ModelInfo, len(seedreamModelDefs))
	for i, def := range seedreamModelDefs {
		infos[i] = model.ModelInfo{ID: def.id, Capabilities: def.caps}
	}
	return infos
}

func seedreamCapabilities(modelName string) model.ModelCapabilities {
	normalized := strings.ToLower(modelName)
	var best model.ModelCapabilities
	var bestLen int
	for _, def := range seedreamModelDefs {
		if strings.Contains(normalized, def.pattern) && len(def.pattern) > bestLen {
			best = def.caps
			bestLen = len(def.pattern)
		}
	}
	if bestLen > 0 {
		return best
	}
	return model.ModelCapabilities{DefaultOutputFormat: "jpeg"}
}

var seedreamModelDefs = []struct {
	pattern string
	id      string
	caps    model.ModelCapabilities
}{
	{
		pattern: "5-0",
		id:      "doubao-seedream-5-0-260128",
		caps: model.ModelCapabilities{
			SupportsImageInput:   true,
			SupportsSequential:   true,
			SupportsStream:       true,
			SupportsSeed:         true,
			SupportsOutputFormat: true,
			SupportsWebSearch:    true,
			SupportsWatermark:    true,
			DefaultOutputFormat:  "jpeg",
			AllowedSizes:         []string{"1K", "2K", "3K"},
		},
	},
	{
		pattern: "4-5",
		id:      "doubao-seedream-4-5-250130",
		caps: model.ModelCapabilities{
			SupportsImageInput:  true,
			SupportsSequential:  true,
			SupportsStream:      true,
			SupportsSeed:        true,
			SupportsWatermark:   true,
			DefaultOutputFormat: "jpeg",
			AllowedSizes:        []string{"1K", "2K", "3K", "4K"},
		},
	},
	{
		pattern: "4-0",
		id:      "doubao-seedream-4-0-250130",
		caps: model.ModelCapabilities{
			SupportsImageInput:         true,
			SupportsSequential:         true,
			SupportsStream:             true,
			SupportsSeed:               true,
			SupportsWatermark:          true,
			SupportsFastPromptOptimize: true,
			DefaultOutputFormat:        "jpeg",
			AllowedSizes:               []string{"1K", "2K", "3K", "4K"},
		},
	},
	{
		pattern: "3-0-t2i",
		id:      "doubao-seedream-3-0-t2i-250115",
		caps: model.ModelCapabilities{
			SupportsGuidanceScale: true,
			DefaultOutputFormat:   "jpeg",
			AllowedSizes:          []string{"2K", "3K"},
		},
	},
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

func allowedSizesMap(sizes []string) map[string]bool {
	m := make(map[string]bool, len(sizes))
	for _, s := range sizes {
		m[s] = true
	}
	return m
}

func isPixelSize(size string) bool {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return false
	}
	return parts[0] != "" && parts[1] != ""
}

// ---------------------------------------------------------------------------
// Backward-compatible wrappers (used by image_task.go / batch/ai.go)
// These will be removed in Tasks 7, 8.

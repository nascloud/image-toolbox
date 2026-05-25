package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"image-toolbox/backend/model"
)

const modelsCacheTTL = 10 * time.Minute

type ChatGPT2APIProvider struct {
	apiKey       string
	baseURL      string
	httpClient   *http.Client
	mu           sync.RWMutex
	cachedModels []model.ModelInfo
	lastFetch    time.Time
}

func NewChatGPT2APIProvider(apiKey, baseURL string) *ChatGPT2APIProvider {
	if baseURL == "" {
		baseURL = DefaultChatGPT2APIBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &ChatGPT2APIProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

func (p *ChatGPT2APIProvider) Name() string {
	return ProviderChatGPT2API
}

func (p *ChatGPT2APIProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	if req.Image == "" {
		return p.generateGenerations(ctx, req)
	}
	return p.generateEdits(ctx, req)
}

func (p *ChatGPT2APIProvider) generateGenerations(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	body := map[string]any{
		"model":  req.Model,
		"prompt": req.Prompt,
	}

	n := req.N
	if n < 1 {
		n = 1
	}
	if n > 4 {
		n = 4
	}
	body["n"] = n

	if req.Size != "" {
		body["size"] = req.Size
	}

	body["response_format"] = "b64_json"

	return p.doRequest(ctx, p.baseURL+"/v1/images/generations", body)
}

func (p *ChatGPT2APIProvider) generateEdits(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	body := map[string]any{
		"model":  req.Model,
		"prompt": req.Prompt,
	}

	images := make([]map[string]string, 0, 1+len(req.ReferenceImages))
	if req.Image != "" {
		images = append(images, map[string]string{"image_url": req.Image})
	}
	for _, ref := range req.ReferenceImages {
		images = append(images, map[string]string{"image_url": ref})
	}

	if len(images) > 0 {
		body["images"] = images
	}

	if req.Size != "" {
		body["size"] = req.Size
	}

	return p.doRequest(ctx, p.baseURL+"/v1/images/edits", body)
}

func (p *ChatGPT2APIProvider) doRequest(ctx context.Context, url string, body map[string]any) (*model.AIImageResponse, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewReader(payload))
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

func (p *ChatGPT2APIProvider) Models() []model.ModelInfo {
	p.mu.RLock()
	if p.cachedModels != nil && time.Since(p.lastFetch) < modelsCacheTTL {
		defer p.mu.RUnlock()
		return cloneModels(p.cachedModels)
	}
	p.mu.RUnlock()

	models, err := p.fetchModels()
	if err != nil {
		models = p.staticModels()
	}

	p.mu.Lock()
	p.cachedModels = models
	p.lastFetch = time.Now()
	p.mu.Unlock()

	return cloneModels(models)
}

func (p *ChatGPT2APIProvider) fetchModels() ([]model.ModelInfo, error) {
	req, err := http.NewRequest("GET", p.baseURL+"/v1/models", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	var models []model.ModelInfo
	for _, item := range result.Data {
		models = append(models, model.ModelInfo{
			ID:           item.ID,
			Capabilities: chatgpt2apiCapabilities(item.ID),
		})
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("no models returned")
	}

	return models, nil
}

func (p *ChatGPT2APIProvider) staticModels() []model.ModelInfo {
	return []model.ModelInfo{
		{
			ID:           "gpt-image-2",
			Capabilities: chatgpt2apiCapabilities("gpt-image-2"),
		},
		{
			ID:           "gpt-image-2-auto",
			Capabilities: chatgpt2apiCapabilities("gpt-image-2-auto"),
		},
		{
			ID:           "gpt-5-image-preview",
			Capabilities: chatgpt2apiCapabilities("gpt-5-image-preview"),
		},
	}
}

func chatgpt2apiCapabilities(modelID string) model.ModelCapabilities {
	normalized := strings.ToLower(modelID)

	if strings.Contains(normalized, "gpt-image-2") {
		return model.ModelCapabilities{
			SupportsImageInput: true,
			SupportsEdits:      true,
			SupportsN:          true,
			NMax:               4,
		}
	}

	if strings.Contains(normalized, "gpt-5") {
		return model.ModelCapabilities{
			SupportsN: true,
			NMax:      4,
		}
	}

	return model.ModelCapabilities{
		SupportsN: true,
		NMax:      4,
	}
}

func cloneModels(models []model.ModelInfo) []model.ModelInfo {
	result := make([]model.ModelInfo, len(models))
	copy(result, models)
	return result
}

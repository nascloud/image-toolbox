package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"strings"
	"sync"
	"time"

	"image-toolbox/backend/model"
)

const modelsCacheTTL = 10 * time.Minute

type OpenAIProvider struct {
	apiKey       string
	baseURL      string
	httpClient   *http.Client
	mu           sync.RWMutex
	cachedModels []model.ModelInfo
	lastFetch    time.Time
}

func NewOpenAIProvider(apiKey, baseURL string) *OpenAIProvider {
	if baseURL == "" {
		baseURL = DefaultOpenAIBaseURL
	}
	baseURL = strings.TrimSuffix(baseURL, "/")
	return &OpenAIProvider{
		apiKey:  apiKey,
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

func (p *OpenAIProvider) Name() string {
	return ProviderOpenAI
}

func (p *OpenAIProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	if req.Image == "" {
		return p.generateGenerations(ctx, req)
	}
	return p.generateEdits(ctx, req)
}

func (p *OpenAIProvider) generateGenerations(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	body, err := openAIFields(req)
	if err != nil {
		return nil, err
	}
	return p.doRequest(ctx, p.endpoint("images/generations"), body)
}

func (p *OpenAIProvider) generateEdits(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	fields, err := openAIFields(req)
	if err != nil {
		return nil, err
	}
	for key, value := range fields {
		if err := w.WriteField(key, multipartFieldValue(value)); err != nil {
			return nil, fmt.Errorf("write %s field: %w", key, err)
		}
	}

	if req.Image == "" {
		return nil, fmt.Errorf("input image is required for edits")
	}
	mimeType, rawData, err := decodeDataURI(req.Image)
	if err != nil {
		return nil, fmt.Errorf("decode input image: %w", err)
	}
	if len(rawData) == 0 {
		return nil, fmt.Errorf("decode input image: empty data")
	}
	part, err := createImageFormFile(w, "image[]", "input"+extensionForMime(mimeType), mimeType)
	if err != nil {
		return nil, fmt.Errorf("create input image field: %w", err)
	}
	if _, err := part.Write(rawData); err != nil {
		return nil, fmt.Errorf("write input image: %w", err)
	}

	for idx, ref := range req.ReferenceImages {
		refMimeType, refData, err := decodeDataURI(ref)
		if err != nil {
			return nil, fmt.Errorf("decode reference image %d: %w", idx+1, err)
		}
		if len(refData) == 0 {
			return nil, fmt.Errorf("decode reference image %d: empty data", idx+1)
		}
		refPart, err := createImageFormFile(w, "image[]", fmt.Sprintf("ref_%02d%s", idx+1, extensionForMime(refMimeType)), refMimeType)
		if err != nil {
			return nil, fmt.Errorf("create reference image %d field: %w", idx+1, err)
		}
		if _, err := refPart.Write(refData); err != nil {
			return nil, fmt.Errorf("write reference image %d: %w", idx+1, err)
		}
	}

	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.endpoint("images/edits"), &b)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", w.FormDataContentType())
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

	return parseOpenAIResponse(resp.StatusCode, respBody)
}

func (p *OpenAIProvider) doRequest(ctx context.Context, url string, body map[string]any) (*model.AIImageResponse, error) {
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

	return parseOpenAIResponse(resp.StatusCode, respBody)
}

func parseOpenAIResponse(statusCode int, respBody []byte) (*model.AIImageResponse, error) {
	var result model.AIImageResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		body := strings.TrimSpace(string(respBody))
		if body == "" {
			body = "<empty response>"
		}
		if len(body) > 500 {
			body = body[:500] + "..."
		}
		if statusCode != http.StatusOK {
			return nil, fmt.Errorf("HTTP %d: non-JSON response: %s", statusCode, body)
		}
		return nil, fmt.Errorf("API returned non-JSON response: %s", body)
	}

	if statusCode != http.StatusOK {
		if result.Error != nil {
			return nil, fmt.Errorf("API error (%s): %s", result.Error.Code, result.Error.Message)
		}
		return nil, fmt.Errorf("HTTP %d: %s", statusCode, strings.TrimSpace(string(respBody)))
	}

	return &result, nil
}

func (p *OpenAIProvider) Models(ctx context.Context) ([]model.ModelInfo, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	p.mu.RLock()
	if p.cachedModels != nil && time.Since(p.lastFetch) < modelsCacheTTL {
		defer p.mu.RUnlock()
		return cloneModels(p.cachedModels), nil
	}
	p.mu.RUnlock()

	models, err := p.fetchModels(ctx)
	if err != nil {
		models = p.staticModels()
	}

	p.mu.Lock()
	p.cachedModels = models
	p.lastFetch = time.Now()
	p.mu.Unlock()

	return cloneModels(models), nil
}

func (p *OpenAIProvider) ModelCapabilities(modelID string) model.ModelCapabilities {
	return openAICapabilities(modelID)
}

func (p *OpenAIProvider) endpoint(path string) string {
	baseURL := strings.TrimRight(p.baseURL, "/")
	path = strings.TrimLeft(path, "/")
	if strings.HasSuffix(baseURL, "/v1") {
		return baseURL + "/" + path
	}
	return baseURL + "/v1/" + path
}

func (p *OpenAIProvider) fetchModels(ctx context.Context) ([]model.ModelInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.endpoint("models"), nil)
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
		if strings.TrimSpace(item.ID) == "" {
			continue
		}
		models = append(models, model.ModelInfo{
			ID:           item.ID,
			Capabilities: openAICapabilities(item.ID),
		})
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("no models returned")
	}

	return models, nil
}

func (p *OpenAIProvider) staticModels() []model.ModelInfo {
	ids := []string{
		"gpt-image-2",
		"codex-gpt-image-2",
		"auto",
		"gpt-5",
		"gpt-5-1",
		"gpt-5-2",
		"gpt-5-3",
		"gpt-5-3-mini",
		"gpt-5-mini",
	}
	models := make([]model.ModelInfo, len(ids))
	for i, id := range ids {
		models[i] = model.ModelInfo{
			ID:           id,
			Capabilities: openAICapabilities(id),
		}
	}
	return models
}

func openAICapabilities(modelID string) model.ModelCapabilities {
	normalized := strings.ToLower(modelID)

	switch {
	case strings.Contains(normalized, "gpt-image-2"),
		strings.Contains(normalized, "codex-gpt-image-2"):
		return model.ModelCapabilities{
			SupportsImageInput:   true,
			SupportsEdits:        true,
			SupportsOutputFormat: true,
			SupportsN:            true,
			DefaultOutputFormat:  "png",
			AllowedSizes:         []string{"auto", "1:1", "3:4", "4:3", "16:9", "9:16", "3:2", "2:3", "21:9"},
			NMax:                 10,
		}

	case strings.Contains(normalized, "gpt-5"):
		return model.ModelCapabilities{
			SupportsImageInput:   true,
			SupportsEdits:        true,
			SupportsOutputFormat: true,
			SupportsN:            true,
			DefaultOutputFormat:  "png",
			AllowedSizes:         []string{"auto", "1:1", "3:4", "4:3", "16:9", "9:16", "3:2", "2:3", "21:9"},
			NMax:                 10,
		}

	default:
		return model.ModelCapabilities{
			SupportsOutputFormat: true,
			SupportsN:            true,
			DefaultOutputFormat:  "png",
			AllowedSizes:         []string{"auto", "1:1", "3:4", "4:3", "16:9", "9:16", "3:2", "2:3", "21:9"},
			NMax:                 10,
		}
	}
}

func openAIFields(req model.AIImageRequest) (map[string]any, error) {
	prompt, err := openAIPrompt(req.Prompt, req.Size)
	if err != nil {
		return nil, err
	}

	body := map[string]any{
		"model":  req.Model,
		"prompt": prompt,
	}
	if strings.TrimSpace(req.NegativePrompt) != "" {
		body["negative_prompt"] = req.NegativePrompt
	}

	if req.N != 0 {
		body["n"] = clampN(req.N)
	}
	if req.Quality != "" {
		body["quality"] = req.Quality
	}
	if req.OutputFormat != "" {
		body["output_format"] = req.OutputFormat
	}
	if req.Stream {
		body["stream"] = true
	}
	if req.ResponseFormat != "" && !isGPTImageModel(req.Model) {
		body["response_format"] = req.ResponseFormat
	}

	return body, nil
}

func openAIPrompt(prompt, aspectRatio string) (string, error) {
	normalized, ok, err := normalizeOpenAIAspectRatio(aspectRatio)
	if err != nil {
		return "", err
	}
	if !ok {
		return prompt, nil
	}
	return fmt.Sprintf("%s\n\nAspect ratio: %s.", prompt, normalized), nil
}

func normalizeOpenAIAspectRatio(aspectRatio string) (string, bool, error) {
	value := strings.ToLower(strings.ReplaceAll(strings.TrimSpace(aspectRatio), " ", ""))
	value = strings.ReplaceAll(value, "x", ":")
	if value == "" || value == "auto" {
		return "", false, nil
	}
	if !strings.Contains(value, ":") {
		return "", false, nil
	}
	parts := strings.SplitN(value, ":", 2)
	if len(parts) != 2 {
		return "", false, fmt.Errorf("invalid aspect ratio: %s", aspectRatio)
	}
	w, errW := strconv.ParseFloat(parts[0], 64)
	h, errH := strconv.ParseFloat(parts[1], 64)
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return "", false, fmt.Errorf("invalid aspect ratio: %s", aspectRatio)
	}
	ratio := w / h
	if ratio > 3 || ratio < 1.0/3.0 {
		return "", false, fmt.Errorf("gpt-image-2 requires aspect ratio between 1:3 and 3:1")
	}
	return value, true, nil
}

func isGPTImageModel(modelID string) bool {
	return strings.HasPrefix(strings.ToLower(modelID), "gpt-image-")
}

func multipartFieldValue(value any) string {
	switch v := value.(type) {
	case string:
		return v
	case bool:
		if v {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(v)
	default:
		data, err := json.Marshal(value)
		if err != nil {
			return fmt.Sprint(value)
		}
		return string(data)
	}
}

func createImageFormFile(w *multipart.Writer, fieldName, fileName, mimeType string) (io.Writer, error) {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, escapeQuotes(fieldName), escapeQuotes(fileName)))
	if strings.TrimSpace(mimeType) == "" {
		mimeType = "application/octet-stream"
	}
	header.Set("Content-Type", mimeType)
	return w.CreatePart(header)
}

func escapeQuotes(value string) string {
	return strings.NewReplacer("\\", "\\\\", `"`, "\\\"").Replace(value)
}

// clampN clamps n to the standard image API range [1, 10].
func clampN(n int) int {
	if n < 1 {
		return 1
	}
	if n > 10 {
		return 10
	}
	return n
}

// decodeDataURI parses a data URI like "data:image/png;base64,iVBOR..." and
// returns the MIME type and raw bytes.
func decodeDataURI(uri string) (string, []byte, error) {
	if !strings.HasPrefix(uri, "data:") {
		return "", nil, fmt.Errorf("not a data URI")
	}

	comma := strings.Index(uri, ",")
	if comma < 0 {
		return "", nil, fmt.Errorf("invalid data URI")
	}

	header := uri[5:comma] // skip "data:"
	encoded := uri[comma+1:]

	// Parse MIME type and optional base64 marker
	mimeType := "image/png"
	if header != "" {
		parts := strings.SplitN(header, ";", 2)
		mimeType = parts[0]
	}

	raw, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", nil, fmt.Errorf("decode base64: %w", err)
	}

	return mimeType, raw, nil
}

func extensionForMime(mimeType string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/gif":
		return ".gif"
	default:
		return ".png"
	}
}

func cloneModels(models []model.ModelInfo) []model.ModelInfo {
	result := make([]model.ModelInfo, len(models))
	copy(result, models)
	return result
}

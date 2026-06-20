package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"strconv"
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

	if size := resolveChatGPT2APISize(req.Quality, req.Size); size != "" {
		body["size"] = size
	}

	body["response_format"] = "b64_json"

	if req.Stream {
		body["stream"] = true
	}

	return p.doRequest(ctx, p.baseURL+"/v1/images/generations", body)
}

func (p *ChatGPT2APIProvider) generateEdits(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)

	// Text fields
	if err := w.WriteField("model", req.Model); err != nil {
		return nil, fmt.Errorf("write model field: %w", err)
	}
	if err := w.WriteField("prompt", req.Prompt); err != nil {
		return nil, fmt.Errorf("write prompt field: %w", err)
	}
	nStr := strconv.Itoa(clampN(req.N))
	if err := w.WriteField("n", nStr); err != nil {
		return nil, fmt.Errorf("write n field: %w", err)
	}
	if err := w.WriteField("response_format", "b64_json"); err != nil {
		return nil, fmt.Errorf("write response_format field: %w", err)
	}

	if size := resolveChatGPT2APISize(req.Quality, req.Size); size != "" {
		if err := w.WriteField("size", size); err != nil {
			return nil, fmt.Errorf("write size field: %w", err)
		}
	}

	if req.Stream {
		if err := w.WriteField("stream", "true"); err != nil {
			return nil, fmt.Errorf("write stream field: %w", err)
		}
	}

	// Main image — decode data URI and write as file
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
	part, err := w.CreateFormFile("image", "input"+extensionForMime(mimeType))
	if err != nil {
		return nil, fmt.Errorf("create input image field: %w", err)
	}
	if _, err := part.Write(rawData); err != nil {
		return nil, fmt.Errorf("write input image: %w", err)
	}

	// Reference images — decode data URIs and write as file fields
	for idx, ref := range req.ReferenceImages {
		refMimeType, refData, err := decodeDataURI(ref)
		if err != nil {
			return nil, fmt.Errorf("decode reference image %d: %w", idx+1, err)
		}
		if len(refData) == 0 {
			return nil, fmt.Errorf("decode reference image %d: empty data", idx+1)
		}
		refPart, err := w.CreateFormFile("image", fmt.Sprintf("ref_%02d%s", idx+1, extensionForMime(refMimeType)))
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

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/v1/images/edits", &b)
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

func (p *ChatGPT2APIProvider) ModelCapabilities(modelID string) model.ModelCapabilities {
	return chatgpt2apiCapabilities(modelID)
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
		if strings.TrimSpace(item.ID) == "" {
			continue
		}
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
			Capabilities: chatgpt2apiCapabilities(id),
		}
	}
	return models
}

func chatgpt2apiCapabilities(modelID string) model.ModelCapabilities {
	normalized := strings.ToLower(modelID)

	switch {
	case strings.Contains(normalized, "gpt-image-2"),
		strings.Contains(normalized, "codex-gpt-image-2"):
		return model.ModelCapabilities{
			SupportsImageInput: true,
			SupportsEdits:      true,
			SupportsN:          true,
			NMax:               4,
		}

	case strings.Contains(normalized, "gpt-5"):
		return model.ModelCapabilities{
			SupportsImageInput: true,
			SupportsEdits:      true,
			SupportsN:          true,
			NMax:               4,
		}

	default:
		return model.ModelCapabilities{
			SupportsN: true,
			NMax:      4,
		}
	}
}

// clampN clamps n to valid range [1, 4].
func clampN(n int) int {
	if n < 1 {
		return 1
	}
	if n > 4 {
		return 4
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

// chatgpt2apiQualityTarget returns target total pixels for a given quality level.
func chatgpt2apiQualityTarget(quality string) int {
	switch strings.ToLower(quality) {
	case "low":
		return 1024 * 1024
	case "medium":
		return 2048 * 2048
	case "high":
		return 8_294_400
	default:
		return 0
	}
}

// parseRatio parses "W:H" or "WxH" into integer ratio parts.
func parseRatio(s string) (int, int) {
	if s == "" {
		return 0, 0
	}

	// Try "WxH" (pixel format) first
	if strings.Contains(s, "x") {
		parts := strings.SplitN(s, "x", 2)
		if len(parts) == 2 {
			w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
			h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
			if errW == nil && errH == nil && w > 0 && h > 0 {
				// Reduce by GCD
				g := gcd(w, h)
				return w / g, h / g
			}
		}
		return 0, 0
	}

	// Try "W:H" (ratio format)
	parts := strings.SplitN(s, ":", 2)
	if len(parts) == 2 {
		w, errW := strconv.Atoi(strings.TrimSpace(parts[0]))
		h, errH := strconv.Atoi(strings.TrimSpace(parts[1]))
		if errW == nil && errH == nil && w > 0 && h > 0 {
			g := gcd(w, h)
			return w / g, h / g
		}
	}
	return 0, 0
}

func gcd(a, b int) int {
	for b != 0 {
		a, b = b, a%b
	}
	return a
}

// round16 rounds to the nearest multiple of 16, with a minimum of 16.
func round16(v float64) float64 {
	r := math.Round(v/16) * 16
	if r < 16 {
		return 16
	}
	return r
}

// clampMax3840 scales dimensions down proportionally so neither exceeds 3840.
func clampMax3840(w, h float64) (float64, float64) {
	maxDim := math.Max(w, h)
	if maxDim <= 3840 {
		return w, h
	}
	scale := 3840 / maxDim
	return math.Floor(w*scale/16) * 16, math.Floor(h*scale/16) * 16
}

// validateConstraints checks GPT Image 2 size rules and adjusts if needed.
func validateConstraints(w, h float64, wRatio, hRatio int) (float64, float64) {
	// 1. Both ≤ 3840
	if w > 3840 || h > 3840 {
		cw, ch := clampMax3840(w, h)
		return validateConstraints(cw, ch, wRatio, hRatio)
	}

	// 2. Aspect ratio ≤ 3:1
	if math.Max(w, h)/math.Min(w, h) > 3.0 {
		maxDim := math.Max(w, h)
		minTarget := maxDim / 3.0
		if w > h {
			h = round16(minTarget)
		} else {
			w = round16(minTarget)
		}
	}

	// 3. Total pixels within [655360, 8294400]
	total := int(w * h)
	if total > 8_294_400 {
		scale := math.Sqrt(8_294_400 / float64(total))
		w, h = clampMax3840(w*scale, h*scale)
	} else if total < 655_360 {
		// Scale up until at least 655360 or max dimension hits 3840
		scale := math.Sqrt(655_360 / float64(total))
		newW := round16(w * scale)
		newH := round16(h * scale)
		if newW <= 3840 && newH <= 3840 {
			w, h = newW, newH
		}
	}

	return round16(w), round16(h)
}

// resolveChatGPT2APISize combines quality and aspect ratio into a valid pixel size for ChatGPT2API.
//
// Rules (GPT Image 2):
//   - Neither dimension may exceed 3840
//   - Both dimensions must be multiples of 16
//   - Long side / short side ≤ 3
//   - Total pixels ∈ [655360, 8294400]
//
// Priority:
//  1. quality=auto/empty or size=auto → omit size (let API decide)
//  2. size is pixel format ("WxH") → use directly
//  3. quality + ratio ("W:H") → compute pixel dimensions
func resolveChatGPT2APISize(quality, size string) string {
	if quality == "auto" || quality == "" || size == "auto" {
		return ""
	}

	// If size is already a pixel value, use it directly
	if strings.Contains(size, "x") && isPixelSize(size) {
		return size
	}

	wRatio, hRatio := parseRatio(size)
	if wRatio <= 0 || hRatio <= 0 {
		return ""
	}

	targetPixels := chatgpt2apiQualityTarget(quality)
	if targetPixels <= 0 {
		return size
	}

	// Compute scale factor: k = sqrt(targetPixels / (wRatio * hRatio))
	area := float64(wRatio * hRatio)
	k := math.Sqrt(float64(targetPixels) / area)

	w := float64(wRatio) * k
	h := float64(hRatio) * k

	// Round and validate against constraints
	w, h = validateConstraints(w, h, wRatio, hRatio)

	if w <= 0 || h <= 0 {
		return ""
	}

	return fmt.Sprintf("%dx%d", int(w), int(h))
}

func cloneModels(models []model.ModelInfo) []model.ModelInfo {
	result := make([]model.ModelInfo, len(models))
	copy(result, models)
	return result
}

# Phase 3: AI Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Tab4 (AI image generation via Volcano Engine Seedream API) + Settings page (API Key management).

**Architecture:** New `ai/` package for API calls (HTTP client, prompt builder, reference image encoder, image task processor), new `batch/ai.go` for AI batch orchestration, config file for API Key storage, new frontend pages for AI batch and settings.

**Tech Stack:** Go standard `net/http` + `encoding/json` for API calls, file-based config storage, Seedream API v3 (compatible with OpenAI image generation format).

---

## API Reference

**Endpoint:** `POST https://ark.cn-beijing.volces.com/api/v3/images/generations`
**Auth:** `Authorization: Bearer {apiKey}`
**Request body:**
```json
{
  "model": "doubao-seedream-5-0-260128",
  "prompt": "prompt text",
  "size": "2048x2048",
  "stream": false,
  "responseFormat": "url",
  "watermark": true,
  "image": "data:image/png;base64,...",
  "seed": -1,
  "output_format": "png",
  "guidance_scale": 2.5
}
```
**Response:**
```json
{
  "data": [{ "url": "...", "size": "2048x2048" }],
  "usage": { "generated_images": 1 }
}
```

---

## File Structure

### Backend (new and modified)
```
backend/
├── app/app.go                    # MODIFY: add RunAIImageBatch, SaveApiKey, GetApiKey
├── ai/
│   ├── client.go                 # CREATE: HTTP client for Volcano Engine API
│   ├── client_test.go            # CREATE: test with mock server
│   ├── prompt.go                 # CREATE: prompt construction (pure function)
│   ├── reference.go              # CREATE: image read + base64 encode
│   ├── reference_test.go         # CREATE: test encoding
│   └── image_task.go             # CREATE: single image AI task
├── batch/ai.go                   # CREATE: AI batch orchestration
├── config/
│   └── config.go                 # CREATE: API Key persistence
└── model/
    └── ai.go                     # CREATE: AI request/response DTOs
```

### Frontend (new and modified)
```
frontend/src/
├── App.tsx                       # MODIFY: add AI and Settings tabs
├── pages/
│   ├── AIBatch.tsx               # CREATE: Tab4 AI generation page
│   └── Settings.tsx              # CREATE: API Key settings
```

---

### Task 1: Model Types (model/ai.go)

**Files:**
- Create: `backend/model/ai.go`

- [ ] **Step 1: Write the file**

```go
package model

// AIImageRequest represents a request to an AI image generation API.
type AIImageRequest struct {
	Model           string   `json:"model"`
	Prompt          string   `json:"prompt"`
	Size            string   `json:"size"`
	Image           string   `json:"image,omitempty"`
	ReferenceImages []string `json:"referenceImages,omitempty"`
	Seed            int      `json:"seed,omitempty"`
	OutputFormat    string   `json:"outputFormat,omitempty"`
	Watermark       bool     `json:"watermark"`
	GuidanceScale   float64  `json:"guidanceScale,omitempty"`
}

// AIImageResult represents the result of processing one image through AI.
type AIImageResult struct {
	SourcePath string `json:"sourcePath"`
	OutputPath string `json:"outputPath,omitempty"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

// AIImageResponse represents the API response from the image generation endpoint.
type AIImageResponse struct {
	Data []struct {
		URL     string `json:"url,omitempty"`
		B64JSON string `json:"b64_json,omitempty"`
		Size    string `json:"size,omitempty"`
		Error   *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	} `json:"data"`
	Usage *struct {
		GeneratedImages int `json:"generated_images"`
		OutputTokens    int `json:"output_tokens"`
		TotalTokens     int `json:"total_tokens"`
	} `json:"usage,omitempty"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// AIBatchRequest holds AI batch processing parameters.
type AIBatchRequest struct {
	SourcePaths      []string `json:"sourcePaths"`
	OutputDir        string   `json:"outputDir"`
	Prompt           string   `json:"prompt"`
	Model            string   `json:"model"`
	Size             string   `json:"size"`
	ReferenceImages  []string `json:"referenceImages"`
	Seed             int      `json:"seed"`
	OutputFormat     string   `json:"outputFormat"`
	Watermark        bool     `json:"watermark"`
	GuidanceScale    float64  `json:"guidanceScale"`
}
```

- [ ] **Step 2: Verify package compiles**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go build ./backend/model
```

- [ ] **Step 3: Commit**

```bash
git add backend/model/ai.go
git commit -m "feat: define AI model types for image generation"
```

---

### Task 2: Config Storage (config/config.go)

**Files:**
- Create: `backend/config/config.go`
- Create: `backend/config/config_test.go`

- [ ] **Step 1: Write config_test.go**

```go
package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSaveAndLoadApiKey(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	err := SaveApiKey(cfgPath, "test-key-123")
	if err != nil {
		t.Fatal(err)
	}

	key, err := LoadApiKey(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if key != "test-key-123" {
		t.Errorf("got %q, want %q", key, "test-key-123")
	}
}

func TestLoadEmptyApiKey(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	key, err := LoadApiKey(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if key != "" {
		t.Errorf("expected empty key, got %q", key)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/config -v
```

- [ ] **Step 3: Write config.go**

```go
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type appConfig struct {
	ApiKey string `json:"apiKey"`
}

// SaveApiKey writes the API key to the config file at path.
func SaveApiKey(path, apiKey string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	cfg := appConfig{ApiKey: apiKey}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// LoadApiKey reads the API key from the config file at path.
// Returns empty string if the file does not exist.
func LoadApiKey(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", err
	}
	return cfg.ApiKey, nil
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/config -v
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/config/
git commit -m "feat: add API key config persistence"
```

---

### Task 3: AI Client (ai/client.go + ai/client_test.go)

**Files:**
- Create: `backend/ai/client.go`
- Create: `backend/ai/client_test.go`

- [ ] **Step 1: Write client_test.go**

```go
package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"image-toolbox/backend/model"
)

func TestGenerateImage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth header
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing or wrong auth header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("wrong content type")
		}

		// Decode request body
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "test-model" {
			t.Errorf("expected model test-model, got %v", req["model"])
		}
		if req["prompt"] != "test prompt" {
			t.Errorf("expected prompt 'test prompt', got %v", req["prompt"])
		}

		// Return success response
		resp := model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{URL: "http://example.com/img.png", Size: "1024x1024"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClient("test-key")
	client.BaseURL = server.URL

	req := model.AIImageRequest{
		Model:  "test-model",
		Prompt: "test prompt",
		Size:   "1024x1024",
	}

	resp, err := client.Generate(req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
	if resp.Data[0].URL != "http://example.com/img.png" {
		t.Errorf("expected URL, got %v", resp.Data[0].URL)
	}
}

func TestGenerateImageAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Error: &struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "unauthorized", Message: "Invalid API key"},
		})
	}))
	defer server.Close()

	client := NewClient("bad-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model: "test", Prompt: "test", Size: "1024x1024",
	})
	if err == nil {
		t.Fatal("expected error for unauthorized, got nil")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/ai -v
```
Expected: FAIL

- [ ] **Step 3: Write client.go**

```go
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
		"stream":         false,
		"responseFormat": "url",
		"watermark":      req.Watermark,
	}

	if req.Image != "" {
		if len(req.ReferenceImages) > 0 {
			images := append([]string{req.Image}, req.ReferenceImages...)
			body["image"] = images
		} else {
			body["image"] = req.Image
		}
	}
	if req.Seed > 0 {
		body["seed"] = req.Seed
	}
	if req.OutputFormat != "" {
		body["output_format"] = req.OutputFormat
	}
	if req.GuidanceScale > 0 {
		body["guidance_scale"] = req.GuidanceScale
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/ai -v
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai/client.go backend/ai/client_test.go
git commit -m "feat: implement AI image generation API client"
```

---

### Task 4: Prompt Builder and Reference Image Handler

**Files:**
- Create: `backend/ai/prompt.go`
- Create: `backend/ai/reference.go`
- Create: `backend/ai/reference_test.go`

- [ ] **Step 1: Write prompt.go**

```go
package ai

// BuildPrompt constructs the final prompt string.
// Currently returns the prompt as-is. Future enhancements may add
// prompt templates, style modifiers, or prompt optimization.
func BuildPrompt(prompt string) string {
	return prompt
}
```

- [ ] **Step 2: Write reference_test.go**

```go
package ai

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func createTestPNGFile(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	for y := 0; y < 10; y++ {
		for x := 0; x < 10; x++ {
			img.Set(x, y, color.RGBA{255, 0, 0, 255})
		}
	}
	f, _ := os.Create(path)
	defer f.Close()
	png.Encode(f, img)
}

func TestEncodeImageToBase64(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.png")
	createTestPNGFile(t, path)

	data, err := EncodeImageToBase64(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(data, "data:image/png;base64,") {
		t.Errorf("expected data URI prefix, got %s", data[:30])
	}
	if len(data) < 100 {
		t.Errorf("encoded data too short: %d", len(data))
	}
}
```

- [ ] **Step 3: Run test → FAIL**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/ai -v -run TestEncode
```

- [ ] **Step 4: Write reference.go**

```go
package ai

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// mimeFromExt maps file extensions to MIME types.
var mimeFromExt = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".gif":  "image/gif",
	".tiff": "image/tiff",
	".tif":  "image/tiff",
}

// EncodeImageToBase64 reads an image file and returns a data URI string.
func EncodeImageToBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}

	ext := strings.ToLower(filepath.Ext(path))
	mime := mimeFromExt[ext]
	if mime == "" {
		mime = "image/png"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
}
```

- [ ] **Step 5: Run test → PASS**

- [ ] **Step 6: Commit**

```bash
git add backend/ai/prompt.go backend/ai/reference.go backend/ai/reference_test.go
git commit -m "feat: add prompt builder and reference image encoder"
```

---

### Task 5: AI Image Task + Batch

**Files:**
- Create: `backend/ai/image_task.go`
- Create: `backend/batch/ai.go`

- [ ] **Step 1: Write image_task.go**

```go
package ai

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"image-toolbox/backend/model"
)

// ProcessSingleImage handles one image through the AI generation pipeline.
func ProcessSingleImage(client *Client, srcPath, outputDir string, opts model.AIBatchRequest) (string, error) {
	// Encode input image to base64
	imgData, err := EncodeImageToBase64(srcPath)
	if err != nil {
		return "", fmt.Errorf("encode input: %w", err)
	}

	// Encode reference images
	var refs []string
	for _, refPath := range opts.ReferenceImages {
		refData, err := EncodeImageToBase64(refPath)
		if err != nil {
			return "", fmt.Errorf("encode reference %s: %w", refPath, err)
		}
		refs = append(refs, refData)
	}

	// Build the request
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

	// Call API
	resp, err := client.Generate(req)
	if err != nil {
		return "", fmt.Errorf("API call: %w", err)
	}

	// Process results — download first generated image
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
		// Decode base64 response (strip data URI prefix if present)
		b64 := first.B64JSON
		if idx := strings.Index(b64, ","); idx >= 0 {
			b64 = b64[idx+1:]
		}
		data, err := base64StdEncoding.DecodeString(b64)
		if err != nil {
			return "", fmt.Errorf("decode b64: %w", err)
		}
		imageData = data
	} else {
		return "", fmt.Errorf("no image data in response")
	}

	// Determine output format
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

// base64StdEncoding is referenced for decoding base64 response data.
var base64StdEncoding = base64.StdEncoding
```

Wait, the import for `base64` is already in reference.go, but for image_task.go I need it too. Let me make sure the import is correct.

Actually, I realize `base64` is already imported in reference.go which is in the same package. So I can reference it in image_task.go without re-importing. But the explicit `var base64StdEncoding` isn't needed if I import `encoding/base64` directly. Let me fix this.

- [ ] **Step 2: Write batch/ai.go**

```go
package batch

import (
	"fmt"

	backendAI "image-toolbox/backend/ai"
	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

// RunAIImageBatch processes images through AI generation.
func RunAIImageBatch(req model.AIBatchRequest, configPath string, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	apiKey, err := config.LoadApiKey(configPath)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("load API key: %v", err)}
	}
	if apiKey == "" {
		return model.BatchResult{Error: "API key not configured. Go to Settings to set your API key."}
	}

	client := backendAI.NewClient(apiKey)

	// Set defaults
	if req.Model == "" {
		req.Model = "doubao-seedream-5-0-260128"
	}
	if req.Size == "" {
		req.Size = "2048x2048"
	}

	jobFn := func(srcPath string) (string, error) {
		return backendAI.ProcessSingleImage(client, srcPath, req.OutputDir, req)
	}

	results := RunConcurrent(req.SourcePaths, jobFn, 2, progressCh)
	return aggregateResults(results)
}
```

- [ ] **Step 3: Verify build**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go build ./backend/ai ./backend/batch
```

- [ ] **Step 4: Run all tests**

```bash
go test ./backend/... -count=1
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai/image_task.go backend/batch/ai.go
git commit -m "feat: add AI image task processor and batch orchestration"
```

---

### Task 6: Wails API Layer Update

**Files:**
- Modify: `backend/app/app.go`

- [ ] **Step 1: Add RunAIImageBatch, SaveApiKey, GetApiKey methods**

Read current `backend/app/app.go` and add these methods:

```go
// RunAIImageBatch processes images through AI generation.
func (a *App) RunAIImageBatch(req model.AIBatchRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}

	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	// Use default config path
	configPath := filepath.Join(getConfigDir(), "config.json")
	result := batch.RunAIImageBatch(req, configPath, progressCh)
	close(progressCh)
	return result, nil
}

// SaveApiKey persists the API key to the config file.
func (a *App) SaveApiKey(apiKey string) error {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.SaveApiKey(configPath, apiKey)
}

// GetApiKey retrieves the stored API key (masked for display).
func (a *App) GetApiKey() (string, error) {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.LoadApiKey(configPath)
}

// getConfigDir returns the path to the application config directory.
func getConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".imagetool"
	}
	return filepath.Join(home, ".imagetool")
}
```

Add imports:
```go
"os"
"path/filepath"
"image-toolbox/backend/config"
```

- [ ] **Step 2: Verify build**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go build ./backend/app
```

- [ ] **Step 3: Run all tests**

```bash
go test ./backend/... -count=1
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/app.go
git commit -m "feat: add RunAIImageBatch, SaveApiKey, GetApiKey API methods"
```

---

### Task 7: Frontend — Settings Page

**Files:**
- Create: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write Settings.tsx**

```tsx
import React, { useState, useEffect } from 'react';

export const Settings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const key = await (window as any).go.main.App.GetApiKey();
        if (key) setApiKey(key);
      } catch { /* no-op */ }
    })();
  }, []);

  const handleSave = async () => {
    try {
      await (window as any).go.main.App.SaveApiKey(apiKey);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* no-op */ }
  };

  const btnStyle: React.CSSProperties = {
    padding: '10px 32px', background: '#e94560', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    padding: '10px 14px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 24px', fontSize: 22, fontWeight: 600 }}>设置</h2>

      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
          Volcano Engine API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder="输入你的火山方舟 API Key"
          style={inputStyle}
        />
        <p style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
          API Key 仅保存在本地，不会上传到任何第三方
        </p>
      </div>

      <button onClick={handleSave} style={btnStyle}>
        {saved ? '已保存 ✓' : '保存'}
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx**

Read current `App.tsx` and add the Settings tab. The Settings tab doesn't go in the main tab bar — add a settings icon/button in the Layout, or add it as a 5th tab. For simplicity, add it as a tab:

```tsx
import { Settings } from './pages/Settings';
// ... in tabs array:
{ id: 'settings', label: '设置', component: <Settings /> },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/App.tsx
git commit -m "feat: add settings page for API key configuration"
```

---

### Task 8: Frontend — AI Batch Page

**Files:**
- Create: `frontend/src/pages/AIBatch.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write AIBatch.tsx**

```tsx
import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

const models = [
  { id: 'doubao-seedream-5-0-260128', name: 'Seedream 5.0' },
  { id: 'doubao-seedream-5-0-lite-260128', name: 'Seedream 5.0 Lite' },
  { id: 'doubao-seedream-4-5-251128', name: 'Seedream 4.5' },
  { id: 'doubao-seedream-4-0-250828', name: 'Seedream 4.0' },
  { id: 'doubao-seedream-3-0-t2i-250415', name: 'Seedream 3.0' },
];

const sizes = ['1024x1024', '2048x2048', '3072x3072', '4096x4096'];

export const AIBatch: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState(models[0].id);
  const [size, setSize] = useState('2048x2048');
  const [seed, setSeed] = useState(-1);
  const [outputFormat, setOutputFormat] = useState('png');
  const [watermark, setWatermark] = useState(true);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleSelectRefs = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result) setReferenceImages(prev => [...prev, ...result]);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch('RunAIImageBatch', {
      sourcePaths: files,
      outputDir,
      prompt,
      model,
      size,
      seed: seed >= 0 ? seed : -1,
      outputFormat,
      watermark,
      referenceImages,
    });
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 20px', background: '#0f3460', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: 80,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>AI 图片生成</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择图片文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Prompt */}
        <div>
          <label style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>提示词 (Prompt)</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '10px 14px', background: '#1a1a2e', color: '#fff',
              border: '1px solid #333', borderRadius: 6, fontSize: 14, resize: 'vertical',
              boxSizing: 'border-box', fontFamily: 'inherit' }}
            placeholder="描述你想要的图片内容..." />
        </div>

        {/* Model */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>模型</label>
          <select value={model} onChange={e => setModel(e.target.value)} style={selectStyle}>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Size */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>尺寸</label>
          <select value={size} onChange={e => setSize(e.target.value)} style={selectStyle}>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Seed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>随机种子</label>
          <input type="number" value={seed} onChange={e => setSeed(Number(e.target.value))}
            style={inputStyle} min={-1} />
          <span style={{ fontSize: 12, color: '#888' }}>-1 = 随机</span>
        </div>

        {/* Output format */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>输出格式</label>
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)} style={selectStyle}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
          </select>
        </div>

        {/* Watermark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>水印</label>
          <label style={{ fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={watermark} onChange={e => setWatermark(e.target.checked)} />
            添加 Seedream 水印
          </label>
        </div>

        {/* Reference images */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>参考图</label>
            <button onClick={handleSelectRefs} style={btnStyle}>选择参考图</button>
          </div>
          {referenceImages.length > 0 && (
            <div style={{ fontSize: 13, color: '#888' }}>
              {referenceImages.length} 张参考图
            </div>
          )}
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0 || !prompt}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '开始 AI 生成'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx**

Read current `App.tsx` and add AI page import and tab:

```tsx
import { AIBatch } from './pages/AIBatch';
// ...
{ id: 'ai', label: 'AI 生成', component: <AIBatch /> },
{ id: 'settings', label: '设置', component: <Settings /> },
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AIBatch.tsx frontend/src/App.tsx
git commit -m "feat: add AI batch generation page"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/... -count=1 -v
```
Expected: ALL PASS

- [ ] **Step 2: Build Wails binary**

```bash
cd "F:/Python/imagetool"
wails build
```
Expected: Build succeeds

- [ ] **Step 3: Verify TypeScript**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```
Expected: No errors

- [ ] **Step 4: Git status and final commit**

```bash
cd "F:/Python/imagetool"
git status
git add -A
git commit -m "chore: Phase 3 complete — AI generation"
```

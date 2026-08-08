# Multi-Provider AI Image Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the AI image generation backend to support multiple providers (Seedream + OpenAI via Sub2API) through a common Provider interface.

**Architecture:** A `Provider` interface with `Generate()` and `Models()` methods is implemented by `SeedreamProvider` (migrated from existing `client.go`) and `OpenAIProvider` (new). The `image_task.go` pipeline accepts the interface instead of a concrete client. Config is extended with per-provider API keys and base URLs, with lazy migration from the legacy single-key format. Frontend gains a provider selector with dynamic parameter rendering.

**Tech Stack:** Go 1.24, Wails v2, React + TypeScript, Volcano Engine Ark API, OpenAI-compatible API

---

### Task 1: Update shared types in model/ai.go

**Files:**
- Modify: `backend/model/ai.go`

- [ ] **Step 1: Add `ModelCapabilities`, `ModelInfo`, and `ProviderConfigResponse` structs; add `Provider` and `N` fields to `AIBatchRequest` and `AIImageRequest`**

```go
// backend/model/ai.go — add after AIImageRequest

// ModelCapabilities describes API parameters accepted by a model.
type ModelCapabilities struct {
	SupportsImageInput         bool     `json:"supportsImageInput"`
	SupportsEdits              bool     `json:"supportsEdits"`
	SupportsSequential         bool     `json:"supportsSequential"`
	SupportsStream             bool     `json:"supportsStream"`
	SupportsGuidanceScale      bool     `json:"supportsGuidanceScale"`
	SupportsOutputFormat       bool     `json:"supportsOutputFormat"`
	SupportsWebSearch          bool     `json:"supportsWebSearch"`
	SupportsFastPromptOptimize bool     `json:"supportsFastPromptOptimize"`
	SupportsSeed               bool     `json:"supportsSeed"`
	SupportsWatermark          bool     `json:"supportsWatermark"`
	SupportsN                  bool     `json:"supportsN"`
	DefaultOutputFormat        string   `json:"defaultOutputFormat"`
	AllowedSizes               []string `json:"allowedSizes"`
	NMax                       int      `json:"nMax"`
}

// ModelInfo describes a single model offered by a provider.
type ModelInfo struct {
	ID           string            `json:"id"`
	Capabilities ModelCapabilities `json:"capabilities"`
}

// ProviderConfigResponse is returned to the frontend (API key masked).
type ProviderConfigResponse struct {
	HasAPIKey bool   `json:"hasApiKey"`
	BaseURL   string `json:"baseURL"`
}
```

Add `Provider` and `N` to `AIBatchRequest`:
```go
type AIBatchRequest struct {
	Provider string `json:"provider"` // "seedream" | "openai"
	N        int    `json:"n"`        // images per request (OpenAI)
	// ... keep existing fields unchanged
}
```

Add `N` to `AIImageRequest`:
```go
type AIImageRequest struct {
	N int `json:"n,omitempty"`
	// ... keep existing fields unchanged
}
```

- [ ] **Step 2: Run tests to verify compilation**

Run: `cd F:\Python\imagetool && go build ./...`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add backend/model/ai.go
git commit -m "feat(model): add ModelCapabilities, ModelInfo, Provider and N fields"
```

---

### Task 2: Update config for multi-provider support

**Files:**
- Modify: `backend/config/config.go`
- Test: `backend/config/config_test.go`

- [ ] **Step 1: Write test for legacy config migration**

```go
// backend/config/config_test.go — add at end

func TestLegacyConfigMigration(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")
	legacy := `{"apiKey":"sk-legacy","aiOutputDir":"C:\\output"}`
	if err := os.WriteFile(cfgPath, []byte(legacy), 0644); err != nil {
		t.Fatal(err)
	}

	apiKey, baseURL, err := LoadProviderConfig(cfgPath, "seedream")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "sk-legacy" {
		t.Fatalf("expected sk-legacy, got %s", apiKey)
	}
	if baseURL == "" {
		t.Fatal("expected non-empty baseURL from default")
	}

	active, err := LoadActiveProvider(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if active != "seedream" {
		t.Fatalf("expected default seedream, got %s", active)
	}
}

func TestProviderConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	if err := SaveProviderConfig(cfgPath, "openai", "sk-new", "https://example.com"); err != nil {
		t.Fatal(err)
	}
	apiKey, baseURL, err := LoadProviderConfig(cfgPath, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "sk-new" || baseURL != "https://example.com" {
		t.Fatalf("got %s, %s", apiKey, baseURL)
	}

	if err := SaveActiveProvider(cfgPath, "openai"); err != nil {
		t.Fatal(err)
	}
	active, err := LoadActiveProvider(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if active != "openai" {
		t.Fatalf("expected openai, got %s", active)
	}

	// Verify legacy field is not written
	data, _ := os.ReadFile(cfgPath)
	if strings.Contains(string(data), `"apiKey"`) {
		t.Fatal("legacy apiKey field should be omitted after new-format save")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd F:\Python\imagetool && go test ./backend/config/ -run TestLegacyConfigMigration -v`
Expected: FAIL — functions not defined

- [ ] **Step 3: Update config.go with new struct and functions**

```go
// backend/config/config.go — replace existing content

package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type appConfig struct {
	ActiveProvider string                    `json:"activeProvider"`
	Providers      map[string]ProviderConfig `json:"providers"`
	AiOutputDir    string                    `json:"aiOutputDir"`
	ApiKey         string                    `json:"apiKey,omitempty"` // legacy
}

type ProviderConfig struct {
	ApiKey  string `json:"apiKey"`
	BaseURL string `json:"baseURL"`
}

const (
	DefaultSeedreamBaseURL    = "https://ark.cn-beijing.volces.com/api/v3"
	DefaultOpenAIBaseURL = "https://open2api.kuvms.net"
)

// SaveApiKey writes the API key to the config file at path (legacy shim).
func SaveApiKey(path, apiKey string) error {
	return SaveProviderConfig(path, "seedream", apiKey, DefaultSeedreamBaseURL)
}

// LoadApiKey reads the API key from the config file at path (legacy shim).
func LoadApiKey(path string) (string, error) {
	apiKey, _, err := LoadProviderConfig(path, "seedream")
	return apiKey, err
}

// SaveProviderConfig persists a provider's API key and base URL.
func SaveProviderConfig(path, name, apiKey, baseURL string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{
			Providers: make(map[string]ProviderConfig),
		}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	cfg.Providers[name] = ProviderConfig{ApiKey: apiKey, BaseURL: baseURL}
	return saveConfig(path, cfg)
}

// LoadProviderConfig reads a provider's API key and base URL.
// Returns defaults if config file doesn't exist.
func LoadProviderConfig(path, name string) (string, string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", "", err
	}
	p, ok := cfg.Providers[name]
	if !ok {
		return "", defaultBaseURL(name), nil
	}
	if p.BaseURL == "" {
		return p.ApiKey, defaultBaseURL(name), nil
	}
	return p.ApiKey, p.BaseURL, nil
}

// SaveActiveProvider persists the active provider name.
func SaveActiveProvider(path, name string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{
			Providers: make(map[string]ProviderConfig),
		}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	cfg.ActiveProvider = name
	return saveConfig(path, cfg)
}

// LoadActiveProvider returns the active provider name, defaulting to "seedream".
func LoadActiveProvider(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "seedream", nil
	}
	if cfg.ActiveProvider == "" {
		return "seedream", nil
	}
	return cfg.ActiveProvider, nil
}

// SaveAiOutputDir persists the AI output directory.
func SaveAiOutputDir(path, dir string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{}
	}
	cfg.AiOutputDir = dir
	return saveConfig(path, cfg)
}

// LoadAiOutputDir retrieves the stored AI output directory.
func LoadAiOutputDir(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", err
	}
	return cfg.AiOutputDir, nil
}

func defaultBaseURL(name string) string {
	switch name {
	case "openai":
		return DefaultOpenAIBaseURL
	default:
		return DefaultSeedreamBaseURL
	}
}

func loadConfig(path string) (*appConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &appConfig{}, nil
		}
		return nil, err
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	// Lazy migration: legacy apiKey -> providers["seedream"]
	if cfg.ApiKey != "" && len(cfg.Providers) == 0 {
		if cfg.Providers == nil {
			cfg.Providers = make(map[string]ProviderConfig)
		}
		cfg.Providers["seedream"] = ProviderConfig{
			ApiKey:  cfg.ApiKey,
			BaseURL: DefaultSeedreamBaseURL,
		}
	}
	return &cfg, nil
}

func saveConfig(path string, cfg *appConfig) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	// Clear legacy field on save
	cfg.ApiKey = ""
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd F:\Python\imagetool && go test ./backend/config/ -v`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/config/config.go backend/config/config_test.go
git commit -m "feat(config): multi-provider config with lazy legacy migration"
```

---

### Task 3: Define Provider interface and factory

**Files:**
- Create: `backend/ai/provider.go`

- [ ] **Step 1: Write test for factory**

```go
// backend/ai/provider_test.go

package ai

import (
	"testing"
)

func TestNewProviderSeedream(t *testing.T) {
	p, err := NewProvider("seedream", "test-key", DefaultSeedreamBaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name() != "seedream" {
		t.Fatalf("expected seedream, got %s", p.Name())
	}
}

func TestNewProviderOpenAI(t *testing.T) {
	p, err := NewProvider("openai", "test-key", DefaultOpenAIBaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name() != "openai" {
		t.Fatalf("expected openai, got %s", p.Name())
	}
}

func TestNewProviderUnknown(t *testing.T) {
	_, err := NewProvider("unknown", "test-key", "")
	if err == nil {
		t.Fatal("expected error for unknown provider")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestNewProvider -v`
Expected: FAIL — NewProvider not defined

- [ ] **Step 3: Write Provider interface and factory**

```go
// backend/ai/provider.go

package ai

import (
	"context"
	"fmt"

	"image-toolbox/backend/model"
)

const (
	ProviderSeedream    = "seedream"
	ProviderOpenAI = "openai"
)

// Provider is the common interface for AI image generation backends.
type Provider interface {
	Name() string
	Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error)
	Models() []model.ModelInfo
}

// NewProvider creates a provider by name, injecting API key and base URL.
func NewProvider(name, apiKey, baseURL string) (Provider, error) {
	switch name {
	case ProviderSeedream:
		return NewSeedreamProvider(apiKey, baseURL), nil
	case ProviderOpenAI:
		return NewOpenAIProvider(apiKey, baseURL), nil
	default:
		return nil, fmt.Errorf("unknown AI provider: %s", name)
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestNewProvider -v`
Expected: FAIL because NewSeedreamProvider and NewOpenAIProvider are not yet defined. We need stub implementations.

- [ ] **Step 5: Add minimal stubs to make factory test pass**

Add to provider_seedream.go (create file with minimal stub):
```go
package ai

import (
	"context"
	"image-toolbox/backend/model"
)

type SeedreamProvider struct {
	apiKey     string
	baseURL    string
}

func NewSeedreamProvider(apiKey, baseURL string) *SeedreamProvider {
	return &SeedreamProvider{apiKey: apiKey, baseURL: baseURL}
}

func (p *SeedreamProvider) Name() string { return ProviderSeedream }

func (p *SeedreamProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	return nil, fmt.Errorf("not yet implemented")
}

func (p *SeedreamProvider) Models() []model.ModelInfo {
	return nil
}
```

Add to provider_openai.go (create file with minimal stub):
```go
package ai

import (
	"context"
	"image-toolbox/backend/model"
)

type OpenAIProvider struct {
	apiKey     string
	baseURL    string
}

func NewOpenAIProvider(apiKey, baseURL string) *OpenAIProvider {
	return &OpenAIProvider{apiKey: apiKey, baseURL: baseURL}
}

func (p *OpenAIProvider) Name() string { return ProviderOpenAI }

func (p *OpenAIProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	return nil, fmt.Errorf("not yet implemented")
}

func (p *OpenAIProvider) Models() []model.ModelInfo {
	return nil
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestNewProvider -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/ai/provider.go backend/ai/provider_test.go backend/ai/provider_seedream.go backend/ai/provider_openai.go
git commit -m "feat(ai): add Provider interface, factory, and provider stubs"
```

---

### Task 4: Implement SeedreamProvider (migrate from client.go)

**Files:**
- Delete: `backend/ai/client.go`
- Create (replace): `backend/ai/provider_seedream.go` — full implementation
- Update: `backend/ai/provider_openai.go` — import `fmt` for stub
- Update: `backend/ai/capability.go` — migrate to return `model.ModelCapabilities`
- Modify: `backend/ai/image_task.go` — update import of `CapabilitiesForModel` to new signature

- [ ] **Step 1: Re-read existing client.go and capability.go for accurate migration**

Run: `cd F:\Python\imagetool && cat backend/ai/client.go backend/ai/capability.go`
Expected: Full content for reference

- [ ] **Step 2: Write tests for SeedreamProvider Generate**

Most of the existing `client_test.go` tests apply directly. Rename `NewClient` -> `NewSeedreamProvider`, `client.Generate` -> `provider.Generate`. Keep all test assertions the same.

```go
// backend/ai/provider_seedream_test.go

package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"image-toolbox/backend/model"
)

func TestSeedreamGenerateImage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing or wrong auth header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("wrong content type")
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "test-model" {
			t.Errorf("expected model test-model, got %v", req["model"])
		}
		if req["prompt"] != "test prompt" {
			t.Errorf("expected prompt 'test prompt', got %v", req["prompt"])
		}
		if req["response_format"] != "url" {
			t.Errorf("expected response_format url, got %v", req["response_format"])
		}
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

	p := NewSeedreamProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:  "test-model",
		Prompt: "test prompt",
		Size:   "1024x1024",
	}

	resp, err := p.Generate(nil, req)
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

func TestSeedreamGenerateAPIError(t *testing.T) {
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

	p := NewSeedreamProvider("bad-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model: "test", Prompt: "test", Size: "1024x1024",
	})
	if err == nil {
		t.Fatal("expected error for unauthorized, got nil")
	}
}

func TestSeedreamIncludesGuidanceScaleForSupportedModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req["guidance_scale"] != 2.5 {
			t.Fatalf("expected guidance_scale 2.5, got %v", req["guidance_scale"])
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model:         "doubao-seedream-3-0-t2i-250415",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsGuidanceScaleForUnsupportedModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["guidance_scale"]; ok {
			t.Fatalf("did not expect guidance_scale for unsupported model: %+v", req)
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model:         "doubao-seedream-5-0-lite-260128",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsUnsupportedOutputFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["output_format"]; ok {
			t.Fatalf("did not expect output_format for Seedream 4.5: %+v", req)
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model:        "doubao-seedream-4-5-251128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamIncludesOutputFormatForSeedream5(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req["output_format"] != "png" {
			t.Fatalf("expected output_format png, got %v", req["output_format"])
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model:        "doubao-seedream-5-0-lite-260128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsImageAndSequentialForSeedream3(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["image"]; ok {
			t.Fatalf("did not expect image for Seedream 3.0: %+v", req)
		}
		if _, ok := req["sequential_image_generation"]; ok {
			t.Fatalf("did not expect sequential_image_generation for Seedream 3.0: %+v", req)
		}
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(nil, model.AIImageRequest{
		Model:                     "doubao-seedream-3-0-t2i-250415",
		Prompt:                    "test",
		Size:                      "2K",
		Image:                     "data:image/png;base64,abc",
		ReferenceImages:           []string{"data:image/png;base64,def"},
		SequentialImageGeneration: "auto",
		MaxImages:                 4,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamModels(t *testing.T) {
	p := NewSeedreamProvider("test-key", "")
	models := p.Models()
	if len(models) == 0 {
		t.Fatal("expected at least one model")
	}
	found := false
	for _, m := range models {
		if m.ID == "doubao-seedream-5-0-260128" {
			found = true
			if !m.Capabilities.SupportsSeed {
				t.Error("Seedream 5.0 should support seed")
			}
			if !m.Capabilities.SupportsSequential {
				t.Error("Seedream 5.0 should support sequential")
			}
			if !m.Capabilities.SupportsOutputFormat {
				t.Error("Seedream 5.0 should support output format")
			}
			if !m.Capabilities.SupportsWebSearch {
				t.Error("Seedream 5.0 should support web search")
			}
		}
	}
	if !found {
		t.Fatal("expected doubao-seedream-5-0-260128 in models")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestSeedream -v`
Expected: FAIL methods not implemented

- [ ] **Step 4: Write full SeedreamProvider implementation**

```go
// backend/ai/provider_seedream.go — full implementation

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

type SeedreamProvider struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

func NewSeedreamProvider(apiKey, baseURL string) *SeedreamProvider {
	if baseURL == "" {
		baseURL = DefaultSeedreamBaseURL
	}
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
		if isPixelSize(req.Size) || caps.AllowedSizes[req.Size] {
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
	return []model.ModelInfo{
		{
			ID: "doubao-seedream-5-0-260128",
			Capabilities: model.ModelCapabilities{
				SupportsImageInput:  true,
				SupportsSequential:  true,
				SupportsStream:      true,
				SupportsSeed:        true,
				SupportsOutputFormat: true,
				SupportsWebSearch:   true,
				SupportsWatermark:   true,
				DefaultOutputFormat: "jpeg",
				AllowedSizes:        []string{"1K", "2K", "3K"},
			},
		},
		{
			ID: "doubao-seedream-4-5-250130",
			Capabilities: model.ModelCapabilities{
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
			ID: "doubao-seedream-4-0-250130",
			Capabilities: model.ModelCapabilities{
				SupportsImageInput:          true,
				SupportsSequential:          true,
				SupportsStream:              true,
				SupportsSeed:                true,
				SupportsFastPromptOptimize:  true,
				SupportsWatermark:           true,
				DefaultOutputFormat:         "jpeg",
				AllowedSizes:                []string{"1K", "2K", "3K", "4K"},
			},
		},
		{
			ID: "doubao-seedream-3-0-t2i-250115",
			Capabilities: model.ModelCapabilities{
				SupportsGuidanceScale: true,
				DefaultOutputFormat:   "jpeg",
				AllowedSizes:          []string{"2K", "3K"},
			},
		},
	}
}

// containsSize checks if a pixel-size string matches an allowed size key.
func containsSize(sizes []string, size string) bool {
	for _, s := range sizes {
		if s == size {
			return true
		}
	}
	return false
}

func isPixelSize(size string) bool {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return false
	}
	return parts[0] != "" && parts[1] != ""
}

// seedreamCapabilities is a fast lookup for Seedream model capabilities.
func seedreamCapabilities(modelID string) seedreamCaps {
	normalized := strings.ToLower(modelID)
	caps := seedreamCaps{
		SupportsImageInput:  true,
		SupportsSequential:  true,
		SupportsStream:      true,
		SupportsSeed:        true,
		SupportsWatermark:   true,
		DefaultOutputFormat: "jpeg",
		AllowedSizes:        map[string]bool{"1K": true, "2K": true, "3K": true, "4K": true},
	}

	switch {
	case strings.Contains(normalized, "3-0-t2i"):
		return seedreamCaps{
			SupportsGuidanceScale: true,
			DefaultOutputFormat:   "jpeg",
			AllowedSizes:          map[string]bool{"2K": true, "3K": true},
		}
	case strings.Contains(normalized, "5-0"):
		caps.SupportsOutputFormat = true
		caps.SupportsWebSearch = true
		caps.AllowedSizes = map[string]bool{"1K": true, "2K": true, "3K": true}
		return caps
	case strings.Contains(normalized, "4-5"):
		return caps
	case strings.Contains(normalized, "4-0"):
		caps.SupportsFastPromptOptimize = true
		return caps
	default:
		return caps
	}
}

// seedreamCaps mirrors model.ModelCapabilities but uses map[string]bool for AllowedSizes
// for efficient lookup during request building.
type seedreamCaps struct {
	SupportsImageInput         bool
	SupportsSequential         bool
	SupportsStream             bool
	SupportsGuidanceScale      bool
	SupportsOutputFormat       bool
	SupportsWebSearch          bool
	SupportsFastPromptOptimize bool
	SupportsSeed               bool
	SupportsWatermark          bool
	DefaultOutputFormat        string
	AllowedSizes               map[string]bool
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestSeedream -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/ai/provider_seedream.go backend/ai/provider_seedream_test.go
git commit -m "feat(ai): migrate client.go into SeedreamProvider"
```

- [ ] **Step 7: Delete old client.go and capability.go**

Delete `backend/ai/client.go` and `backend/ai/capability.go`.

- [ ] **Step 8: Run all ai tests**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -v`
Expected: PASS (existing tests removed, new tests pass)

- [ ] **Step 9: Commit**

```bash
git rm backend/ai/client.go backend/ai/capability.go
git commit -m "refactor(ai): remove deprecated client.go and capability.go"
```

---

### Task 5: Extract DownloadImage to shared download.go

**Files:**
- Create: `backend/ai/download.go`
- Update: `backend/ai/provider_seedream.go` — remove duplicate `DownloadImage` if any

- [ ] **Step 1: Write test for download**

The existing test `TestDownloadImageReturnsHTTPError` in `client_test.go` needs to be recreated in a new test file or moved.

```go
// backend/ai/download_test.go

package ai

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDownloadImageReturnsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("forbidden"))
	}))
	defer server.Close()

	_, err := DownloadImage(server.URL)
	if err == nil {
		t.Fatal("expected download error")
	}
	if !strings.Contains(err.Error(), "HTTP 403") {
		t.Fatalf("expected HTTP status in error, got %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestDownload -v`
Expected: FAIL — DownloadImage not defined (was removed with client.go)

- [ ] **Step 3: Write download.go**

```go
// backend/ai/download.go

package ai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestDownload -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/ai/download.go backend/ai/download_test.go
git commit -m "refactor(ai): extract DownloadImage to shared download.go"
```

---

### Task 6: Implement OpenAIProvider

**Files:**
- Modify: `backend/ai/provider_openai.go` — full implementation
- Create: `backend/ai/provider_openai_test.go`

- [ ] **Step 1: Write tests for OpenAIProvider**

```go
// backend/ai/provider_openai_test.go

package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"image-toolbox/backend/model"
)

func TestOpenAIGenerateGenerations(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/v1/images/generations") {
			t.Fatalf("expected /v1/images/generations, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing or wrong auth header")
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "gpt-image-2" {
			t.Errorf("expected model gpt-image-2, got %v", req["model"])
		}
		if req["prompt"] != "test prompt" {
			t.Errorf("expected prompt, got %v", req["prompt"])
		}
		if req["n"] != float64(2) {
			t.Errorf("expected n=2, got %v", req["n"])
		}
		if req["response_format"] != "b64_json" {
			t.Errorf("expected response_format b64_json, got %v", req["response_format"])
		}
		// Should NOT have image/edits fields
		if _, ok := req["image"]; ok {
			t.Error("did not expect image for generations")
		}
		if _, ok := req["images"]; ok {
			t.Error("did not expect images for generations")
		}

		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: "dGVzdC1pbWFnZS0x"},
				{B64JSON: "dGVzdC1pbWFnZS0y"},
			},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "test prompt",
		N:      2,
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("expected 2 results, got %d", len(resp.Data))
	}
}

func TestOpenAIGenerateEdits(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/v1/images/edits") {
			t.Fatalf("expected /v1/images/edits, got %s", r.URL.Path)
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "gpt-image-2" {
			t.Errorf("expected model gpt-image-2, got %v", req["model"])
		}
		if req["prompt"] != "edit prompt" {
			t.Errorf("expected prompt, got %v", req["prompt"])
		}
		images, ok := req["images"].([]any)
		if !ok {
			t.Fatal("expected images array")
		}
		if len(images) != 2 {
			t.Fatalf("expected 2 images, got %d", len(images))
		}
		img0 := images[0].(map[string]any)
		if _, ok := img0["image_url"]; !ok {
			t.Error("expected image_url in images[0]")
		}
		// Should NOT have n or response_format in edits JSON body
		if _, ok := req["n"]; ok {
			t.Error("did not expect n in edits request")
		}

		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: "ZWRpdGVkLWltYWdl"},
			},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:   "gpt-image-2",
		Prompt:  "edit prompt",
		Image:   "data:image/png;base64,aW5wdXQ=",
		ReferenceImages: []string{"data:image/png;base64,cmVmMQ=="},
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
}

func TestOpenAIModels(t *testing.T) {
	p := NewOpenAIProvider("test-key", "")
	models := p.Models()
	if len(models) == 0 {
		t.Fatal("expected at least one model")
	}
	found := false
	for _, m := range models {
		if m.ID == "gpt-image-2" {
			found = true
			if !m.Capabilities.SupportsImageInput {
				t.Error("gpt-image-2 should support image input")
			}
			if !m.Capabilities.SupportsEdits {
				t.Error("gpt-image-2 should support edits")
			}
			if !m.Capabilities.SupportsN {
				t.Error("gpt-image-2 should support N")
			}
			if m.Capabilities.NMax != 4 {
				t.Errorf("expected NMax 4, got %d", m.Capabilities.NMax)
			}
		}
	}
	if !found {
		t.Fatal("expected gpt-image-2 in models")
	}
}

func TestOpenAIErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "invalid_prompt",
				"message": "Prompt too long",
			},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "this is a very long prompt that will fail",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "invalid_prompt") {
		t.Fatalf("expected error code in message, got: %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestOpenAI -v`
Expected: FAIL — methods not implemented

- [ ] **Step 3: Write full OpenAIProvider implementation**

```go
// backend/ai/provider_openai.go

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

type OpenAIProvider struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	mu         sync.RWMutex
	cachedModels []model.ModelInfo
	lastFetch    time.Time
}

func NewOpenAIProvider(apiKey, baseURL string) *OpenAIProvider {
	if baseURL == "" {
		baseURL = DefaultOpenAIBaseURL
	}
	return &OpenAIProvider{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 180 * time.Second,
		},
	}
}

func (p *OpenAIProvider) Name() string { return ProviderOpenAI }

func (p *OpenAIProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	if req.Image != "" {
		return p.generateEdits(ctx, req)
	}
	return p.generateGenerations(ctx, req)
}

func (p *OpenAIProvider) generateGenerations(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	body := map[string]any{
		"model":  req.Model,
		"prompt": req.Prompt,
	}

	if req.N > 1 {
		if req.N > 4 {
			req.N = 4
		}
		body["n"] = req.N
	}
	if req.ResponseFormat != "" {
		body["response_format"] = req.ResponseFormat
	} else {
		body["response_format"] = "b64_json"
	}

	return p.doRequest(ctx, "/v1/images/generations", body)
}

func (p *OpenAIProvider) generateEdits(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	images := make([]map[string]string, 0, 1+len(req.ReferenceImages))
	images = append(images, map[string]string{"image_url": req.Image})
	for _, ref := range req.ReferenceImages {
		images = append(images, map[string]string{"image_url": ref})
	}

	body := map[string]any{
		"model":  req.Model,
		"prompt": req.Prompt,
		"images": images,
	}

	return p.doRequest(ctx, "/v1/images/edits", body)
}

func (p *OpenAIProvider) doRequest(ctx context.Context, endpoint string, body map[string]any) (*model.AIImageResponse, error) {
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.baseURL+endpoint, bytes.NewReader(payload))
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

func (p *OpenAIProvider) Models() []model.ModelInfo {
	p.mu.RLock()
	if time.Since(p.lastFetch) < 10*time.Minute && len(p.cachedModels) > 0 {
		defer p.mu.RUnlock()
		return p.cachedModels
	}
	p.mu.RUnlock()

	p.mu.Lock()
	defer p.mu.Unlock()

	// Try fetching from API
	fetched, err := p.fetchModels()
	if err == nil && len(fetched) > 0 {
		p.cachedModels = fetched
		p.lastFetch = time.Now()
		return fetched
	}

	// Fallback to static list
	static := p.staticModels()
	p.cachedModels = static
	p.lastFetch = time.Now()
	return static
}

func (p *OpenAIProvider) fetchModels() ([]model.ModelInfo, error) {
	httpReq, err := http.NewRequest("GET", p.baseURL+"/v1/models", nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var apiResp struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, err
	}

	models := make([]model.ModelInfo, 0, len(apiResp.Data))
	for _, m := range apiResp.Data {
		models = append(models, model.ModelInfo{
			ID:           m.ID,
			Capabilities: openAICapabilities(m.ID),
		})
	}
	return models, nil
}

func (p *OpenAIProvider) staticModels() []model.ModelInfo {
	return []model.ModelInfo{
		{ID: "gpt-image-2", Capabilities: openAICapabilities("gpt-image-2")},
		{ID: "codex-gpt-image-2", Capabilities: openAICapabilities("codex-gpt-image-2")},
		{ID: "auto", Capabilities: openAICapabilities("auto")},
		{ID: "gpt-5", Capabilities: openAICapabilities("gpt-5")},
		{ID: "gpt-5-1", Capabilities: openAICapabilities("gpt-5-1")},
		{ID: "gpt-5-2", Capabilities: openAICapabilities("gpt-5-2")},
		{ID: "gpt-5-3", Capabilities: openAICapabilities("gpt-5-3")},
		{ID: "gpt-5-3-mini", Capabilities: openAICapabilities("gpt-5-3-mini")},
		{ID: "gpt-5-mini", Capabilities: openAICapabilities("gpt-5-mini")},
	}
}

func openAICapabilities(modelID string) model.ModelCapabilities {
	normalized := strings.ToLower(modelID)
	caps := model.ModelCapabilities{
		SupportsImageInput:  true,
		SupportsWatermark:   false,
		DefaultOutputFormat: "jpeg",
		NMax:                4,
	}

	if strings.Contains(normalized, "gpt-image") || strings.Contains(normalized, "auto") {
		caps.SupportsEdits = true
		caps.SupportsN = true
	}
	if strings.Contains(normalized, "gpt-5") {
		caps.SupportsN = true
	}

	return caps
}
```

Note: The `doRequest` method is shared between generations and edits, which keeps the HTTP logic in one place.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestOpenAI -v`
Expected: All PASS

- [ ] **Step 5: Run all ai tests**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add backend/ai/provider_openai.go backend/ai/provider_openai_test.go
git commit -m "feat(ai): add OpenAIProvider with generations and edits"
```

---

### Task 7: Update image_task.go to use Provider interface

**Files:**
- Modify: `backend/ai/image_task.go`
- Modify: `backend/ai/image_task_test.go`

- [ ] **Step 1: Update image_task.go function signatures and capability lookup**

Change all `*Client` to `Provider`:

```go
// backend/ai/image_task.go — key changes

// Before:
func ProcessSingleImagesWithContext(ctx context.Context, client *Client, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) ([]string, error) {
	caps := CapabilitiesForModel(opts.Model)
	effectiveOutputFormat := EffectiveOutputFormat(opts.Model, opts.OutputFormat)
	// ...
	resp, err := client.GenerateWithContext(ctx, req)

// After:
func ProcessSingleImagesWithContext(ctx context.Context, provider Provider, srcPath, outputDir string, opts model.AIBatchRequest, outputPath string) ([]string, error) {
	caps := capabilitiesFromProvider(provider, opts.Model)
	effectiveOutputFormat := effectiveOutputFormat(caps, opts.OutputFormat)
	// ...
	resp, err := provider.Generate(ctx, req)
```

Replace calls to `CapabilitiesForModel(opts.Model)` with `capabilitiesFromProvider(provider, opts.Model)`.

Replace `EffectiveOutputFormat(opts.Model, opts.OutputFormat)` with `effectiveOutputFormat(caps, opts.OutputFormat)`.

Add helper functions at the bottom of the file or at the top (before the Process functions):

```go
func capabilitiesFromProvider(provider Provider, modelID string) model.ModelCapabilities {
	for _, m := range provider.Models() {
		if m.ID == modelID {
			return m.Capabilities
		}
	}
	return model.ModelCapabilities{}
}

func effectiveOutputFormat(caps model.ModelCapabilities, requested string) string {
	if caps.SupportsOutputFormat {
		if requested == "png" || requested == "jpeg" {
			return requested
		}
	}
	return "jpeg"
}
```

Remove the import of `"strings"` if it's no longer used after removing `EffectiveOutputFormat` dependency.

- [ ] **Step 2: Update image_task_test.go**

Change `NewClient` to `NewSeedreamProvider`, `client.BaseURL = server.URL` to passing URL in constructor:

```go
// In TestProcessSingleImagesSavesAllReturnedImages:
// Before:
client := NewClient("test-key")
client.BaseURL = server.URL

// After:
provider := NewSeedreamProvider("test-key", server.URL)
```

Change the function call:
```go
// Before:
outPaths, err := ProcessSingleImagesWithContext(context.Background(), client, srcPath, outDir, ...)

// After:
outPaths, err := ProcessSingleImagesWithContext(context.Background(), provider, srcPath, outDir, ...)
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -run TestProcess -v`
Expected: PASS

- [ ] **Step 4: Run all ai tests**

Run: `cd F:\Python\imagetool && go test ./backend/ai/ -v`
Expected: All PASS

- [ ] **Step 5: Verify full build**

Run: `cd F:\Python\imagetool && go build ./...`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add backend/ai/image_task.go backend/ai/image_task_test.go
git commit -m "refactor(ai): update image_task to use Provider interface"
```

---

### Task 8: Update batch/ai.go to use provider factory

**Files:**
- Modify: `backend/batch/ai.go`

- [ ] **Step 1: Update RunAIImageBatch**

```go
// backend/batch/ai.go

package batch

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	backendAI "image-toolbox/backend/ai"
	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

// RunAIImageBatch processes images through AI generation.
func RunAIImageBatch(ctx context.Context, req model.AIBatchRequest, configPath string, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	providerName := req.Provider
	if providerName == "" {
		var err error
		providerName, err = config.LoadActiveProvider(configPath)
		if err != nil || providerName == "" {
			providerName = "seedream"
		}
	}

	apiKey, baseURL, err := config.LoadProviderConfig(configPath, providerName)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("load config for %s: %v", providerName, err)}
	}
	if apiKey == "" {
		return model.BatchResult{Error: fmt.Sprintf("API key not configured for %s. Go to Settings to set it up.", providerName)}
	}

	provider, err := backendAI.NewProvider(providerName, apiKey, baseURL)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("create provider %s: %v", providerName, err)}
	}

	// Apply defaults per provider
	if req.Model == "" {
		switch providerName {
		case "openai":
			req.Model = "gpt-image-2"
		default:
			req.Model = "doubao-seedream-5-0-260128"
		}
	}
	if req.Size == "" {
		req.Size = "2048x2048"
	}
	if req.N <= 0 {
		req.N = 1
	} else if req.N > 4 {
		req.N = 4
	}

	caps := capabilitiesForProvider(provider, req.Model)
	outExt := outputExtension(caps, req.OutputFormat)

	outputPaths := uniqueOutputPaths(req.SourcePaths, func(srcPath string) string {
		name := trimImageExt(srcPath)
		return filepath.Join(req.OutputDir, name+"_ai"+outExt)
	})

	jobFn := func(srcPath string) ([]string, error) {
		return backendAI.ProcessSingleImagesWithContext(ctx, provider, srcPath, req.OutputDir, req, outputPaths[srcPath])
	}

	maxConcurrent := 2
	if req.Concurrent > 0 {
		maxConcurrent = req.Concurrent
	}
	results := RunConcurrentPaths(ctx, req.SourcePaths, jobFn, maxConcurrent, progressCh)
	return aggregateResults(results)
}

func capabilitiesForProvider(provider backendAI.Provider, modelID string) model.ModelCapabilities {
	for _, m := range provider.Models() {
		if m.ID == modelID {
			return m.Capabilities
		}
	}
	return model.ModelCapabilities{}
}

func outputExtension(caps model.ModelCapabilities, requestedFormat string) string {
	ext := ".png"
	if caps.DefaultOutputFormat == "jpeg" || requestedFormat == "jpeg" {
		ext = ".jpg"
	} else if requestedFormat == "png" {
		ext = ".png"
	}
	return ext
}

func trimImageExt(srcPath string) string {
	base := filepath.Base(srcPath)
	return strings.TrimSuffix(base, filepath.Ext(base))
}
```

Remove the unused `backendAI.EffectiveOutputFormat` reference and the `config.LoadApiKey` call.

- [ ] **Step 2: Verify build**

Run: `cd F:\Python\imagetool && go build ./...`
Expected: Build succeeds

- [ ] **Step 3: Run all tests**

Run: `cd F:\Python\imagetool && go test ./... -v 2>&1 | head -100`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/batch/ai.go
git commit -m "refactor(batch): use provider factory in RunAIImageBatch"
```

---

### Task 9: Update app/app.go with new Wails methods

**Files:**
- Modify: `backend/app/app.go`

- [ ] **Step 1: Add new methods and update RunAIImageBatch**

Add these methods to the `App` struct:

```go
// GetProviderModels returns model list and capabilities for a provider.
func (a *App) GetProviderModels(providerName string) ([]model.ModelInfo, error) {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")

	apiKey, baseURL, err := config.LoadProviderConfig(cfgPath, providerName)
	if err != nil {
		return nil, err
	}
	if apiKey == "" {
		return nil, fmt.Errorf("API key not configured for %s", providerName)
	}

	provider, err := ai.NewProvider(providerName, apiKey, baseURL)
	if err != nil {
		return nil, err
	}
	return provider.Models(), nil
}

// GetProviderConfig returns provider config (API key masked for frontend).
func (a *App) GetProviderConfig(providerName string) (model.ProviderConfigResponse, error) {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")

	apiKey, baseURL, err := config.LoadProviderConfig(cfgPath, providerName)
	if err != nil {
		return model.ProviderConfigResponse{}, err
	}
	return model.ProviderConfigResponse{
		HasAPIKey: apiKey != "",
		BaseURL:   baseURL,
	}, nil
}

// SaveProviderConfig persists a provider's API key and base URL.
func (a *App) SaveProviderConfig(providerName, apiKey, baseURL string) error {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")
	return config.SaveProviderConfig(cfgPath, providerName, apiKey, baseURL)
}

// SetActiveProvider sets the default provider.
func (a *App) SetActiveProvider(providerName string) error {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")
	return config.SaveActiveProvider(cfgPath, providerName)
}

// GetActiveProvider returns the default provider name.
func (a *App) GetActiveProvider() (string, error) {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")
	return config.LoadActiveProvider(cfgPath)
}
```

Update `RunAIImageBatch` to pass `req.Provider` through (remove the old API key loading):

```go
func (a *App) RunAIImageBatch(req model.AIBatchRequest) ([]model.AIImageResult, error) {
	configDir := a.getConfigDir()
	cfgPath := filepath.Join(configDir, "config.json")

	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		var err error
		req.SourcePaths, err = file.ScanImages(req.OutputDir)
		if err != nil {
			return nil, fmt.Errorf("scan sources: %w", err)
		}
	}

	if len(req.SourcePaths) == 0 {
		return nil, fmt.Errorf("no source images provided")
	}

	// Ensure provider default
	if req.Provider == "" {
		active, err := config.LoadActiveProvider(cfgPath)
		if err == nil && active != "" {
			req.Provider = active
		} else {
			req.Provider = "seedream"
		}
	}

	tempDir, err := file.AITempDir()
	if err != nil {
		return nil, fmt.Errorf("create temp dir: %w", err)
	}
	a.currentAiOutputDir = tempDir

	req.OutputDir = tempDir

	appCtx, cancel := context.WithCancel(context.Background())
	a.cancelAI = cancel

	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	go func() {
		defer close(progressCh)
		result := batch.RunAIImageBatch(appCtx, req, cfgPath, progressCh)
		if result.Error != "" {
			progressCh <- model.ProgressUpdate{Done: true, Error: result.Error}
			return
		}
		progressCh <- model.ProgressUpdate{Done: true}
	}()

	return nil, nil
}
```

- [ ] **Step 2: Verify build**

Run: `cd F:\Python\imagetool && go build ./...`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add backend/app/app.go
git commit -m "feat(app): add provider config/model API methods"
```

---

### Task 10: Update frontend Settings page for multi-provider config

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`

- [ ] **Step 1: Update Settings.tsx with multi-provider config UI**

```tsx
// Key changes to Settings.tsx:

// Add state for providers
const [providers, setProviders] = useState({
  seedream: { apiKey: '', baseURL: '' },
  openai: { apiKey: '', baseURL: '' },
});
const [activeProvider, setActiveProviderState] = useState('seedream');

// Load configs on mount
useEffect(() => {
  loadProviderConfig('seedream');
  loadProviderConfig('openai');
  loadActiveProvider();
}, []);

async function loadProviderConfig(name: string) {
  try {
    const cfg = await go.main.App.GetProviderConfig(name);
    setProviders(prev => ({
      ...prev,
      [name]: { apiKey: cfg.hasApiKey ? '••••••••' : '', baseURL: cfg.baseURL }
    }));
  } catch {}
}

async function loadActiveProvider() {
  try {
    const name = await go.main.App.GetActiveProvider();
    setActiveProviderState(name);
  } catch {}
}
```

UI layout: render a section for each provider with API Key and Base URL inputs, plus a "Default Provider" dropdown at the top.

- [ ] **Step 2: Verify frontend builds**

Run: `cd F:\Python\imagetool\frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Settings.tsx
git commit -m "feat(ui): multi-provider config in Settings page"
```

---

### Task 11: Update frontend AI batch page for provider switching

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx`

- [ ] **Step 1: Add provider selector and dynamic parameter rendering**

Key changes to AIBatch.tsx:

```tsx
// Add provider state
const [provider, setProvider] = useState('seedream');
const [availableModels, setAvailableModels] = useState<Array<{id: string; capabilities: any}>>([]);
const [n, setN] = useState(1);

// Per-provider preserved state
const [seedreamParams, setSeedreamParams] = useState({...});
const [openAIParams, setOpenAIParams] = useState({n: 1});

// Load active provider on mount
useEffect(() => {
  go.main.App.GetActiveProvider().then(setProvider).catch(() => setProvider('seedream'));
}, []);

// Fetch models when provider changes
useEffect(() => {
  if (!provider) return;
  go.main.App.GetProviderModels(provider)
    .then(models => setAvailableModels(models))
    .catch(() => setAvailableModels([]));
}, [provider]);

// When provider changes, restore saved params
function handleProviderChange(newProvider: string) {
  // Save current params
  if (provider === 'seedream') setSeedreamParams({...currentParams});
  if (provider === 'openai') setOpenAIParams({n});
  // Switch
  setProvider(newProvider);
  // Restore saved params
  if (newProvider === 'openai') {
    setN(openAIParams.n);
  }
}
```

Parameter rendering:
```tsx
// Conditionally render params based on capabilities
{capabilities.supportsN && (
  <div className="param-group">
    <label>Images per request (n)</label>
    <input type="number" min={1} max={capabilities.nMax || 4}
      value={n} onChange={e => setN(Number(e.target.value))} />
    {sourcePaths.length > 0 && n > 1 && (
      <span className="note">
        Will generate {sourcePaths.length} × {n} = {sourcePaths.length * n} total images
      </span>
    )}
  </div>
)}
```

- [ ] **Step 2: Verify frontend builds**

Run: `cd F:\Python\imagetool\frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AIBatch.tsx
git commit -m "feat(ui): provider selector and dynamic params in AI batch page"
```

---

### Task 12: Clean up and final verification

**Files:** None (verification only)

- [ ] **Step 1: Verify full backend build**

Run: `cd F:\Python\imagetool && go build ./...`
Expected: Build succeeds, no errors

- [ ] **Step 2: Run all backend tests**

Run: `cd F:\Python\imagetool && go test ./... -count=1`
Expected: All tests pass

- [ ] **Step 3: Verify frontend build**

Run: `cd F:\Python\imagetool\frontend && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Verify test count matches expected**

The old `client_test.go` is replaced by `provider_seedream_test.go`. All existing test scenarios are preserved. No regressions.

- [ ] **Step 5: Final commit**

```bash
git commit --allow-empty -m "chore: multi-provider AI integration complete"
```

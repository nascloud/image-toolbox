# Multi-Provider AI Image Generation Architecture

Date: 2026-05-25

## Background

Currently the application supports only one AI image generation provider: Volcano Engine Ark API (Seedream models). The ChatGPT2API (an OpenAI-compatible image API) needs to be integrated to support both text-to-image and image editing.

## Goals

- Refactor the AI backend to support multiple providers via a common interface
- Integrate ChatGPT2API as a second provider (generations + edits endpoints)
- Allow users to switch providers without restarting the application
- Support per-provider API Key and Base URL configuration
- Minimal disruption to existing Seedream workflow
- Provider selection via Settings (default) and AI page (temporary override)

## Non-Goals

- Removing Seedream provider
- Supporting streaming responses from ChatGPT2API
- Supporting file upload via multipart/form-data for edits (JSON-only is sufficient)

## Architecture

### Provider Interface

New file: `backend/ai/provider.go`

```go
type Provider interface {
    Name() string
    Generate(ctx context.Context, req *model.AIImageRequest) (*model.AIImageResponse, error)
    Models() []ModelInfo
}

type ModelInfo struct {
    ID           string            `json:"id"`
    Capabilities ModelCapabilities `json:"capabilities"`
}

type ModelCapabilities struct {
    SupportsImageInput         bool     `json:"supportsImageInput"`
    SupportsEdits             bool     `json:"supportsEdits"`         // new for ChatGPT2API
    SupportsSequential         bool     `json:"supportsSequential"`
    SupportsStream             bool     `json:"supportsStream"`
    SupportsGuidanceScale      bool     `json:"supportsGuidanceScale"`
    SupportsOutputFormat       bool     `json:"supportsOutputFormat"`
    SupportsWebSearch          bool     `json:"supportsWebSearch"`
    SupportsFastPromptOptimize bool     `json:"supportsFastPromptOptimize"`
    SupportsSeed               bool     `json:"supportsSeed"`
    SupportsWatermark          bool     `json:"supportsWatermark"`
    SupportsN                  bool     `json:"supportsN"`            // new for ChatGPT2API multi-image
    DefaultOutputFormat        string   `json:"defaultOutputFormat"`
    AllowedSizes               []string `json:"allowedSizes"`
    NMax                      int      `json:"nMax"`                 // max value for n parameter
}
```

Provider factory function:

```go
func NewProvider(name, apiKey, baseURL string) (Provider, error)
```

Returns `SeedreamProvider` or `ChatGPT2APIProvider` based on name.

### Provider: SeedreamProvider

File: `backend/ai/provider_seedream.go` (migrated from existing `client.go`)

- BaseURL: `https://ark.cn-beijing.volces.com/api/v3` (default)
- Endpoint: `POST /images/generations`
- Request format: Volcano Engine Ark format (unchanged)
- Models: doubao-seedream-5-0-260128, doubao-seedream-4-5-250130, doubao-seedream-4-0-250130, doubao-seedream-3-0-t2i-250115
- Capabilities: unchanged from current `capability.go`
- Response format: existing `AIImageResponse` struct

### Provider: ChatGPT2APIProvider

File: `backend/ai/provider_chatgpt2api.go`

- BaseURL: configurable (default from user's doc: `https://image.wq727.cf:21118`)
- Endpoints:
  - `POST /v1/images/generations` — text-to-image when `req.Image` is empty
  - `POST /v1/images/edits` — image editing when `req.Image` is non-empty
- Models: `gpt-image-2`, `codex-gpt-image-2`, `auto`, `gpt-5`, `gpt-5-1`, `gpt-5-2`, `gpt-5-3`, `gpt-5-3-mini`, `gpt-5-mini`
- Request format: OpenAI-compatible JSON
- `response_format` defaults to `"b64_json"`
- `n` parameter: 1-4 images per request
- Capabilities: no seed, no guidance_scale, no sequential_image_generation, no watermark, no web_search, no output_format selection, no prompt optimization
- Model list is optionally fetched from `GET /v1/models` on first use (cached), with fallback to a static list

Edit mode details:
- Sends `POST /v1/images/edits` with JSON body containing `model`, `prompt`, `n`, `response_format`, and `images` array (with `image_url` entries using base64 data URIs)
- The input image is encoded as a base64 data URI and placed in the `images` array
- Reference images are appended to the `images` array

### Configuration Changes

File: `backend/config/config.go`

```go
type appConfig struct {
    ActiveProvider string                    `json:"activeProvider"`
    Providers      map[string]ProviderConfig `json:"providers"`
    AiOutputDir    string                    `json:"aiOutputDir"`
}

type ProviderConfig struct {
    ApiKey  string `json:"apiKey"`
    BaseURL string `json:"baseURL"`
}
```

New config functions:
- `SaveProviderConfig(path, name, apiKey, baseURL)` — merge into `Providers` map, preserve `AiOutputDir`
- `LoadProviderConfig(path, name)` — returns `(apiKey, baseURL, error)`
- `SaveActiveProvider(path, name)` / `LoadActiveProvider(path)`

`SaveApiKey`/`LoadApiKey` remain as compatibility shims that map to the `"seedream"` provider entry.

### Model Changes

File: `backend/model/ai.go`

`AIBatchRequest` adds:
```go
type AIBatchRequest struct {
    Provider string `json:"provider"` // "seedream" | "chatgpt2api"
    // ... existing fields
}
```

`AIImageRequest` unchanged (provider-agnostic internal struct).

### Pipeline Changes

File: `backend/ai/image_task.go`

`ProcessSingleImagesWithContext` changes signature:
```go
// Before
func ProcessSingleImagesWithContext(ctx context.Context, client *Client, ...)

// After
func ProcessSingleImagesWithContext(ctx context.Context, provider Provider, ...)
```

Internal capability queries (`CapabilitiesForModel`, `EffectiveOutputFormat`) change to use `provider.Models()` instead of global functions.

The `capability.go` functions `CapabilitiesForModel` and `EffectiveOutputFormat` are preserved for backward compatibility during migration, but marked as deprecated in favor of per-provider model info.

### Batch Changes

File: `backend/batch/ai.go`

`RunAIImageBatch` updated to:
1. Determine provider name from `req.Provider` (fallback to config's `activeProvider`, then `"seedream"`)
2. Load provider config from saved settings
3. Call `ai.NewProvider(name, apiKey, baseURL)`
4. Pass provider to `ProcessSingleImagesWithContext`

Default model and size logic becomes provider-aware:
- Seedream defaults: model=`"doubao-seedream-5-0-260128"`, size=`"2048x2048"`
- ChatGPT2API defaults: model=`"gpt-image-2"`, size not used (API determines)

### App API Changes

File: `backend/app/app.go`

New Wails-bound methods:
- `GetProviderModels(providerName string) ([]model.ModelInfo, error)` — returns models + capabilities for a provider
- `SaveProviderConfig(providerName, apiKey, baseURL string) error` — persist API key and URL
- `GetProviderConfig(providerName string) (ProviderConfig, error)` — retrieve config (API key masked for frontend display)
- `SetActiveProvider(providerName string) error`
- `GetActiveProvider() (string, error)`

Existing `SaveApiKey`/`GetApiKey` remain for backward compatibility.

`RunAIImageBatch` updated to pass `req.Provider` through to `batch.RunAIImageBatch`.

### Frontend Changes

#### AIBatch.tsx
- Add **Provider selector** dropdown at top of page
  - On provider change, call `GetProviderModels()` and rebuild model dropdown + parameter UI
- **Parameter panel** dynamically renders based on model capabilities:
  - Seedream: all existing params (seed, guidance_scale, sequential, watermark, web_search, etc.)
  - ChatGPT2API: prompt, n (1-4), output format (jpg/png), reference images (for edit mode)
  - ChatGPT2API edit mode: when input image is provided, show "edit" action type selector alongside default "generate"
- Model dropdown repopulated from backend response
- Settings defaults loaded on page mount

#### Settings.tsx
- Replace single API Key input with a **Provider configuration section**:
  - Tab or section for each provider (Seedream, ChatGPT2API)
  - Each section: API Key input + Base URL input
- Add **Default Provider** dropdown

### Data Flow

```
User selects provider on AI page
  → Frontend calls GetProviderModels(providerName)
  → Backend creates provider instance, returns model list + capabilities
  → Frontend renders model dropdown and parameter controls

User configures batch and clicks "Start"
  → Frontend sends AIBatchRequest with provider="seedream"|"chatgpt2api"
  → backend/app/app.go → batch.RunAIImageBatch()
  → batch/ai.go creates provider via factory using saved config
  → For each image: ProcessSingleImagesWithContext(provider, ...)
  → provider.Generate(ctx, &AIImageRequest{...})
  → Results returned via progress channel, same as existing flow
```

### Error Handling

- Unknown provider name: return error with available providers list
- Missing API key for selected provider: return clear error message specifying which provider needs configuration
- ChatGPT2API endpoint errors: parsed from OpenAI error format
- Single image failure within batch: logged, other images continue (existing pattern)

### Testing Strategy

- Unit tests for `ChatGPT2APIProvider.Generate()` — verify request body format, URL routing, response parsing
- Unit tests for `NewProvider()` factory — unknown name error handling
- Unit tests for config serialization/deserialization with new `Providers` map
- Integration test against ChatGPT2API mock server for edits endpoint
- Existing Seedream tests remain unchanged and should pass without modification

### Backward Compatibility

- Existing config files (with only `apiKey` and `aiOutputDir`) are read correctly on upgrade
  - `loadConfig()` maps legacy `apiKey` -> `providers["seedream"].apiKey`
  - `activeProvider` defaults to `"seedream"` when absent
- Existing frontend calls to `SaveApiKey`/`GetApiKey` map to seedream provider
- No migration step required for users

### File Inventory

New files:
- `backend/ai/provider.go` — interface, factory, ModelInfo, ModelCapabilities
- `backend/ai/provider_seedream.go` — migrate from client.go
- `backend/ai/provider_chatgpt2api.go` — new provider

Modified files:
- `backend/ai/client.go` — removed, logic migrated into provider_seedream.go
- `backend/ai/capability.go` — add deprecated markers, keep for transition
- `backend/ai/image_task.go` — change *Client to Provider
- `backend/ai/reference.go` — no changes expected
- `backend/batch/ai.go` — use provider factory
- `backend/model/ai.go` — add Provider field to AIBatchRequest
- `backend/config/config.go` — multi-provider config struct + accessors
- `backend/app/app.go` — add provider config/model API methods, update RunAIImageBatch
- `frontend/src/pages/AIBatch.tsx` — provider selector, dynamic params
- `frontend/src/pages/Settings.tsx` — multi-provider config UI

# Multi-Provider AI Image Generation Architecture

Date: 2026-05-25

## Background

Currently the application supports Volcano Engine Ark API (Seedream models). An OpenAI-compatible Sub2API provider needs to be integrated to support both text-to-image and image editing.

## Goals

- Refactor the AI backend to support multiple providers via a common interface
- Integrate OpenAI (Sub2API) as a second provider (generations + edits endpoints)
- Allow users to switch providers without restarting the application
- Support per-provider API Key and Base URL configuration
- Minimal disruption to existing Seedream workflow
- Provider selection via Settings (default) and AI page (temporary override)

## Non-Goals

- Removing Seedream provider
- Supporting streaming responses from OpenAI (Sub2API)
- Supporting file upload via multipart/form-data for edits (JSON-only is sufficient, because Wails bindings only support JSON-serializable parameters; base64 data URIs work for typical image sizes under ~10MB per image)

## Architecture

### Shared Types

File: `backend/model/ai.go` (extend existing)

All cross-boundary types (`ModelInfo`, `ModelCapabilities`) are defined in the `model` package, consistent with the project rule that all struct definitions live in `backend/model/`.

```go
// ModelInfo describes a single model offered by a provider.
type ModelInfo struct {
    ID           string            `json:"id"`
    Capabilities ModelCapabilities `json:"capabilities"`
}

// ModelCapabilities describes API parameters accepted by a model.
// This replaces the old ai.ModelCapabilities struct (which had no JSON tags
// and used map[string]bool for AllowedSizes).
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
```

**Migration from `ai.ModelCapabilities`**: The existing `backend/ai/capability.go` struct is deleted. `CapabilitiesForModel()` and `EffectiveOutputFormat()` are updated to return/use `model.ModelCapabilities`. `AllowedSizes` changes from `map[string]bool` to `[]string`; all call sites (e.g. `client.go` L51: `caps.AllowedSizes[req.Size]`) are updated to use a helper `containsSize(caps.AllowedSizes, req.Size)`.

**`SupportsSeed` fix**: The existing `client.go` L78 incorrectly gates seed on `SupportsGuidanceScale`. After migration, this uses the new `SupportsSeed` field. Seedream 5.0/4.5/4.0 set `SupportsSeed: true`; Seedream 3.0 t2i sets `SupportsSeed: false` (it only supports `GuidanceScale`).

### Provider Interface

New file: `backend/ai/provider.go`

```go
// Provider is the common interface for AI image generation backends.
type Provider interface {
    Name() string
    Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error)
    Models() []model.ModelInfo
}
```

Note: `Generate` uses **value receiver** `model.AIImageRequest` (not pointer), matching the existing `Client.GenerateWithContext` signature and all call sites.

Provider factory function:

```go
func NewProvider(name, apiKey, baseURL string) (Provider, error)
```

Returns `SeedreamProvider` or `OpenAIProvider` based on name.

### Provider: SeedreamProvider

File: `backend/ai/provider_seedream.go` (migrated from existing `client.go`)

- BaseURL: `https://ark.cn-beijing.volces.com/api/v3` (default)
- Endpoint: `POST /images/generations`
- Request format: Volcano Engine Ark format (unchanged)
- Models: doubao-seedream-5-0-260128, doubao-seedream-4-5-250130, doubao-seedream-4-0-250130, doubao-seedream-3-0-t2i-250115
- Capabilities: migrated from current `capability.go`, now returning `model.ModelCapabilities`
- Response format: existing `AIImageResponse` struct
- Timeout: 120s (unchanged from current default)

### Provider: OpenAIProvider

File: `backend/ai/provider_openai.go`

- BaseURL: configurable (default: `https://open2api.kuvms.net`)
- Timeout: 180s (Sub2API may be slower due to upstream routing)
- Endpoints:
  - `POST /v1/images/generations` — text-to-image when `req.Image` is empty
  - `POST /v1/images/edits` — image editing when `req.Image` is non-empty
- Models: `gpt-image-2`, `codex-gpt-image-2`, `auto`, `gpt-5`, `gpt-5-1`, `gpt-5-2`, `gpt-5-3`, `gpt-5-3-mini`, `gpt-5-mini`
- Request format: OpenAI-compatible JSON
- `response_format` defaults to `"b64_json"`
- `n` parameter: 1-4 images per request
- Capabilities: `SupportsImageInput: true` (model can accept images for editing), `SupportsEdits: true`, `SupportsN: true`, `NMax: 4`. All other `Supports*` fields are `false`.
- Model list is optionally fetched from `GET /v1/models` on first use (cached in memory with 10-minute TTL), with fallback to a static list

**`SupportsImageInput` clarification**: Set to `true` because the model supports receiving images. Whether images are actually sent depends on `req.Image != ""` at the call site (`image_task.go`). When `req.Image` is empty, the provider routes to `/v1/images/generations`; when non-empty, it routes to `/v1/images/edits`.

#### Generations request body

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "n": 1,
  "response_format": "b64_json"
}
```

#### Edits request body

```json
{
  "model": "gpt-image-2",
  "prompt": "...",
  "images": [
    {"image_url": "data:image/png;base64,..."}
  ]
}
```

**Note**: For the edits endpoint, `n` and `response_format` are **not sent** in the JSON body, as the API documentation examples for JSON mode do not include them. If testing reveals they are accepted, they can be added later. The input image is encoded as a base64 data URI and placed in the `images` array. Reference images are appended to the same array.

#### Response format compatibility

Sub2API returns an OpenAI-compatible response that maps to the existing `model.AIImageResponse` struct:

| Sub2API field | AIImageResponse mapping | Notes |
|---|---|---|
| `data[].b64_json` | `Data[].B64JSON` | ✅ direct match |
| `data[].url` | `Data[].URL` | ✅ direct match |
| `data[].revised_prompt` | _(not captured)_ | Ignored for now; can be added to `AIImageResponse.Data` later if needed |
| `error.message` | `Error.Message` | ✅ direct match |
| `error.type` | _(not captured)_ | OpenAI includes `type` field; we only use `code` + `message` |

The existing struct's `omitempty` tags and unused fields (`Size`, `Usage`) are harmlessly ignored when parsing Sub2API responses. No struct changes needed for initial integration.

### Shared Utilities

File: `backend/ai/download.go` (new, extracted from `client.go`)

The following package-level functions are **not** provider-specific and must remain accessible to all providers and `image_task.go`:

- `DownloadImage(url string) ([]byte, error)`
- `DownloadImageWithContext(ctx context.Context, url string) ([]byte, error)`

These are extracted from the deleted `client.go` into a new `download.go` file within the `ai` package.

### Configuration Changes

File: `backend/config/config.go`

```go
type appConfig struct {
    ActiveProvider string                    `json:"activeProvider"`
    Providers      map[string]ProviderConfig `json:"providers"`
    AiOutputDir    string                    `json:"aiOutputDir"`
    // Legacy field, read-only for migration
    ApiKey         string                    `json:"apiKey,omitempty"`
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

#### Config migration strategy

Migration from legacy format is **read-only** and **lazy**:

1. `loadConfig()` reads the JSON file. If the legacy `apiKey` field is non-empty and `providers` map is nil/empty, it populates `providers["seedream"].apiKey` from the legacy field **in memory only**.
2. `activeProvider` defaults to `"seedream"` when absent.
3. The config file is **not rewritten** during this migration. The new format is only written when the user explicitly saves settings (calls `SaveProviderConfig` or `SaveActiveProvider`).
4. Once saved in the new format, the legacy `apiKey` field is omitted (`omitempty`).

This avoids accidentally overwriting the config file on app startup.

### Model Changes

File: `backend/model/ai.go`

`AIBatchRequest` adds:
```go
type AIBatchRequest struct {
    Provider string `json:"provider"` // "seedream" | "openai"
    N        int    `json:"n"`        // number of images per request (OpenAI only, 1-4)
    // ... existing fields
}
```

`AIImageRequest` adds:
```go
type AIImageRequest struct {
    N int `json:"n,omitempty"` // passed through for providers that support SupportsN
    // ... existing fields
}
```

### Pipeline Changes

File: `backend/ai/image_task.go`

`ProcessSingleImagesWithContext` changes signature:
```go
// Before
func ProcessSingleImagesWithContext(ctx context.Context, client *Client, ...)

// After
func ProcessSingleImagesWithContext(ctx context.Context, provider Provider, ...)
```

Capability lookup changes from global `CapabilitiesForModel(model)` to querying `provider.Models()` for the matching model's capabilities. A helper function is added:

```go
// capabilitiesFromProvider looks up capabilities for a model from the provider's model list.
func capabilitiesFromProvider(provider Provider, modelID string) model.ModelCapabilities {
    for _, m := range provider.Models() {
        if m.ID == modelID {
            return m.Capabilities
        }
    }
    return model.ModelCapabilities{} // zero value = no capabilities
}
```

The `EffectiveOutputFormat` function is updated to accept `model.ModelCapabilities` directly instead of a model name string.

Convenience wrappers `ProcessSingleImage` and `ProcessSingleImageWithContext` are updated accordingly.

### Batch Changes

File: `backend/batch/ai.go`

`RunAIImageBatch` updated to:
1. Determine provider name from `req.Provider` (fallback to config's `activeProvider`, then `"seedream"`)
2. Load provider config from saved settings
3. Call `ai.NewProvider(name, apiKey, baseURL)`
4. Pass provider to `ProcessSingleImagesWithContext`

Default model and size logic becomes provider-aware:
- Seedream defaults: model=`"doubao-seedream-5-0-260128"`, size=`"2048x2048"`
- OpenAI defaults: model=`"gpt-image-2"`, size not used (API determines)

### App API Changes

File: `backend/app/app.go`

New Wails-bound methods:
- `GetProviderModels(providerName string) ([]model.ModelInfo, error)` — returns models + capabilities for a provider; results are cached in memory for 10 minutes per provider
- `SaveProviderConfig(providerName, apiKey, baseURL string) error` — persist API key and URL
- `GetProviderConfig(providerName string) (model.ProviderConfigResponse, error)` — retrieve config (API key masked for frontend display)
- `SetActiveProvider(providerName string) error`
- `GetActiveProvider() (string, error)`

Existing `SaveApiKey`/`GetApiKey` remain for backward compatibility.

`RunAIImageBatch` updated to pass `req.Provider` through to `batch.RunAIImageBatch`.

### Frontend Changes

#### AIBatch.tsx
- Add **Provider selector** dropdown at top of page
  - On provider change, call `GetProviderModels()` and rebuild model dropdown + parameter UI
  - **File list is preserved** across provider switches (the input images don't change)
  - **Provider-specific parameter state is preserved** independently: switching from Seedream → OpenAI and back restores previously-configured Seedream parameters (seed, guidance_scale, etc.)
- **Parameter panel** dynamically renders based on model capabilities:
  - Seedream: all existing params (seed, guidance_scale, sequential, watermark, web_search, etc.)
  - OpenAI: prompt, n (1-4), reference images (for edit mode)
  - OpenAI edit mode: when input image is provided, show "edit" action type selector alongside default "generate"
- **`n` parameter UX**: Clearly label that `n` controls "images generated per request". When batch-processing N input images with n=2, show a note: "Will generate N × 2 = 2N total images". This prevents confusion between "number of input images" and "images per generation".
- Model dropdown repopulated from backend response
- Settings defaults loaded on page mount

#### Settings.tsx
- Replace single API Key input with a **Provider configuration section**:
  - Tab or section for each provider (Seedream, OpenAI)
  - Each section: API Key input + Base URL input (with placeholder showing the default URL)
- Add **Default Provider** dropdown

### Data Flow

```
User selects provider on AI page
  → Frontend calls GetProviderModels(providerName)
  → Backend creates provider instance (or returns cached), returns model list + capabilities
  → Frontend renders model dropdown and parameter controls

User configures batch and clicks "Start"
  → Frontend sends AIBatchRequest with provider="seedream"|"openai"
  → backend/app/app.go → batch.RunAIImageBatch()
  → batch/ai.go creates provider via factory using saved config
  → For each image: ProcessSingleImagesWithContext(provider, ...)
  → provider.Generate(ctx, AIImageRequest{...})
  → Results returned via progress channel, same as existing flow
```

### Error Handling

- Unknown provider name: return error with available providers list
- Missing API key for selected provider: return clear error message specifying which provider needs configuration
- OpenAI endpoint errors: parsed from OpenAI error format (`error.message` + `error.type`)
- Single image failure within batch: logged, other images continue (existing pattern)

### Testing Strategy

- Unit tests for `OpenAIProvider.Generate()` — verify request body format, URL routing (generations vs edits), response parsing
- Unit tests for `NewProvider()` factory — unknown name error handling
- Unit tests for config serialization/deserialization with new `Providers` map, including legacy migration
- Integration test against a Sub2API mock server for edits endpoint
- Verify `AllowedSizes` migration: ensure `containsSize()` works correctly with the new `[]string` type
- Verify `SupportsSeed` is used instead of `SupportsGuidanceScale` for seed gating
- Existing Seedream tests remain unchanged and should pass without modification

### Backward Compatibility

- Existing config files (with only `apiKey` and `aiOutputDir`) are read correctly on upgrade
  - `loadConfig()` maps legacy `apiKey` -> `providers["seedream"].apiKey` **in memory only** (no file write)
  - `activeProvider` defaults to `"seedream"` when absent
  - New format is written only when user explicitly saves settings
- Existing frontend calls to `SaveApiKey`/`GetApiKey` map to seedream provider
- No migration step required for users

### File Inventory

New files:
- `backend/ai/provider.go` — interface, factory function
- `backend/ai/provider_seedream.go` — migrate from client.go
- `backend/ai/provider_openai.go` — new provider
- `backend/ai/download.go` — extracted DownloadImage/DownloadImageWithContext (shared utility)

Modified files:
- `backend/ai/client.go` — **deleted**, logic split into provider_seedream.go + download.go
- `backend/ai/capability.go` — **deleted**, `ModelCapabilities` struct moved to `model/ai.go`; `CapabilitiesForModel()` logic moved into `SeedreamProvider.Models()` and kept as deprecated wrapper
- `backend/ai/image_task.go` — change `*Client` to `Provider`; use `capabilitiesFromProvider()` instead of `CapabilitiesForModel()`; fix seed gating to use `SupportsSeed`
- `backend/ai/reference.go` — no changes expected
- `backend/batch/ai.go` — use provider factory
- `backend/model/ai.go` — add `Provider`/`N` fields to `AIBatchRequest`; add `N` to `AIImageRequest`; add `ModelInfo`, `ModelCapabilities`, `ProviderConfigResponse` structs
- `backend/config/config.go` — multi-provider config struct + accessors + lazy legacy migration
- `backend/app/app.go` — add provider config/model API methods, update RunAIImageBatch
- `frontend/src/pages/AIBatch.tsx` — provider selector, dynamic params, n×batch UX
- `frontend/src/pages/Settings.tsx` — multi-provider config UI

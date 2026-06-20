package ai

import (
	"context"
	"fmt"

	"image-toolbox/backend/model"
)

const (
	ProviderSeedream    = "seedream"
	ProviderChatGPT2API = "chatgpt2api"

	DefaultSeedreamBaseURL    = "https://ark.cn-beijing.volces.com/api/v3"
	DefaultChatGPT2APIBaseURL = "http://localhost:3000"
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
	case ProviderChatGPT2API:
		return NewChatGPT2APIProvider(apiKey, baseURL), nil
	default:
		return nil, fmt.Errorf("unknown AI provider: %s", name)
	}
}

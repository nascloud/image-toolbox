package ai

import (
	"context"
	"fmt"

	"image-toolbox/backend/model"
)

const (
	ProviderSeedream = "seedream"
	ProviderOpenAI   = "openai"

	DefaultSeedreamBaseURL = "https://ark.cn-beijing.volces.com/api/v3"
	DefaultOpenAIBaseURL   = "https://open2api.kuvms.net"
)

// Provider is the common interface for AI image generation backends.
type Provider interface {
	Name() string
	Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error)
	Models(ctx context.Context) ([]model.ModelInfo, error)
	ModelCapabilities(modelID string) model.ModelCapabilities
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

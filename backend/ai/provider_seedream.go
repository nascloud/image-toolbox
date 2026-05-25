package ai

import (
	"context"
	"fmt"

	"image-toolbox/backend/model"
)

type SeedreamProvider struct {
	apiKey  string
	baseURL string
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

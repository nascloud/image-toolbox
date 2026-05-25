package ai

import (
	"context"
	"fmt"

	"image-toolbox/backend/model"
)

type ChatGPT2APIProvider struct {
	apiKey  string
	baseURL string
}

func NewChatGPT2APIProvider(apiKey, baseURL string) *ChatGPT2APIProvider {
	return &ChatGPT2APIProvider{apiKey: apiKey, baseURL: baseURL}
}

func (p *ChatGPT2APIProvider) Name() string { return ProviderChatGPT2API }

func (p *ChatGPT2APIProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	return nil, fmt.Errorf("not yet implemented")
}

func (p *ChatGPT2APIProvider) Models() []model.ModelInfo {
	return nil
}

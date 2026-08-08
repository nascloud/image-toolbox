package ai

import (
	"context"
	"testing"

	"image-toolbox/backend/model"
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

type capabilityOnlyProvider struct {
	modelCalls int
	caps       model.ModelCapabilities
}

func (p *capabilityOnlyProvider) Name() string { return "capability-only" }

func (p *capabilityOnlyProvider) Generate(ctx context.Context, req model.AIImageRequest) (*model.AIImageResponse, error) {
	return nil, nil
}

func (p *capabilityOnlyProvider) Models() []model.ModelInfo {
	p.modelCalls++
	return nil
}

func (p *capabilityOnlyProvider) ModelCapabilities(modelID string) model.ModelCapabilities {
	return p.caps
}

func TestProviderCapabilitiesDoesNotCallModels(t *testing.T) {
	p := &capabilityOnlyProvider{caps: model.ModelCapabilities{SupportsImageInput: true}}

	caps := ProviderCapabilities(p, "any-model")
	if !caps.SupportsImageInput {
		t.Fatal("expected SupportsImageInput capability")
	}
	if p.modelCalls != 0 {
		t.Fatalf("expected Models not to be called, got %d calls", p.modelCalls)
	}
}

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

func TestNewProviderChatGPT2API(t *testing.T) {
	p, err := NewProvider("chatgpt2api", "test-key", DefaultChatGPT2APIBaseURL)
	if err != nil {
		t.Fatal(err)
	}
	if p.Name() != "chatgpt2api" {
		t.Fatalf("expected chatgpt2api, got %s", p.Name())
	}
}

func TestNewProviderUnknown(t *testing.T) {
	_, err := NewProvider("unknown", "test-key", "")
	if err == nil {
		t.Fatal("expected error for unknown provider")
	}
}

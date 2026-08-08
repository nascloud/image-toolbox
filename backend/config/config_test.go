package config

import (
	"encoding/json"
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

func TestOpenAIDefaultBaseURL(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.json")
	apiKey, baseURL, err := LoadProviderConfig(cfgPath, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "" {
		t.Fatalf("expected empty API key, got %q", apiKey)
	}
	if baseURL != "https://open2api.kuvms.net" {
		t.Fatalf("expected OpenAI default Base URL, got %q", baseURL)
	}
}

func TestOpenAIDefaultReviewConfig(t *testing.T) {
	cfgPath := filepath.Join(t.TempDir(), "config.json")
	apiKey, modelID, endpoint, err := LoadProviderReviewConfig(cfgPath, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "" {
		t.Fatalf("expected empty API key, got %q", apiKey)
	}
	if modelID != "gpt-6-sol" {
		t.Fatalf("expected default review model gpt-6-sol, got %q", modelID)
	}
	if endpoint != "https://open2api.kuvms.net/v1/responses" {
		t.Fatalf("unexpected default review endpoint %q", endpoint)
	}
	if DefaultOpenAIReasoningEffort != "medium" {
		t.Fatalf("expected default reasoning effort medium, got %q", DefaultOpenAIReasoningEffort)
	}
}

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

	// Verify legacy top-level apiKey field is not written
	data, _ := os.ReadFile(cfgPath)
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatal(err)
	}
	if _, exists := raw["apiKey"]; exists {
		t.Fatal("legacy top-level apiKey field should be omitted after new-format save")
	}
}

func TestProviderReviewConfigRoundTripAndImageSavePreservesIt(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")
	if err := SaveProviderConfig(cfgPath, "seedream", "sk-review", DefaultSeedreamBaseURL); err != nil {
		t.Fatal(err)
	}
	if err := SaveProviderReviewConfig(cfgPath, "seedream", "ep-language-model", "https://example.com/chat/completions"); err != nil {
		t.Fatal(err)
	}
	if err := SaveProviderConfigWithKeyMode(cfgPath, "seedream", "", "https://example.com/v3", true); err != nil {
		t.Fatal(err)
	}

	apiKey, modelID, endpoint, err := LoadProviderReviewConfig(cfgPath, "seedream")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "sk-review" || modelID != "ep-language-model" || endpoint != "https://example.com/chat/completions" {
		t.Fatalf("unexpected review config: key=%q model=%q endpoint=%q", apiKey, modelID, endpoint)
	}
}

func TestSaveProviderConfigPreservesExistingKey(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.json")

	if err := SaveProviderConfig(cfgPath, "openai", "sk-original", "https://open2api.kuvms.net"); err != nil {
		t.Fatal(err)
	}
	if err := SaveProviderConfigWithKeyMode(cfgPath, "openai", "", "http://127.0.0.1:3000", true); err != nil {
		t.Fatal(err)
	}

	apiKey, baseURL, err := LoadProviderConfig(cfgPath, "openai")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "sk-original" {
		t.Fatalf("expected key to be preserved, got %q", apiKey)
	}
	if baseURL != "http://127.0.0.1:3000" {
		t.Fatalf("expected updated baseURL, got %q", baseURL)
	}
}

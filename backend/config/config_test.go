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

	if err := SaveProviderConfig(cfgPath, "chatgpt2api", "sk-new", "https://example.com"); err != nil {
		t.Fatal(err)
	}
	apiKey, baseURL, err := LoadProviderConfig(cfgPath, "chatgpt2api")
	if err != nil {
		t.Fatal(err)
	}
	if apiKey != "sk-new" || baseURL != "https://example.com" {
		t.Fatalf("got %s, %s", apiKey, baseURL)
	}

	if err := SaveActiveProvider(cfgPath, "chatgpt2api"); err != nil {
		t.Fatal(err)
	}
	active, err := LoadActiveProvider(cfgPath)
	if err != nil {
		t.Fatal(err)
	}
	if active != "chatgpt2api" {
		t.Fatalf("expected chatgpt2api, got %s", active)
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

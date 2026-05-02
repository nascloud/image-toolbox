package config

import (
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

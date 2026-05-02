package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type appConfig struct {
	ApiKey string `json:"apiKey"`
}

// SaveApiKey writes the API key to the config file at path.
func SaveApiKey(path, apiKey string) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	cfg := appConfig{ApiKey: apiKey}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// LoadApiKey reads the API key from the config file at path.
// Returns empty string if the file does not exist.
func LoadApiKey(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "", nil
		}
		return "", err
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", err
	}
	return cfg.ApiKey, nil
}

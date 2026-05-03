package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type appConfig struct {
	ApiKey     string `json:"apiKey"`
	AiOutputDir string `json:"aiOutputDir"`
}

// SaveApiKey writes the API key to the config file at path.
func SaveApiKey(path, apiKey string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{}
	}
	cfg.ApiKey = apiKey
	return saveConfig(path, cfg)
}

// LoadApiKey reads the API key from the config file at path.
func LoadApiKey(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", err
	}
	return cfg.ApiKey, nil
}

// SaveAiOutputDir persists the AI output directory to the config file.
func SaveAiOutputDir(path, dir string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{}
	}
	cfg.AiOutputDir = dir
	return saveConfig(path, cfg)
}

// LoadAiOutputDir retrieves the stored AI output directory.
func LoadAiOutputDir(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", err
	}
	return cfg.AiOutputDir, nil
}

func loadConfig(path string) (*appConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return &appConfig{}, nil
		}
		return nil, err
	}
	var cfg appConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func saveConfig(path string, cfg *appConfig) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

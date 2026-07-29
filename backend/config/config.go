package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"image-toolbox/backend/model"
)

type appConfig struct {
	ActiveProvider string                       `json:"activeProvider"`
	Providers      map[string]ProviderConfig    `json:"providers"`
	ProviderModels map[string][]model.ModelInfo `json:"providerModels,omitempty"`
	AiOutputDir    string                       `json:"aiOutputDir"`
	ApiKey         string                       `json:"apiKey,omitempty"`
}

type ProviderConfig struct {
	ApiKey         string `json:"apiKey"`
	BaseURL        string `json:"baseURL"`
	ReviewModel    string `json:"reviewModel,omitempty"`
	ReviewEndpoint string `json:"reviewEndpoint,omitempty"`
}

const (
	DefaultSeedreamBaseURL    = "https://ark.cn-beijing.volces.com/api/v3"
	DefaultChatGPT2APIBaseURL = "http://localhost:3000"
)

func SaveApiKey(path, apiKey string) error {
	return SaveProviderConfig(path, "seedream", apiKey, DefaultSeedreamBaseURL)
}

func LoadApiKey(path string) (string, error) {
	apiKey, _, err := LoadProviderConfig(path, "seedream")
	return apiKey, err
}

func SaveProviderConfig(path, name, apiKey, baseURL string) error {
	return SaveProviderConfigWithKeyMode(path, name, apiKey, baseURL, false)
}

func SaveProviderConfigWithKeyMode(path, name, apiKey, baseURL string, preserveExistingKey bool) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{Providers: make(map[string]ProviderConfig)}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	existing := cfg.Providers[name]
	if preserveExistingKey {
		apiKey = existing.ApiKey
	}
	cfg.Providers[name] = ProviderConfig{
		ApiKey:         apiKey,
		BaseURL:        baseURL,
		ReviewModel:    existing.ReviewModel,
		ReviewEndpoint: existing.ReviewEndpoint,
	}
	return saveConfig(path, cfg)
}

func LoadProviderConfig(path, name string) (string, string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", "", err
	}
	p, ok := cfg.Providers[name]
	if !ok {
		return "", defaultBaseURL(name), nil
	}
	if p.BaseURL == "" {
		return p.ApiKey, defaultBaseURL(name), nil
	}
	return p.ApiKey, p.BaseURL, nil
}

// SaveProviderReviewConfig persists the explicit plain-text chat model and endpoint.
func SaveProviderReviewConfig(path, name, reviewModel, reviewEndpoint string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{Providers: make(map[string]ProviderConfig)}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	provider := cfg.Providers[name]
	provider.ReviewModel = reviewModel
	provider.ReviewEndpoint = reviewEndpoint
	cfg.Providers[name] = provider
	return saveConfig(path, cfg)
}

// LoadProviderReviewConfig returns the provider key plus explicit text configuration.
func LoadProviderReviewConfig(path, name string) (string, string, string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", "", "", err
	}
	provider, ok := cfg.Providers[name]
	if !ok {
		return "", "", "", nil
	}
	return provider.ApiKey, provider.ReviewModel, provider.ReviewEndpoint, nil
}

func SaveActiveProvider(path, name string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{Providers: make(map[string]ProviderConfig)}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	cfg.ActiveProvider = name
	return saveConfig(path, cfg)
}

func LoadActiveProvider(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		if os.IsNotExist(err) {
			return "seedream", nil
		}
		return "", err
	}
	if cfg.ActiveProvider == "" {
		return "seedream", nil
	}
	return cfg.ActiveProvider, nil
}

func SaveAiOutputDir(path, dir string) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{Providers: make(map[string]ProviderConfig)}
	}
	if cfg.Providers == nil {
		cfg.Providers = make(map[string]ProviderConfig)
	}
	cfg.AiOutputDir = dir
	return saveConfig(path, cfg)
}

func LoadAiOutputDir(path string) (string, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return "", err
	}
	return cfg.AiOutputDir, nil
}

func SaveProviderModels(path, name string, models []model.ModelInfo) error {
	cfg, err := loadConfig(path)
	if err != nil {
		cfg = &appConfig{Providers: make(map[string]ProviderConfig)}
	}
	if cfg.ProviderModels == nil {
		cfg.ProviderModels = make(map[string][]model.ModelInfo)
	}
	cfg.ProviderModels[name] = models
	return saveConfig(path, cfg)
}

func LoadProviderModels(path, name string) ([]model.ModelInfo, error) {
	cfg, err := loadConfig(path)
	if err != nil {
		return nil, err
	}
	models, ok := cfg.ProviderModels[name]
	if !ok || len(models) == 0 {
		return nil, fmt.Errorf("no cached models for %s", name)
	}
	return models, nil
}

func defaultBaseURL(name string) string {
	switch name {
	case "chatgpt2api":
		return DefaultChatGPT2APIBaseURL
	default:
		return DefaultSeedreamBaseURL
	}
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
	if cfg.ApiKey != "" && len(cfg.Providers) == 0 {
		if cfg.Providers == nil {
			cfg.Providers = make(map[string]ProviderConfig)
		}
		cfg.Providers["seedream"] = ProviderConfig{
			ApiKey:  cfg.ApiKey,
			BaseURL: DefaultSeedreamBaseURL,
		}
	}
	return &cfg, nil
}

func saveConfig(path string, cfg *appConfig) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	clone := *cfg
	clone.ApiKey = ""
	data, err := json.MarshalIndent(&clone, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

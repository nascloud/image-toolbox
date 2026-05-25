package batch

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"

	backendAI "image-toolbox/backend/ai"
	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

// RunAIImageBatch processes images through AI generation.
func RunAIImageBatch(ctx context.Context, req model.AIBatchRequest, configPath string, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	providerName := req.Provider
	if providerName == "" {
		var err error
		providerName, err = config.LoadActiveProvider(configPath)
		if err != nil || providerName == "" {
			providerName = "seedream"
		}
	}

	apiKey, baseURL, err := config.LoadProviderConfig(configPath, providerName)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("load config for %s: %v", providerName, err)}
	}
	if apiKey == "" {
		return model.BatchResult{Error: fmt.Sprintf("API key not configured for %s. Go to Settings to set it up.", providerName)}
	}

	provider, err := backendAI.NewProvider(providerName, apiKey, baseURL)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("create provider %s: %v", providerName, err)}
	}

	if req.Model == "" {
		switch providerName {
		case "chatgpt2api":
			req.Model = "gpt-image-2"
		default:
			req.Model = "doubao-seedream-5-0-260128"
		}
	}
	if req.Size == "" {
		req.Size = "2048x2048"
	}
	if req.N <= 0 {
		req.N = 1
	} else if req.N > 4 {
		req.N = 4
	}

	caps := ProviderCapabilities(provider, req.Model)
	outExt := outputFileExtension(caps, req.OutputFormat)

	outputPaths := uniqueOutputPaths(req.SourcePaths, func(srcPath string) string {
		name := trimImageExt(srcPath)
		return filepath.Join(req.OutputDir, name+"_ai"+outExt)
	})

	jobFn := func(srcPath string) ([]string, error) {
		return backendAI.ProcessSingleImagesWithContext(ctx, provider, srcPath, req.OutputDir, req, outputPaths[srcPath])
	}

	maxConcurrent := 2
	if req.Concurrent > 0 {
		maxConcurrent = req.Concurrent
	}
	results := RunConcurrentPaths(ctx, req.SourcePaths, jobFn, maxConcurrent, progressCh)
	return aggregateResults(results)
}

// ProviderCapabilities looks up capabilities for a model from any provider.
func ProviderCapabilities(provider backendAI.Provider, modelID string) model.ModelCapabilities {
	for _, m := range provider.Models() {
		if m.ID == modelID {
			return m.Capabilities
		}
	}
	return model.ModelCapabilities{}
}

func outputFileExtension(caps model.ModelCapabilities, requestedFormat string) string {
	if requestedFormat == "png" || (requestedFormat == "" && caps.DefaultOutputFormat == "png") {
		return ".png"
	}
	return ".jpg"
}

func trimImageExt(srcPath string) string {
	base := filepath.Base(srcPath)
	return strings.TrimSuffix(base, filepath.Ext(base))
}

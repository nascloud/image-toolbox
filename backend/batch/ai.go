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
	apiKey, err := config.LoadApiKey(configPath)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("load API key: %v", err)}
	}
	if apiKey == "" {
		return model.BatchResult{Error: "API key not configured. Go to Settings to set your API key."}
	}

	if req.Model == "" {
		req.Model = "doubao-seedream-5-0-260128"
	}
	if req.Size == "" {
		req.Size = "2048x2048"
	}

	provider := backendAI.NewSeedreamProvider(apiKey, "")
	caps := backendAI.ProviderCapabilities(provider, req.Model)

	outputPaths := uniqueOutputPaths(req.SourcePaths, func(srcPath string) string {
		outExt := ".jpg"
		if caps.DefaultOutputFormat == "png" {
			outExt = ".png"
		}
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

func trimImageExt(srcPath string) string {
	base := filepath.Base(srcPath)
	return strings.TrimSuffix(base, filepath.Ext(base))
}

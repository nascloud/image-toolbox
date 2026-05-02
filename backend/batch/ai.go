package batch

import (
	"fmt"

	backendAI "image-toolbox/backend/ai"
	"image-toolbox/backend/config"
	"image-toolbox/backend/model"
)

// RunAIImageBatch processes images through AI generation.
func RunAIImageBatch(req model.AIBatchRequest, configPath string, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	apiKey, err := config.LoadApiKey(configPath)
	if err != nil {
		return model.BatchResult{Error: fmt.Sprintf("load API key: %v", err)}
	}
	if apiKey == "" {
		return model.BatchResult{Error: "API key not configured. Go to Settings to set your API key."}
	}

	client := backendAI.NewClient(apiKey)

	if req.Model == "" {
		req.Model = "doubao-seedream-5-0-260128"
	}
	if req.Size == "" {
		req.Size = "2048x2048"
	}

	jobFn := func(srcPath string) (string, error) {
		return backendAI.ProcessSingleImage(client, srcPath, req.OutputDir, req)
	}

	maxConcurrent := 2
	if req.Concurrent > 0 {
		maxConcurrent = req.Concurrent
	}
	results := RunConcurrent(req.SourcePaths, jobFn, maxConcurrent, progressCh)
	return aggregateResults(results)
}

package batch

import (
	"context"
	"sync"

	"image-toolbox/backend/model"
)

// JobFunc processes a single source path and returns the output path or error.
type JobFunc func(srcPath string) (string, error)

// JobFuncPaths processes a single source path and returns all output paths or error.
type JobFuncPaths func(srcPath string) ([]string, error)

// RunConcurrent executes jobs concurrently with a progress channel.
// If ctx is cancelled, remaining pending jobs are skipped and marked as cancelled.
func RunConcurrent(ctx context.Context, sources []string, fn JobFunc, maxConcurrent int, progressCh chan<- model.ProgressUpdate) []model.ImageResult {
	return RunConcurrentPaths(ctx, sources, func(srcPath string) ([]string, error) {
		outPath, err := fn(srcPath)
		if err != nil {
			return nil, err
		}
		if outPath == "" {
			return nil, nil
		}
		return []string{outPath}, nil
	}, maxConcurrent, progressCh)
}

// RunConcurrentPaths executes jobs concurrently and supports multiple output paths per source.
func RunConcurrentPaths(ctx context.Context, sources []string, fn JobFuncPaths, maxConcurrent int, progressCh chan<- model.ProgressUpdate) []model.ImageResult {
	if maxConcurrent <= 0 {
		maxConcurrent = 1
	}
	total := len(sources)
	results := make([]model.ImageResult, total)
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxConcurrent)
	var mu sync.Mutex

	for i, src := range sources {
		select {
		case <-ctx.Done():
			mu.Lock()
			results[i] = model.ImageResult{SourcePath: src, Error: "cancelled"}
			mu.Unlock()
			continue
		case sem <- struct{}{}:
		}

		wg.Add(1)
		go func(idx int, path string) {
			defer wg.Done()
			defer func() { <-sem }()

			r := model.ImageResult{SourcePath: path}
			if ctx.Err() != nil {
				r.Error = "cancelled"
			} else {
				outPaths, err := fn(path)
				if err != nil {
					r.Error = err.Error()
				} else {
					r.Success = true
					r.OutputPaths = outPaths
					if len(outPaths) > 0 {
						r.OutputPath = outPaths[0]
					}
				}
			}

			mu.Lock()
			results[idx] = r
			completed := 0
			for _, res := range results {
				if res.SourcePath != "" {
					completed++
				}
			}
			mu.Unlock()

			if progressCh != nil {
				progressCh <- model.ProgressUpdate{
					Completed: completed,
					Total:     total,
					Current:   path,
					Error:     r.Error,
				}
			}
		}(i, src)
	}

	wg.Wait()

	if progressCh != nil {
		progressCh <- model.ProgressUpdate{Completed: total, Total: total, Done: true}
	}

	return results
}

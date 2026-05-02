package app

import (
	"image-toolbox/backend/batch"
	"image-toolbox/backend/file"
	"image-toolbox/backend/model"
)

// App is the thin Wails API layer that exposes methods to the frontend.
// It delegates all logic to the backend packages and holds no processing state.
type App struct {
	progressCallbacks map[string]chan model.ProgressUpdate
}

// NewApp creates a new API App instance.
func NewApp() *App {
	return &App{
		progressCallbacks: make(map[string]chan model.ProgressUpdate),
	}
}

// ScanDirectory scans a directory for supported image files.
// If recursive is true, it walks subdirectories as well.
func (a *App) ScanDirectory(dir string, recursive bool) ([]string, error) {
	return file.ScanImageFiles(dir, recursive)
}

// ProcessImagesBatch executes a full local batch processing pipeline.
// If SourcePaths is empty but OutputDir is provided, it scans OutputDir for images first.
func (a *App) ProcessImagesBatch(req model.BatchRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}

	progressCh := make(chan model.ProgressUpdate, 100)
	result := batch.RunLocalBatch(req, progressCh)
	close(progressCh)

	return result, nil
}

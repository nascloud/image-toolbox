package app

import (
	"context"
	"fmt"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"image-toolbox/backend/batch"
	"image-toolbox/backend/file"
	"image-toolbox/backend/model"
)

// App is the thin Wails API layer that exposes methods to the frontend.
// It delegates all logic to the backend packages.
type App struct {
	ctx context.Context
}

// NewApp creates a new API App instance.
func NewApp() *App {
	return &App{}
}

// SetContext stores the Wails runtime context for dialog and event calls.
func (a *App) SetContext(ctx context.Context) {
	a.ctx = ctx
}

// SelectFiles opens a file dialog for selecting image files.
func (a *App) SelectFiles() ([]string, error) {
	files, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择图片文件",
		Filters: []runtime.FileFilter{
			{DisplayName: "图片文件", Pattern: "*.jpg;*.jpeg;*.png;*.webp;*.bmp;*.gif;*.tiff"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("select files: %w", err)
	}
	return files, nil
}

// SelectDirectory opens a directory picker.
func (a *App) SelectDirectory() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择图片文件夹",
	})
	if err != nil {
		return "", fmt.Errorf("select directory: %w", err)
	}
	return dir, nil
}

// ScanDirectory scans a directory for supported image files.
func (a *App) ScanDirectory(dir string, recursive bool) ([]string, error) {
	return file.ScanImageFiles(dir, recursive)
}

// ProcessImagesBatch executes a full local batch processing pipeline with progress events.
func (a *App) ProcessImagesBatch(req model.BatchRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}

	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunLocalBatch(req, progressCh)
	close(progressCh)

	return result, nil
}

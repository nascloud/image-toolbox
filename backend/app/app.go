package app

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"image-toolbox/backend/batch"
	"image-toolbox/backend/config"
	"image-toolbox/backend/file"
	"image-toolbox/backend/model"
)

// App is the thin Wails API layer that exposes methods to the frontend.
type App struct {
	ctx       context.Context
	cancelFn  context.CancelFunc
}

// NewApp creates a new API App instance.
func NewApp() *App {
	return &App{}
}

// SetContext stores the Wails runtime context for dialog and event calls.
func (a *App) SetContext(ctx context.Context) {
	a.ctx = ctx
}

// newBatchContext creates a cancellable context for batch operations.
func (a *App) newBatchContext() context.Context {
	if a.cancelFn != nil {
		a.cancelFn()
	}
	ctx, cancel := context.WithCancel(context.Background())
	a.cancelFn = cancel
	return ctx
}

// CancelBatch cancels the currently running batch operation.
func (a *App) CancelBatch() {
	if a.cancelFn != nil {
		a.cancelFn()
		a.cancelFn = nil
	}
}

// OpenOutputDir opens the given directory in the file explorer.
func (a *App) OpenOutputDir(dir string) error {
	if dir == "" {
		return fmt.Errorf("no directory specified")
	}
	cmd := exec.Command("explorer", dir)
	return cmd.Start()
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

// SelectOutputDir opens a directory picker for output.
func (a *App) SelectOutputDir() (string, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择输出文件夹",
	})
	if err != nil {
		return "", fmt.Errorf("select output dir: %w", err)
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

	ctx := a.newBatchContext()
	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunLocalBatch(ctx, req, progressCh)
	close(progressCh)
	return result, nil
}

// SliceImages processes a batch of images with the slicing operation.
func (a *App) SliceImages(req model.SliceRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}
	if req.SliceCount <= 0 {
		req.SliceCount = 25
	}
	if req.Contrast <= 0 {
		req.Contrast = 1.0
	}
	if req.Saturation <= 0 {
		req.Saturation = 1.0
	}

	ctx := a.newBatchContext()
	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunSliceBatch(ctx, req, progressCh)
	close(progressCh)
	return result, nil
}

// WatermarkImages processes a batch of images with watermark.
func (a *App) WatermarkImages(req model.WatermarkRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}
	if req.Opacity <= 0 {
		req.Opacity = 0.5
	} else if req.Opacity > 1.0 {
		req.Opacity = 1.0
	}
	if req.Position == "" {
		req.Position = "bottomRight"
	}

	ctx := a.newBatchContext()
	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunWatermarkBatch(ctx, req, progressCh)
	close(progressCh)
	return result, nil
}

// RunAIImageBatch processes images through AI generation.
func (a *App) RunAIImageBatch(req model.AIBatchRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}

	ctx := a.newBatchContext()
	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	configPath := filepath.Join(getConfigDir(), "config.json")
	result := batch.RunAIImageBatch(ctx, req, configPath, progressCh)
	close(progressCh)
	return result, nil
}

// SaveApiKey persists the API key to the config file.
func (a *App) SaveApiKey(apiKey string) error {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.SaveApiKey(configPath, apiKey)
}

// GetApiKey retrieves the stored API key.
func (a *App) GetApiKey() (string, error) {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.LoadApiKey(configPath)
}

func getConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".imagetool"
	}
	return filepath.Join(home, ".imagetool")
}

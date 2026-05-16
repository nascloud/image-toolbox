package app

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	"image/jpeg"
	_ "image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "golang.org/x/image/webp"

	"image-toolbox/backend/batch"
	"image-toolbox/backend/config"
	"image-toolbox/backend/file"
	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// App is the thin Wails API layer that exposes methods to the frontend.
type App struct {
	ctx       context.Context
	cancelFn  context.CancelFunc
}

// NewApp creates a new API App instance.
func NewApp() *App {
	file.CleanupOldAITempDirs()
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
			{DisplayName: "图片文件", Pattern: "*.jpg;*.jpeg;*.jfif;*.png;*.webp;*.bmp;*.gif;*.tiff"},
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

// ReadImageAsBase64 reads an image file and returns a data URI for display in the frontend.
func (a *App) ReadImageAsBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read image: %w", err)
	}
	ext := strings.ToLower(filepath.Ext(path))
	mime := "image/png"
	switch ext {
	case ".jpg", ".jpeg", ".jfif":
		mime = "image/jpeg"
	case ".png":
		mime = "image/png"
	case ".webp":
		mime = "image/webp"
	case ".gif":
		mime = "image/gif"
	}
	return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data)), nil
}

// ReadImageThumbnail reads an image file, downscales it to the given maxDim (longest side),
// and returns a JPEG base64 data URI. Use maxDim=80 for queue icons, 320 for hover preview.
func (a *App) ReadImageThumbnail(path string, maxDim int) (string, error) {
	if maxDim <= 0 || maxDim > 1024 {
		maxDim = 80
	}

	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open image: %w", err)
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return "", fmt.Errorf("decode image: %w", err)
	}

	bounds := img.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	// If image is already smaller than maxDim, no need to downscale
	if srcW <= maxDim && srcH <= maxDim {
		var buf bytes.Buffer
		if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
			return "", fmt.Errorf("encode thumbnail: %w", err)
		}
		return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
	}

	// Calculate thumbnail dimensions (max maxDim on longest side)
	thumbW, thumbH := maxDim, maxDim
	if srcW > srcH {
		thumbH = srcH * maxDim / srcW
		if thumbH < 1 {
			thumbH = 1
		}
	} else {
		thumbW = srcW * maxDim / srcH
		if thumbW < 1 {
			thumbW = 1
		}
	}

	// Simple nearest-neighbor downscale
	thumb := image.NewRGBA(image.Rect(0, 0, thumbW, thumbH))
	for y := 0; y < thumbH; y++ {
		srcY := y * srcH / thumbH
		for x := 0; x < thumbW; x++ {
			srcX := x * srcW / thumbW
			thumb.Set(x, y, img.At(bounds.Min.X+srcX, bounds.Min.Y+srcY))
		}
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, thumb, &jpeg.Options{Quality: 75}); err != nil {
		return "", fmt.Errorf("encode thumbnail: %w", err)
	}

	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
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

// GetImageInfo returns basic metadata about an image file.
func (a *App) GetImageInfo(filePath string) (map[string]interface{}, error) {
	info := map[string]interface{}{}
	if filePath == "" {
		return info, fmt.Errorf("no file path provided")
	}

	stat, err := os.Stat(filePath)
	if err != nil {
		return info, fmt.Errorf("stat file: %w", err)
	}
	info["fileName"] = stat.Name()
	info["fileSize"] = stat.Size()

	f, err := os.Open(filePath)
	if err != nil {
		return info, fmt.Errorf("open file: %w", err)
	}
	defer f.Close()

	cfg, format, err := image.DecodeConfig(f)
	if err != nil {
		return info, nil // still return partial info
	}
	info["width"] = cfg.Width
	info["height"] = cfg.Height
	info["format"] = strings.ToUpper(format)

	return info, nil
}

// PreviewWatermark generates a base64 encoded thumbnail of the watermarked image for preview.
func (a *App) PreviewWatermark(req model.WatermarkPreviewRequest) (string, error) {
	if req.SourcePath == "" {
		return "", fmt.Errorf("no source path provided")
	}
	f, err := os.Open(req.SourcePath)
	if err != nil {
		return "", fmt.Errorf("open image: %w", err)
	}
	defer f.Close()

	img, _, err := image.Decode(f)
	if err != nil {
		return "", fmt.Errorf("decode image: %w", err)
	}

	// Downscale source image to a reasonable size for preview to speed up processing
	maxDim := 2000
	bounds := img.Bounds()
	if bounds.Dx() > maxDim || bounds.Dy() > maxDim {
		// Just a simple scale down based on the longest side
		img = backendImage.ResizeImage(img, backendImage.ResizeOptions{
			Mode: backendImage.ResizeModeMaxEdge, MaxEdge: maxDim,
		})
	}

	var wmImage image.Image
	if req.WatermarkImage != "" {
		wf, err := os.Open(req.WatermarkImage)
		if err != nil {
			return "", fmt.Errorf("open watermark image: %w", err)
		}
		defer wf.Close()
		wmImage, _, err = image.Decode(wf)
		if err != nil {
			return "", fmt.Errorf("decode watermark image: %w", err)
		}
		// Scale watermark image proportionally if the source image was scaled
		if bounds.Dx() > maxDim || bounds.Dy() > maxDim {
			scale := float64(maxDim) / float64(bounds.Dx())
			if bounds.Dy() > bounds.Dx() {
				scale = float64(maxDim) / float64(bounds.Dy())
			}
			wmBounds := wmImage.Bounds()
			newWmW := int(float64(wmBounds.Dx()) * scale)
			if newWmW < 1 {
				newWmW = 1
			}
			wmImage = backendImage.ResizeImage(wmImage, backendImage.ResizeOptions{
				Mode: backendImage.ResizeModeMaxEdge, MaxEdge: newWmW,
			})
		}
	}

	var result image.Image = img
	if wmImage != nil {
		result = backendImage.AddImageWatermark(img, wmImage, req.Opacity, req.Position)
	} else if req.WatermarkText != "" {
		// Adjust font size for the preview scale
		fSize := req.FontSize
		if fSize <= 0 {
			fSize = 12
		}
		if bounds.Dx() > maxDim || bounds.Dy() > maxDim {
			scale := float64(maxDim) / float64(bounds.Dx())
			if bounds.Dy() > bounds.Dx() {
				scale = float64(maxDim) / float64(bounds.Dy())
			}
			fSize = int(float64(fSize) * scale)
			if fSize < 8 {
				fSize = 8 // ensure it's still somewhat readable
			}
		}
		result = backendImage.AddTextWatermark(img, req.WatermarkText, req.Opacity, req.Position, fSize, req.FontColor)
	}

	var buf bytes.Buffer
	// Encode as JPEG for fast preview
	if err := jpeg.Encode(&buf, result, &jpeg.Options{Quality: 80}); err != nil {
		return "", fmt.Errorf("encode preview: %w", err)
	}

	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// RunAIImageBatch processes images through AI generation.
// Images are written to a temporary cache directory. Use SaveFilesToDir
// to persist them to a permanent location.
func (a *App) RunAIImageBatch(req model.AIBatchRequest) (model.BatchResult, error) {
	if len(req.SourcePaths) == 0 && req.OutputDir != "" {
		paths, err := file.ScanImageFiles(req.OutputDir, false)
		if err != nil {
			return model.BatchResult{}, err
		}
		req.SourcePaths = paths
	}

	tmpDir, err := file.AITempDir()
	if err != nil {
		return model.BatchResult{}, fmt.Errorf("create temp dir: %w", err)
	}
	req.OutputDir = tmpDir

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

// SaveAiOutputDir persists the AI output directory.
func (a *App) SaveAiOutputDir(dir string) error {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.SaveAiOutputDir(configPath, dir)
}

// SaveFilesToDir copies a list of source files to the given destination directory.
func (a *App) SaveFilesToDir(sourcePaths []string, destDir string) (int, error) {
	var count int
	for _, src := range sourcePaths {
		if _, err := file.CopyFile(src, destDir); err != nil {
			continue
		}
		count++
	}
	if count == 0 {
		return 0, fmt.Errorf("no files were copied")
	}
	return count, nil
}

// GetAiOutputDir retrieves the stored AI output directory.
func (a *App) GetAiOutputDir() (string, error) {
	configPath := filepath.Join(getConfigDir(), "config.json")
	return config.LoadAiOutputDir(configPath)
}

func getConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".imagetool"
	}
	return filepath.Join(home, ".imagetool")
}

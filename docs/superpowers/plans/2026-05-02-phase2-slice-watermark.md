# Phase 2: Slice + Watermark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Tab2 (image slicing) and Tab3 (image watermark) with full backend + frontend.

**Architecture:** New `image/slice.go` and `image/watermark.go` functions, new batch orchestrators (`batch/slice.go`, `batch/watermark.go`), new model types, exposed via `app.go`, new frontend pages.

**Tech Stack:** Go stdlib `image`, `golang.org/x/image`, Go `math/rand/v2` for slice randomization, `golang.org/x/image/font/basicfont` for text watermarking.

---

## File Structure

### Backend (new and modified)
```
backend/
├── app/app.go                          # MODIFY: add SliceImages, WatermarkImages
├── image/
│   ├── slice.go                        # CREATE: random image slicing
│   ├── slice_test.go                   # CREATE
│   ├── watermark.go                    # CREATE: image + text watermark
│   └── watermark_test.go               # CREATE
├── batch/
│   ├── slice.go                        # CREATE: slice batch orchestration
│   └── watermark.go                    # CREATE: watermark batch orchestration
└── model/
    ├── slice.go                        # CREATE: SliceRequest / SliceOptions
    └── watermark.go                    # CREATE: WatermarkRequest / WatermarkOptions
```

### Frontend (new)
```
frontend/src/
├── App.tsx                             # MODIFY: replace Slice/Watermark placeholders
└── pages/
    ├── Slice.tsx                       # CREATE: Tab2 page
    └── Watermark.tsx                   # CREATE: Tab3 page
```

---

### Task 1: Image Slice Backend

**Files:**
- Create: `backend/image/slice.go`
- Create: `backend/image/slice_test.go`
- Create: `backend/model/slice.go`
- Create: `backend/batch/slice.go`

- [ ] **Step 1: Create model/slice.go**

```go
package model

type SliceRequest struct {
	SourcePaths []string `json:"sourcePaths"`
	OutputDir   string   `json:"outputDir"`
	SliceCount  int      `json:"sliceCount"`
	Contrast    float64  `json:"contrast"`   // 0.1–2.0, 1.0 = no change
	Saturation  float64  `json:"saturation"` // 0.1–2.0, 1.0 = no change
}
```

- [ ] **Step 2: Write slice_test.go**

```go
package image

import (
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"
)

func createTestImageForSlice(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{100, 150, 200, 255})
		}
	}
	return img
}

func TestSliceImageCount(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 25, 1.0, 1.0)
	if len(slices) != 25 {
		t.Errorf("expected 25 slices, got %d", len(slices))
	}
}

func TestSliceHeightsSum(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 10, 1.0, 1.0)
	totalH := 0
	for _, s := range slices {
		totalH += s.Bounds().Dy()
	}
	if totalH != 300 {
		t.Errorf("expected total height 300, got %d", totalH)
	}
}

func TestSliceMinHeight(t *testing.T) {
	// A small image with many slices forces minimum height
	img := createTestImageForSlice(t, 100, 60)
	slices := SliceImage(img, 10, 1.0, 1.0)
	for i, s := range slices {
		if s.Bounds().Dy() < 1 {
			t.Errorf("slice %d has height %d", i, s.Bounds().Dy())
		}
	}
}

func TestSliceWidthPreserved(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImage(img, 5, 1.0, 1.0)
	for i, s := range slices {
		if s.Bounds().Dx() != 200 {
			t.Errorf("slice %d width = %d, want 200", i, s.Bounds().Dx())
		}
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/image/ -v -run TestSlice
```
Expected: FAIL (SliceImage and SliceOptions undefined)

- [ ] **Step 4: Write slice.go**

```go
package image

import (
	"image"
	"image/color"
	"math"
	"math/rand/v2"
)

type SliceOptions struct {
	Count     int
	Contrast  float64
	Saturation float64
}

// calcSliceHeights generates random slice heights that sum to imageHeight.
func calcSliceHeights(imageHeight, sliceCount, minHeight int) []int {
	avgHeight := float64(imageHeight) / float64(sliceCount)

	heights := make([]int, sliceCount)
	remaining := imageHeight

	for i := 0; i < sliceCount; i++ {
		if i == sliceCount-1 {
			heights[i] = remaining
			break
		}

		minAllow := max(minHeight, int(math.Round(avgHeight*0.9)))
		maxAllow := max(minAllow+1, int(math.Round(avgHeight*1.1)))

		// Don't take more than remaining space for other slices
		roomForOthers := remaining - (sliceCount-i-1)*minHeight
		if roomForOthers < maxAllow {
			maxAllow = roomForOthers
		}
		if maxAllow < minAllow {
			maxAllow = minAllow
		}

		h := rand.IntN(maxAllow-minAllow+1) + minAllow
		heights[i] = h
		remaining -= h
	}

	return heights
}

func adjustContrast(img image.Image, factor float64) *image.RGBA {
	if factor == 1.0 {
		return convertToRGBA(img)
	}
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			ri := float64(r >> 8)
			gi := float64(g >> 8)
			bi := float64(b >> 8)
			nr := uint8(clampFloat(128+(ri-128)*factor, 0, 255))
			ng := uint8(clampFloat(128+(gi-128)*factor, 0, 255))
			nb := uint8(clampFloat(128+(bi-128)*factor, 0, 255))
			dst.Set(x, y, color.RGBA{nr, ng, nb, uint8(a >> 8)})
		}
	}
	return dst
}

func applySaturation(img image.Image, factor float64) *image.RGBA {
	if factor == 1.0 {
		return convertToRGBA(img)
	}
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			ri := float64(r >> 8)
			gi := float64(g >> 8)
			bi := float64(b >> 8)

			// Convert to grayscale intensity
			gray := 0.299*ri + 0.587*gi + 0.114*bi
			nr := uint8(clampFloat(gray+(ri-gray)*factor, 0, 255))
			ng := uint8(clampFloat(gray+(gi-gray)*factor, 0, 255))
			nb := uint8(clampFloat(gray+(bi-gray)*factor, 0, 255))
			dst.Set(x, y, color.RGBA{nr, ng, nb, uint8(a >> 8)})
		}
	}
	return dst
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func convertToRGBA(img image.Image) *image.RGBA {
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			dst.Set(x, y, img.At(x, y))
		}
	}
	return dst
}

// SliceImage randomly divides an image into sliceCount horizontal strips.
func SliceImage(src image.Image, sliceCount int, contrast, saturation float64) []image.Image {
	img := src
	if contrast != 1.0 {
		img = adjustContrast(img, contrast)
	}
	if saturation != 1.0 {
		img = applySaturation(img, saturation)
	}

	bounds := img.Bounds()
	height := bounds.Dy()
	minH := 50
	if height/sliceCount < minH {
		minH = max(1, height/sliceCount)
	}

	heights := calcSliceHeights(height, sliceCount, minH)
	slices := make([]image.Image, 0, sliceCount)
	yOff := 0

	for _, h := range heights {
		rect := image.Rect(0, yOff, bounds.Dx(), yOff+h)
		slice := image.NewRGBA(rect)
		for y := rect.Min.Y; y < rect.Max.Y; y++ {
			for x := rect.Min.X; x < rect.Max.X; x++ {
				slice.Set(x, y-rect.Min.Y, img.At(x, y))
			}
		}
		slices = append(slices, slice)
		yOff += h
	}

	return slices
}
```

- [ ] **Step 5: Write batch/slice.go**

```go
package batch

import (
	"fmt"
	"image"
	"os"
	"path/filepath"
	"strings"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// RunSliceBatch processes images with the slicing operation.
func RunSliceBatch(req model.SliceRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	jobFn := func(srcPath string) (string, error) {
		f, err := os.Open(srcPath)
		if err != nil {
			return "", fmt.Errorf("open: %w", err)
		}
		defer f.Close()

		img, _, err := image.Decode(f)
		if err != nil {
			return "", fmt.Errorf("decode: %w", err)
		}

		slices := backendImage.SliceImage(img, req.SliceCount, req.Contrast, req.Saturation)
		if len(slices) == 0 {
			return "", fmt.Errorf("slice returned 0 slices")
		}

		base := filepath.Base(srcPath)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)

		var lastPath string
		for i, slice := range slices {
			outPath := filepath.Join(req.OutputDir, fmt.Sprintf("%s_slice_%d.png", name, i+1))
			if err := saveImage(slice, outPath); err != nil {
				return "", fmt.Errorf("save slice %d: %w", i, err)
			}
			lastPath = outPath
		}
		// Return last path as primary result
		return lastPath, nil
	}

	results := RunConcurrent(req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}

func saveImage(img image.Image, path string) error {
	// Use PNG encoding for slices
	return saveAsPNG(img, path)
}

func saveAsPNG(img image.Image, path string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	return png.Encode(f, img)
}
```

Note: Add `"image/png"` to the import block. The `aggregateResults` helper should be created in batch/runner.go or batch/local.go.

- [ ] **Step 6: Add aggregateResults helper to batch/local.go or a new shared function**

Add to batch/local.go:
```go
func aggregateResults(results []model.ImageResult) model.BatchResult {
	successCount := 0
	failedCount := 0
	for _, r := range results {
		if r.Success {
			successCount++
		} else {
			failedCount++
		}
	}
	return model.BatchResult{
		Total:   len(results),
		Success: successCount,
		Failed:  failedCount,
		Results: results,
	}
}
```

Also export the function as public or duplicate in batch/slice.go and batch/watermark.go.

- [ ] **Step 7: Run all image + batch tests**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/image/... ./backend/batch/... -v
```
Expected: ALL PASS (existing tests + new slice tests)

- [ ] **Step 8: Commit**

```bash
git add backend/image/slice.go backend/image/slice_test.go backend/model/slice.go backend/batch/slice.go
git commit -m "feat: implement image slicing with random strip distribution"
```

---

### Task 2: Image Watermark Backend

**Files:**
- Create: `backend/image/watermark.go`
- Create: `backend/image/watermark_test.go`
- Create: `backend/model/watermark.go`
- Create: `backend/batch/watermark.go`

- [ ] **Step 1: Create model/watermark.go**

```go
package model

type WatermarkRequest struct {
	SourcePaths    []string `json:"sourcePaths"`
	OutputDir      string   `json:"outputDir"`
	WatermarkImage string   `json:"watermarkImage"` // path, empty = text mode
	WatermarkText  string   `json:"watermarkText"`  // text, empty = image mode
	Opacity        float64  `json:"opacity"`         // 0.0–1.0
	Position       string   `json:"position"`        // "tile", "center", "bottomRight", "topLeft"
	FontSize       int      `json:"fontSize"`
	FontColor      string   `json:"fontColor"`       // hex "#RRGGBB"
	UniformWidth   int      `json:"uniformWidth"`    // 0 = disabled
}
```

- [ ] **Step 2: Write watermark_test.go**

```go
package image

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func createWatermarkImage(t *testing.T, w, h int) image.Image {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{255, 255, 255, 200})
		}
	}
	return img
}

func TestImageWatermarkTiled(t *testing.T) {
	base := createSolidImage(t, 200, 200)
	wm := createWatermarkImage(t, 50, 50)
	result := AddImageWatermark(base, wm, 0.5, "tile")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed: %dx%d", result.Bounds().Dx(), result.Bounds().Dy())
	}
}

func TestImageWatermarkCentered(t *testing.T) {
	base := createSolidImage(t, 200, 200)
	wm := createWatermarkImage(t, 50, 50)
	result := AddImageWatermark(base, wm, 0.5, "center")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed")
	}
}

func TestTextWatermark(t *testing.T) {
	base := createSolidImage(t, 200, 200)
	result := AddTextWatermark(base, "Test", 0.5, "bottomRight", 12, "#ffffff")
	if result.Bounds().Dx() != 200 || result.Bounds().Dy() != 200 {
		t.Errorf("dimensions changed")
	}
}
```

- [ ] **Step 3: Run test to verify it fails**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/image/ -v -run TestWatermark
```
Expected: FAIL

- [ ] **Step 4: Write watermark.go**

```go
package image

import (
	"image"
	"image/color"
	"image/draw"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// AddImageWatermark tiles or places a watermark image over the base.
func AddImageWatermark(base, watermark image.Image, opacity float64, position string) *image.RGBA {
	bounds := base.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, base, image.Point{}, draw.Src)

	wmBounds := watermark.Bounds()
	wmW := wmBounds.Dx()
	wmH := wmBounds.Dy()

	// Adjust watermark opacity
	adjustedWM := adjustOpacity(watermark, opacity)

	switch strings.ToLower(position) {
	case "tile":
		for y := 0; y < bounds.Dy(); y += wmH {
			for x := 0; x < bounds.Dx(); x += wmW {
				draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
			}
		}
	case "center":
		x := (bounds.Dx() - wmW) / 2
		y := (bounds.Dy() - wmH) / 2
		draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
	case "bottomRight":
		x := bounds.Dx() - wmW - 10
		y := bounds.Dy() - wmH - 10
		if x < 0 {
			x = 0
		}
		if y < 0 {
			y = 0
		}
		draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
	default: // topLeft
		draw.Draw(dst, image.Rect(0, 0, wmW, wmH), adjustedWM, image.Point{}, draw.Over)
	}

	return dst
}

func adjustOpacity(src image.Image, opacity float64) *image.RGBA {
	bounds := src.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := src.At(x, y).RGBA()
			na := uint32(float64(a>>8) * opacity)
			dst.Set(x, y, color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(na)})
		}
	}
	return dst
}

// AddTextWatermark draws text onto an image.
func AddTextWatermark(base image.Image, text string, opacity float64, position string, fontSize int, fontColor string) *image.RGBA {
	bounds := base.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, base, image.Point{}, draw.Src)

	// Parse color
	c := parseHexColor(fontColor)
	c.A = uint8(opacity * 255)

	face := basicfont.Face7x13
	drawer := &font.Drawer{
		Dst:  dst,
		Src:  image.NewUniform(c),
		Face: face,
	}

	textW := font.MeasureString(face, text).Ceil()
	textH := face.Metrics().Height.Ceil()

	var x, y int
	switch strings.ToLower(position) {
	case "center":
		x = (bounds.Dx() - textW) / 2
		y = (bounds.Dy()-textH)/2 + textH
	case "bottomRight":
		x = bounds.Dx() - textW - 10
		y = bounds.Dy() - 10
	default: // topLeft
		x = 10
		y = textH + 10
	}

	if x < 0 {
		x = 10
	}
	if y < textH {
		y = textH + 10
	}

	drawer.Dot = fixed.P(x, y)
	drawer.DrawString(text)

	return dst
}

func parseHexColor(hex string) color.RGBA {
	if len(hex) == 0 {
		return color.RGBA{255, 255, 255, 255}
	}
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) != 6 {
		return color.RGBA{255, 255, 255, 255}
	}
	r := hexToByte(hex[0:2])
	g := hexToByte(hex[2:4])
	b := hexToByte(hex[4:6])
	return color.RGBA{r, g, b, 255}
}

func hexToByte(s string) uint8 {
	var v uint8
	for _, c := range s {
		v *= 16
		switch {
		case c >= '0' && c <= '9':
			v += uint8(c - '0')
		case c >= 'a' && c <= 'f':
			v += uint8(c - 'a' + 10)
		case c >= 'A' && c <= 'F':
			v += uint8(c - 'A' + 10)
		}
	}
	return v
}
```

- [ ] **Step 5: Write batch/watermark.go**

```go
package batch

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	backendImage "image-toolbox/backend/image"
	"image-toolbox/backend/model"
)

// RunWatermarkBatch processes images with watermark operation.
func RunWatermarkBatch(req model.WatermarkRequest, progressCh chan<- model.ProgressUpdate) model.BatchResult {
	// Load watermark image if provided
	var wmImage image.Image
	if req.WatermarkImage != "" {
		f, err := os.Open(req.WatermarkImage)
		if err != nil {
			return model.BatchResult{Error: fmt.Sprintf("open watermark image: %v", err)}
		}
		defer f.Close()
		wmImage, _, err = image.Decode(f)
		if err != nil {
			return model.BatchResult{Error: fmt.Sprintf("decode watermark image: %v", err)}
		}
	}

	jobFn := func(srcPath string) (string, error) {
		f, err := os.Open(srcPath)
		if err != nil {
			return "", fmt.Errorf("open: %w", err)
		}
		defer f.Close()

		img, _, err := image.Decode(f)
		if err != nil {
			return "", fmt.Errorf("decode: %w", err)
		}

		var result *image.RGBA
		if wmImage != nil {
			result = backendImage.AddImageWatermark(img, wmImage, req.Opacity, req.Position)
		} else if req.WatermarkText != "" {
			result = backendImage.AddTextWatermark(img, req.WatermarkText, req.Opacity, req.Position, req.FontSize, req.FontColor)
		} else {
			return "", fmt.Errorf("no watermark image or text provided")
		}

		base := filepath.Base(srcPath)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		outPath := filepath.Join(req.OutputDir, name+"_watermarked"+ext)

		fOut, err := os.Create(outPath)
		if err != nil {
			return "", fmt.Errorf("create: %w", err)
		}
		defer fOut.Close()

		if err := png.Encode(fOut, result); err != nil {
			return "", fmt.Errorf("encode: %w", err)
		}

		return outPath, nil
	}

	results := RunConcurrent(req.SourcePaths, jobFn, 4, progressCh)
	return aggregateResults(results)
}
```

- [ ] **Step 6: Run all image tests**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/image/... -v
```
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add backend/image/watermark.go backend/image/watermark_test.go backend/model/watermark.go backend/batch/watermark.go
git commit -m "feat: implement image and text watermark"
```

---

### Task 3: Update Wails API Layer

**Files:**
- Modify: `backend/app/app.go`
- Also extract `aggregateResults` to shared location

- [ ] **Step 1: Read current app.go**

Read `backend/app/app.go` to see existing structure.

- [ ] **Step 2: Add SliceImages and WatermarkImages methods**

Add these methods to `backend/app/app.go`:

```go
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

	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunSliceBatch(req, progressCh)
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

	progressCh := make(chan model.ProgressUpdate, 100)
	go func() {
		for update := range progressCh {
			runtime.EventsEmit(a.ctx, "batch-progress", update)
		}
	}()

	result := batch.RunWatermarkBatch(req, progressCh)
	close(progressCh)
	return result, nil
}
```

Don't forget to add imports for `"image-toolbox/backend/model"` and `"github.com/wailsapp/wails/v2/pkg/runtime"` if not already present.

- [ ] **Step 3: Verify build**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go build ./...
```
Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
go test ./backend/... -count=1
```
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/app.go
git commit -m "feat: add SliceImages and WatermarkImages API methods"
```

---

### Task 4: Frontend Slice Page

**Files:**
- Create: `frontend/src/pages/Slice.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write Slice.tsx**

```tsx
import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

export const Slice: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [sliceCount, setSliceCount] = useState(25);
  const [contrast, setContrast] = useState(1.0);
  const [saturation, setSaturation] = useState(1.0);
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch({
      sourcePaths: files,
      outputDir,
      sliceCount,
      contrast,
      saturation,
    });
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 20px', background: '#0f3460', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14, width: 80,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 14, minWidth: 80,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>图片切片</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>切片数量</label>
          <input type="number" value={sliceCount}
            onChange={e => setSliceCount(Math.max(1, Number(e.target.value)))}
            style={inputStyle} min={1} max={1000} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>对比度</label>
          <input type="range" min="10" max="200" value={contrast * 100}
            onChange={e => setContrast(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{contrast.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={labelStyle}>饱和度</label>
          <input type="range" min="10" max="200" value={saturation * 100}
            onChange={e => setSaturation(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{saturation.toFixed(1)}</span>
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '开始切片'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx to import Slice**

Read current `App.tsx` and modify to import and use `Slice` component for the slice tab.

```tsx
import { Slice } from './pages/Slice';
```

And modify the tabs array:
```tsx
{ id: 'slice', label: '切片', component: <Slice /> },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Slice.tsx frontend/src/App.tsx
git commit -m "feat: add slice page with configurable parameters"
```

---

### Task 5: Frontend Watermark Page

**Files:**
- Create: `frontend/src/pages/Watermark.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Write Watermark.tsx**

```tsx
import React, { useState } from 'react';
import { ImageList } from '../components/ImageList';
import { useBatch } from '../hooks/useBatch';
import { BatchProgress } from '../components/BatchProgress';

export const Watermark: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [mode, setMode] = useState<'image' | 'text'>('text');
  const [watermarkImage, setWatermarkImage] = useState('');
  const [watermarkText, setWatermarkText] = useState('Watermark');
  const [opacity, setOpacity] = useState(0.5);
  const [position, setPosition] = useState('bottomRight');
  const { state, startBatch } = useBatch();

  const handleSelectFolder = async () => {
    try {
      const dir = await (window as any).go.main.App.SelectDirectory();
      if (dir) {
        const scanned = await (window as any).go.main.App.ScanDirectory(dir, true);
        if (scanned) setFiles(scanned);
      }
    } catch { /* no-op */ }
  };

  const handleSelectWatermark = async () => {
    try {
      const result = await (window as any).go.main.App.SelectFiles();
      if (result && result.length > 0) setWatermarkImage(result[0]);
    } catch { /* no-op */ }
  };

  const handleRun = async () => {
    const outputDir = files.length > 0
      ? files[0].substring(0, files[0].lastIndexOf('\\'))
      : '';
    await startBatch({
      sourcePaths: files,
      outputDir,
      watermarkImage: mode === 'image' ? watermarkImage : '',
      watermarkText: mode === 'text' ? watermarkText : '',
      opacity,
      position,
      fontSize: 12,
      fontColor: '#ffffff',
    });
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 20px', background: '#0f3460', color: '#fff',
    border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14,
  };
  const selectStyle: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a2e', color: '#fff',
    border: '1px solid #333', borderRadius: 6, fontSize: 14,
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>水印</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <button onClick={handleSelectFolder} style={btnStyle}>选择图片文件夹</button>
      </div>

      <ImageList files={files} onRemove={i => setFiles(files.filter((_, j) => j !== i))}
        onClear={() => setFiles([])} />

      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Watermark mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>水印类型</label>
          <select value={mode} onChange={e => setMode(e.target.value as 'image' | 'text')} style={selectStyle}>
            <option value="text">文字水印</option>
            <option value="image">图片水印</option>
          </select>
        </div>

        {mode === 'text' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>水印文字</label>
            <input type="text" value={watermarkText}
              onChange={e => setWatermarkText(e.target.value)}
              style={{ padding: '8px 12px', background: '#1a1a2e', color: '#fff',
                border: '1px solid #333', borderRadius: 6, fontSize: 14, flex: 1 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 14, minWidth: 80 }}>水印图片</label>
            <span style={{ fontSize: 13, color: '#ccc', flex: 1 }}>
              {watermarkImage || '未选择'}
            </span>
            <button onClick={handleSelectWatermark} style={btnStyle}>选择图片</button>
          </div>
        )}

        {/* Opacity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>透明度</label>
          <input type="range" min="0" max="100" value={opacity * 100}
            onChange={e => setOpacity(Number(e.target.value) / 100)}
            style={{ width: 200 }} />
          <span style={{ fontSize: 13, color: '#888' }}>{Math.round(opacity * 100)}%</span>
        </div>

        {/* Position */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 14, minWidth: 80 }}>位置</label>
          <select value={position} onChange={e => setPosition(e.target.value)} style={selectStyle}>
            <option value="tile">平铺</option>
            <option value="center">居中</option>
            <option value="bottomRight">右下角</option>
            <option value="topLeft">左上角</option>
          </select>
        </div>
      </div>

      <button onClick={handleRun} disabled={state.running || files.length === 0}
        style={{ ...btnStyle, marginTop: 24, background: state.running ? '#555' : '#e94560',
          width: '100%', padding: '12px 0', fontSize: 16 }}>
        {state.running ? '处理中...' : '添加水印'}
      </button>

      <BatchProgress progress={state.progress} />
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx to use Watermark**

Modify the import and tabs array:
```tsx
import { Watermark } from './pages/Watermark';
// ...
{ id: 'watermark', label: '水印', component: <Watermark /> },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Watermark.tsx frontend/src/App.tsx
git commit -m "feat: add watermark page with image and text modes"
```

---

### Task 6: End-to-End Verification

- [ ] **Step 1: Run all backend tests**

```bash
export PATH="/c/Program Files/Go/bin:$HOME/go/bin:$PATH"
cd "F:/Python/imagetool"
go test ./backend/... -count=1 -v
```
Expected: ALL PASS

- [ ] **Step 2: Build Wails binary**

```bash
cd "F:/Python/imagetool"
wails build
```
Expected: Build succeeds

- [ ] **Step 3: Verify TypeScript**

```bash
cd "F:/Python/imagetool/frontend"
npx tsc --noEmit 2>&1
```
Expected: No errors

- [ ] **Step 4: Git status**

```bash
cd "F:/Python/imagetool"
git status
```
Expected: Clean

- [ ] **Step 5: Final commit if needed**

```bash
git add -A
git commit -m "chore: Phase 2 complete — slice + watermark"
```

# Slice by Height Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "slice by fixed height" mode alongside the existing "slice by count" mode in the image slice feature.

**Architecture:** Add `SliceMode` and `SliceHeight` fields to `SliceRequest`, a new pure function `SliceImageByHeight` in the image package, dispatch logic in the batch runner, and a mode selector + height input in the frontend.

**Tech Stack:** Go 1.24, `image` package, React/TypeScript, Wails v2

---

### Task 1: Add SliceMode and SliceHeight to the model

**Files:**
- Modify: `backend/model/slice.go`

- [ ] **Step 1: Add fields to SliceRequest**

```go
// SliceRequest defines parameters for the image slicing operation.
type SliceRequest struct {
	SourcePaths []string `json:"sourcePaths"`
	OutputDir   string   `json:"outputDir"`
	SliceMode   string   `json:"sliceMode"`   // "count" | "height"
	SliceCount  int      `json:"sliceCount"`
	SliceHeight int      `json:"sliceHeight"` // pixels per slice, used when mode="height"
	Contrast    float64  `json:"contrast"`
	Saturation  float64  `json:"saturation"`
	SaveMode    string   `json:"saveMode,omitempty"`
	PrefixName  string   `json:"prefixName,omitempty"`
	SubdirName  string   `json:"subdirName,omitempty"`
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/model/slice.go
git commit -m "feat: add SliceMode and SliceHeight to SliceRequest"
```

---

### Task 2: Add SliceImageByHeight function

**Files:**
- Modify: `backend/image/slice.go`
- Test: `backend/image/slice_test.go`

- [ ] **Step 1: Add SliceImageByHeight to slice.go**

```go
// SliceImageByHeight divides an image into fixed-height horizontal strips.
// The last strip may be shorter if the image height is not evenly divisible.
// Contrast/saturation adjustment is shared with SliceImage.
func SliceImageByHeight(src image.Image, sliceHeight int, contrast, saturation float64) []image.Image {
	img := src
	if contrast != 1.0 {
		img = adjustContrast(img, contrast)
	}
	if saturation != 1.0 {
		img = applySaturation(img, saturation)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if sliceHeight <= 0 {
		return nil
	}

	var slices []image.Image
	for y := 0; y < height; y += sliceHeight {
		h := sliceHeight
		if y+h > height {
			h = height - y
		}
		slice := image.NewRGBA(image.Rect(0, 0, width, h))
		for sy := 0; sy < h; sy++ {
			for sx := 0; sx < width; sx++ {
				slice.Set(sx, sy, img.At(sx, y+sy))
			}
		}
		slices = append(slices, slice)
	}
	return slices
}
```

- [ ] **Step 2: Write tests in slice_test.go**

Add to `backend/image/slice_test.go`:

```go
func TestSliceByHeight_Even(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImageByHeight(img, 100, 1.0, 1.0)
	if len(slices) != 3 {
		t.Fatalf("expected 3 slices, got %d", len(slices))
	}
	for i, s := range slices {
		if s.Bounds().Dy() != 100 {
			t.Errorf("slice %d height = %d, want 100", i, s.Bounds().Dy())
		}
	}
}

func TestSliceByHeight_Remainder(t *testing.T) {
	img := createTestImageForSlice(t, 200, 250)
	slices := SliceImageByHeight(img, 100, 1.0, 1.0)
	if len(slices) != 3 {
		t.Fatalf("expected 3 slices, got %d", len(slices))
	}
	if slices[0].Bounds().Dy() != 100 {
		t.Errorf("slice 0 height = %d, want 100", slices[0].Bounds().Dy())
	}
	if slices[1].Bounds().Dy() != 100 {
		t.Errorf("slice 1 height = %d, want 100", slices[1].Bounds().Dy())
	}
	if slices[2].Bounds().Dy() != 50 {
		t.Errorf("slice 2 height = %d, want 50", slices[2].Bounds().Dy())
	}
}

func TestSliceByHeight_WidthPreserved(t *testing.T) {
	img := createTestImageForSlice(t, 200, 300)
	slices := SliceImageByHeight(img, 100, 1.0, 1.0)
	for i, s := range slices {
		if s.Bounds().Dx() != 200 {
			t.Errorf("slice %d width = %d, want 200", i, s.Bounds().Dx())
		}
	}
}

func TestSliceByHeight_SingleSlice(t *testing.T) {
	img := createTestImageForSlice(t, 200, 50)
	slices := SliceImageByHeight(img, 100, 1.0, 1.0)
	if len(slices) != 1 {
		t.Fatalf("expected 1 slice, got %d", len(slices))
	}
	if slices[0].Bounds().Dy() != 50 {
		t.Errorf("slice height = %d, want 50", slices[0].Bounds().Dy())
	}
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `go test ./backend/image/... -run TestSliceByHeight -v`
Expected: "FAIL" — function not defined yet

- [ ] **Step 4: Run tests to verify they pass**

Run: `go test ./backend/image/... -run TestSliceByHeight -v`
Expected: 4 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/image/slice.go backend/image/slice_test.go
git commit -m "feat: add SliceImageByHeight function"
```

---

### Task 3: Update RunSliceBatch to dispatch on SliceMode

**Files:**
- Modify: `backend/batch/slice.go`
- Modify: `backend/batch/slice_test.go`

- [ ] **Step 1: Update RunSliceBatch**

Change the dispatch in `backend/batch/slice.go` from:

```go
slices := backendImage.SliceImage(img, req.SliceCount, req.Contrast, req.Saturation)
```

To:

```go
var slices []image.Image
switch req.SliceMode {
case "height":
	if req.SliceHeight <= 0 {
		return "", fmt.Errorf("slice height must be positive")
	}
	slices = backendImage.SliceImageByHeight(img, req.SliceHeight, req.Contrast, req.Saturation)
default:
	slices = backendImage.SliceImage(img, req.SliceCount, req.Contrast, req.Saturation)
}
```

- [ ] **Step 2: Update existing batch test to set SliceMode**

In `backend/batch/slice_test.go`, update the request to add `SliceMode: "count"`:

```go
req := model.SliceRequest{
	SourcePaths: []string{src},
	OutputDir:   outDir,
	SliceMode:   "count",
	SliceCount:  3,
	Contrast:    1,
	Saturation:  1,
}
```

- [ ] **Step 3: Add a batch test for height mode**

Add to `backend/batch/slice_test.go`:

```go
func TestRunSliceBatchByHeight(t *testing.T) {
	dir := t.TempDir()
	outDir := filepath.Join(dir, "out")
	src := filepath.Join(dir, "photo.png")
	createTestPNG(t, src)

	req := model.SliceRequest{
		SourcePaths: []string{src},
		OutputDir:   outDir,
		SliceMode:   "height",
		SliceHeight: 100,
		Contrast:    1,
		Saturation:  1,
	}

	result := RunSliceBatch(context.Background(), req, nil)
	if result.Success != 1 {
		t.Fatalf("expected success 1, got result: %+v", result)
	}

	// A test image is 100x100, so 100px height → 1 slice
	expected := filepath.Join(outDir, "photo_S001.png")
	if _, err := os.Stat(expected); err != nil {
		t.Fatalf("expected slice output %s to exist: %v", expected, err)
	}
}
```

- [ ] **Step 4: Run all batch slice tests**

Run: `go test ./backend/batch/... -run TestRunSliceBatch -v`
Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/batch/slice.go backend/batch/slice_test.go
git commit -m "feat: dispatch slice mode in RunSliceBatch"
```

---

### Task 4: Update frontend with mode selector and height input

**Files:**
- Modify: `frontend/src/pages/Slice.tsx`

- [ ] **Step 1: Add sliceMode and sliceHeight state**

After the existing `sliceCount` state line, add:

```tsx
const [sliceMode, setSliceMode] = useState<'count' | 'height'>('count');
const [sliceHeight, setSliceHeight] = useState(100);
```

- [ ] **Step 2: Add mode selector UI before the slice-count input**

After the "切片参数" card-header div, add mode toggle + conditional inputs:

```tsx
<div className="flex-col gap-6" style={{ display: 'flex' }}>
  <div className="form-row">
    <label className="form-label">切片方式</label>
    <select value={sliceMode} onChange={e => setSliceMode(e.target.value as 'count' | 'height')} className="select" style={{ width: 160 }}>
      <option value="count">按数量切片</option>
      <option value="height">按高度切片</option>
    </select>
  </div>
  {sliceMode === 'count' ? (
    <div className="form-row">
      <label className="form-label">切片数量</label>
      <input type="number" value={sliceCount}
        onChange={e => setSliceCount(Math.max(1, Number(e.target.value)))}
        className="input" style={{ width: 100 }} min={1} max={1000} />
    </div>
  ) : (
    <div className="form-row">
      <label className="form-label">切片高度</label>
      <input type="number" value={sliceHeight}
        onChange={e => setSliceHeight(Math.max(1, Number(e.target.value)))}
        className="input" style={{ width: 100 }} min={1} />
      <span className="text-sm text-muted">px</span>
    </div>
  )}
  <div className="form-row">
    <label className="form-label">对比度</label>
    ...
```

Then remove the existing slice-count-only block (lines 89-94 in current file) and keep the contrast/saturation blocks after.

- [ ] **Step 3: Update handleRun to pass new fields**

Update the batch request payload:

```tsx
await startBatch('SliceImages', {
  sourcePaths: files,
  outputDir: saveModeConfig.mode === 'custom'
    ? (saveModeConfig.outputDir || (files.length > 0 ? files[0].substring(0, files[0].lastIndexOf('\\')) : ''))
    : '',
  saveMode: saveModeConfig.mode,
  prefixName: saveModeConfig.prefixName,
  subdirName: saveModeConfig.subdirName,
  sliceMode,
  sliceCount,
  sliceHeight: sliceMode === 'height' ? sliceHeight : 0,
  contrast,
  saturation,
});
```

- [ ] **Step 4: Verify TypeScript compiles (if Wails frontend tooling is available)**

Run: `npx tsc --noEmit` (from `frontend/` directory)
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Slice.tsx
git commit -m "feat: add slice mode selector and height input to Slice page"
```

---

### Task 5: Update Wails auto-generated frontend models (if needed)

**Files:**
- Modify: `frontend/wailsjs/go/models.ts` (auto-generated)

- [ ] **Step 1: Check if SliceRequest class has the new fields**

Open `frontend/wailsjs/go/models.ts` and find the `SliceRequest` class. If it already has `sliceMode` and `sliceHeight` fields, skip this task. If not:

```typescript
export class SliceRequest {
    sourcePaths: string[] = [];
    outputDir: string = '';
    sliceMode: string = '';
    sliceCount: number = 0;
    sliceHeight: number = 0;
    contrast: number = 0;
    saturation: number = 0;
    saveMode?: string;
    prefixName?: string;
    subdirName?: string;

    // ...
}
```

- [ ] **Step 2: Commit (if changed)**

```bash
git add frontend/wailsjs/go/models.ts
git commit -m "chore: update SliceRequest model"
```

---

### Full Integration Test

- [ ] **Step 1: Build the project**

Run: `go build ./...`
Expected: no errors

- [ ] **Step 2: Run all related tests**

Run: `go test ./backend/image/... ./backend/batch/... -v`
Expected: all tests pass (existing slice tests + new height tests)

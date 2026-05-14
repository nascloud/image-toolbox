# Slice by Height — Design Spec

## Summary

Add a new slicing mode to the image slice feature: instead of dividing an image into a random-height number of strips, slice it into fixed-height horizontal strips.

## Mode Switching

The slice page gets a mode selector: **"按数量切片"** (count mode) vs **"按高度切片"** (height mode). Radio/select toggle, mutually exclusive.

- Count mode — existing behavior, unchanged
- Height mode — user inputs a pixel height per slice

## Behavior

- Image is divided into horizontal strips of `sliceHeight` px each, starting from the top
- The last strip gets whatever height remains (may be less than `sliceHeight`)
- Width is preserved for all slices
- Contrast/saturation adjustments apply identically in both modes
- No random variation — fixed, deterministic slices

## Backend Changes

### `backend/model/slice.go`

Add fields to `SliceRequest`:

```go
type SliceRequest struct {
    SourcePaths []string `json:"sourcePaths"`
    OutputDir   string   `json:"outputDir"`
    SliceMode   string   `json:"sliceMode"`   // "count" | "height"
    SliceCount  int      `json:"sliceCount"`   // used when mode="count"
    SliceHeight int      `json:"sliceHeight"`  // used when mode="height"
    Contrast    float64  `json:"contrast"`
    Saturation  float64  `json:"saturation"`
    SaveMode    string   `json:"saveMode,omitempty"`
    PrefixName  string   `json:"prefixName,omitempty"`
    SubdirName  string   `json:"subdirName,omitempty"`
}
```

### `backend/image/slice.go`

Add new function:

```go
// SliceImageByHeight divides an image into fixed-height horizontal strips.
// The last strip may be shorter if the image height is not evenly divisible.
func SliceImageByHeight(src image.Image, sliceHeight int) []image.Image
```

Contrast/saturation preprocessing is shared with `SliceImage` by extracting a helper.

### `backend/batch/slice.go`

`RunSliceBatch` checks `req.SliceMode` and dispatches to the appropriate function:

- `"height"` → `SliceImageByHeight(img, req.SliceHeight)`
- `"count"` or default → `SliceImage(img, req.SliceCount, ...)`

## Frontend Changes

### `frontend/src/pages/Slice.tsx`

- Add `sliceMode` state: `"count" | "height"` (default `"count"`)
- Add `sliceHeight` state: number, default `100`
- Add mode selector (radio or select) above the existing slice-count input
- Conditionally render slice-count input or slice-height input based on mode
- Pass `sliceMode` and `sliceHeight` in the batch request payload

## Tests

### `backend/image/slice_test.go`

- `TestSliceByHeight_Even`: 300px image ÷ 100px height → 3 slices of 100px each
- `TestSliceByHeight_Remainder`: 250px image ÷ 100px height → 2 slices of 100px + 1 slice of 50px
- `TestSliceByHeight_WidthPreserved`: verify width is preserved
- `TestSliceByHeight_SingleSlice`: height >= image height → 1 slice of full height

### `backend/batch/slice_test.go`

- Update existing test to set `SliceMode: "count"` for backward compat
- Add test for `SliceMode: "height"` path

## Error Handling

- `sliceHeight <= 0` → return error "slice height must be positive"
- `sliceHeight > image height` → single slice of full image height (not an error)

## Files Changed

| File | Change |
|------|--------|
| `backend/model/slice.go` | +2 fields: SliceMode, SliceHeight |
| `backend/image/slice.go` | +SliceImageByHeight, extract preprocess helper |
| `backend/image/slice_test.go` | +4 test cases |
| `backend/batch/slice.go` | dispatch on SliceMode |
| `backend/batch/slice_test.go` | update existing test, +1 height test |
| `frontend/src/pages/Slice.tsx` | add mode selector + height input |

# Local Batch Save Mode

## Overview

Add save mode options to the local image batch processing pages. Currently, all processed images are written to a user-specified output directory. This feature adds three additional save modes — overwrite source, add prefix, and save to subdirectory — all defaulting to the source file's directory.

## Save Modes

Four mutually exclusive modes, selected via radio buttons:

| Mode | Value | Behavior | Output Path Example |
|---|---|---|---|
| 输出到指定目录 | `custom` | Write to user-chosen directory (existing behavior) | `/custom/output/name.jpg` |
| 覆盖源文件 | `overwrite` | Write directly to source path | `/src/name.jpg` |
| 添加前缀 | `prefix` | Add user-defined prefix in source directory | `/src/prefix_name.jpg` |
| 保存到子目录 | `subdir` | Write to subdirectory under source directory | `/src/output/name.jpg` |

**Default mode:** `subdir` (保存到子目录), with default subdirectory name `"output"`.

**Scope:** All three local batch pages — ConvertResize, Slice, Watermark.

## Data Model

### Backend struct fields

Added to `BatchRequest`, `SliceRequest`, and `WatermarkRequest`:

```go
SaveMode   string `json:"saveMode"`   // "custom" | "overwrite" | "prefix" | "subdir"
PrefixName string `json:"prefixName"` // default "output", for prefix mode
SubdirName string `json:"subdirName"` // default "output", for subdir mode
```

Empty string `""` is treated as `"custom"` for backward compatibility.

### Frontend state shape

```typescript
interface SaveModeConfig {
  mode: 'custom' | 'overwrite' | 'prefix' | 'subdir';
  prefixName: string;  // default "output"
  subdirName: string;  // default "output"
  outputDir: string;   // existing, only used in custom mode
}
```

## Backend: Path Resolution

### New function in `backend/file/output.go`

```go
// ResolveOutputPath determines the final output path based on save mode.
func ResolveOutputPath(srcPath, outputDir, saveMode, prefixName, subdirName, newExt string) string
```

Logic:
- `overwrite`: return `srcPath` directly
- `prefix`: output in `filepath.Dir(srcPath)`, filename = `prefixName + "_" + baseName`
- `subdir`: output in `filepath.Dir(srcPath) + "/" + subdirName`, filename unchanged
- `custom` (and empty): use `outputDir` as directory, append `_resized` suffix to name (existing behavior)

The `newExt` parameter handles format conversion (e.g., `.jpg` → `.png`). For `overwrite` mode, extension change is still applied (file is effectively renamed).

### Changes in batch files

Each batch file currently constructs its own output path inline. Replace that logic with a call to `ResolveOutputPath`:

- `batch/local.go`: Replace the `if ConvertTo != ""` / `else` path construction block
- `batch/slice.go`: Replace `filepath.Join(req.OutputDir, fmt.Sprintf(...))` call
- `batch/watermark.go`: Replace `filepath.Join(req.OutputDir, ...)` call

## Frontend: UI

### New component: `components/SaveModeSelector.tsx`

A reusable radio group component:

```
┌──────────────────────────────────────────────┐
│  保存方式                                      │
│                                                │
│  ○ 输出到指定目录   [path]           [选择目录] │
│  ○ 覆盖源文件                                   │
│  ○ 添加前缀        [output_]                    │
│  ○ 保存到子目录     [output\]                    │
└──────────────────────────────────────────────┘
```

- Custom mode row: shows current output dir path + "选择目录" button inline
- Prefix mode row: shows editable text input (default "output")
- Subdir mode row: shows editable text input (default "output")
- Overwrite mode row: no extra input
- The existing `PreserveOriginal` checkbox is hidden when mode is `overwrite`

### Page changes

Each page (ConvertResize, Slice, Watermark):

- Remove standalone "输出目录" button row and output-dir display line
- Add `<SaveModeSelector>` inside the parameter card
- `handleRun` reads `saveModeConfig` and passes all fields to the backend request
- The "打开" button for the output directory is only shown in `custom` mode

## Compatibility

- Old requests without `saveMode` field: `""` defaults to `"custom"`, existing `OutputDir` logic runs unchanged
- No frontend API changes to the Wails binding layer

## Files Changed

| File | Change |
|---|---|
| `backend/model/batch.go` | +3 fields to BatchRequest |
| `backend/model/slice.go` | +3 fields to SliceRequest |
| `backend/model/watermark.go` | +3 fields to WatermarkRequest |
| `backend/file/output.go` | New `ResolveOutputPath()` function |
| `backend/batch/local.go` | Use `ResolveOutputPath` |
| `backend/batch/slice.go` | Use `ResolveOutputPath` |
| `backend/batch/watermark.go` | Use `ResolveOutputPath` |
| `frontend/src/components/SaveModeSelector.tsx` | **New file** |
| `frontend/src/pages/ConvertResize.tsx` | Integrate SaveModeSelector |
| `frontend/src/pages/Slice.tsx` | Integrate SaveModeSelector |
| `frontend/src/pages/Watermark.tsx` | Integrate SaveModeSelector |

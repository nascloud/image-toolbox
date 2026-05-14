# Folder Source: Multi-Folder + Files Mixed Support

## Problem

Adding a folder scans only root-level images when `recursive=false` (Slice, AIBatch pages),
but users expect subdirectory images to be included. Watermark always scans recursively
without user control. There is no way to mix files from multiple folders with different
recursive settings in a single batch.

## Design

### State Model

Each page gains a `sources` state replacing the flat `files` array:

```ts
interface FolderSource {
  path: string;           // absolute path to the folder
  recursive: boolean;     // whether subdirectories are scanned
  scannedFiles: string[]; // result of ScanDirectory(path, recursive)
}
```

The effective "all files" used for batch processing is:

```ts
allFiles = [
  ...sources.flatMap(s => s.scannedFiles),
  ...looseFiles,          // individually picked files
]
```

### UI Layout

After "选择文件夹" or "选择文件":

```
┌──────────────────────────────────────────────┐
│ 📁 D:\photos\vacation (递归)        15 张    │
│   ◉ 递归  ○ 非递归    [重新扫描]     [×]     │
│ 📁 D:\photos\icons (非递归)          8 张    │
│   ○ 递归  ◉ 非递归    [重新扫描]     [×]     │
│ 📦 单独添加的文件                     3 张    │
│                                              │
│ 总计: 26 张                                  │
│                                [+ 文件] [+ 文件夹] [清空] │
└──────────────────────────────────────────────┘
```

- Each FolderSource is a row with path, recursive toggle (radio-style), rescans, and remove button
- "单独添加的文件" row shows loose file count, no controls
- Below the source list, an ImageList shows the **flat merged** `allFiles` (no grouping inside)
- Hovering a file shows its source folder hint

### Source List Component

New component `FolderSourceList`:

Props:
```ts
interface FolderSourceListProps {
  sources: FolderSource[];
  looseCount: number;
  onToggleRecursive: (index: number) => void;
  onRescan: (index: number) => Promise<void>;
  onRemoveSource: (index: number) => void;
  onAddFolder: () => void;
  onAddFiles: () => void;
  onClear: () => void;
}
```

Renders the source rows and action buttons. The "选择文件夹" and "选择文件" buttons move here.

### Scan Logic

When user clicks "选择文件夹":
1. `SelectDirectory()` opens native dialog
2. `ScanDirectory(dir, recursive)` scans with current recursive state (default `false`)
3. New `FolderSource{ path: dir, recursive: false, scannedFiles }` is appended to `sources`

When user toggles recursive:
1. Immediately rescans: `ScanDirectory(source.path, !source.recursive)`
2. Updates `source.recursive` and `source.scannedFiles`

### Pages to Modify

| Page | Current `recursive` | Change |
|---|---|---|
| **ConvertResize.tsx** | checkbox on UI | Replace `files` + `recursive` with `sources` + `looseFiles`. Remove old checkbox, replace button group with FolderSourceList |
| **Watermark.tsx** | hardcoded `true` | Same replacement. Keeps recursive toggle per folder (default `true`). |
| **Slice.tsx** | hardcoded `false` | Same replacement. Default recursive `false`. |
| **AIBatch.tsx** | hardcoded `false` | Same pattern but uses its own queue state, not ImageList. Adapt `addFiles` and `handleSelectFolder` to use sources pattern. |

### Error Handling

- If `ScanDirectory` returns error for a folder → the folder row shows a warning icon + error message
- Other folders are unaffected
- Retry via "重新扫描" button

### ImageList Extension

No changes needed to ImageList itself — it continues to receive the flat merged file list.

## Implementation Order

1. Create `FolderSource` type (add to `model` package if needed, or keep local to frontend)
2. Create `FolderSourceList` component
3. Modify ConvertResize page
4. Modify Watermark page
5. Modify Slice page
6. Modify AIBatch page
7. Verify all pages build and work

## Rejected Alternatives

- **Add checkbox only** (no multi-folder): Doesn't solve mixing files from different folders with different recursive settings.
- **Tree view**: Over-engineered for current needs. User selected flat list + source header grouping.
- **Always recursive**: Removes user control; some folders have 10000+ files in deep trees where non-recursive is desired.

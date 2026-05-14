# Folder Source (Multi-Folder + Files) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to add multiple folders (each with per-folder recursive toggle) mixed with individually picked files in a single batch.

**Architecture:** A new `FolderSourceList` component replaces the flat file-selection buttons on each page. Each page replaces its `files: string[]` state with `sources: FolderSource[]` + `looseFiles: string[]`, computing the effective `allFiles` as the merge of all scanned paths + loose files.

**Tech Stack:** React + TypeScript, Go backend (unchanged), Wails v2 bindings

---

## File Map

- **Create:** `frontend/src/components/FolderSourceList.tsx` — the new source-list UI component
- **Modify:** `frontend/src/pages/ConvertResize.tsx` — replace flat file state with sources
- **Modify:** `frontend/src/pages/Watermark.tsx` — same replacement
- **Modify:** `frontend/src/pages/Slice.tsx` — same replacement
- **Modify:** `frontend/src/pages/AIBatch.tsx` — adapt queue logic to use sources

**No backend changes**: `SelectDirectory()` and `ScanDirectory()` already support everything needed.

---

### Task 1: Create FolderSourceList component

**Files:**
- Create: `frontend/src/components/FolderSourceList.tsx`

- [ ] **Step 1: Write FolderSourceList component**

The component renders source entries + action buttons. It does NOT import Wails bindings directly — callbacks come from props.

```tsx
import React from 'react';

export interface FolderSource {
  path: string;
  recursive: boolean;
  scannedFiles: string[];
}

interface FolderSourceListProps {
  sources: FolderSource[];
  looseFiles: string[];
  onAddFolder: () => void;
  onAddFiles: () => void;
  onRemoveSource: (index: number) => void;
  onRescan: (index: number, recursive: boolean) => void;
  onClear: () => void;
}

export const FolderSourceList: React.FC<FolderSourceListProps> = ({
  sources, looseFiles, onAddFolder, onAddFiles, onRemoveSource, onRescan, onClear,
}) => {
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      {sources.length === 0 && looseFiles.length === 0 ? (
        <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
          <button onClick={onAddFiles} className="btn btn-sm btn-primary">选择文件</button>
          <button onClick={onAddFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {sources.map((src, i) => (
              <div key={i} style={{
                background: 'var(--color-bg-surface)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-3) var(--space-4)',
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ fontSize: 16 }}>📁</span>
                    <span className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={src.path}>
                      {src.path}
                    </span>
                    <span className="text-xs text-muted">({src.scannedFiles.length} 张)</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                    <button onClick={() => onRescan(i, !src.recursive)} className="btn-icon" title="重新扫描" style={{ fontSize: 14 }}>↻</button>
                    <button onClick={() => onRemoveSource(i)} className="btn-icon" title="移除" style={{ fontSize: 16 }}>×</button>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input type="radio" name={`recursive-${i}`} checked={src.recursive} onChange={() => { if (!src.recursive) onRescan(i, true); }} />
                    递归子目录
                  </label>
                  <label className="checkbox-label" style={{ fontSize: 12 }}>
                    <input type="radio" name={`recursive-${i}`} checked={!src.recursive} onChange={() => { if (src.recursive) onRescan(i, false); }} />
                    仅当前目录
                  </label>
                </div>
              </div>
            ))}
            {looseFiles.length > 0 && (
              <div className="flex items-center gap-2" style={{ padding: 'var(--space-2) var(--space-4)' }}>
                <span style={{ fontSize: 16 }}>📦</span>
                <span className="text-sm">单独添加的文件</span>
                <span className="text-xs text-muted">({looseFiles.length} 张)</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-4" style={{ flexWrap: 'wrap' }}>
            <button onClick={onAddFiles} className="btn btn-sm btn-primary">+ 选择文件</button>
            <button onClick={onAddFolder} className="btn btn-sm btn-ghost">+ 选择文件夹</button>
            <button onClick={onClear} className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}>清空</button>
          </div>
          <div className="text-xs text-muted mt-3">
            总计: {sources.reduce((sum, s) => sum + s.scannedFiles.length, 0) + looseFiles.length} 张
          </div>
        </>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors (component won't be imported yet so unused-variable warnings won't appear)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FolderSourceList.tsx
git commit -m "feat: add FolderSourceList component for multi-folder source management"
```

---

### Task 2: Modify ConvertResize page

**Files:**
- Modify: `frontend/src/pages/ConvertResize.tsx`

Current state:
```tsx
const [files, setFiles] = useState<string[]>([]);
const [recursive, setRecursive] = useState(false);
```

Replace with:
```tsx
const [sources, setSources] = useState<FolderSource[]>([]);
const [looseFiles, setLooseFiles] = useState<string[]>([]);
```

Add import: `import { FolderSourceList, FolderSource } from '../components/FolderSourceList';`

Computed `allFiles`:
```tsx
const allFiles = [...sources.flatMap(s => s.scannedFiles), ...looseFiles];
```

Replace button group:
```tsx
{/* OLD */}
<div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
  <button onClick={handleSelectFiles} className="btn btn-sm btn-primary">选择文件</button>
  <button onClick={handleSelectFolder} className="btn btn-sm btn-ghost">选择文件夹</button>
</div>
```

With:
```tsx
<FolderSourceList
  sources={sources}
  looseFiles={looseFiles}
  onAddFiles={handleSelectFiles}
  onAddFolder={handleSelectFolder}
  onRemoveSource={(i) => setSources(prev => prev.filter((_, j) => j !== i))}
  onRescan={async (i, recursive) => {
    const src = sources[i];
    try {
      const scanned = await (window as any).go.main.App.ScanDirectory(src.path, recursive);
      if (scanned) {
        setSources(prev => prev.map((s, j) => j === i ? { ...s, recursive, scannedFiles: scanned } : s));
      }
    } catch { /* no-op */ }
  }}
  onClear={() => { setSources([]); setLooseFiles([]); }}
/>
```

Remove recursive state and checkbox (`recursive`, `setRecursive`, the recursive checkbox in the card).

Update `handleSelectFiles`:
```tsx
const handleSelectFiles = async () => {
  try {
    const result = await (window as any).go.main.App.SelectFiles();
    if (result) setLooseFiles(prev => [...prev, ...result]);
  } catch { /* no-op */ }
};
```

Update `handleSelectFolder`:
```tsx
const handleSelectFolder = async () => {
  try {
    const dir = await (window as any).go.main.App.SelectDirectory();
    if (dir) {
      const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
      if (scanned) {
        setSources(prev => {
          if (prev.some(s => s.path === dir)) return prev; // dedup
          return [...prev, { path: dir, recursive: false, scannedFiles: scanned }];
        });
      }
    }
  } catch { /* no-op */ }
};
```

Update all references from `files` to `allFiles`:
- `files.length === 0` → `allFiles.length === 0`
- `files[0]` → `allFiles[0]`
- `<ImageList files={files} ...>` → `<ImageList files={allFiles} ...>`
- `files.filter(...)` in onRemove → use sources/looseFiles — only support per-source removal, not per-file
- `sourcePaths: files` → `sourcePaths: allFiles`

OnRemove per-file is removed since files come from sources. If user needs to remove specific files, they remove the whole source. (This is acceptable per design.)

- [ ] **Step 1: Modify ConvertResize.tsx**

Replace state, imports, handlers, and JSX as described above.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ConvertResize.tsx
git commit -m "feat: adapt ConvertResize page to use multi-folder sources"
```

---

### Task 3: Modify Watermark page

**Files:**
- Modify: `frontend/src/pages/Watermark.tsx`

Same pattern as ConvertResize. Current state:
```tsx
const [files, setFiles] = useState<string[]>([]);
```

Replace with `sources` + `looseFiles`, same `allFiles` computed, import FolderSourceList, replace button group.

Watermark-specific behaviors to preserve:
1. `handleSelectFolder` sets `saveModeConfig.outputDir` if not set
2. `selectedIndex` works on the flattened `allFiles`
3. `handleSelectWatermark` is unrelated — leave alone

- [ ] **Step 1: Modify Watermark.tsx**

Replace file state with sources + looseFiles, import FolderSourceList, replace button group, update all `files` references to `allFiles`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Watermark.tsx
git commit -m "feat: adapt Watermark page to use multi-folder sources"
```

---

### Task 4: Modify Slice page

**Files:**
- Modify: `frontend/src/pages/Slice.tsx`

Same pattern. Current `files` state replaced with `sources` + `looseFiles`.

- [ ] **Step 1: Modify Slice.tsx**

Same transformation as Task 2 (minus recursive checkbox — that was never on Slice).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Slice.tsx
git commit -m "feat: adapt Slice page to use multi-folder sources"
```

---

### Task 5: Modify AIBatch page

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx`

AIBatch uses its own queue (`ImageItem[]`) rather than a flat `files` array. Adapt `handleSelectFolder` and `addFiles`:

Current `handleSelectFolder`:
```tsx
const handleSelectFolder = async () => {
  try {
    const dir = await (window as any).go.main.App.SelectDirectory();
    if (dir) {
      const scanned = await (window as any).go.main.App.ScanDirectory(dir, false);
      if (scanned) addFiles(scanned);
    }
  } catch { /* no-op */ }
};
```

Replace with source-tracked version. Add state:
```tsx
const [folderSources, setFolderSources] = useState<FolderSource[]>([]);
```

Import FolderSourceList.

Replace the batch actions bar buttons related to file/folder selection:
```tsx
{/* OLD */}
<button onClick={clearQueue} className="btn btn-sm btn-ghost">清空</button>
<button onClick={handleSelectFiles} className="btn btn-sm btn-primary">+ 添加图片</button>
<button onClick={handleSelectFolder} className="btn btn-sm btn-ghost">添加文件夹</button>
```

With FolderSourceList. But AIBatch has a different layout — it already has a "图片队列" card. Insert FolderSourceList above the queue card (or inside its header area).

The queue's `clearQueue` should also clear `folderSources`.

- [ ] **Step 1: Modify AIBatch.tsx**

Add `folderSources` state, import FolderSourceList, update handlers, insert FolderSourceList into JSX.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/AIBatch.tsx
git commit -m "feat: adapt AIBatch page to use multi-folder sources"
```

---

### Task 6: Remove unused ImageList onAddClick prop

Currently `onAddClick` on ImageList points to `handleSelectFiles`. Since the source management is now in FolderSourceList, some pages' ImageList no longer needs this. But it's harmless — leave it for now. No change needed.

### Task 7: Verify the full build

- [ ] **Step 1: Build frontend**

```bash
cd frontend && npm run build
```

Expected: No errors, dist/ updated.

- [ ] **Step 2: Build Go backend**

```bash
cd .. && go build -o nul .
```

Expected: No errors.

# AI Batch: Remove Redundant GroupedFileList — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant GroupedFileList component from AIBatch page.

**Architecture:** Single-file change to `frontend/src/pages/AIBatch.tsx`. Remove the import and JSX block. Keep the `FolderEntry` type import for existing state references.

**Tech Stack:** React + TypeScript

---

### Task 1: Remove GroupedFileList from AIBatch.tsx

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx:4` (import line)
- Modify: `frontend/src/pages/AIBatch.tsx:1184-1203` (JSX block)

- [ ] **Step 1: Change import to only keep `FolderEntry`**

Current (line 4):
```tsx
import { GroupedFileList, FolderEntry } from '../components/GroupedFileList';
```

Change to:
```tsx
import { FolderEntry } from '../components/GroupedFileList';
```

- [ ] **Step 2: Remove the `<GroupedFileList>` JSX block**

Remove lines 1184–1203 (the entire `GroupedFileList` usage):
```tsx
          <GroupedFileList
            folders={folders}
            looseFiles={looseFilePaths}
            onAddFiles={handleSelectFiles}
            onAddFolder={handleSelectFolder}
            onRemoveFolder={(i) => {
              const f = folders[i];
              if (!f) return;
              const paths = new Set(f.scannedFiles);
              setQueue(q => q.filter(item => !paths.has(item.path)));
              setFolders(prev => prev.filter((_, j) => j !== i));
            }}
            onRemoveFile={(i) => {
              const path = looseFilePaths[i];
              if (!path) return;
              setQueue(q => q.filter(item => item.path !== path));
              setLooseFilePaths(prev => prev.filter((_, j) => j !== i));
            }}
            onClear={() => { setFolders([]); setLooseFilePaths([]); setQueue([]); }}
          />
```

- [ ] **Step 3: Verify the page compiles and loads**

Run: `cd frontend && npx tsc --noEmit` or check that the frontend dev server doesn't error on build.

Expected: No TypeScript errors, no import unused warnings for `FolderEntry`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AIBatch.tsx
git commit -m "refactor: remove redundant GroupedFileList from AIBatch page"
```

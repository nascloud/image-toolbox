# AI Batch: Remove Redundant GroupedFileList

**Date:** 2026-05-15

## Problem

The AI Batch page (`frontend/src/pages/AIBatch.tsx`) has two components managing the same file set:

1. **GroupedFileList** — directory tree view of source files with add/remove, placed
   above the action bar
2. **Image Queue** — flat processing queue with thumbnails, status badges, results,
   and results preview, placed below the action bar

Both display the same files and both support drag-drop file addition. This creates
visual redundancy and confusion.

## Goal

Remove GroupedFileList from AIBatch. The Image Queue becomes the singular file
management + processing view.

## Scope

- **Removed:** `GroupedFileList` component call and its import from AIBatch
- **Unchanged:** Image Queue (already has drag-drop, empty-state "click to add",
  remove/retry/clear actions)
- **Unchanged:** All backend Go code
- **Unchanged:** `folders`, `looseFilePaths`, `recursive` state variables
  (they become dead code but cause no harm; removal is not worth the
  side-effect risk of breaking the complex state logic that references them)

## Changes

### AIBatch.tsx

1. Remove `import { GroupedFileList, FolderEntry } from '../components/GroupedFileList'`
   → keep only `FolderEntry` type import if still needed for `folders` state type
2. Remove the `<GroupedFileList>` JSX block (lines 1184–1203)
3. Keep `folders`/`looseFilePaths`/`recursive` state and related handlers
   (they are referenced by the queue's `addFiles` and by `handleSelectFiles`/`handleSelectFolder`)

### GroupedFileList.tsx

No changes. Component stays available for other pages.

## Verification

- AIBatch page loads without errors
- Image Queue still shows all files, supports drag-drop, remove, retry, preview
- "选择文件" via queue empty-state click still works
- No other pages are affected

## Risk

Low. This is purely a UI component removal. No backend, no state logic change.
The `FolderEntry` import is retained for type safety of the unused `folders` state.

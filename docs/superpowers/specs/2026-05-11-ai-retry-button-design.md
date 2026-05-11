# AI Batch Retry Buttons Design

## Summary

Add retry functionality to AI image generation results: per-row retry button for completed/error items that automatically re-requests the API for a single image, and a "retry all" button at the queue top that retries all completed/error items in the batch.

## Background

The current AI batch page (AIBatch.tsx) has:
- `retryItem(id)`: only shown for `error` status items, resets to `pending`
- `retryAll()`: only shown when error items exist, resets `error` items to `pending`
- Both require the user to click "开始处理" to execute

The user wants immediate execution on retry — clicking retry should automatically trigger the API request without requiring an additional click.

## Requirements

### 1. Per-row retry (both `error` and `completed`)
- Click "重试" on any completed/error row
- Reset the row to `processing` status
- Immediately call `RunAIImageBatch` with only that single image's path
- Replace the row's results when the API returns
- Show loading state during processing

### 2. "Retry all" at queue top
- Button visible when any `completed` or `error` items exist
- Reset all `completed` + `error` items to `processing` status
- Immediately trigger a batch `RunAIImageBatch` call
- Map results back to individual rows

### 3. Processing guard
- No concurrent batch operations: `retryItem` / `retryAll` / `handleRun` are mutually exclusive
- A `processing` flag prevents re-entry

## Design

### Frontend-only changes

**File:** `frontend/src/pages/AIBatch.tsx`

#### `retryItem(id)` — single image retry

```typescript
const retryItem = async (id: number) => {
  if (processing) return;
  const item = queue.find(i => i.id === id);
  if (!item) return;
  
  // Reset this item to processing
  setQueue(prev => prev.map(i =>
    i.id === id ? { ...i, status: 'processing', error: undefined,
      outputPath: undefined, outputPaths: undefined,
      thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined } : i
  ));
  
  // Execute single-image batch
  setProcessing(true);
  try {
    const req = buildBatchRequest([item.path]);
    const result = await window.go.main.App.RunAIImageBatch(req);
    // Map result back to this item
    if (result?.results?.[0]) {
      const r = result.results[0];
      setQueue(prev => prev.map(i =>
        i.id === id ? {
          ...i,
          status: r.success ? 'completed' : 'error',
          error: r.error,
          outputPath: r.outputPath,
          outputPaths: r.outputPaths || [r.outputPath].filter(Boolean),
        } : i
      ));
      // Load thumbnails if success
      if (r.success) { /* load thumbnails */ }
    }
  } catch (err) {
    setQueue(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'error', error: err.message } : i
    ));
  }
  setProcessing(false);
};
```

#### `retryAll()` — batch retry

```typescript
const retryAll = async () => {
  if (processing) return;
  const toRetry = queue.filter(i => i.status === 'error' || i.status === 'completed');
  if (toRetry.length === 0) return;
  
  // Reset all to processing
  setQueue(prev => prev.map(i =>
    (i.status === 'error' || i.status === 'completed')
      ? { ...i, status: 'processing', error: undefined, /* clear all result fields */ } : i
  ));
  
  // Execute batch
  // Same logic as handleRun but only for toRetry items
  // ... RunAIImageBatch with toRetry paths ...
};
```

#### Parameter extraction

Extract `buildBatchRequest(paths)` helper to avoid duplicating the request-building logic between `handleRun`, `retryItem`, and `retryAll`.

#### Button visibility changes

| Button | Before | After |
|--------|--------|-------|
| Per-row "重试" | `item.status === 'error'` | `item.status === 'error' \|\| item.status === 'completed'` |
| "全部重试" position | Batch actions bar | Queue header row (right side, near "清空") |
| "全部重试" visibility | `errors.length > 0` | `errors.length + completed.length > 0` |

### Backend changes

None. The existing `RunAIImageBatch` in `app.go` already accepts arbitrary `sourcePaths` arrays and handles single-image batches correctly.

## Data Flow

```
handleRun     → pending items      → RunAIImageBatch([...]) → map results
retryItem(id) → single item        → RunAIImageBatch([path]) → update that row
retryAll()    → error + completed  → RunAIImageBatch([...]) → map results to rows
                ╲ mutually exclusive via processing flag
```

## Files Changed

- `frontend/src/pages/AIBatch.tsx` — all changes (frontend only)

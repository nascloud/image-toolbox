# AI Batch Retry Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-row and "retry all" buttons to AI batch results that auto-trigger API requests.

**Architecture:** Frontend-only changes to `AIBatch.tsx`. Extract request-building logic into a shared helper, rewrite `retryItem`/`retryAll` as async functions that auto-trigger `RunAIImageBatch`, and update button visibility/position.

**Tech Stack:** React + TypeScript + Wails Go bindings

---

### Task 1: Extract `buildBatchRequest` helper

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx` — add helper function, refactor `handleRun` to use it

- [ ] **Step 1: Add `buildBatchRequest` function** — place inside the component body, between state declarations and effects (after line ~212, before `useEffect` line ~214).

This function captures current panel parameter state and builds the request object for `RunAIImageBatch`. Add after the `const cancelRef = useRef(false);` line:

```typescript
// Build RunAIImageBatch request from current panel parameters for given source paths
function buildBatchRequest(paths: string[]) {
  const outputDir = aiOutputDir || (paths[0]?.substring(0, paths[0].lastIndexOf('\\')) ?? '');
  const downloadW = downloadWidth === 'custom'
    ? (parseInt(customWidth) || 0)
    : downloadWidth === 'original' ? 0 : parseInt(downloadWidth);
  const maxGeneratedImages = Math.max(1, 15 - (1 + referenceImages.length));
  return {
    sourcePaths: paths,
    outputDir,
    prompt,
    model,
    size,
    seed: isGuidanceSupported && seed >= 0 ? seed : -1,
    outputFormat: isOutputFormatSupported ? outputFormat : 'jpeg',
    watermark,
    guidanceScale: isGuidanceSupported ? guidanceScale : 0,
    responseFormat,
    sequentialImageGeneration: isSequentialSupported ? sequentialMode : 'disabled',
    maxImages: Math.min(maxImages, maxGeneratedImages),
    optimizePromptMode: isFastPromptOptimizeSupported ? optimizePromptMode : 'standard',
    webSearch: isWebSearchSupported && webSearch,
    concurrent: Math.min(concurrent, paths.length),
    referenceImages,
    downloadWidth: isNaN(downloadW) ? 0 : downloadW,
  };
}
```

- [ ] **Step 2: Replace inline request in `handleRun` (L447-L470)** — replace the entire request object literal with a call to `buildBatchRequest`:

In `handleRun`, find:
```typescript
const outputDir = aiOutputDir || pendingItems[0].path.substring(0, pendingItems[0].path.lastIndexOf('\\'));
const downloadW = downloadWidth === 'custom'
  ? (parseInt(customWidth) || 0)
  : downloadWidth === 'original' ? 0 : parseInt(downloadWidth);
const maxGeneratedImages = Math.max(1, 15 - (1 + referenceImages.length));
const result = await (window as any).go.main.App.RunAIImageBatch({
  sourcePaths: pendingItems.map(i => i.path),
  outputDir,
  prompt,
  ...
});
```

Replace with:
```typescript
const result = await (window as any).go.main.App.RunAIImageBatch(
  buildBatchRequest(pendingItems.map(i => i.path))
);
```

- [ ] **Step 3: Verify it compiles conceptually** — the function captures state at call time, which is correct since `handleRun` is async and the state is stable during execution.

---

### Task 2: Rewrite `retryItem` as async auto-trigger

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx` — replace `retryItem` function (currently L354-356)

- [ ] **Step 1: Replace `retryItem`** — change from synchronous state reset to async API call:

Find:
```typescript
const retryItem = (id: number) => {
  setQueue(prev => prev.map(i => i.id === id ? { ...i, status: 'pending' as const, error: undefined, results: undefined, outputPath: undefined, outputPaths: undefined, thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined } : i));
};
```

Replace with:
```typescript
const retryItem = async (id: number) => {
  if (processing) return;
  const item = queue.find(i => i.id === id);
  if (!item) return;

  // Reset item to processing immediately
  setQueue(prev => prev.map(i =>
    i.id === id ? { ...i, status: 'processing' as const, error: undefined,
      outputPath: undefined, outputPaths: undefined,
      thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined } : i
  ));
  setProcessing(true);

  try {
    const result = await (window as any).go.main.App.RunAIImageBatch(
      buildBatchRequest([item.path])
    );

    if (!result || !result.results || result.results.length === 0) {
      setQueue(prev => prev.map(i =>
        i.id === id ? { ...i, status: 'error' as const, error: result?.error || '处理失败' } : i
      ));
      setProcessing(false);
      return;
    }

    const r = result.results[0];
    setQueue(prev => prev.map(i => {
      if (i.id !== id) return i;
      if (r.success) {
        const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
          ? r.outputPaths
          : r.outputPath ? [r.outputPath] : [];
        return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
      }
      return { ...i, status: 'error' as const, error: r.error || '处理失败' };
    }));

    // Load thumbnails on success
    if (r.success) {
      const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
        ? r.outputPaths
        : r.outputPath ? [r.outputPath] : [];
      if (outputPaths.length > 0) {
        const thumbUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
          try {
            const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 80);
            return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
          } catch { return ''; }
        }));
        const resultHoverUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
          try {
            const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 640);
            return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
          } catch { return ''; }
        }));
        setQueue(prev => prev.map(i =>
          i.id === id ? { ...i, thumbUrl: thumbUrls[0], thumbUrls, resultHoverUrls } : i
        ));
      }
    }
  } catch (err: any) {
    setQueue(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'error' as const, error: err.message } : i
    ));
  }
  setProcessing(false);
};
```

---

### Task 3: Rewrite `retryAll` as async auto-trigger

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx` — replace `retryAll` function (currently L556-561)

- [ ] **Step 1: Replace `retryAll`** — change from resetting error items to async batch retry of completed+error:

Find:
```typescript
const retryAll = () => {
  if (processing) return;
  setQueue(prev => prev.map(i =>
    i.status === 'error' ? { ...i, status: 'pending' as const, error: undefined, results: undefined, outputPath: undefined, outputPaths: undefined, thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined } : i
  ));
};
```

Replace with:
```typescript
const retryAll = async () => {
  if (processing) return;
  const toRetry = queue.filter(i => i.status === 'error' || i.status === 'completed');
  if (toRetry.length === 0) return;

  setProcessing(true);

  // Mark all toRetry items as processing
  setQueue(prev => prev.map(i =>
    (i.status === 'error' || i.status === 'completed')
      ? { ...i, status: 'processing' as const, error: undefined,
        outputPath: undefined, outputPaths: undefined,
        thumbUrl: undefined, thumbUrls: undefined, resultHoverUrls: undefined }
      : i
  ));

  try {
    const result = await (window as any).go.main.App.RunAIImageBatch(
      buildBatchRequest(toRetry.map(i => i.path))
    );

    if (!result || !result.results) {
      if (!result) showToast('处理失败：无返回结果', 'error');
      setQueue(prev => prev.map(i =>
        (i.status === 'processing')
          ? { ...i, status: 'error' as const, error: result?.error || '处理失败' }
          : i
      ));
      setProcessing(false);
      return;
    }

    // Map results back to queue items by source path
    const resultByPath = new Map<string, any>();
    for (const r of result.results) {
      if (r.sourcePath) resultByPath.set(r.sourcePath, r);
    }

    let failedCount = 0;
    setQueue(prev => prev.map(i => {
      const r = resultByPath.get(i.path);
      if (r) {
        const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
          ? r.outputPaths
          : r.outputPath ? [r.outputPath] : [];
        if (r.success && outputPaths.length > 0) {
          return { ...i, status: 'completed' as const, outputPath: outputPaths[0], outputPaths };
        } else {
          failedCount++;
          return { ...i, status: 'error' as const, error: r.error || '处理失败' };
        }
      }
      return { ...i, status: 'error' as const, error: '未返回处理结果' };
    }));

    // Load thumbnails for all completed items
    const completedResults = result.results.filter((r: any) => r.success);
    await Promise.all(completedResults.map(async (r: any) => {
      const outputPaths = Array.isArray(r.outputPaths) && r.outputPaths.length > 0
        ? r.outputPaths
        : r.outputPath ? [r.outputPath] : [];
      if (outputPaths.length === 0) return;
      const thumbUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
        try {
          const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 80);
          return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
        } catch { return ''; }
      }));
      const resultHoverUrls = await Promise.all(outputPaths.map(async (outPath: string) => {
        try {
          const dataUrl = await (window as any).go.main.App.ReadImageThumbnail(outPath, 640);
          return dataUrl && dataUrl.startsWith('data:') ? dataUrl : '';
        } catch { return ''; }
      }));
      setQueue(prev => prev.map(i => {
        if (i.path !== r.sourcePath) return i;
        return { ...i, thumbUrl: thumbUrls[0], thumbUrls, resultHoverUrls };
      }));
    }));

    if (failedCount > 0) showToast(`${failedCount} 张处理失败`, 'error');
  } catch (err: any) {
    showToast(`处理出错: ${err.message}`, 'error');
    setQueue(prev => prev.map(i =>
      (i.status === 'processing')
        ? { ...i, status: 'error' as const, error: err.message }
        : i
    ));
  }
  setProcessing(false);
};
```

---

### Task 4: Update button visibility and position

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx` — update JSX for "全部重试" and per-row "重试"

- [ ] **Step 1: Show "重试" for completed items too** — find the per-row actions block (around L1205-1207):

Find:
```tsx
{item.status === 'error' && <button onClick={() => retryItem(item.id)} className="btn btn-sm btn-ghost" style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}>重试</button>}
```

Replace with:
```tsx
{(item.status === 'error' || item.status === 'completed') && (
  <button
    onClick={() => retryItem(item.id)}
    className="btn btn-sm btn-ghost"
    style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)' }}
    disabled={processing}
  >
    重试
  </button>
)}
```

- [ ] **Step 2: Move "全部重试" button to queue header** — find the current button in batch actions bar (around L979-981):

Find:
```tsx
{queue.filter(i => i.status === 'error').length > 0 && (
  <button onClick={retryAll} className="btn btn-sm" style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'transparent' }}>全部重试</button>
)}
```

Replace with just an empty space or delete this block.

- [ ] **Step 3: Add "全部重试" to queue header** — find the queue header (around L1081-L1084):

Find:
```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 8 }}>
  <span>图片队列</span>
  <span>{completedCount}/{queue.length} 完成</span>
</div>
```

Replace with:
```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 10px', fontSize: 12, color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 8 }}>
  <span>图片队列</span>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    {queue.filter(i => i.status === 'error' || i.status === 'completed').length > 0 && (
      <button
        onClick={retryAll}
        disabled={processing}
        className="btn btn-sm"
        style={{ border: '1px solid var(--color-warning)', color: 'var(--color-warning)', background: 'transparent', fontSize: 11, padding: '2px 10px' }}
      >
        全部重试
      </button>
    )}
    <span>{completedCount}/{queue.length} 完成</span>
  </div>
</div>
```

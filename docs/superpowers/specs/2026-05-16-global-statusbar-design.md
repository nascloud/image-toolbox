# Global StatusBar Design

Move the inline `BatchProgress` component from individual pages to a persistent bottom status bar, visible across all tabs.

## Motivation

- Progress bar should be **always visible** regardless of which tab or scroll position
- Eliminate redundant `batch-progress` event listeners across pages
- Provide idle-state context (image count, ready status) even when no batch is running

## Architecture

```
App
└── ProgressProvider              ← React Context
    ├── Layout
    │   ├── TabNav                ← existing
    │   ├── MainContent           ← existing (page content)
    │   └── StatusBar             ← NEW - fixed bottom bar
```

**Data flow:**
- `useBatch` already listens to Wails `batch-progress` events → also calls `updateProgress()` on context
- `AIBatch` calculates its own per-item completion → also calls `updateProgress()` on context
- `StatusBar` reads from context → renders the bar

No backend changes. No new Wails events.

## ProgressContext

**File:** `frontend/src/hooks/useProgress.ts`

```ts
interface GlobalProgress {
  completed: number
  total: number
  current: string
  error?: string
  done: boolean
  running: boolean
}

interface ProgressContextValue {
  progress: GlobalProgress | null
  idleText: string               // idle state display text
  updateProgress: (p: GlobalProgress | null) => void
  setIdleText: (text: string) => void
}
```

- `ProgressProvider` wraps `App`
- `updateProgress(null)` clears to idle
- `updateProgress({ done: true, ... })` triggers a 5-second "result" display phase (timer in StatusBar), then auto-clears to idle
- Each page calls `setIdleText(...)` when its file list changes, e.g. `setIdleText('15 张图片 · 就绪')`

## StatusBar Component

**File:** `frontend/src/components/StatusBar.tsx`

Fixed-height bottom bar (40px), three visual states:

| State | Content |
|-------|---------|
| Idle | `{N} 张图片 · 就绪` (left-aligned, `text-muted`) |
| Active | Single-row compact: `10/20 50% ████████░░░░ current.jpg [取消]` |
| Done (5s) | `✓ 处理完成 · 10 成功 0 失败` (centered, `text-success`), auto-returns to idle |

CSS classes added to `design-system.css`:
- `.status-bar` — fixed bottom bar container
- `.status-bar-idle` / `.status-bar-active` / `.status-bar-done` — state styles
- `.status-bar-track` / `.status-bar-fill` — progress bar (reuse existing progress-track pattern)

The progress bar fill transitions smoothly (existing `transition: width 0.4s`).

## Files Changed

| File | Change |
|------|--------|
| `hooks/useProgress.ts` | **NEW** — `ProgressContext`, `ProgressProvider`, `useProgressContext()` |
| `components/StatusBar.tsx` | **NEW** — bottom bar component |
| `components/Layout.tsx` | Add `<StatusBar />` after `<main>` |
| `hooks/useBatch.ts` | On `batch-progress` event, call `updateProgress()`; on start call it too |
| `pages/ConvertResize.tsx` | Remove `<BatchProgress>`; call `setIdleText()` when `allFiles` changes |
| `pages/Slice.tsx` | Same |
| `pages/Watermark.tsx` | Same |
| `pages/AIBatch.tsx` | Call `updateProgress()` in `handleRun`, `retryItem`, `retryAll`; remove inline `downloadProgress` float |
| `App.tsx` | Wrap `<ProgressProvider>` around `<Layout>` |
| `styles/design-system.css` | Add `.status-bar-*` classes |

**Not touched:** backend, `GroupedFileList`, `SaveModeSelector`, `ImageList`, `useBatch` signature (still returns same API).

## AIBatch Integration

AIBatch does not use `useBatch` — it manages its own queue. Integration points:

1. `handleRun` starts with `updateProgress({ completed: 0, total: pendingItems.length, running: true, current: '准备中...' })`
2. After results return, `updateProgress({ completed: completedCount, total: queue.length, running: true, current: '' })`
3. On completion, `updateProgress({ completed: total, total, done: true, running: false, current: '' })`
4. Same pattern in `retryAll` and `retryItem`

The per-item status badges (`pending`, `processing`, etc.) remain in the queue — the bottom bar shows only aggregated numbers.

## Edge Cases

- **No batch running, no images:** idle text shows `0 张图片 · 就绪`
- **Batch completes with errors:** done state shows errors: `✓ 处理完成 · 8 成功 2 失败`
- **Cancel mid-batch:** `updateProgress(...)` clears immediately, returns to idle
- **Switch tabs mid-batch:** StatusBar persists across tabs (it's in Layout, not in page content)
- **AI Batch concurrent processing:** progress updates are batched per-result-batch (not per-concurrent-task), same granularity as current AI page display

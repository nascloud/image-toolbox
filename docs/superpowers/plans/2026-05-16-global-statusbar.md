# Global StatusBar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move inline batch progress from individual pages to a persistent bottom StatusBar.

**Architecture:** A React Context (`ProgressProvider`) holds global progress state. `StatusBar` in Layout reads it. `useBatch` and `AIBatch` push updates to the context. No backend changes.

**Tech Stack:** React + TypeScript, Wails runtime events

---

### Task 1: Create ProgressContext

**Files:**
- Create: `frontend/src/hooks/useProgress.ts`

- [ ] **Step 1: Write the context file**

```ts
// frontend/src/hooks/useProgress.ts
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface GlobalProgress {
  completed: number;
  total: number;
  current: string;
  error?: string;
  done: boolean;
  running: boolean;
}

export interface ProgressContextValue {
  progress: GlobalProgress | null;
  idleText: string;
  updateProgress: (p: GlobalProgress | null) => void;
  setIdleText: (text: string) => void;
}

const ProgressContext = createContext<ProgressContextValue>({
  progress: null,
  idleText: '0 张图片 · 就绪',
  updateProgress: () => {},
  setIdleText: () => {},
});

export const useProgressContext = () => useContext(ProgressContext);

export const ProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<GlobalProgress | null>(null);
  const [idleText, setIdleText] = useState('0 张图片 · 就绪');

  const updateProgress = useCallback((p: GlobalProgress | null) => {
    setProgress(p);
  }, []);

  return (
    <ProgressContext.Provider value={{ progress, idleText, updateProgress, setIdleText }}>
      {children}
    </ProgressContext.Provider>
  );
};
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 2: Add StatusBar CSS

**Files:**
- Modify: `frontend/src/styles/design-system.css`

- [ ] **Step 1: Append StatusBar CSS classes**

Add at the end of `design-system.css`:

```css
/* ═══════════════════════════════════════════════
   Component Classes: StatusBar
   ═══════════════════════════════════════════════ */

.status-bar {
  height: 40px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 0 var(--space-10);
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border-subtle);
  gap: var(--space-6);
  overflow: hidden;
  z-index: var(--z-sticky);
}

.status-bar-idle {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.status-bar-active {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
}

.status-bar-progress-text {
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 80px;
  font-variant-numeric: tabular-nums;
}

.status-bar-track {
  flex: 1;
  height: 4px;
  background: var(--color-border-default);
  border-radius: 2px;
  overflow: hidden;
  min-width: 60px;
}

.status-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 2px;
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.status-bar-current {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 1;
  min-width: 0;
  color: var(--color-text-muted);
  font-size: var(--text-xs);
}

.status-bar-done {
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--color-success);
  font-weight: var(--weight-medium);
  animation: fadeIn var(--transition-base);
}

.status-bar-error {
  color: var(--color-danger);
}
```

- [ ] **Step 2: Verify CSS parses**

Run: `npx tsc --noEmit` (CSS imports should not cause issues)

---

### Task 3: Create StatusBar Component

**Files:**
- Create: `frontend/src/components/StatusBar.tsx`

- [ ] **Step 1: Write the component**

```tsx
// frontend/src/components/StatusBar.tsx
import React, { useEffect, useRef } from 'react';
import { useProgressContext, GlobalProgress } from '../hooks/useProgress';

export const StatusBar: React.FC = () => {
  const { progress, idleText, updateProgress } = useProgressContext();
  const doneTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-clear done state after 5s
  useEffect(() => {
    if (progress?.done) {
      doneTimerRef.current = setTimeout(() => {
        updateProgress(null);
      }, 5000);
    }
    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [progress?.done, updateProgress]);

  // Cancel button
  const handleCancel = async () => {
    try {
      await (window as any).go.main.App.CancelBatch();
      updateProgress(null);
    } catch { /* no-op */ }
  };

  // Idle state
  if (!progress) {
    return (
      <div className="status-bar status-bar-idle">
        {idleText}
      </div>
    );
  }

  // Done state
  if (progress.done) {
    const errorText = progress.error ? ` · ${progress.error}` : '';
    return (
      <div className="status-bar status-bar-done">
        ✓ 处理完成 · {progress.completed} 成功{errorText}
      </div>
    );
  }

  // Active state
  const pct = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  return (
    <div className="status-bar status-bar-active">
      <span className="status-bar-progress-text">
        {progress.completed}/{progress.total} {pct}%
      </span>
      <div className="status-bar-track">
        <div className="status-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {progress.current && (
        <span className="status-bar-current" title={progress.current}>
          {progress.current}
        </span>
      )}
      <button
        onClick={handleCancel}
        className="btn btn-sm btn-danger"
        style={{ flexShrink: 0, fontSize: 11, padding: '2px 10px', height: 26 }}
      >
        取消
      </button>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 4: Wire StatusBar into Layout and App

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add StatusBar to Layout**

After the `</main>` closing tag, add `<StatusBar />`:

```tsx
// Layout.tsx — add import at top
import { StatusBar } from './StatusBar';

// After </main> and before </div> (app-layout closing):
      </main>
      <StatusBar />
    </div>
```

The complete return should be:
```tsx
  return (
    <div className="app-layout">
      <nav className="tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main
        ref={contentRef}
        className="main-content"
        style={{
          animation: animating ? 'fadeIn 250ms ease' : undefined,
        }}
      >
        {activeContent}
      </main>
      <StatusBar />
    </div>
  );
```

- [ ] **Step 2: Wrap App with ProgressProvider**

Replace the return in `App.tsx`:

```tsx
// App.tsx — add import at top
import { ProgressProvider } from './hooks/useProgress';

// Wrap the Layout:
  return (
    <ProgressProvider>
      <Layout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </ProgressProvider>
  );
```

- [ ] **Step 3: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 5: Integrate useBatch with ProgressContext

**Files:**
- Modify: `frontend/src/hooks/useBatch.ts`

- [ ] **Step 1: Add progress context calls**

```tsx
// useBatch.ts — add import at top
import { useProgressContext } from './useProgress';

// Inside useBatch function body, add:
const { updateProgress } = useProgressContext();

// In the EventsOn callback, add updateProgress call:
  useEffect(() => {
    EventsOn('batch-progress', (update: ProgressUpdate) => {
      setState(prev => ({ ...prev, progress: update }));
      updateProgress({ ...update, running: true });
    });
    return () => {
      EventsOff('batch-progress');
    };
  }, [updateProgress]);

// In startBatch, at the very beginning before the try:
const startBatch = useCallback(async (method: string, request: any) => {
  setState({ running: true, progress: null, result: null });
  updateProgress({ completed: 0, total: 0, current: '', running: true, done: false });

  try {
    // ... existing code ...
  }
}, [updateProgress]);   // ← add updateProgress to deps

// Also in cancelBatch, clear the global progress:
const cancelBatch = useCallback(async () => {
  updateProgress(null);
  try {
    await (window as any).go.main.App.CancelBatch();
  } catch { /* no-op */ }
}, [updateProgress]);
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 6: Modify ConvertResize Page

**Files:**
- Modify: `frontend/src/pages/ConvertResize.tsx`

- [ ] **Step 1: Remove BatchProgress, add setIdleText**

```tsx
// Remove import of BatchProgress:
// BEFORE:
import { BatchProgress } from '../components/BatchProgress';
// AFTER: delete this line

// Add import for progress context:
import { useProgressContext } from '../hooks/useProgress';

// Inside the component, after useBatch():
const { setIdleText } = useProgressContext();

// Add effect to update idle text when allFiles changes:
useEffect(() => {
  const count = allFiles.length;
  setIdleText(count > 0 ? `${count} 张图片 · 就绪` : '0 张图片 · 就绪');
}, [allFiles, setIdleText]);

// Remove the <BatchProgress> line (line 194):
// BEFORE:
          <BatchProgress progress={state.progress} />
// AFTER: delete this line
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 7: Modify Slice Page

**Files:**
- Modify: `frontend/src/pages/Slice.tsx`

- [ ] **Step 1: Remove BatchProgress, add setIdleText**

Same pattern as ConvertResize:

```tsx
// Remove import:
// DELETE: import { BatchProgress } from '../components/BatchProgress';

// Add import:
import { useProgressContext } from '../hooks/useProgress';

// Inside component, after useBatch():
const { setIdleText } = useProgressContext();

// Add effect:
useEffect(() => {
  const count = allFiles.length;
  setIdleText(count > 0 ? `${count} 张图片 · 就绪` : '0 张图片 · 就绪');
}, [allFiles, setIdleText]);

// Remove <BatchProgress progress={state.progress} /> line
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 8: Modify Watermark Page

**Files:**
- Modify: `frontend/src/pages/Watermark.tsx`

- [ ] **Step 1: Remove BatchProgress, add setIdleText**

Same pattern:

```tsx
// DELETE: import { BatchProgress } from '../components/BatchProgress';

// Add import:
import { useProgressContext } from '../hooks/useProgress';

// Inside component, after useBatch():
const { setIdleText } = useProgressContext();

// Add effect:
useEffect(() => {
  const count = allFiles.length;
  setIdleText(count > 0 ? `${count} 张图片 · 就绪` : '0 张图片 · 就绪');
}, [allFiles, setIdleText]);

// Remove <BatchProgress progress={state.progress} /> line
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Task 9: Modify AIBatch Page

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx`

- [ ] **Step 1: Integrate progress context**

```tsx
// Add import at top:
import { useProgressContext } from '../hooks/useProgress';

// Inside AIBatch component body, add:
const { updateProgress } = useProgressContext();

// In handleRun, before the processing starts (around line 546-562):
// After `setProcessing(true);` add:
updateProgress({
  completed: 0,
  total: pendingItems.length,
  current: '准备中...',
  running: true,
  done: false,
});

// After results return and queue is updated (around line 598):
// After the setQueue call that maps results, add progress update:
const completedNow = queue.filter(i => i.status === 'completed').length + pendingItems.filter((item, idx) => {
  const r = resultByPath.get(item.path);
  return r && r.success;
}).length;

updateProgress({
  completed: completedNow,
  total: queue.length,
  current: '',
  running: false,
  done: true,
});

// Update the cancel handler (the one in the inline button, around line 1215):
// Add before the existing cancel logic:
updateProgress(null);

// In retryItem, after the item starts processing (around line 422):
updateProgress({
  completed: 0,
  total: 1,
  current: item.name,
  running: true,
  done: false,
});

// In retryItem, after results come back (around line 448):
updateProgress({
  completed: 1,
  total: 1,
  current: '',
  running: false,
  done: true,
});

// Remove the downloadProgress floating div (lines 1227-1231):
// DELETE:
{/* {downloadProgress.active && (
  <div style={{ position: 'fixed', bottom: 20, ... }}>
    下载中 {downloadProgress.current} / {downloadProgress.total}
  </div>
)} */}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit`
Expected: No type errors.

---

### Spec Coverage

Check each spec requirement against tasks:

| Spec Requirement | Task |
|---|---|
| ProgressContext with types | Task 1 |
| StatusBar with 3 visual states | Task 3 |
| Auto-clear done state after 5s | Task 3 |
| StatusBar in Layout (persistent) | Task 4 |
| App wrapped with ProgressProvider | Task 4 |
| useBatch pushes to context | Task 5 |
| Remove inline BatchProgress from pages | Tasks 6, 7, 8 |
| setIdleText per page | Tasks 6, 7, 8 |
| AIBatch pushes progress to context | Task 9 |
| AIBatch remove downloadProgress float | Task 9 |
| StatusBar CSS classes | Task 2 |

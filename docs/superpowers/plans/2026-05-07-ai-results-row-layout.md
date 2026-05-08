# AI Batch Results Row Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure AI batch result thumbnails from below filename to inline on the same row, at 40×40 size with hover preview.

**Architecture:** Pure frontend change — two files: CSS class adjustments and JSX restructuring in the queue item render loop. No backend changes. No new components.

**Tech Stack:** React + TypeScript, CSS (design system)

---

## File Structure

- **Modify:** `frontend/src/styles/design-system.css` — adjust `.queue-name`, `.queue-result-thumb`, `.queue-result-more`, `.queue-results`; add `.queue-item-spacer`
- **Modify:** `frontend/src/pages/AIBatch.tsx:944-1027` — move AI results div from inside `.queue-name` to main flex row level, add hover events, change slice limit 4→5

---

### Task 1: CSS adjustments

**Files:**
- Modify: `frontend/src/styles/design-system.css:798-872`

- [ ] **Step 1: Change `.queue-name` flex from `1` to `0 1 auto` with `min-width: 120px`**

Current (line 802-803):
```css
.queue-name {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex: 1;
  min-width: 0;
}
```

Change to:
```css
.queue-name {
  font-size: var(--text-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  flex: 0 1 auto;
  min-width: 120px;
}
```

- [ ] **Step 2: Remove `.queue-results` margin-top**

Current (line 827-833):
```css
.queue-results {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  min-width: 0;
}
```

Remove `margin-top: var(--space-3);`:
```css
.queue-results {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
```

- [ ] **Step 3: Change `.queue-result-thumb` from 34px → 40px**

Current (line 835-846):
```css
.queue-result-thumb {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  ...
```

Change to:
```css
.queue-result-thumb {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  ...
```

- [ ] **Step 4: Change `.queue-result-more` from 34px → 40px**

Current (line 860-872):
```css
.queue-result-more {
  min-width: 34px;
  height: 34px;
  ...
```

Change to:
```css
.queue-result-more {
  min-width: 40px;
  height: 40px;
  ...
```

- [ ] **Step 5: Add `.queue-item-spacer` class**

Add after `.queue-item:hover` block (after line 775):
```css
.queue-item-spacer {
  flex: 1;
  min-width: 20px;
}
```

- [ ] **Step 6: Commit CSS changes**

```bash
git add frontend/src/styles/design-system.css
git commit -m "style: adjust queue item CSS for inline AI results layout

- .queue-name: flex 1 → 0 1 auto, min-width 120px
- .queue-result-thumb: 34px → 40px
- .queue-result-more: 34px → 40px
- .queue-results: remove margin-top
- Add .queue-item-spacer class"
```

---

### Task 2: JSX restructuring in AIBatch.tsx

**Files:**
- Modify: `frontend/src/pages/AIBatch.tsx:968-994`

- [ ] **Step 1: Move AI results div out of `.queue-name` and add hover preview events**

Current structure (lines 968-994):
```tsx
<div className="queue-name">
  <div className="queue-title" onClick={() => openPreview(item)} style={{ cursor: 'pointer' }}>
    {item.name}
  </div>
  {item.status === 'completed' && item.outputPaths && item.outputPaths.length > 0 && (
    <div className="queue-results">
      {item.outputPaths.slice(0, 4).map((outPath, idx) => (
        <button
          key={outPath}
          className="queue-result-thumb"
          onClick={() => openPreview(item, outPath)}
          title={fileNameFromPath(outPath)}
        >
          {item.thumbUrls?.[idx] ? (
            <img src={item.thumbUrls[idx]} alt={`AI result ${idx + 1}`} />
          ) : (
            <span>{idx + 1}</span>
          )}
        </button>
      ))}
      {item.outputPaths.length > 4 && (
        <span className="queue-result-more">+{item.outputPaths.length - 4}</span>
      )}
    </div>
  )}
  {item.error && <div className="queue-error text-xs text-danger mt-2" title={item.error}>{item.error}</div>}
</div>
```

Replace with (AI results moved outside `.queue-name`):
```tsx
<div className="queue-name">
  <div className="queue-title" onClick={() => openPreview(item)} style={{ cursor: 'pointer' }}>
    {item.name}
  </div>
  {item.error && <div className="queue-error text-xs text-danger mt-2" title={item.error}>{item.error}</div>}
</div>
```

Then after the `</div>` of `.queue-name`, before the status badges, add the spacer and AI results:
```tsx
</div>  {/* end of .queue-name */}

{/* Spacer to push AI results toward middle-right */}
<div className="queue-item-spacer" />

{/* AI result thumbnails — inline on the same row */}
{item.status === 'completed' && item.outputPaths && item.outputPaths.length > 0 && (
  <div className="queue-results">
    {item.outputPaths.slice(0, 5).map((outPath, idx) => (
      <button
        key={outPath}
        className="queue-result-thumb"
        onClick={() => openPreview(item, outPath)}
        title={fileNameFromPath(outPath)}
        onMouseMove={(e) => {
          setHoverPreviewImg(toFileUrl(outPath));
          setHoverPreviewPos({ x: e.clientX, y: e.clientY });
        }}
        onMouseEnter={() => setHoverPreviewVisible(true)}
        onMouseLeave={() => setHoverPreviewVisible(false)}
      >
        {item.thumbUrls?.[idx] ? (
          <img src={item.thumbUrls[idx]} alt={`AI result ${idx + 1}`} />
        ) : (
          <span>{idx + 1}</span>
        )}
      </button>
    ))}
    {item.outputPaths.length > 5 && (
      <span className="queue-result-more">+{item.outputPaths.length - 5}</span>
    )}
  </div>
)}

{/* Status badges */}
```

- [ ] **Step 2: Verify the complete queue item structure**

The result should look like:
```tsx
<div key={item.id} className="queue-item">
  {/* Source thumbnail */}
  <div className="queue-thumb" ...>
    ...
  </div>

  {/* Filename (no more AI results inside) */}
  <div className="queue-name">
    <div className="queue-title" ...>{item.name}</div>
    {item.error && <div className="queue-error" ...>{item.error}</div>}
  </div>

  {/* Spacer */}
  <div className="queue-item-spacer" />

  {/* AI results (inline, same row) */}
  {item.status === 'completed' && item.outputPaths?.length > 0 && (
    <div className="queue-results">
      {item.outputPaths.slice(0, 5).map((outPath, idx) => (
        <button key={outPath} className="queue-result-thumb"
          onClick={() => openPreview(item, outPath)}
          onMouseMove={...} onMouseEnter={...} onMouseLeave={...}>
          {item.thumbUrls?.[idx] ? <img ... /> : <span>{idx + 1}</span>}
        </button>
      ))}
      {item.outputPaths.length > 5 && (
        <span className="queue-result-more">+{item.outputPaths.length - 5}</span>
      )}
    </div>
  )}

  {/* Status badges */}
  ...

  {/* Actions */}
  ...
</div>
```

- [ ] **Step 3: Commit JSX changes**

```bash
git add frontend/src/pages/AIBatch.tsx
git commit -m "feat: restructure AI results to inline row with hover preview

- Move AI result thumbnails from inside .queue-name to main flex row
- Add flex spacer for middle-to-right positioning
- Add hover preview events (onMouseMove/Enter/Leave) to AI result thumbs
- Change display limit from 4 to 5 thumbnails"
```

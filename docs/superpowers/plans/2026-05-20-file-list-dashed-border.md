# File List 虚线框 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dashed border to the file list area in GroupedFileList to visually distinguish it from the operation area.

**Architecture:** One CSS class addition to `design-system.css`, one className addition in `GroupedFileList.tsx`. No logic changes, no new components.

**Tech Stack:** CSS3, React (inline styles preserved)

---

### Task 1: CSS class + component update

**Files:**
- Modify: `frontend/src/styles/design-system.css` (new class at end)
- Modify: `frontend/src/components/GroupedFileList.tsx:203` (add className)

- [ ] **Step 1: Add `.file-list-area` class to design-system.css**

Append before the final blank line in `frontend/src/styles/design-system.css`:

```css
.file-list-area {
  border: 2px dashed var(--color-border-default);
  border-radius: var(--radius-lg);
  margin-top: var(--space-3);
}
```

- [ ] **Step 2: Add className to GroupedFileList's file list container**

In `frontend/src/components/GroupedFileList.tsx`, line 203, change:

```tsx
<div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 'var(--space-3) var(--space-4)' }}>
```

to:

```tsx
<div className="file-list-area" style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 'var(--space-3) var(--space-4)' }}>
```

- [ ] **Step 3: Verify the build**

Run: `npm run build` in `frontend/` directory (or the project's build command).
Expected: No compilation errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/design-system.css frontend/src/components/GroupedFileList.tsx
git commit -m "feat: add dashed border to file list area in GroupedFileList"
```

# Dropzone 虚线框放大实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 放大 ImageList 组件的虚线框 dropzone，空状态改为纵向居中布局，有文件列表时始终显示虚线边框

**Architecture:** 仅改动 `frontend/src/components/ImageList.tsx` 一个文件的内联样式，不涉及 CSS 文件或其他组件

**Tech Stack:** React + TypeScript

---

### Task 1: 修改空状态虚线框样式

**Files:**
- Modify: `frontend/src/components/ImageList.tsx:88-107`

- [ ] **Step 1: 去掉内联 padding/flexDirection/gap，保留 cursor 和 drop-target**

修改第 88-107 行的空状态 `<div>`，将当前的内联样式：

```tsx
style={{
  padding: '20px 24px', flexDirection: 'row', gap: 8, cursor: 'pointer',
  ['--wails-drop-target' as any]: 'drop',
  borderColor: dragOver ? 'var(--color-accent)' : undefined,
  background: dragOver ? 'var(--color-accent-glow)' : undefined,
}}
```

改为：

```tsx
style={{
  cursor: 'pointer',
  ['--wails-drop-target' as any]: 'drop',
  borderColor: dragOver ? 'var(--color-accent)' : undefined,
  background: dragOver ? 'var(--color-accent-glow)' : undefined,
}}
```

`.empty-state` CSS 类会自动提供：
- `flex-direction: column`（图标在上、文字在下）
- `padding: var(--space-12)`（约 48px）
- `gap: var(--space-3)`
- `border: 2px dashed var(--color-border-default)`

- [ ] **Step 2: 验证修改**

```bash
cd frontend && npm run build
```

Expected: 构建成功，无 TypeScript 错误。空状态虚线框变为纵向居中布局，尺寸变大。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImageList.tsx
git commit -m "feat: enlarge empty-state dropzone with vertical centered layout"
```

---

### Task 2: 为有文件列表时添加虚线边框

**Files:**
- Modify: `frontend/src/components/ImageList.tsx:110-123`

- [ ] **Step 1: 修改容器样式，始终显示虚线边框**

修改第 110-123 行的 `<div>`，当前样式为：

```tsx
style={{
  borderRadius: 'var(--radius-2xl)',
  ['--wails-drop-target' as any]: 'drop',
  outline: dragOver ? '2px dashed var(--color-accent)' : undefined,
  outlineOffset: 2,
  transition: 'outline 150ms ease',
  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
}}
```

改为：

```tsx
style={{
  borderRadius: 'var(--radius-2xl)',
  ['--wails-drop-target' as any]: 'drop',
  border: '2px dashed var(--color-border-default)',
  borderColor: dragOver ? 'var(--color-accent)' : 'var(--color-border-default)',
  background: dragOver ? 'var(--color-accent-glow)' : undefined,
  transition: 'border-color 150ms ease, background 150ms ease',
  padding: 'var(--space-5)',
  flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
}}
```

改动要点：
- `outline` → `border`：边框始终可见，且占据布局空间
- 默认色 `var(--color-border-default)`，拖拽时变为 `var(--color-accent)`
- 新增 `background: dragOver ? ...`：拖拽时背景 glow
- 新增 `padding: var(--space-5)`：虚线框与文件列表之间保持间距
- 移除 `outlineOffset`（border 不需要）

- [ ] **Step 2: 验证修改**

```bash
cd frontend && npm run build
```

Expected: 构建成功。添加图片后，列表容器显示 2px 虚线边框，拖拽时高亮。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImageList.tsx
git commit -m "feat: show dashed border on image list container with drag highlight"
```

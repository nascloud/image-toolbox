# Dropzone 虚线框放大设计

## 背景

用户反馈 ImageList 组件中的虚线框（dropzone）太小，希望在所有使用该组件的页面中放大，使其更醒目、更便于拖拽或点击添加图片。

## 现状

`ImageList` 组件用于三个页面：ConvertResize、Slice、Watermark。

空状态时使用 `.empty-state` CSS 类，但被内联样式覆盖：
- `padding: '20px 24px'`（偏小）
- `flexDirection: 'row'`（横向排列）
- `gap: 8`

有文件列表时没有虚线边框，仅拖拽时闪现 `outline`。

## 改动

### 文件清单

1. `frontend/src/components/ImageList.tsx`（唯一改动文件）

### 1. ImageList.tsx — 空状态

去掉内联的 `padding`、`flexDirection`、`gap`，只保留 `cursor: 'pointer'` 和 `--wails-drop-target`。

让 `.empty-state` CSS 默认样式生效：
- `flex-direction: column`（纵向居中，图标在文字上方）
- `padding: var(--space-12)`（约 48px，远大于当前 20px）
- `gap: var(--space-3)`

### 2. ImageList.tsx — 有文件列表时

已有文件时整体容器始终显示虚线边框，规则：

| 状态 | 虚线样式 | 背景 |
|------|----------|------|
| 默认 | `2px dashed var(--color-border-default)` | 透明 |
| 拖拽悬停 | `2px dashed var(--color-accent)` | `var(--color-accent-glow)` |
| hover | 不变 | 不变 |

实现方式：
- 使用 `border` 属性（而非 `outline`），以便边框占据布局空间
- 容器增加 `padding: var(--space-5)`，使边框与文件列表保持间距
- 默认边框色与 `.empty-state` 一致（`var(--color-border-default)`）
- "+ 添加" 按钮触发文件选择
- 文件项（预览、删除）的点击事件不受影响

### 3. 不涉及的页面

AIBatch 页面使用独立的拖拽区域实现，不在本次改动范围内。

## 影响范围

| 页面 | 空状态 | 有文件列表 |
|------|--------|-----------|
| ConvertResize | 变大 + 竖向 | 新增虚线框 |
| Slice | 变大 + 竖向 | 新增虚线框 |
| Watermark | 变大 + 竖向 | 新增虚线框 |
| AIBatch | 不受影响 | 不受影响 |

## 不产生的影响

- 不改变文件列表内的预览、删除行为
- 不改变拖拽逻辑（路径过滤、Wails 事件处理）
- 不改变已有文件时的文件列表样式（只包裹虚线边框）

# File List 虚线框设计

## 目标

在本地处理页面（转换/缩放、切片、水印）中，为 `GroupedFileList` 组件内部的文件列表区域添加虚线边框，使其与右侧操作区域的 solid 边框卡片形成视觉区分。

## 受影响的页面

- ConvertResize.tsx
- Slice.tsx
- Watermark.tsx

## 实现方案

**方案 A（选定）：在 CSS 文件新增类，组件引用**

### 步骤 1 — 新增 CSS 类

在 `frontend/src/styles/design-system.css` 新增 `.file-list-area` 类：

```css
.file-list-area {
  border: 2px dashed var(--color-border-default);
  border-radius: var(--radius-lg);
  margin-top: var(--space-3);
}
```

- 使用 `2px dashed` 确保虚线视觉效果明显
- 圆角与 `.card` 保持一致风格
- 顶部间距让按钮区域和文件列表区域有清晰分层

### 步骤 2 — 组件引用

在 `frontend/src/components/GroupedFileList.tsx` 第 203 行的容器 div 上添加 `className="file-list-area"`，保留原有 inline style。

该 div 当前内容：
```tsx
<div style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 'var(--space-3) var(--space-4)' }}>
```

修改为：
```tsx
<div className="file-list-area" style={{ flex: 1, overflow: 'auto', minHeight: 0, padding: 'var(--space-3) var(--space-4)' }}>
```

### 步骤 3 — 验证

- 确认三个本地处理页面的文件列表区域都展示虚线边框
- 确认右侧操作区域卡片仍为 solid 边框
- 确认空白状态（无文件时）显示正常
- 确认拖拽高亮状态不受影响

## 不变的内容

- GroupedFileList 外容器的 `.card` 类保持不变（现有 solid 边框）
- 按钮区的样式不变
- 右侧操作区的 `.card` 不变
- AIBatch 页面不受影响（不使用 GroupedFileList 作为文件列表）

## 未涉及

- 无后端改动
- 无新依赖
- 无新增组件
- 无状态或逻辑变更

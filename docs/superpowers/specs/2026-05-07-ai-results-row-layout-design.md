# AI Batch 结果行布局重新设计

## 目标

重新设计 AI 批处理结果展示的行布局，将 AI 生成缩略图从文件名下方改为同一行内，从行中间开始向右排列，减少垂直空间占用，增加列表可读性。

## 现状问题

当前 AI 结果缩略图渲染在 `.queue-name` 内部、文件名**下方**，导致：
- 每行占用更多垂直空间（约多 40%）
- 信息密度低，可浏览效率差
- 视觉上 AI 结果被"藏"在文件名下，不够直观

## 新布局

单行结构（flex）：

```
[source-thumb 40px] [filename | min-width: 120px, truncate] [spacer flex:1] [AI-thumb ×5 | +N] [status badge] [actions]
```

- 源图缩略图：40×40px，保持不变
- 文件名：`flex: 0 1 auto; min-width: 120px`，超长截断
- flex spacer：占满剩余空间，将 AI 结果推向中间偏右
- AI 结果缩略图：40×40px（与原图一致），最多显示 5 张，超出显示 `+N`
- 状态标签、操作按钮：保持在右侧

## 具体改动

### CSS 调整（design-system.css）

| 选择器 | 当前值 | 新值 |
|--------|--------|------|
| `.queue-name` | `flex: 1` | `flex: 0 1 auto; min-width: 120px` |
| `.queue-results` | `margin-top: var(--space-3)` | （移除） |
| `.queue-result-thumb` | `width/height: 34px` | `width/height: 40px` |
| `.queue-result-more` | `min-width: 34px; height: 34px` | `min-width: 40px; height: 40px` |

新增：
- `.queue-item-spacer`：`flex: 1; min-width: 20px;`

### JSX 结构调整（AIBatch.tsx）

- 将 AI 结果渲染块从 `.queue-name` 内部**移到外层**，位于 spacer 之后、badge 之前
- `item.outputPaths.slice(0, 4)` → `slice(0, 5)`
- 对应 `+N` 计算自动适配（`outputPaths.length - 5`）

### Hover 预览

AI 结果缩略图绑定鼠标事件，复用现有 hover-preview 机制：

```tsx
onMouseMove  → setHoverPreviewImg + setHoverPreviewPos
onMouseEnter → setHoverPreviewVisible(true)
onMouseLeave → setHoverPreviewVisible(false)
```

使用 `toFileUrl(outPath)` 作为预览图源（全分辨率文件），复用现有 `.hover-preview` CSS。

### 状态显示

各状态下 AI 结果区域的显示规则：

| Item status | AI results area |
|-------------|----------------|
| `pending` | 不显示 |
| `processing` | 不显示 |
| `completed` | 显示缩略图 + +N |
| `error` | 不显示 |
| `cancelled` | 不显示 |

## 边界情况

- **无 AI 结果**：spacer 直接连接 badge，无异常
- **1 张结果**：只显示 1 张缩略图，无 +N
- **恰好 5 张**：显示 5 张缩略图，无 +N
- **超过 5 张**：显示 5 张缩略图 + `+N`（`N = outputPaths.length - 5`）
- **文件名超长**：`text-overflow: ellipsis` 截断，`min-width: 120px` 保证至少宽度
- **并发处理中**：AI 结果区域隐藏，只显示源图缩略图和"处理中"badge

## 不做的范围

- 不提取子组件（保持在 AIBatch.tsx 中）
- 不改变 hover-preview 浮窗样式和定位逻辑
- 不改动后端数据流
- 不改变预览弹窗（modal）的行为

# Image Toolbox

Windows 本地图片批处理 + AI 图片生成桌面应用，基于 Wails v2 + Go + React/TypeScript。

## 功能

### 本地图片处理
- **格式转换 & 缩放** — jpg/png/webp 互转，按比例或指定尺寸缩放
- **图片切片** — 按数量等分或按像素高度切割
- **图片水印** — 文字水印 / 图片水印，支持透明度、位置、预览

### AI 图片生成
- 通过火山引擎 Ark API 调用豆包 Seedream 系列模型
- 支持 Seedream 5.0 / 4.5 / 4.0 / 3.0
- 文生图、图生图、多参考图
- 组图生成、联网搜索、提示词优化
- 批量处理，并发控制
- 可自定义尺寸、格式、水印、种子

### 通用
- 拖拽添加文件
- 文件夹扫描
- 灵活的保存模式（原目录/指定目录/子目录）
- 进度显示

## 开发

```bash
# 实时开发（前端热重载 + Go 后端）
wails dev

# 构建生产包
wails build
```

前端的 Vite 开发服务器默认端口。Go 方法也可通过 http://localhost:34115 在浏览器中调试。

## 技术栈

| 层     | 技术                     |
| ------ | ------------------------ |
| 后端   | Go 1.24.2, Wails v2.12.0 |
| 前端   | React 18, TypeScript     |
| 构建   | Vite 3                   |
| 图片   | golang.org/x/image       |
| AI API | 火山引擎 Ark (OpenAI 兼容) |

## 配置

API Key 等设置在 Settings 页面管理，持久化到本地 JSON 文件。

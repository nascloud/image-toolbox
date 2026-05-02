# Image Toolbox — 重构设计文档

## 概述

将现有四个独立的 Python 图片处理项目（image_convert、slice_images、watermarked、seedream）重构为一个统一的 Windows 桌面图片工具箱。技术栈为 Go 1.22+ + Wails v2 + React + TypeScript。

## 架构原则

1. 各功能以 Tab 隔离，彼此不耦合
2. 前端只负责参数配置与状态展示，不处理图片
3. 后端功能模块可独立测试
4. 批处理 = 对一组路径执行相同处理 pipeline
5. 错误隔离：单张图片失败不影响其它

## 整体架构

### 后端目录

```
backend/
├── app/app.go                    # Wails API 层（最薄）
│
├── image/                        # 本地图片处理
│   ├── convert.go                # 格式转换（jpg/png/webp）
│   ├── resize.go                 # 缩放（按比例/指定尺寸）
│   ├── slice.go                  # 随机切片（来自 slice_images）
│   └── watermark.go              # 水印（图片水印 + 文字水印）
│
├── ai/                           # AI 图片处理
│   ├── client.go                 # 火山方舟 API 客户端
│   ├── prompt.go                 # Prompt 构建（纯函数）
│   ├── reference.go              # 参考图处理
│   └── image_task.go             # 单图 AI 任务
│
├── batch/                        # 批处理调度（所有 Tab 共用）
│   ├── runner.go                 # 并发/错误隔离/进度上报
│   ├── local.go                  # 本地批处理编排
│   └── ai.go                     # AI 批处理编排
│
├── file/                         # 文件系统
│   ├── picker.go                 # 文件/目录选择
│   ├── scan.go                   # 扫描目录生成图片列表
│   ├── output.go                 # 输出路径 & 命名规则
│   └── temp.go                   # 临时文件管理
│
├── model/                        # 数据结构
│   ├── image.go                  # ImageJob/ImageResult
│   ├── batch.go                  # BatchRequest/BatchResult
│   ├── ai.go                     # AI 请求/响应结构
│   └── progress.go               # 进度状态定义
│
└── util/                         # 通用工具
    ├── logger.go
    └── errors.go
```

### 前端页面

```
frontend/
└── src/
    ├── pages/
    │   ├── ConvertResize.tsx     ← Tab1: 格式转换 + 缩放
    │   ├── Slice.tsx             ← Tab2: 图片切片
    │   ├── Watermark.tsx         ← Tab3: 水印
    │   ├── AIBatch.tsx           ← Tab4: AI 生成
    │   └── Settings.tsx          ← 全局设置（API Key 等）
    │
    ├── components/
    │   ├── ImageList.tsx          # 图片列表（各 Tab 复用）
    │   ├── BatchProgress.tsx      # 进度条/日志
    │   └── Layout.tsx             # Tab 导航布局
    │
    ├── hooks/useBatch.ts          # 批处理状态管理
    └── api/                       # Wails 绑定
```

### 数据流

```
用户操作 Tab → 前端调用 Wails API → app.go 路由
  → batch/runner.go 编排
    → image/*.go 或 ai/*.go 处理单图
  → 结果汇总返回前端
```

## Tab 功能详情

### Tab1: 格式转换 + 缩放

来源：image_convert + watermarked 缩放逻辑

- 选择图片文件或文件夹（支持递归扫描）
- 支持的输入格式：jpg、png、webp、bmp、tiff、gif
- 操作选项（可组合）：
  - 格式转换：目标格式 jpg / png / webp
  - 缩放：按比例 / 指定宽高 / 限制最大边
- 输出命名规则：
  - `a.jpg` → `a_converted.png`
  - `a.jpg` → `a_resized_50%.jpg`
  - `a.jpg` → `a_resized_1920.jpg`

### Tab2: 图片切片

来源：slice_images

- 输入：单张图片或文件夹
- 参数：切片数量（默认25）、对比度（0.1-2.0）、饱和度（0.1-2.0）
- 切片算法：随机生成切割高度，总和等于原图高度，每片在平均高度90%-110%间浮动，最小50px
- 输出：`{原文件名}_slice_{序号}.png`

### Tab3: 水印

来源：watermarked

- 图片水印：选择水印图片，平铺覆盖，调节透明度（0-100%）
- 文字水印：输入文字，选择字体/大小/颜色/位置
- 预处理选项：
  - 统一输入宽度（如先缩放到1440px宽）
  - AI 超分辨率放大（onnxruntime_go 加载 ESRGAN/EDSR ONNX 模型）

### Tab4: AI 生成

来源：seedream，对接火山方舟 API

- 输入：Prompt（必填）、输入图片（必填）、参考图（0-12张）
- 参数：模型选择、图片尺寸、风格强度、文本权重、随机种子、输出格式
- 批量：多张图片用相同配置依次执行 AI 生成

## 批处理规范

- 输入：`[]string` 图片路径
- 输出：`[]ImageResult`（每张图片包含路径、状态、错误信息）
- 并发执行 + 进度回调
- 不覆盖原图

## API 设计

所有前端可调用方法位于 `backend/app/app.go`：

- `ProcessImagesBatch(request BatchRequest) ([]ImageResult, error)`
- `RunAIImageBatch(request AIBatchRequest) ([]ImageResult, error)`
- `SelectFiles() ([]string, error)`
- `SelectDirectory() (string, error)`

参数仅限 string / int / bool / struct（JSON 可序列化），返回 `(result, error)`。

## 依赖说明

- 图片编解码：Go 标准库 `image` + `golang.org/x/image`
- 水印合成：Go `image/draw` + RGBA alpha composite
- AI 超分辨率：使用 [yalue/onnxruntime_go](https://github.com/yalue/onnxruntime_go) 加载 ONNX 格式超分模型（ESRGAN/EDSR 等），支持 GPU 加速（CUDA/DirectML）
- 模型来源：Hugging Face 预训练超分 ONNX 模型
- AI API 客户端：标准 `net/http` + `encoding/json`

## 错误处理

- 单张图片错误 ≠ 批处理失败
- 错误信息包含文件名 + 操作类型
- 禁止 panic
- Go 标准 error 返回

## 实施阶段建议

考虑到项目规模，建议分 3 个阶段实施：

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **Phase 1** | 项目脚手架 + Tab1（格式转换+缩放）+ 共享基础设施（file、batch、model） | 无 |
| **Phase 2** | Tab2（切片）+ Tab3（水印） | Phase 1 |
| **Phase 3** | Tab4（AI 生成）+ Settings 页 | Phase 1 |

# Project: Windows Image Processing Desktop App

你是本项目的 **核心工程师 Codex**，该项目是一个 **Windows 本地图片批处理 + AI 图片批处理工具**。

请你像在真实商业项目中一样编写代码，遵循以下规范。

---

## 1. 项目核心目标（必须理解）

本项目是一个 **本地优先（Local-first）图片处理应用**，主要能力包括：

### ✅ 本地图片批处理（不依赖 AI）

- 图片缩放（按比例 / 指定最大边）
- 图片格式转换（jpg / png / webp）
- 图片水印（文字水印 / 图片水印）
- 图片切片（按数量 / 按像素高度）
- 批量处理文件夹

### ✅ AI 图片批处理（通过 API）

- 文本提示词（Prompt）
- 可选参考图（Reference Image）
- 支持对一组图片执行相同 AI 操作
- 支持可复现参数（尺寸、模型、种子、风格等）
- 多供应商支持：Seedream（火山引擎 Ark）、ChatGPT2API（兼容 OpenAI 格式）
- 多模型支持：Seedream 5.0 / 4.5 / 4.0 / 3.0、ChatGPT2API 接入模型

⚠️ AI **不是实时交互工具**，而是：
> **"用户配置一次 → 后端批量执行 → 返回结果"**

---

## 2. 技术栈（不可变）

### 后端

- Go 1.24.2
- Wails v2.12.0
- Windows 为主要平台
- 所有图片处理与 AI 请求都在后端完成

### 前端

- React + TypeScript
- 只负责参数配置、状态显示、进度反馈
- 不能直接操作本地图片内容

---

## 3. 图片处理架构原则（非常重要）

### ✅ 强制原则

1. **一切图片都以"文件路径"为核心**
2. **批处理 = 对一组路径执行相同处理 pipeline**
3. 每一步操作应：
  - 可组合
  - 可单独测试
  - 不依赖 UI 状态

---

## 4. 目录职责（严格遵守）

### 后端目录职责

```
image-toolbox/
├── main.go
├── app.go                     # Wails 入口，嵌入 backend/app
├── wails.json
├── go.mod / go.sum
│
├── backend/
│   ├── app/                   # ✅ 给前端用的 API（最薄）
│   │   └── app.go
│   │
│   ├── image/                 # ✅ 本地图片处理（非 AI）
│   │   ├── resize.go          # 缩放 / 尺寸限制
│   │   ├── convert.go         # 格式转换（jpg/png/webp）
│   │   ├── slice.go           # 图片切片（按数量 / 按高度）
│   │   └── watermark.go       # 文字/图片水印
│   │
│   ├── batch/                 # ✅ 批处理调度层（核心）
│   │   ├── local.go           # 本地图片批处理（缩放/转换）
│   │   ├── ai.go              # AI 图片批处理
│   │   ├── runner.go          # 并发 / 错误隔离 / 进度
│   │   ├── slice.go           # 切片批处理
│   │   ├── watermark.go       # 水印批处理
│   │   └── output_paths.go    # 批处理输出路径规划
│   │
│   ├── ai/                    # ✅ AI 图片处理
│   │   ├── provider.go        # Provider 接口定义 + 工厂方法
│   │   ├── provider_seedream.go      # Seedream 供应商实现
│   │   ├── provider_chatgpt2api.go   # ChatGPT2API 供应商实现
│   │   ├── prompt.go          # Prompt 构建（纯函数）
│   │   ├── reference.go       # 参考图处理
│   │   ├── image_task.go      # 单图 AI 任务（input → API → output）
│   │   └── download.go        # 结果图片 URL → 本地文件下载
│   │
│   ├── config/                # ✅ 配置管理
│   │   └── config.go          # API Key / AI 输出目录持久化（多供应商）
│   │
│   ├── file/                  # ✅ 文件系统
│   │   ├── scan.go            # 扫描目录生成图片列表
│   │   ├── output.go          # 输出路径 & 命名
│   │   ├── copy.go            # 文件复制
│   │   └── temp.go            # 临时文件管理
│   │
│   ├── model/                 # ✅ 所有结构体定义
│   │   ├── image.go           # ImageJob / ImageResult
│   │   ├── batch.go           # BatchRequest / BatchResult
│   │   ├── ai.go              # AIImageRequest / AIImageResponse / AIBatchRequest / ModelInfo
│   │   ├── slice.go           # SliceRequest
│   │   ├── watermark.go       # WatermarkRequest / WatermarkPreviewRequest
│   │   └── progress.go        # 进度状态
│   │
│   ├── shell/                 # ✅ Windows Shell 集成
│   │   ├── register.go        # 右键菜单注册 / 卸载
│   │   ├── launch.go          # 命令行参数解析（LaunchIntent）
│   │   ├── mutex.go           # 单实例互斥锁
│   │   └── ipc.go             # 进程间通信（第二实例 → 已有实例）
│   │
│   └── util/                  # 通用工具（待充实）
│       └── ...
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   │
│   └── src/
│       ├── main.tsx            # 入口
│       ├── App.tsx             # 根组件 + 路由
│       │
│       ├── pages/
│       │   ├── ConvertResize.tsx  # 转换 / 缩放页面
│       │   ├── Slice.tsx          # 切片页面
│       │   ├── Watermark.tsx      # 水印页面
│       │   ├── AIBatch.tsx        # AI 批处理页面
│       │   └── Settings.tsx       # 设置页面（API Key 等）
│       │
│       ├── components/
│       │   ├── Layout.tsx         # 全局布局 / 侧栏导航
│       │   ├── ImageList.tsx      # 图片列表（拖拽）
│       │   ├── GroupedFileList.tsx # 分组文件列表
│       │   ├── SaveModeSelector.tsx # 保存模式选择器
│       │   └── StatusBar.tsx      # 全局状态栏
│       │
│       ├── hooks/
│       │   ├── useBatch.ts        # 批处理状态管理
│       │   ├── useProgress.tsx    # 进度管理
│       │   └── useIntent.tsx      # Shell 启动意图管理
│       │
│       ├── assets/
│       ├── styles/
│       ├── wailsjs/              # Wails 自动生成绑定
│       └── vite-env.d.ts
│
└── docs/
    ├── api文档/                  # 火山引擎 Ark API 参考
    │   ├── API文档.md
    │   ├── 模型能力.md
    │   └── 自定义图片输出规格.md
    │
    └── superpowers/
        ├── plans/                # 功能实现计划
        └── specs/                # 功能设计文档
```

❌ 禁止：
- 混合图片处理与 AI 代码
- 在 app.go 或 backend/app/app.go 写任何处理逻辑
- 单文件承担多种图片操作

---

## 5. 批处理设计规范（非常重要）

### ✅ 本地批处理必须遵循：

- 输入：`[]string` 图片路径
- 输出：`[]ImageResult`
- 每张图片 **失败不影响其它图片**
- 每一步处理：
  - 返回新图片路径
  - 不覆盖原图（除非明确指定）

✅ 推荐结构：
- 扫描 → 校验 → 执行 → 结果汇总

---

## 6. AI 图片处理规则（强约束）

### AI 图片功能定义

AI 图片处理 **必须支持以下输入**：

- Prompt（必填）
- 输入图片（必填）
- 可选参考图（0–N 张）
- 批量输入图片

### 强制要求

✅ 所有 AI 图像请求：
- 在后端发起
- 使用 context + timeout
- 使用 struct 定义请求 / 响应
- 支持批量输入路径

✅ Prompt 构建：
- 独立于 API client
- 可重复生成（纯函数）

✅ 模型能力：
- 通过 `provider.go` 中的 `Provider` 接口定义统一契约
- 每个供应商（`provider_seedream.go` / `provider_chatgpt2api.go`）自行实现能力
- 通过 `model.go` 中的 `ModelCapabilities` / `ModelInfo` 定义各模型支持的参数差异
- 前端请求参数统一，后端按供应商 + 模型自动适配

❌ 禁止：
- 前端拼 Prompt
- 前端拿 API Key
- 返回未解析的 JSON 字符串

---

## 7. 图片命名与输出规则

你必须使用**确定性输出规则**：

- 不与原文件冲突
- 输出路径可预测
- 批处理中可追踪来源

✅ 示例：
- `input/a.jpg`
- → `output/a_resized_1024.jpg`
- → `output/a_ai_style01.png`

---

## 8. Wails API 设计规范（强制）

所有前端可调用方法：

- 位于：`backend/app/app.go`
- 参数仅限：
  - string / int / bool
  - struct（JSON 可序列化）
- 返回：
  - `(result, error)`

✅ 推荐 API 风格：
- `ProcessLocalBatch(...)`
- `RunAIImageBatch(...)`
- `SliceImages(...)`
- `ApplyWatermark(...)`

❌ 禁止：
- map[string]interface{}
- 直接暴露 image/ai 内部结构

---

## 9. 错误与稳定性原则

- 单张图片错误 ≠ 批处理失败
- 错误信息需包含：
  - 文件名
  - 操作类型
- 禁止 panic
- 所有错误必须返回

---

## 10. 输出代码规则（绝对遵守）

当你生成代码时：

1. ✅ 提供 **完整文件**
2. ✅ 明确文件路径
3. ✅ 可编译、可运行
4. ✅ 不写伪代码
5. ✅ 不省略 import

如有假设：
- 在文件头部写注释说明
- 不要在回复中反问

---

## 11. 工程价值取向（你必须坚持）

开发优先级：

1. 正确性
2. 稳定性
3. 可维护性
4. 清晰度
5. 性能（除非批量规模>1万张）

---

## 12. 你的角色定位

你不是一个对话机器人。

你是：
- 一个桌面应用图片处理工程师
- 在维护一个长期项目
- 为真实用户负责

请避免：
- 炫技
- 过度设计
- 实验性依赖

---

**始终记住：**
> 这个项目的成功标准不是"使用了多高级技术"，  
> 而是 **"大量图片可以安全、可控、可重复地被处理"**。

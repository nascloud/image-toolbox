# ChatGPT2API 使用说明

## 项目简介

[ChatGPT2API](https://github.com/basketikun/chatgpt2api) 是对 ChatGPT 官网图片能力的逆向封装，提供 OpenAI 兼容的图片生成 API。它可以作为 ImageToolbox 的 AI 图片生成后端，是火山引擎 Seedream 付费 API 的免费替代方案。

## 两种集成方式

### 方式一：独立部署 + Provider 配置（本项目推荐）

ChatGPT2API 独立部署为服务，ImageToolbox 通过 Provider 配置连接它。

#### 1. 部署 ChatGPT2API

```bash
git clone git@github.com:basketikun/chatgpt2api.git
cd chatgpt2api
# 编辑 config.json，设置 auth-key
docker compose up -d
```

部署后：
- API Base URL：`http://localhost:3000`（后端自动拼接 `/v1` 路径）
- Web 面板：`http://localhost:3000`

#### 2. 配置 ImageToolbox

在设置页选择 ChatGPT2API Provider，配置：

| 配置项   | 说明                                                  |
| -------- | ----------------------------------------------------- |
| API Key  | ChatGPT2API 的 `auth-key`（即 config.json 中设置的值） |
| Base URL | ChatGPT2API 服务地址，默认 `http://localhost:3000`     |

#### 3. 可用的模型

| 模型 ID          | 说明                             |
| ---------------- | -------------------------------- |
| `gpt-image-2`    | 官网图片生成模型（推荐）          |
| `auto`           | 自动选择模式                     |
| `gpt-5`          | GPT-5 系列（支持图生图/编辑）     |
| `gpt-5-1`        | GPT-5 系列                       |
| `gpt-5-2`        | GPT-5 系列                       |
| `gpt-5-3`        | GPT-5 系列                       |
| `gpt-5-3-mini`   | GPT-5 系列                       |
| `gpt-5-mini`     | GPT-5 系列                       |
| `codex-gpt-image-2` | Codex 画图（需 Plus/Team/Pro）|

#### 4. 能力说明

| 能力                | ChatGPT2API | 说明                          |
| ------------------- | ----------- | ----------------------------- |
| 文生图              | 支持        | `POST /v1/images/generations` |
| 图生图/编辑         | 支持        | `POST /v1/images/edits`       |
| 多张生成（n）       | 支持        | 1-4 张/次                     |
| 参考图输入          | 支持        | base64 或 URL                 |
| 联网搜索            | 不支持      |                               |

### 方式二：作为 OpenAI 兼容渠道接入（infinite-canvas 方式）

[infinite-canvas](https://github.com/basketikun/infinite-canvas) 项目采用**后端代理**模式：将 ChatGPT2API 配置为系统渠道，所有 AI 请求通过后端 `/api/v1/*` 代理转发。

#### 配置方式

在系统设置中配置渠道：

```json
{
  "channels": [
    {
      "protocol": "openai",
      "name": "ChatGPT2API",
      "baseUrl": "http://chatgpt2api:3000",
      "apiKey": "your-auth-key",
      "models": ["gpt-image-2", "gpt-5"],
      "weight": 1,
      "enabled": true
    }
  ]
}
```

#### 代理端点

后端自动代理以下 OpenAI 兼容接口：

| 前端请求                     | 代理目标                             |
| ---------------------------- | ------------------------------------ |
| `POST /api/v1/images/generations` | `{baseUrl}/v1/images/generations` |
| `POST /api/v1/images/edits`       | `{baseUrl}/v1/images/edits`       |
| `POST /api/v1/chat/completions`   | `{baseUrl}/v1/chat/completions`   |
| `GET /api/v1/models`              | `{baseUrl}/v1/models`             |

#### 渠道选择逻辑

1. 根据请求的 `model` 参数匹配 available 渠道
2. 多个渠道支持同一模型时按权重随机选择
3. 支持管理员后台测试渠道连通性和模型列表

## API 参数说明

### POST /v1/images/generations（文生图）

```json
{
  "model": "gpt-image-2",
  "prompt": "一只漂浮在太空里的猫",
  "n": 1,
  "response_format": "b64_json"
}
```

#### 参数详情

| 参数              | 类型    | 必填 | 默认值        | 说明                                    |
| ----------------- | ------- | ---- | ------------- | --------------------------------------- |
| `model`           | string  | 否   | `"gpt-image-2"` | 模型 ID                                |
| `prompt`          | string  | 是   |               | 图片提示词                              |
| `n`               | int     | 否   | `1`           | 生成数量，范围 1-4                      |
| `size`            | string  | 否   | `null`        | 宽高比提示：`"1:1"`/`"16:9"`/`"9:16"`/`"4:3"`/`"3:4"`，或任意字符串当作文本提示追加 |
| `quality`         | string  | 否   | `"auto"`      | 画质等级（见下方说明）                  |
| `response_format` | string  | 否   | `"b64_json"`  | 返回格式：`"b64_json"` 或 `"url"`       |
| `stream`          | boolean | 否   | `null`        | 是否启用流式输出                        |

> 注意：`size` 参数在 ChatGPT2API 中仅作为文本提示附加到 prompt 中，不是硬性尺寸控制。实际图片尺寸由模型决定。

#### 尺寸 + 画质组合逻辑

GPT Image 2 的 `size` 参数是**接口契约**——发送的像素值就是模型应返回的分辨率（不是文本提示）。所以后端将前端传来的 `size`（宽高比）和 `quality`（画质档位）组合成合法的像素值再发送。

**前端传入**：

| 参数      | 可选值                                                                   | 说明                 |
| --------- | ------------------------------------------------------------------------ | -------------------- |
| `size`    | `1:1` `3:4` `4:3` `16:9` `9:16` `3:2` `2:3` `21:9` 或像素值如 `3840x2160` | 宽高比/具体像素      |
| `quality` | `auto` `low` `medium` `high`                                             | 画质档位（控制总像素） |

**后端计算规则**：

1. `quality=auto` 或空 → `size` 原样发送（或空字符串则不传 size）
2. `size` 为像素格式（如 `3840x2160`）→ 直接使用，`quality` 忽略
3. `size` 为宽高比（如 `3:4`）+ `quality` 非 auto → 根据比例和目标像素面积计算实际像素

**quality 目标像素面积**：

| quality  | 目标总像素   | 典型结果举例（搭配 1:1 比例） |
| -------- | ------------ | ---------------------------- |
| `low`    | ~1,048,576   | 1024×1024                    |
| `medium` | ~4,194,304   | 2048×2048                    |
| `high`   | 8,294,400    | 2880×2880                    |

**常见搭配示例**：

| size   | quality | 计算过程                            | 实际发送      |
| ------ | ------- | ----------------------------------- | ------------- |
| `1:1`  | `low`   | 1MP 方形 → 1024×1024               | `1024x1024`   |
| `1:1`  | `medium`| 4MP 方形 → 2048×2048               | `2048x2048`   |
| `1:1`  | `high`  | 8.3MP 方形 → 2880×2880（上限）     | `2880x2880`   |
| `3:4`  | `low`   | 1MP 竖图 → 768×1024                | `768x1024`    |
| `3:4`  | `medium`| 4MP 竖图 → 1536×2048               | `1536x2048`   |
| `9:16` | `low`   | 1MP 竖图 → 576×1024                | `576x1024`    |
| `16:9` | `high`  | 8.3MP 横图 → 3840×2160（4K）       | `3840x2160`   |
| `9:16` | `high`  | 8.3MP 竖图 → 2160×3840（竖4K）     | `2160x3840`   |
| `2:3`  | `high`  | 8.3MP 竖图 → 2496×3744             | `2496x3744`   |

**GPT Image 2 尺寸硬约束**（自动校验+调整）：

1. **任一边 ≤ 3840px**（长边超出会等比缩回）
2. **宽和高都是 16 的倍数**（计算后自动取最近的 16 倍数）
3. **长边 / 短边 ≤ 3**（超宽/超窄比例会被强制修正）
4. **总像素 ∈ [655,360, 8,294,400]**（不足会放大，超出会缩小）

> 提示词可以描述画面内容、风格和构图，但不能可靠地指定最终像素。生产请求**必须**把分辨率写进 `size` 参数。

### POST /v1/images/edits（图生图/编辑）

仅支持 `multipart/form-data` 格式（OpenAI 兼容）。

```
POST /v1/images/edits
Authorization: Bearer <auth-key>
Content-Type: multipart/form-data

model=gpt-image-2
prompt=把这张图改成赛博朋克夜景风格
n=1
response_format=b64_json
image=<file>  (主图片文件)
image_url=data:image/png;base64,...  (参考图，可选，可重复)
```

> 注意：ImageToolbox 后端会自动将输入图片编码为文件上传，参考图以 `image_url` 表单字段发送。

#### 参数详情

| 参数              | 类型     | 必填 | 默认值           | 说明                           |
| ----------------- | -------- | ---- | ---------------- | ------------------------------ |
| `model`           | string   | 否   | `"gpt-image-2"`  | 模型 ID                        |
| `prompt`          | string   | 是   |                  | 编辑提示词                     |
| `n`               | int      | 否   | `1`              | 生成数量，范围 1-4             |
| `size`            | string   | 否   | `null`           | 宽高比提示                     |
| `quality`         | string   | 否   | `"auto"`         | 画质等级，见上方尺寸+画质组合   |
| `response_format` | string   | 否   | `"b64_json"`     | 返回格式                       |
| `stream`          | bool     | 否   | `null`           | 流式输出                       |
| `image`           | file     | 否   |                  | 主图片文件上传                  |
| `image_url`       | string   | 否   |                  | 参考图 URL 或 base64（可重复）  |

> *JSON 模式下 `images` 为必填。`images` 数组中每个元素格式：`{"image_url": "<data URI 或 http URL>"}`。

### POST /v1/chat/completions（图片场景对话）

```json
{
  "model": "gpt-image-2",
  "messages": [
    {"role": "user", "content": "生成一张雨夜东京街头的赛博朋克猫"}
  ],
  "n": 1
}
```

| 参数       | 类型      | 必填 | 说明                                    |
| ---------- | --------- | ---- | --------------------------------------- |
| `model`    | string    | 否   | 模型 ID，默认 `"auto"`                  |
| `messages` | array     | 是   | 消息数组                                |
| `n`        | int       | 否   | 生成数量                                |
| `stream`   | boolean   | 否   | 流式输出                                |

## 返回值格式

```json
{
  "created": 1718000000,
  "data": [
    {
      "b64_json": "...",
      "url": "http://...",
      "revised_prompt": "..."
    }
  ]
}
```

| 字段              | 类型   | 说明                                      |
| ----------------- | ------ | ----------------------------------------- |
| `created`         | int    | Unix 时间戳                               |
| `data[].b64_json` | string | Base64 编码的图片数据（`response_format=b64_json`） |
| `data[].url`      | string | 图片 URL（`response_format=url` 时返回）  |
| `data[].revised_prompt` | string | 优化后的提示词                    |

错误时返回：

```json
{
  "error": {
    "message": "...",
    "type": "server_error",
    "code": "upstream_error"
  }
}
```

## 数据流对比

### ImageToolbox（Provider 模式）

```
用户选择 ChatGPT2API Provider
  → 前端调用 GetProviderModels("chatgpt2api")
  → 后端创建 ChatGPT2APIProvider 实例
  → provider.Generate(ctx, req) 直接调用 ChatGPT2API
  → 返回结果
```

### InfiniteCanvas（代理模式）

```
用户在前端配置模型和提示词
  → 前端调用后端 /api/v1/images/generations
  → 后端根据 model 名 SelectModelChannel
  → 转发请求到对应渠道的 /v1/images/generations
  → 返回结果给前端
```

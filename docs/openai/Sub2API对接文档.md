# Sub2API（Codex 转发）—— ImageToolbox 对接文档

> 本文以 ImageToolbox 当前代码为准。项目通过内部 Provider `openai` 连接 **Sub2API 提供的 Codex/OpenAI 兼容转发接口**。

## 一、配置

在 ImageToolbox 设置页配置 Provider `openai`：

| 配置项 | 当前含义 |
|---|---|
| API Key | Sub2API 分配的访问令牌 |
| Base URL | Sub2API 的 OpenAI 兼容基础地址 |
| 评价重写模型 | 默认 `gpt-5.6-sol` |
| 评价重写 Endpoint | 默认 `https://open2api.kuvms.net/v1/responses` |
| 评价推理强度 | 默认 `medium` |

请求统一使用：

```http
Authorization: Bearer <API Key>
```

Base URL 可以填写服务根地址，也可以以 `/v1` 结尾：

- `https://open2api.kuvms.net` → 请求 `https://open2api.kuvms.net/v1/...`
- `https://open2api.kuvms.net/v1` → 请求 `https://open2api.kuvms.net/v1/...`

后端会移除 Base URL 末尾的 `/`，并保证 `/v1` 只出现一次。空 Base URL 时使用默认地址 `https://open2api.kuvms.net`。

买家秀评价重写复用该 Provider 的 API Key，通过 Responses API 发送 `reasoning: {"effort":"medium"}`。配置文件中的 `reviewModel` 或 `reviewEndpoint` 为空时，后端分别回退到上述默认模型和 Endpoint。

## 二、ImageToolbox 实际调用的接口

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/v1/models` | 获取 Sub2API 当前可用模型 |
| `POST` | `/v1/images/generations` | 文生图 |
| `POST` | `/v1/images/edits` | 单图或多参考图编辑 |

当前图片 Provider 不调用 `/v1/chat/completions` 或 `/v1/responses`。买家秀评价重写独立调用默认 `/v1/responses` 文本 Endpoint，不属于图片接口。

HTTP 客户端超时为 180 秒。模型列表成功获取后缓存 10 分钟；获取失败时使用代码内置的模型列表。

## 三、模型

`GET /v1/models` 的响应格式：

```json
{
  "data": [
    {"id": "gpt-image-2"},
    {"id": "codex-gpt-image-2"}
  ]
}
```

ImageToolbox 使用 `data[].id` 作为模型 ID。接口不可用或返回空列表时，回退到：

- `gpt-image-2`
- `codex-gpt-image-2`
- `auto`
- `gpt-5`
- `gpt-5-1`
- `gpt-5-2`
- `gpt-5-3`
- `gpt-5-3-mini`
- `gpt-5-mini`

`gpt-image-2`、`codex-gpt-image-2` 和名称包含 `gpt-5` 的模型在前端被标记为支持图片输入和编辑。图片数量 `n` 的能力上限为 10。

## 四、文生图

### 请求

```http
POST /v1/images/generations
Content-Type: application/json
Authorization: Bearer <API Key>
```

ImageToolbox 可能发送：

```json
{
  "model": "gpt-image-2",
  "prompt": "一只漂浮在太空里的猫\n\nAspect ratio: 16:9.",
  "negative_prompt": "文字、水印",
  "n": 2,
  "quality": "high",
  "output_format": "png",
  "stream": true
}
```

### 实际参数映射

| ImageToolbox 参数 | 发给 Sub2API 的字段 | 发送规则 |
|---|---|---|
| `Model` | `model` | 始终发送 |
| `Prompt` | `prompt` | 始终发送；宽高比可能追加到末尾 |
| `NegativePrompt` | `negative_prompt` | 非空时发送 |
| `N` | `n` | 非 0 时发送，并限制到 1–10 |
| `Quality` | `quality` | 非空时原样发送 |
| `OutputFormat` | `output_format` | 非空时原样发送 |
| `Stream` | `stream` | 仅为 `true` 时发送 |
| `ResponseFormat` | `response_format` | 仅非空且模型名不以 `gpt-image-` 开头时发送 |
| `Size` | 不直接发送 | 转换为 `prompt` 中的宽高比说明 |

以下通用请求字段当前不会由 Sub2API 图片 Provider 发送：`seed`、`watermark`、`guidance_scale`、`sequential_image_generation`、`max_images`、`optimize_prompt_mode`、`web_search`。

### 宽高比处理

当前实现**不发送 `size` 字段，也不把画质换算成像素尺寸**。`Size` 的处理规则如下：

1. 空值或 `auto`：不修改提示词。
2. 不包含宽高比的普通值：不修改提示词。
3. `16:9`、`16x9` 等有效比例：统一为冒号形式，并在提示词末尾追加 `Aspect ratio: 16:9.`。
4. 宽高比必须位于 1:3 到 3:1 之间，否则请求在本地失败。

前端当前提供：

`auto`、`1:1`、`3:4`、`4:3`、`16:9`、`9:16`、`3:2`、`2:3`、`21:9`

画质选项为：

`auto`、`low`、`medium`、`high`

`quality` 会原样传给 Sub2API，但 ImageToolbox 不保证上游一定支持每个档位。

### `response_format` 注意事项

对于 `gpt-image-*` 模型，当前代码会主动省略 `response_format`，即使前端请求中设置了 `url` 或 `b64_json`。这是为了适配当前 Codex 转发接口。其他模型可透传 `response_format`。

## 五、图片编辑

只要请求包含主输入图片，ImageToolbox 就会改用图片编辑接口：

```http
POST /v1/images/edits
Content-Type: multipart/form-data
Authorization: Bearer <API Key>
```

文本字段与文生图一致。主图和参考图全部使用可重复的 `image[]` 文件字段：

```text
model=gpt-image-2
prompt=把商品放到自然光客厅场景中
n=1
quality=high
output_format=png
image[]=<主图文件>
image[]=<参考图 1>
image[]=<参考图 2>
```

发送顺序固定为：

1. 主输入图；
2. `ReferenceImages` 中的参考图，保持原顺序。

ImageToolbox 内部会把本地图片读取为 data URI，再解码为文件上传。支持识别的扩展名为 PNG、JPEG/JPG、WebP 和 GIF；未知 MIME 类型使用 `.png` 文件名。

当前实现不使用 JSON `images`、表单 `image` 或 `image_url` 字段。Sub2API 必须接收可重复的 `image[]` 文件字段。

## 六、响应

ImageToolbox 接收以下统一响应：

```json
{
  "data": [
    {
      "url": "https://example.com/generated.png",
      "b64_json": "...",
      "size": "1536x1024"
    }
  ],
  "usage": {
    "generated_images": 1,
    "output_tokens": 0,
    "total_tokens": 0
  }
}
```

| 字段 | 说明 |
|---|---|
| `data[].url` | 可下载的结果地址 |
| `data[].b64_json` | Base64 图片数据 |
| `data[].size` | 上游返回的尺寸信息 |
| `data[].error.code` | 单个结果的错误码 |
| `data[].error.message` | 单个结果的错误信息 |
| `usage` | 可选用量信息 |

成功响应必须是 HTTP 200 和合法 JSON。非 200 响应支持读取：

```json
{
  "error": {
    "code": "invalid_prompt",
    "message": "Prompt too long"
  }
}
```

若错误响应不是 JSON，ImageToolbox 会保留 HTTP 状态码及最多 500 个字符的响应正文，便于定位网关错误。

## 七、代码对应关系

| 代码位置 | 职责 |
|---|---|
| `backend/ai/provider_openai.go` | Sub2API 图片请求、认证、模型获取和响应解析 |
| `backend/ai/provider.go` | Provider 标识 `openai` 和工厂注册 |
| `backend/model/ai.go` | 前后端通用 AI 请求、响应和模型能力结构 |
| `backend/config/config.go` | API Key、Base URL 和评价改写配置持久化 |
| `frontend/src/pages/Settings.tsx` | Provider 配置界面 |

更新本文时应以 `openAIFields`、`generateEdits`、`endpoint` 和 `parseOpenAIResponse` 的实际行为为准。

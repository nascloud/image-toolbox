# Sub2API（Codex 转发）使用说明

> ImageToolbox 当前通过内部 Provider `openai` 使用 Sub2API 的 Codex/OpenAI 兼容图片接口。

完整请求字段和代码映射见：

[`docs/openai/Sub2API对接文档.md`](../openai/Sub2API对接文档.md)

## 设置

在“设置”中找到 `OpenAI (Sub2API)` Provider 配置项，填写：

| 配置项 | 填写内容 |
|---|---|
| API Key | Sub2API 访问令牌 |
| Base URL | Sub2API OpenAI 兼容地址，默认 `https://open2api.kuvms.net` |

后端统一发送 `Authorization: Bearer <API Key>`。Base URL 不以 `/v1` 结尾时，后端会自动补上 `/v1`。

空 Base URL 时使用默认地址 `https://open2api.kuvms.net`。

## 当前使用的接口

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/v1/models` | 获取模型列表 |
| `POST` | `/v1/images/generations` | 文生图 |
| `POST` | `/v1/images/edits` | 图生图和多参考图编辑 |

图片 Provider 不调用 `/v1/chat/completions` 或 `/v1/responses`。

## 文生图请求

```json
{
  "model": "gpt-image-2",
  "prompt": "商品白底图转自然光场景\n\nAspect ratio: 4:3.",
  "negative_prompt": "文字、水印",
  "n": 1,
  "quality": "high",
  "output_format": "png"
}
```

发送规则：

- `model`、`prompt` 始终发送。
- `negative_prompt`、`quality`、`output_format` 非空时发送。
- `n` 非 0 时发送，并限制为 1–10。
- `stream` 只在值为 `true` 时发送。
- `size` 不作为独立字段发送；有效宽高比会追加到 `prompt`。
- `gpt-image-*` 模型不发送 `response_format`；其他模型可透传该字段。
- `seed`、`watermark`、`guidance_scale`、顺序生成、提示词优化和联网搜索参数当前不发送给 Sub2API。

有效宽高比必须在 1:3 到 3:1 之间。前端可选值：

`auto`、`1:1`、`3:4`、`4:3`、`16:9`、`9:16`、`3:2`、`2:3`、`21:9`

## 图片编辑请求

图片编辑使用 `multipart/form-data`。主图和所有参考图都以可重复的 `image[]` 文件字段发送，主图在前：

```text
model=gpt-image-2
prompt=保持商品不变，替换为客厅背景
quality=high
output_format=png
image[]=<主图>
image[]=<参考图 1>
image[]=<参考图 2>
```

当前实现不发送 JSON `images`、表单 `image` 或 `image_url`。

## 响应

Sub2API 应返回 HTTP 200 和 OpenAI 图片风格的 JSON：

```json
{
  "data": [
    {
      "url": "https://example.com/result.png",
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

`data` 项可以提供 `url` 或 `b64_json`。错误响应建议使用：

```json
{
  "error": {
    "code": "invalid_request",
    "message": "..."
  }
}
```

## 模型列表与回退

后端优先读取 `/v1/models` 的 `data[].id`，缓存 10 分钟。读取失败或列表为空时使用内置模型：

`gpt-image-2`、`codex-gpt-image-2`、`auto`、`gpt-5`、`gpt-5-1`、`gpt-5-2`、`gpt-5-3`、`gpt-5-3-mini`、`gpt-5-mini`

请求超时为 180 秒。

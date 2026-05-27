# ChatGPT2API —— API 对接文档

> 项目地址：https://github.com/basketikun/chatgpt2api
> ChatGPT 官网图片生成/编辑能力的逆向封装，兼容 OpenAI 协议。

---

## 一、项目概述

ChatGPT2API 是对 ChatGPT 官网图片生成/编辑等能力的**逆向封装**，暴露**兼容 OpenAI 协议的 REST API**，并提供 Web 管理面板、号池管理、多账号轮询、Docker 自托管等功能。

- **核心能力**：图片生成（文生图）、图片编辑（图修图）、多图组图编辑
- **兼容协议**：OpenAI `images/generations`、`images/edits`、`chat/completions`、`responses`
- **后端语言**：Python（FastAPI）
- **部署方式**：Docker Compose（推荐）

---

## 二、快速部署

### Docker Compose 部署（推荐）

```yaml
# docker-compose.yml
version: "3"
services:
  chatgpt2api:
    image: ghcr.io/basketikun/chatgpt2api:latest
    container_name: chatgpt2api
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      - ./config.json:/app/config.json
    environment:
      - CHATGPT2API_AUTH_KEY=your-secret-key
    restart: unless-stopped
```

```bash
docker compose up -d
```

### 启动后访问

| 服务 | 地址 |
|---|---|
| Web 管理面板 | `http://localhost:3000` |
| API 基础地址 | `http://localhost:3000/v1` |
| 数据目录 | `./data` |

### 本地开发启动

```bash
git clone git@github.com:basketikun/chatgpt2api.git
cd chatgpt2api

# 后端
uv sync
uv run main.py

# 前端（可选）
cd web
bun install
bun run dev
```

### 更新版本

```bash
docker pull ghcr.io/basketikun/chatgpt2api:latest
docker compose down
docker compose up -d
```

---

## 三、认证方式

所有 API 请求必须在 HTTP Header 中传入：

```
Authorization: Bearer <auth-key>
```

`auth-key` 在 `config.json` 的 `auth-key` 字段设置，或通过环境变量 `CHATGPT2API_AUTH_KEY` 覆盖。

---

## 四、模型列表

```
GET /v1/models
```

### 返回模型

| 模型 ID | 说明 |
|---|---|
| `gpt-image-2` | **主要图片生成模型，推荐使用** |
| `codex-gpt-image-2` | Codex 画图接口（需 Plus/Team/Pro 订阅），与 `gpt-image-2` 共享额度但走不同链路 |
| `auto` | 自动选择 |
| `gpt-5` | GPT-5 系列图片生成 |
| `gpt-5-1` | |
| `gpt-5-2` | |
| `gpt-5-3` | |
| `gpt-5-3-mini` | |
| `gpt-5-mini` | |

---

## 五、核心 API 接口

### 5.1 图片生成 —— `POST /v1/images/generations`

OpenAI 兼容的文生图接口。

#### Request

```
POST /v1/images/generations
Content-Type: application/json
Authorization: Bearer <auth-key>
```

```json
{
    "model": "gpt-image-2",
    "prompt": "一只漂浮在太空里的猫，赛博朋克风格",
    "n": 1,
    "response_format": "b64_json"
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型 ID，推荐 `gpt-image-2` |
| `prompt` | string | 是 | 图片生成提示词 |
| `n` | int | 否 | 生成数量，范围 **1-4**，默认 1 |
| `response_format` | string | 否 | `b64_json` 或 `url`，默认 `b64_json` |

#### Response

```json
{
    "created": 1715000000,
    "data": [
        {
            "b64_json": "<base64 encoded image data>",
            "revised_prompt": "A cyberpunk cat floating in space..."
        }
    ]
}
```

| 字段 | 说明 |
|---|---|
| `created` | Unix 时间戳 |
| `data[].b64_json` | Base64 编码的图片数据 |
| `data[].url` | 图片 URL（当 `response_format=url` 时） |
| `data[].revised_prompt` | 模型优化后的提示词 |

#### cURL 示例

```bash
curl http://localhost:3000/v1/images/generations \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <auth-key>" \
  -d '{
    "model": "gpt-image-2",
    "prompt": "一只漂浮在太空里的猫",
    "n": 1,
    "response_format": "b64_json"
  }'
```

---

### 5.2 图片编辑 —— `POST /v1/images/edits`

OpenAI 兼容的图修图接口。支持 **multipart/form-data**（上传文件）和 **application/json**（传图片 URL）两种方式。

#### 方式一：multipart/form-data（上传本地文件）

```bash
curl http://localhost:3000/v1/images/edits \
  -H "Authorization: Bearer <auth-key>" \
  -F "model=gpt-image-2" \
  -F "prompt=把这张图改成赛博朋克夜景风格" \
  -F "n=1" \
  -F "image=@./input.png"
```

#### 方式二：application/json（传图片 URL 或 base64）

```
POST /v1/images/edits
Content-Type: application/json
Authorization: Bearer <auth-key>
```

```json
{
    "model": "gpt-image-2",
    "prompt": "把这张图改成赛博朋克夜景风格",
    "images": [
        {"image_url": "https://example.com/input.png"}
    ],
    "n": 1
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 模型 ID |
| `prompt` | string | 是 | 编辑描述提示词 |
| `n` | int | 否 | 生成数量，范围 1-4 |
| `image` | file | 条件必填 | multipart 模式上传图片文件 |
| `images` | array | 条件必填 | JSON 模式传入图片引用 `{"image_url": "..."}`，支持多张 |
| `image_url` | string | 否 | 表单模式的图片链接，支持重复字段传多张 |

#### Response

```json
{
    "created": 1715000000,
    "data": [
        {
            "b64_json": "<base64>",
            "revised_prompt": "..."
        }
    ]
}
```

---

### 5.3 Chat Completions 图片模式 —— `POST /v1/chat/completions`

面向图片生成场景的 OpenAI 聊天补全兼容接口（**非通用聊天代理**）。

#### Request

```
POST /v1/chat/completions
Content-Type: application/json
Authorization: Bearer <auth-key>
```

```json
{
    "model": "gpt-image-2",
    "messages": [
        {
            "role": "user",
            "content": "生成一张雨夜东京街头的赛博朋克猫"
        }
    ],
    "n": 1
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 图片模型 |
| `messages` | array | 是 | 消息数组，内容解析为图片生成提示 |
| `n` | int | 否 | 图片生成数量 |
| `stream` | bool | 否 | 流式输出（已实现，测试中） |

#### Response

```json
{
    "id": "chatcmpl-xxx",
    "object": "chat.completion",
    "created": 1715000000,
    "model": "gpt-image-2",
    "choices": [
        {
            "index": 0,
            "message": {
                "role": "assistant",
                "content": "![image](data:image/png;base64,...)"
            }
        }
    ]
}
```

---

### 5.4 Responses API 图片模式 —— `POST /v1/responses`

面向图片生成工具调用的 Responses API 兼容接口。

#### Request

```
POST /v1/responses
Content-Type: application/json
Authorization: Bearer <auth-key>
```

```json
{
    "model": "gpt-5",
    "input": "生成一张未来感城市天际线图片",
    "tools": [
        {
            "type": "image_generation"
        }
    ]
}
```

#### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | string | 是 | 响应模型字段，生成仍走图片兼容逻辑 |
| `input` | string | 是 | 输入内容，解析为图片生成提示词 |
| `tools` | array | 是 | 必须包含 `{"type": "image_generation"}` |
| `stream` | bool | 否 | 流式输出（测试中） |

---

## 六、错误处理

### HTTP 状态码

| 状态码 | 含义 |
|---|---|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | `auth-key` 缺失或无效 |
| 429 | 请求过于频繁（账号限流） |
| 500 | 服务端内部错误 |

### 错误响应格式

```json
{
    "error": {
        "message": "Error description",
        "type": "invalid_request_error",
        "code": 400
    }
}
```

---

## 七、号池管理

### 7.1 REST API 端点

| 方法 | 路径 | 功能 |
|---|---|---|
| `GET` | `/api/accounts` | 获取账号列表（支持搜索/筛选/分页） |
| `POST` | `/api/accounts` | 导入账号 |
| `PUT` | `/api/accounts/{id}` | 编辑账号 |
| `DELETE` | `/api/accounts/{id}` | 删除账号 |
| `POST` | `/api/accounts/batch-delete` | 批量删除 |
| `POST` | `/api/accounts/refresh` | 批量刷新账号额度 |
| `GET` | `/api/accounts/export` | 导出账号 |

### 7.2 账号导入方式

| 方式 | 说明 |
|---|---|
| 本地 CPA JSON 文件 | 直接上传 `.cpa.json` 文件 |
| 远程 CPA 服务器 | 配置远程 URL，按需拉取账号 |
| sub2api 服务器 | 配置 sub2api 地址，拉取 OpenAI OAuth 账号批量导入 |
| access_token 手动导入 | 直接输入 access_token |

### 7.3 核心机制

- **自动轮询**：号池中的账号按轮询策略分配任务
- **限流处理**：429 限流时自动标记，定时检查恢复
- **失效自动剔除**：Token 失效时自动移除账号
- **并发控制**：通过 `image_account_concurrency` 配置单账号并发数（默认 3）

---

## 八、配置参考

### config.json

```json
{
  "auth-key": "your-secret-key",
  "refresh_account_interval_minute": 60,
  "image_retention_days": 15,
  "image_poll_timeout_secs": 120,
  "auto_remove_rate_limited_accounts": false,
  "auto_remove_invalid_accounts": true,
  "log_levels": ["debug", "error", "info", "warning"],
  "proxy": "",
  "base_url": "",
  "sensitive_words": [],
  "global_system_prompt": "",
  "image_account_concurrency": 3,
  "backup": {
    "enabled": false,
    "provider": "cloudflare_r2",
    "interval_minutes": 1440,
    "rotation_keep": 10
  }
}
```

### 环境变量

| 变量 | 说明 |
|---|---|
| `CHATGPT2API_AUTH_KEY` | 认证密钥，覆盖 config.json 的 `auth-key` |
| `CHATGPT2API_BASE_URL` | 基础 URL，用于生成图片 URL |
| `STORAGE_BACKEND` | 存储后端：`json`、`sqlite`、`postgres`、`git` |
| `DATABASE_URL` | 数据库连接串（sqlite/postgres 时使用） |

### 存储后端

| 后端 | 说明 |
|---|---|
| `json` | 本地 JSON 文件（默认） |
| `sqlite` | 本地 SQLite 数据库 |
| `postgres` | 外部 PostgreSQL（需配置 `DATABASE_URL`） |
| `git` | Git 私有仓库（需配置 `GIT_REPO_URL` + `GIT_TOKEN`） |

---

## 九、客户端开发对接指南

### 9.1 Go 对接示例

```go
package main

import (
    "bytes"
    "encoding/base64"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
)

// ImageGenRequest 图片生成请求
type ImageGenRequest struct {
    Model          string `json:"model"`
    Prompt         string `json:"prompt"`
    N              int    `json:"n,omitempty"`
    ResponseFormat string `json:"response_format,omitempty"`
}

// ImageGenResponse 图片生成响应
type ImageGenResponse struct {
    Created int64 `json:"created"`
    Data    []struct {
        B64JSON       string `json:"b64_json,omitempty"`
        URL           string `json:"url,omitempty"`
        RevisedPrompt string `json:"revised_prompt,omitempty"`
    } `json:"data"`
}

// GenerateImage 调用图片生成 API
func GenerateImage(apiURL, authKey, prompt string, n int) (*ImageGenResponse, error) {
    body := ImageGenRequest{
        Model:          "gpt-image-2",
        Prompt:         prompt,
        N:              n,
        ResponseFormat: "b64_json",
    }
    payload, _ := json.Marshal(body)

    req, _ := http.NewRequest("POST", apiURL+"/v1/images/generations",
        bytes.NewReader(payload))
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Authorization", "Bearer "+authKey)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        respBody, _ := io.ReadAll(resp.Body)
        return nil, fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
    }

    var result ImageGenResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode failed: %w", err)
    }
    return &result, nil
}

// SaveBase64Image 将 base64 图片保存到本地文件
func SaveBase64Image(b64, outputPath string) error {
    data, err := base64.StdEncoding.DecodeString(b64)
    if err != nil {
        return fmt.Errorf("base64 decode failed: %w", err)
    }
    return os.WriteFile(outputPath, data, 0644)
}
```

### 9.2 Python 对接示例

```python
import base64
import requests


def generate_image(api_url: str, auth_key: str, prompt: str, n: int = 1):
    """调用图片生成 API"""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_key}",
    }
    payload = {
        "model": "gpt-image-2",
        "prompt": prompt,
        "n": n,
        "response_format": "b64_json",
    }
    resp = requests.post(f"{api_url}/v1/images/generations",
                         headers=headers, json=payload)
    resp.raise_for_status()
    return resp.json()


def save_base64_image(b64_str: str, output_path: str):
    """保存 base64 图片到文件"""
    data = base64.b64decode(b64_str)
    with open(output_path, "wb") as f:
        f.write(data)


# 使用示例
result = generate_image(
    api_url="http://localhost:3000",
    auth_key="your-auth-key",
    prompt="一只赛博朋克猫",
    n=1,
)
for i, img in enumerate(result["data"]):
    save_base64_image(img["b64_json"], f"output_{i}.png")
```

### 9.3 TypeScript 对接示例

```typescript
interface ImageGenRequest {
  model: string;
  prompt: string;
  n?: number;
  response_format?: string;
}

interface ImageGenResponse {
  created: number;
  data: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
}

async function generateImage(
  apiUrl: string,
  authKey: string,
  prompt: string,
  n = 1
): Promise<ImageGenResponse> {
  const response = await fetch(`${apiUrl}/v1/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authKey}`,
    },
    body: JSON.stringify({
      model: "gpt-image-2",
      prompt,
      n,
      response_format: "b64_json",
    } satisfies ImageGenRequest),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

function base64ToBlob(b64: string, mimeType = "image/png"): Blob {
  const byteChars = atob(b64);
  const byteArrays = [];
  for (let offset = 0; offset < byteChars.length; offset += 512) {
    const slice = byteChars.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: mimeType });
}

// 使用
const result = await generateImage(
  "http://localhost:3000",
  "your-auth-key",
  "一只赛博朋克猫"
);
result.data.forEach((img, i) => {
  const blob = base64ToBlob(img.b64_json!);
  const url = URL.createObjectURL(blob);
  console.log(`Image ${i}:`, url);
});
```

---

## 十、与 imagetool 项目集成方案

### 集成架构

```
┌─────────────────────────────────────────────────────┐
│                   imagetool (Go)                    │
│                                                     │
│  backend/ai/                                        │
│  ├── client.go        ─── HTTP 调用 ChatGPT2API     │
│  ├── image_task.go    ─── 单图 AI 任务封装          │
│  └── ...                                            │
│                                                     │
│  batch/ai.go          ─── 批处理调度                │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP (OpenAI 兼容协议)
                       ▼
┌─────────────────────────────────────────────────────┐
│              ChatGPT2API (Python)                    │
│                                                     │
│  POST /v1/images/generations  文生图                │
│  POST /v1/images/edits        图修图                │
│  POST /v1/chat/completions    聊天补全(图片)        │
│                                                     │
│  号池管理 ── 自动轮询、限流处理、失效剔除            │
└──────────────────────┬──────────────────────────────┘
                       │ 逆向协议
                       ▼
┌─────────────────────────────────────────────────────┐
│              ChatGPT 官网                            │
│  gpt-image-2 / codex-gpt-image-2 / gpt-5 系列       │
└─────────────────────────────────────────────────────┘
```

### 集成步骤

1. **部署 ChatGPT2API**：在服务器或本地通过 Docker Compose 启动
2. **配置号池**：通过 Web 面板导入 ChatGPT 账号（access_token 或 CPA 文件）
3. **Go 后端对接**：

```go
// backend/ai/client.go
const ChatGPT2APIBaseURL = "http://localhost:3000/v1"

type ChatGPT2APIClient struct {
    baseURL string
    authKey string
    http    *http.Client
}

func NewChatGPT2APIClient(authKey string) *ChatGPT2APIClient {
    return &ChatGPT2APIClient{
        baseURL: ChatGPT2APIBaseURL,
        authKey: authKey,
        http:    &http.Client{Timeout: 120 * time.Second},
    }
}
```

### 注意事项

- API Key 使用 ChatGPT2API 的 `auth-key`，而非 OpenAI API Key
- 模型传参透传到 ChatGPT2API 后自动适配 ChatGPT 官网协议
- 利用 `image_account_concurrency`（默认 3）控制并发，避免账号被限流
- 批处理失败重试时，ChatGPT2API 会自动切换到号池中的下一个可用账号
- 支持 `response_format=b64_json` 避免图片 URL 过期问题
- 图片编辑场景需注意上传格式（multipart 或 JSON URL）

---

## 十一、功能状态总览

| 功能 | 状态 | 说明 |
|---|---|---|
| `POST /v1/images/generations` | ✅ | 文生图，支持 n 多张 |
| `POST /v1/images/edits` | ✅ | 图修图，支持文件上传和 JSON URL |
| `POST /v1/chat/completions`（图片） | ✅ | 聊天补全图片模式 |
| `POST /v1/responses`（图片） | ✅ | Responses API 图片工具调用 |
| `GET /v1/models` | ✅ | 返回可用模型列表 |
| 流式输出（stream） | ✅ | 已实现，测试中 |
| 前端图片工作台 | ✅ | 内置 Web 画图界面 |
| 号池管理 | ✅ | 多账号轮询、限流处理、失效剔除 |
| CPA 导入 | ✅ | 本地/远程 CPA 文件导入 |
| sub2api 导入 | ✅ | 从 sub2api 服务器拉取账号 |
| Docker 部署 | ✅ | 多架构镜像支持 |
| 代理配置 | ✅ | 全局 HTTP/HTTPS/SOCKS5 代理 |
| 图片尺寸参数 | ❌ | 待实现 |
| `rt_token` 刷新 | ❌ | 待实现 |
| Anthropic 协议支持 | ❌ | 待实现 |

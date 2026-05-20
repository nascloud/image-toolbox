# Windows 右键菜单集成设计

在 Windows 资源管理器中，右键点击图片文件或文件夹时，出现 image-toolbox 的级联子菜单，点击后打开应用并加载对应文件到对应处理页面。

## 用户故事

- 用户在文件夹里选择了一张或多张图片 → 右键 → "ImageToolbox" → "转换/缩放" → 应用打开，文件已加载到转换页面
- 用户右键点击文件夹 → "ImageToolbox" → "切片" → 应用打开，该文件夹所有图片加载到切片页面
- 用户在 Settings 页面点击"安装右键菜单" / "卸载右键菜单" 来控制注册表

## 注册表结构

### 写入位置

使用 `HKEY_CURRENT_USER\Software\Classes`（免管理员提权，仅对当前用户生效）：

| 目标 | 注册表路径 |
|------|-----------|
| 图片文件 | `HKCU\Software\Classes\SystemFileAssociations\image\shell\ImageToolbox` |
| 文件夹 | `HKCU\Software\Classes\Directory\shell\ImageToolbox` |

### 级联菜单结构

```
ImageToolbox
├── (默认) = "ImageToolbox"
├── MUIVerb = "ImageToolbox"      ← 菜单显示名
├── Icon = "C:\...\image-toolbox.exe,0"
├── subcommands
│
├── shell
│   ├── convert
│   │   ├── (默认) = "转换/缩放"
│   │   └── command
│   │       └── (默认) = "C:\...\image-toolbox.exe" --page=convert "%V"
│   ├── slice
│   │   ├── (默认) = "切片"
│   │   └── command
│   │       └── (默认) = "C:\...\image-toolbox.exe" --page=slice "%V"
│   ├── watermark
│   │   ├── (默认) = "水印"
│   │   └── command
│   │       └── (默认) = "C:\...\image-toolbox.exe" --page=watermark "%V"
│   └── aibatch
│       ├── (默认) = "AI 批处理"
│       └── command
│           └── (默认) = "C:\...\image-toolbox.exe" --page=aibatch "%V"
```

- `%V` 在文件上右键时传递选中的文件路径列表，在文件夹上右键时传递文件夹路径
- Windows 10/11 级联菜单需要 subcommands 注册表项

## 命令行格式与启动流程

### 参数格式
```
image-toolbox.exe --page=<page> <file1> [file2 ...]
```
- `--page`: convert / slice / watermark / aibatch
- 后续参数：文件路径（%V 展开后）

### 单实例 IPC

应用启动时在 `main.go` 中执行单实例检测：

1. 调用 Windows API `CreateMutexW` 创建命名互斥体 `"ImageToolbox-SingleInstance-Mutex"`
2. 如果互斥体已存在（`ERROR_ALREADY_EXISTS`），表示已有实例在运行
3. 第二个实例读取主实例的 IPC 端口号（从 `%TEMP%\imagetool-ipc-port.txt`），通过 TCP 连接发送 `LaunchIntent` JSON（1 秒超时，超时则直接退出），然后自身退出
4. 主实例在启动时选择一个空闲端口，启动 TCP 监听 goroutine，将端口号写入 `%TEMP%\imagetool-ipc-port.txt`；端口绑定失败则依次尝试下一个端口，最多 5 次
5. 主实例收到 IPC 消息后，通过 `runtime.EventsEmit(ctx, "app:launch-intent", intent)` 通知前端

### LaunchIntent 结构
```go
type LaunchIntent struct {
    Page  string   `json:"page"`  // convert | slice | watermark | aibatch
    Files []string `json:"files"` // 文件路径列表
}
```

## 后端新增模块

### `backend/shell/` 包

| 文件 | 职责 |
|------|------|
| `register.go` | `InstallContextMenu(appPath)`, `UninstallContextMenu()`, `IsContextMenuInstalled()` |
| `ipc.go` | `StartIPCServer(ctx, handler)`, `SendLaunchIntent(port, intent)`, `LaunchIntent` 结构体 |
| `mutex.go` | Windows 命名互斥体封装 `CreateMutex`, `OpenMutex`, `ReleaseMutex` |

### `backend/app/app.go` 新增 API

```go
func (a *App) InstallContextMenu() error
func (a *App) UninstallContextMenu() error
func (a *App) IsContextMenuInstalled() bool
```

### `main.go` 变更

在 `NewApp()` 或 `main()` 中增加启动参数解析与单实例逻辑：

```go
func main() {
    // 1. 解析命令行参数
    intent := shell.ParseLaunchIntent(os.Args[1:])

    // 2. 单实例检测
    if shell.IsAnotherInstanceRunning() {
        // 发送到已运行实例并退出
        port := shell.ReadIPCPort()
        shell.SendLaunchIntent(port, intent)
        return
    }

    // 3. 自己是主实例，启动 IPC 服务器
    app := NewApp()
    port, _ := shell.StartIPCServer(app.ctx, app.handleLaunchIntent)
    shell.WriteIPCPort(port)

    // 4. 原始启动或右键启动时，如果有 intent 立即处理
    if intent != nil {
        app.handleLaunchIntent(*intent)
    }

    // 5. 正常启动 Wails
    wails.Run(...)
}
```

## 前端变更

### `frontend/src/pages/Settings.tsx`
- 检测 `IsContextMenuInstalled()` 状态
- 显示"安装右键菜单" / "卸载右键菜单" 按钮
- 点击后调用对应 API，刷新状态

### `frontend/src/App.tsx`
- 监听 `app:launch-intent` 事件
- 解析 intent，路由跳转到对应页面，传递文件列表

### `frontend/src/pages/*.tsx`
- 各处理页面（ConvertResize, Slice, Watermark, AIBatch）支持通过 `IntentContext` 接收外部文件注入

### IntentContext

新增 `frontend/src/hooks/useIntent.ts`，提供全局的 intent 传递机制：

```tsx
interface LaunchIntent {
  page: 'convert' | 'slice' | 'watermark' | 'aibatch'
  files: string[]
}

interface IntentContextValue {
  pending: LaunchIntent | null
  setPending: (intent: LaunchIntent | null) => void
}
```

`IntentProvider` 包裹在 `App` 级别。

```tsx
// App.tsx
useEffect(() => {
  const unsub = EventsOn("app:launch-intent", (intent: LaunchIntent) => {
    setPending(intent)
    navigate(`/${intent.page}`)
  })
  return () => unsub()
}, [])

// 各页面组件
const { pending, setPending } = useIntentContext()
useEffect(() => {
  if (pending && pending.page === currentPage && pending.files.length > 0) {
    addFiles(pending.files)
    setPending(null)
  }
}, [pending])
```

组件在 `pending` 被消费后立即 `setPending(null)`，避免重复注入。

## 受影响文件清单

| 文件 | 变更 |
|------|------|
| `backend/shell/register.go` | **NEW** — 注册表写入/删除 |
| `backend/shell/ipc.go` | **NEW** — IPC 服务器与客户端 |
| `backend/shell/mutex.go` | **NEW** — 命名互斥体封装 |
| `main.go` | 启动参数解析 + 单实例 + IPC 启动 |
| `app.go` | 新增 `handleLaunchIntent()`, 保存 ctx |
| `backend/app/app.go` | 新增 `InstallContextMenu`, `UninstallContextMenu`, `IsContextMenuInstalled` |
| `frontend/src/pages/Settings.tsx` | 安装/卸载按钮 |
| `frontend/src/hooks/useIntent.ts` | **NEW** — IntentContext + IntentProvider |
| `frontend/src/App.tsx` | 监听 `app:launch-intent`，包裹 IntentProvider |
| `frontend/src/pages/ConvertResize.tsx` | 消费 intent，支持外部文件注入 |
| `frontend/src/pages/Slice.tsx` | 同上 |
| `frontend/src/pages/Watermark.tsx` | 同上 |
| `frontend/src/pages/AIBatch.tsx` | 同上 |

## 错误处理与边界情况

- **注册表写入失败**：返回用户可读的错误信息，如"注册表写入失败，请检查权限"
- **IPC 端口被占用**：尝试下一个端口，最多重试 5 次
- **IPC 发送超时**：5 秒超时，超时后直接启动新实例（fallback 到多实例模式）
- **右键菜单已安装时再次安装**：先卸载旧菜单，再安装新菜单（更新路径）
- **exe 路径移动**：用户需要重新安装右键菜单（Settings 页面卸载 → 安装）
- **多文件选择**：Windows 10+ 支持 `%V` 传递多个文件路径，按空格分隔，引号包裹。Go 端用 `shellwords` 或类似方式解析

## 测试策略

- `shell/register_test.go`：模拟注册表操作（单元测试，不实际写入注册表）
- `shell/ipc_test.go`：启动本地 TCP 服务器，发送/接收 LaunchIntent
- `shell/mutex_test.go`：测试互斥体创建与检测
- 手动测试：实际 install → 右键 → 验证页面跳转与文件加载

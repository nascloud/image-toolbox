# Windows 右键菜单扩展名覆盖 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为全部 8 种支持的图片格式添加按扩展名的 Windows 右键菜单注册，解决 `.webp` 等格式右键菜单不出现的问题。

**Architecture:** 在 `backend/shell/register.go` 中定义扩展名列表，`InstallContextMenu()` 在原有两个路径之外额外为每个扩展名写入注册表；`UninstallContextMenu()` 同样遍历清理。

**Tech Stack:** Go, `golang.org/x/sys/windows/registry`

---

### Task 1: 在 register.go 中添加扩展名列表并重构注册/卸载

**Files:**
- Modify: `backend/shell/register.go`
- Test: `backend/shell/register_test.go`（手动执行）

**设计要点：**
- 扩展名列表定义为包级变量 `imageExtensions = []string{".jpg", ".jpeg", ".jfif", ".png", ".webp", ".bmp", ".gif", ".tiff"}`
- `installForKey()` 已有通用能力，不需要改动函数签名，只需在 `InstallContextMenu()` 中增加一个循环
- `UninstallContextMenu()` 中增加一个循环，清理每个扩展名的路径
- 路径格式为 `Software\Classes\.ext\shell\ImageToolbox`
- `IsContextMenuInstalled()` 保持只检查 `image` 类和 `Directory` 两个主键，无需变更

- [ ] **Step 1: 在 register.go 中添加 `imageExtensions` 变量**

在 `appExePath` 变量定义后添加：

```go
var imageExtensions = []string{
	".jpg", ".jpeg", ".jfif", ".png",
	".webp", ".bmp", ".gif", ".tiff",
}
```

- [ ] **Step 2: 修改 `InstallContextMenu()`**

在现有 `installForKey(regImageFiles, "%1")` 和 `installForKey(regDirectory, "%V")` 之后，添加扩展名循环：

```go
func InstallContextMenu() error {
	if appExePath == "" {
		return fmt.Errorf("cannot determine executable path")
	}
	_ = UninstallContextMenu()

	// 原有的类级注册
	if err := installForKey(regImageFiles, "%1"); err != nil {
		return fmt.Errorf("install image files: %w", err)
	}
	if err := installForKey(regDirectory, "%V"); err != nil {
		return fmt.Errorf("install directory: %w", err)
	}

	// 按扩展名注册
	for _, ext := range imageExtensions {
		extKey := "Software\\Classes\\" + ext + "\\shell\\ImageToolbox"
		if err := installForKey(extKey, "%1"); err != nil {
			return fmt.Errorf("install %s: %w", ext, err)
		}
	}

	return nil
}
```

- [ ] **Step 3: 修改 `UninstallContextMenu()`**

在原有列表后追加扩展名路径：

```go
func UninstallContextMenu() error {
	for _, parent := range []string{regImageFiles, regDirectory} {
		if err := deleteRegistryTree(registry.CURRENT_USER, parent); err != nil {
			return fmt.Errorf("uninstall %s: %w", parent, err)
		}
	}
	// 清理按扩展名注册的条目
	for _, ext := range imageExtensions {
		extKey := "Software\\Classes\\" + ext + "\\shell\\ImageToolbox"
		if err := deleteRegistryTree(registry.CURRENT_USER, extKey); err != nil {
			return fmt.Errorf("uninstall %s: %w", ext, err)
		}
	}
	return nil
}
```

- [ ] **Step 4: 确认 `IsContextMenuInstalled()` 无变动**

保留现有逻辑，只检查 `regImageFiles` 和 `regDirectory` 两个主键。原因：扩展名条目与主键在同一安装流程中创建，主键存在即可认为安装完整。

- [ ] **Step 5: 验证编译通过**

```bash
cd F:\Python\imagetool
go build ./...
```

预期：编译通过，无错误。

- [ ] **Step 6: 手动测试安装/卸载**

```bash
cd F:\Python\imagetool
go test ./backend/shell/ -run TestInstallAndUninstall -v
```

注意：该测试默认 `t.Skip`，需要去掉 skip 后在本地手动执行，验证：
1. `InstallContextMenu()` 执行后注册表中出现对应的扩展名路径
2. `IsContextMenuInstalled()` 返回 `true`
3. `UninstallContextMenu()` 执行后所有扩展名路径被清理
4. `IsContextMenuInstalled()` 返回 `false`

- [ ] **Step 7: 提交**

```bash
git add backend/shell/register.go
git commit -m "fix: register Windows context menu under each image extension to support webp and all formats"
```

# Windows 右键菜单扩展名覆盖设计

## 问题

当前 Windows 右键菜单注册在 `SystemFileAssociations\image` 下，依赖 Windows 将扩展名关联到 `image` 文件类。部分格式（如 `.webp`）在部分 Windows 版本上未被关联到 `image` 类，导致右键菜单不出现。

## 方案

保留现有的 `SystemFileAssociations\image` 和 `Directory` 注册，同时为全部 8 种支持的图片格式添加按扩展名的注册。

## 变更范围

仅修改 `backend/shell/register.go`。

## 注册逻辑

安装时写入以下注册表路径：

```
# 原有（保留）
HKCU\Software\Classes\SystemFileAssociations\image\shell\ImageToolbox
HKCU\Software\Classes\Directory\shell\ImageToolbox

# 新增（8 种扩展名）
HKCU\Software\Classes\.jpg\shell\ImageToolbox
HKCU\Software\Classes\.jpeg\shell\ImageToolbox
HKCU\Software\Classes\.jfif\shell\ImageToolbox
HKCU\Software\Classes\.png\shell\ImageToolbox
HKCU\Software\Classes\.webp\shell\ImageToolbox
HKCU\Software\Classes\.bmp\shell\ImageToolbox
HKCU\Software\Classes\.gif\shell\ImageToolbox
HKCU\Software\Classes\.tiff\shell\ImageToolbox
```

每个扩展名路径下的 `MUIVerb`、`Icon`、`command` 值与 `SystemFileAssociations\image` 完全一致（`%1` 参数）。重复注册无害——Windows 优先使用按扩展名的注册，用户无感知。

扩展名列表定义在 `register.go` 中作为包级常量，自包含。

## 卸载逻辑

`UninstallContextMenu()` 遍历原有两个路径 + 8 个扩展名路径，全部调用 `deleteRegistryTree` 清理。

## 检测逻辑

`IsContextMenuInstalled()` 保持现有逻辑：仅检查 `image` 类和 `Directory` 两个主键是否存在。扩展名条目是伴随主键一起安装的，检测主键足以判断安装状态。

## 测试

`register_test.go` 中的手动测试（`TestInstallAndUninstall`）在本地手动执行验证，覆盖安装后注册表内容正确、卸载后全部清理。

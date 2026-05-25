package shell

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

var appExePath string

var imageExtensions = []string{
	".jpg", ".jpeg", ".jfif", ".png",
	".webp", ".bmp", ".gif", ".tiff",
}

func init() {
	exe, err := os.Executable()
	if err == nil {
		appExePath = exe
	}
}

const (
	regImageFiles = "Software\\Classes\\SystemFileAssociations\\image\\shell\\ImageToolbox"
	regDirectory  = "Software\\Classes\\Directory\\shell\\ImageToolbox"
)

func InstallContextMenu() error {
	if appExePath == "" {
		return fmt.Errorf("cannot determine executable path")
	}
	_ = UninstallContextMenu()
	// %1 = the selected file path (one invocation per file)
	if err := installForKey(regImageFiles, "%1"); err != nil {
		return fmt.Errorf("install image files: %w", err)
	}
	// %V = the folder path
	if err := installForKey(regDirectory, "%V"); err != nil {
		return fmt.Errorf("install directory: %w", err)
	}

	// 按扩展名注册，确保.webp等非常规关联格式也能显示菜单
	for _, ext := range imageExtensions {
		extKey := "Software\\Classes\\" + ext + "\\shell\\ImageToolbox"
		if err := installForKey(extKey, "%1"); err != nil {
			return fmt.Errorf("install %s: %w", ext, err)
		}
	}

	return nil
}

// pathArg specifies the shell expansion variable to embed in the command line.
// Use "%1" for file associations (one invocation per selected file) and
// "%V" for directories (passes the folder path).
func installForKey(parentKey string, pathArg string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, parentKey, registry.WRITE)
	if err != nil {
		return err
	}
	defer k.Close()

	menuText := "ImageToolbox 转换/缩放"
	k.SetStringValue("", menuText)
	k.SetStringValue("MUIVerb", menuText)
	k.SetStringValue("Icon", appExePath+",0")
	k.SetStringValue("MultiSelectModel", "Player")
	// Make sure SubCommands is deleted if it existed previously
	_ = k.DeleteValue("SubCommands")

	// Create command subkey directly under parentKey
	cmdKey := parentKey + "\\command"
	ck, _, err := registry.CreateKey(registry.CURRENT_USER, cmdKey, registry.WRITE)
	if err != nil {
		return fmt.Errorf("create command key: %w", err)
	}
	defer ck.Close()

	cmdLine := fmt.Sprintf(`"%s" --page=convert "%s"`, appExePath, pathArg)
	ck.SetStringValue("", cmdLine)

	return nil
}

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

func deleteRegistryTree(k registry.Key, keyPath string) error {
	subKey, err := registry.OpenKey(k, keyPath, registry.ENUMERATE_SUB_KEYS)
	if err != nil {
		if err == registry.ErrNotExist {
			return nil
		}
		return err
	}
	subKeys, err := subKey.ReadSubKeyNames(-1)
	subKey.Close()
	if err != nil {
		return err
	}
	for _, sk := range subKeys {
		if err := deleteRegistryTree(k, keyPath+"\\"+sk); err != nil {
			return err
		}
	}
	parentPath := filepath.Dir(keyPath)
	name := filepath.Base(keyPath)
	pKey, err := registry.OpenKey(k, parentPath, registry.WRITE)
	if err != nil {
		return err
	}
	defer pKey.Close()
	return registry.DeleteKey(pKey, name)
}

func IsContextMenuInstalled() bool {
	for _, parent := range []string{regImageFiles, regDirectory} {
		k, err := registry.OpenKey(registry.CURRENT_USER, parent, registry.READ)
		if err != nil {
			return false
		}
		k.Close()
	}
	return true
}

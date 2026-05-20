package shell

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows/registry"
)

var contextMenuVerbs = []struct {
	Verb string
	Text string
}{
	{Verb: "convert", Text: "转换/缩放"},
	{Verb: "slice", Text: "切片"},
	{Verb: "watermark", Text: "水印"},
	{Verb: "aibatch", Text: "AI 批处理"},
}

var appExePath string

func init() {
	exe, err := os.Executable()
	if err == nil {
		appExePath = exe
	}
}

const (
	regImageFiles = "SystemFileAssociations\\image\\shell\\ImageToolbox"
	regDirectory  = "Directory\\shell\\ImageToolbox"
)

func InstallContextMenu() error {
	if appExePath == "" {
		return fmt.Errorf("cannot determine executable path")
	}
	_ = UninstallContextMenu()
	if err := installForKey(regImageFiles); err != nil {
		return fmt.Errorf("install image files: %w", err)
	}
	if err := installForKey(regDirectory); err != nil {
		return fmt.Errorf("install directory: %w", err)
	}
	return nil
}

func installForKey(parentKey string) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, parentKey, registry.WRITE)
	if err != nil {
		return err
	}
	k.SetStringValue("", "ImageToolbox")
	k.SetStringValue("MUIVerb", "ImageToolbox")
	k.SetStringValue("Icon", appExePath+",0")
	k.SetStringValue("SubCommands", "")
	k.Close()

	shellKey := parentKey + "\\shell"
	for _, v := range contextMenuVerbs {
		verbKey := shellKey + "\\" + v.Verb
		vk, _, err := registry.CreateKey(registry.CURRENT_USER, verbKey, registry.WRITE)
		if err != nil {
			return fmt.Errorf("create verb key %s: %w", v.Verb, err)
		}
		vk.SetStringValue("", v.Text)
		vk.Close()

		cmdKey := verbKey + "\\command"
		ck, _, err := registry.CreateKey(registry.CURRENT_USER, cmdKey, registry.WRITE)
		if err != nil {
			return fmt.Errorf("create command key %s: %w", v.Verb, err)
		}
		cmdLine := fmt.Sprintf(`"%s" --page=%s "%%V"`, appExePath, v.Verb)
		ck.SetStringValue("", cmdLine)
		ck.Close()
	}
	return nil
}

func UninstallContextMenu() error {
	for _, parent := range []string{regImageFiles, regDirectory} {
		if err := deleteRegistryTree(registry.CURRENT_USER, parent); err != nil {
			return fmt.Errorf("uninstall %s: %w", parent, err)
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

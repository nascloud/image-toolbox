package shell

import (
	"testing"
)

func TestInstallAndUninstall(t *testing.T) {
	t.Skip("registry test modifies HKCU; run manually")

	if err := InstallContextMenu(); err != nil {
		t.Fatalf("install: %v", err)
	}
	if !IsContextMenuInstalled() {
		t.Error("expected installed after install")
	}
	if err := UninstallContextMenu(); err != nil {
		t.Fatalf("uninstall: %v", err)
	}
	if IsContextMenuInstalled() {
		t.Error("expected not installed after uninstall")
	}
}

func TestIsContextMenuInstalled_InitiallyFalse(t *testing.T) {
	if IsContextMenuInstalled() {
		t.Skip("context menu is currently installed; cannot test absent state")
	}
}

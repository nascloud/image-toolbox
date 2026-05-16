package file

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func CopyFile(src, destDir string) (string, error) {
	srcFile, err := os.Open(src)
	if err != nil {
		return "", fmt.Errorf("open source: %w", err)
	}
	defer srcFile.Close()

	baseName := filepath.Base(src)
	destPath := filepath.Join(destDir, baseName)

	if _, err := os.Stat(destPath); err == nil {
		ext := filepath.Ext(baseName)
		name := baseName[:len(baseName)-len(ext)]
		for i := 1; ; i++ {
			destPath = filepath.Join(destDir, fmt.Sprintf("%s_%d%s", name, i, ext))
			if _, err := os.Stat(destPath); os.IsNotExist(err) {
				break
			}
		}
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("create dest: %w", err)
	}
	defer destFile.Close()

	if _, err := io.Copy(destFile, srcFile); err != nil {
		return "", fmt.Errorf("copy: %w", err)
	}

	return destPath, nil
}

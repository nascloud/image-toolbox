package file

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const aiTempPrefix = "image-toolbox-ai-"

// AITempDir creates a temporary directory for AI-generated images.
// A new unique directory is created on each call so that successive
// batch runs do not conflict.
func AITempDir() (string, error) {
	dir, err := os.MkdirTemp("", aiTempPrefix)
	if err != nil {
		return "", fmt.Errorf("create ai temp dir: %w", err)
	}
	return dir, nil
}

// CleanupOldAITempDirs removes any AI temp directories left behind by
// previous sessions. Call once at startup.
func CleanupOldAITempDirs() {
	base := os.TempDir()
	entries, err := os.ReadDir(base)
	if err != nil {
		return
	}
	for _, e := range entries {
		if e.IsDir() && strings.HasPrefix(e.Name(), aiTempPrefix) {
			os.RemoveAll(filepath.Join(base, e.Name()))
		}
	}
}

package ai

import (
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var mimeFromExt = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".gif":  "image/gif",
	".tiff": "image/tiff",
	".tif":  "image/tiff",
}

// EncodeImageToBase64 reads an image file and returns a data URI string.
func EncodeImageToBase64(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}

	ext := strings.ToLower(filepath.Ext(path))
	mime := mimeFromExt[ext]
	if mime == "" {
		mime = "image/png"
	}

	encoded := base64.StdEncoding.EncodeToString(data)
	return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
}

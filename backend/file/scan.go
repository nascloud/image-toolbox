package file

import (
	"os"
	"path/filepath"
	"strings"
)

var imageExts = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".jfif": true,
	".png":  true,
	".webp": true,
	".bmp":  true,
	".gif":  true,
	".tiff": true,
}

// IsImageFile returns true if the file extension is a supported image format.
func IsImageFile(ext string) bool {
	return imageExts[strings.ToLower(ext)]
}

// ScanImageFiles walks dir and returns all image file paths.
func ScanImageFiles(dir string, recursive bool) ([]string, error) {
	files := make([]string, 0)

	walkFn := func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			if !recursive && path != dir {
				return filepath.SkipDir
			}
			return nil
		}
		ext := filepath.Ext(info.Name())
		if IsImageFile(ext) {
			files = append(files, path)
		}
		return nil
	}

	if err := filepath.Walk(dir, walkFn); err != nil {
		return nil, err
	}
	return files, nil
}

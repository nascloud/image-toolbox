package file

import (
	"path/filepath"
	"strings"
)

// OutputPath generates the output file path with optional suffix and extension change.
func OutputPath(srcPath, outDir, suffix, newExt string) string {
	base := filepath.Base(srcPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)

	outName := name + suffix
	if newExt != "" {
		outName += "." + strings.TrimPrefix(newExt, ".")
	} else {
		outName += ext
	}

	return filepath.Join(outDir, outName)
}

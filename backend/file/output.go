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

// ResolveOutputPath determines the final output path based on save mode.
// saveMode: "custom" | "overwrite" | "prefix" | "subdir" (empty treated as custom)
// suffix is appended to the filename only in "custom" mode (e.g. "_resized", "_watermarked").
// newExt sets a new extension (for format conversion); empty keeps original extension.
func ResolveOutputPath(srcPath, outputDir, saveMode, prefixName, subdirName, newExt, suffix string) string {
	srcDir := filepath.Dir(srcPath)
	base := filepath.Base(srcPath)
	ext := filepath.Ext(base)
	name := strings.TrimSuffix(base, ext)

	var outDir, outName string

	switch saveMode {
	case "overwrite":
		if newExt == "" {
			return srcPath
		}
		outDir = srcDir
		outName = name

	case "prefix":
		if prefixName == "" {
			prefixName = "output"
		}
		outDir = srcDir
		outName = prefixName + "_" + name

	case "subdir":
		if subdirName == "" {
			subdirName = "output"
		}
		outDir = filepath.Join(srcDir, subdirName)
		outName = name

	default: // "custom" or ""
		outDir = outputDir
		outName = name + suffix
	}

	if newExt != "" {
		outName += "." + strings.TrimPrefix(newExt, ".")
	} else {
		outName += ext
	}

	return filepath.Join(outDir, outName)
}

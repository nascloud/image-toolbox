package batch

import (
	"fmt"
	"hash/fnv"
	"path/filepath"
)

func uniqueOutputPaths(sources []string, build func(string) string) map[string]string {
	paths := make(map[string]string, len(sources))
	counts := make(map[string]int, len(sources))
	for _, src := range sources {
		out := build(src)
		paths[src] = out
		counts[filepath.Clean(out)]++
	}

	for src, out := range paths {
		if counts[filepath.Clean(out)] > 1 {
			paths[src] = addPathHash(out, src)
		}
	}
	return paths
}

func addPathHash(path, seed string) string {
	ext := filepath.Ext(path)
	base := path[:len(path)-len(ext)]
	return fmt.Sprintf("%s_%08x%s", base, pathHash(seed), ext)
}

func pathHash(path string) uint32 {
	h := fnv.New32a()
	_, _ = h.Write([]byte(filepath.Clean(path)))
	return h.Sum32()
}

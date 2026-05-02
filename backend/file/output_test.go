package file

import (
	"path/filepath"
	"testing"
)

func TestOutputPath(t *testing.T) {
	tests := []struct {
		name     string
		src      string
		outDir   string
		suffix   string
		newExt   string
		expected string
	}{
		{"no change", "/images/a.jpg", "/out", "", "", "/out/a.jpg"},
		{"with suffix", "/images/a.jpg", "/out", "_resized", "", "/out/a_resized.jpg"},
		{"change ext", "/images/a.png", "/out", "", ".jpg", "/out/a.jpg"},
		{"suffix + ext", "/images/a.jpg", "/out", "_converted", ".png", "/out/a_converted.png"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := OutputPath(tt.src, tt.outDir, tt.suffix, tt.newExt)
			want := filepath.FromSlash(tt.expected)
			if got != want {
				t.Errorf("OutputPath() = %s, want %s", got, want)
			}
		})
	}
}

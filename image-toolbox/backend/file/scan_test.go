package file

import (
	"os"
	"path/filepath"
	"testing"
)

func TestScanImageFiles(t *testing.T) {
	dir := t.TempDir()
	files := []string{"a.jpg", "b.png", "c.webp", "d.txt", "e.bmp", "f.gif", "g.tiff"}
	for _, f := range files {
		os.WriteFile(filepath.Join(dir, f), []byte("dummy"), 0644)
	}

	got, err := ScanImageFiles(dir, false)
	if err != nil {
		t.Fatal(err)
	}

	if len(got) != 6 {
		t.Errorf("expected 6 image files, got %d", len(got))
	}
}

func TestScanImageFilesRecursive(t *testing.T) {
	dir := t.TempDir()
	subdir := filepath.Join(dir, "sub")
	os.Mkdir(subdir, 0755)
	os.WriteFile(filepath.Join(dir, "root.png"), []byte("dummy"), 0644)
	os.WriteFile(filepath.Join(subdir, "nested.jpg"), []byte("dummy"), 0644)

	got, _ := ScanImageFiles(dir, false)
	if len(got) != 1 {
		t.Errorf("non-recursive expected 1, got %d", len(got))
	}

	got, _ = ScanImageFiles(dir, true)
	if len(got) != 2 {
		t.Errorf("recursive expected 2, got %d", len(got))
	}
}

func TestIsImageFile(t *testing.T) {
	tests := []struct {
		name  string
		ext   string
		isImg bool
	}{
		{".jpg", ".jpg", true},
		{".jpeg", ".jpeg", true},
		{".png", ".png", true},
		{".webp", ".webp", true},
		{".bmp", ".bmp", true},
		{".gif", ".gif", true},
		{".tiff", ".tiff", true},
		{".txt", ".txt", false},
		{".exe", ".exe", false},
		{"no ext", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsImageFile(tt.ext); got != tt.isImg {
				t.Errorf("IsImageFile(%q) = %v, want %v", tt.ext, got, tt.isImg)
			}
		})
	}
}

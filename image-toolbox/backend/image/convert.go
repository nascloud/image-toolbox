package image

import (
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"strings"

	"github.com/deepteams/webp"
	"golang.org/x/image/draw"
)

var supportedTargetExts = map[string]bool{
	"jpg":  true,
	"jpeg": true,
	"png":  true,
	"webp": true,
}

// ConvertImage decodes srcPath and re-encodes it as targetFormat at destPath.
func ConvertImage(srcPath, destPath, targetFormat string, resizeOpts *ResizeOptions) (string, error) {
	targetFormat = strings.ToLower(strings.TrimPrefix(targetFormat, "."))
	if !supportedTargetExts[targetFormat] {
		return "", fmt.Errorf("unsupported target format: %s", targetFormat)
	}

	srcFile, err := os.Open(srcPath)
	if err != nil {
		return "", fmt.Errorf("open source: %w", err)
	}
	defer srcFile.Close()

	img, _, err := image.Decode(srcFile)
	if err != nil {
		return "", fmt.Errorf("decode source: %w", err)
	}

	if resizeOpts != nil {
		img = ResizeImage(img, *resizeOpts)
	}

	destFile, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("create dest: %w", err)
	}
	defer destFile.Close()

	if targetFormat == "jpg" || targetFormat == "jpeg" {
		img = removeAlpha(img)
	}

	switch targetFormat {
	case "jpg", "jpeg":
		err = jpeg.Encode(destFile, img, &jpeg.Options{Quality: 95})
	case "png":
		err = png.Encode(destFile, img)
	case "webp":
		err = webp.Encode(destFile, img, &webp.Options{Quality: 90})
	}
	if err != nil {
		return "", fmt.Errorf("encode to %s: %w", targetFormat, err)
	}

	return destPath, nil
}

// removeAlpha composites the image onto a white background for JPEG output.
func removeAlpha(img image.Image) image.Image {
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, image.White, image.Point{}, draw.Src)
	draw.Draw(dst, bounds, img, image.Point{}, draw.Over)
	return dst
}

// Temporary stubs — will be properly implemented in Task 5 (resize.go).
type ResizeOptions struct {
	Mode    string
	Value   float64
	Width   int
	Height  int
	MaxEdge int
}

func ResizeImage(src image.Image, opts ResizeOptions) image.Image {
	return src // no-op until Task 5
}

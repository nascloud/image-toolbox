package ai

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	// Register decoders so image.Decode can handle these formats.
	_ "image/gif"
	_ "image/jpeg"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"

	"golang.org/x/image/draw"
)

// Formats the AI API natively supports — others get converted to PNG.
var aiSupportedExt = map[string]bool{
	".png":  true,
	".jpg":  true,
".jpeg": true,
	".webp": true,
	".jfif": true,
}

var mimeFromExt = map[string]string{
	".png":  "image/png",
	".jpg":  "image/jpeg",
	".jpeg": "image/jpeg",
	".jfif": "image/jpeg",
	".webp": "image/webp",
	".bmp":  "image/bmp",
	".gif":  "image/gif",
	".tiff": "image/tiff",
	".tif":  "image/tiff",
}

// EncodeImageToBase64 reads an image file and returns a data URI string.
// Formats not natively supported by the AI API (BMP, GIF, TIFF) are decoded
// and re-encoded as PNG before being base64-encoded.
func EncodeImageToBase64(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))

	// Fast path: formats the AI API supports natively
	if aiSupportedExt[ext] {
		data, err := os.ReadFile(path)
		if err != nil {
			return "", fmt.Errorf("read: %w", err)
		}
		mime := mimeFromExt[ext]
		if mime == "" {
			mime = "image/png"
		}
		encoded := base64.StdEncoding.EncodeToString(data)
		return fmt.Sprintf("data:%s;base64,%s", mime, encoded), nil
	}

	// Convert path: decode image and re-encode as PNG
	src, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open: %w", err)
	}
	defer src.Close()

	img, _, err := image.Decode(src)
	if err != nil {
		return "", fmt.Errorf("decode: %w", err)
	}

	// Composite onto white background to strip alpha from formats
	// that might have it (GIF palette, TIFF alpha), ensuring clean PNG output
	bounds := img.Bounds()
	rgba := image.NewRGBA(bounds)
	draw.Draw(rgba, bounds, image.White, image.Point{}, draw.Src)
	draw.Draw(rgba, bounds, img, image.Point{}, draw.Over)

	var buf bytes.Buffer
	if err := png.Encode(&buf, rgba); err != nil {
		return "", fmt.Errorf("encode to png: %w", err)
	}

	encoded := base64.StdEncoding.EncodeToString(buf.Bytes())
	return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
}

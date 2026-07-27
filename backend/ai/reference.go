package ai

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"strings"

	// Register decoders so image.Decode can handle these formats.
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"
	_ "image/gif"
	_ "image/jpeg"

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

const (
	aiLargeImageMaxBytes    = 10 * 1024 * 1024
	aiLargeImageMaxLongEdge = 4096
	aiLargeImageJPEGQuality = 92
)

// EncodeImageToBase64 reads an image file and returns a data URI string.
// Supported images are passed through unchanged unless they exceed 10 MiB or
// have a long edge over 4096 pixels. Oversized images are resized and encoded
// as JPEG; unsupported formats are converted to PNG.
func EncodeImageToBase64(path string) (string, error) {
	ext := strings.ToLower(filepath.Ext(path))

	if aiSupportedExt[ext] {
		info, err := os.Stat(path)
		if err != nil {
			return "", fmt.Errorf("stat: %w", err)
		}
		oversizedDimensions, err := imageExceedsLongEdge(path, aiLargeImageMaxLongEdge)
		if err != nil {
			return "", err
		}
		if info.Size() <= aiLargeImageMaxBytes && !oversizedDimensions {
			return encodeFileDataURI(path, mimeFromExt[ext])
		}
		return encodeOversizedImage(path, aiLargeImageMaxLongEdge)
	}

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
	// that might have it (GIF palette, TIFF alpha), ensuring clean PNG output.
	bounds := img.Bounds()
	rgba := image.NewRGBA(bounds)
	draw.Draw(rgba, bounds, image.White, image.Point{}, draw.Src)
	draw.Draw(rgba, bounds, img, image.Point{}, draw.Over)

	var buf bytes.Buffer
	if err := png.Encode(&buf, rgba); err != nil {
		return "", fmt.Errorf("encode to png: %w", err)
	}
	return dataURI("image/png", buf.Bytes()), nil
}

func imageExceedsLongEdge(path string, maxLongEdge int) (bool, error) {
	file, err := os.Open(path)
	if err != nil {
		return false, fmt.Errorf("open: %w", err)
	}
	defer file.Close()

	config, _, err := image.DecodeConfig(file)
	if err != nil {
		return false, fmt.Errorf("decode config: %w", err)
	}
	return config.Width > maxLongEdge || config.Height > maxLongEdge, nil
}

func encodeFileDataURI(path, mime string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read: %w", err)
	}
	if mime == "" {
		mime = "image/png"
	}
	return dataURI(mime, data), nil
}

func encodeOversizedImage(path string, maxLongEdge int) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open oversized image: %w", err)
	}
	defer file.Close()

	img, _, err := image.Decode(file)
	if err != nil {
		return "", fmt.Errorf("decode oversized image: %w", err)
	}
	img = resizeToMaxLongEdge(img, maxLongEdge)
	img = compositeOnWhite(img)

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: aiLargeImageJPEGQuality}); err != nil {
		return "", fmt.Errorf("encode oversized image: %w", err)
	}
	return dataURI("image/jpeg", buf.Bytes()), nil
}

func compositeOnWhite(src image.Image) image.Image {
	bounds := src.Bounds()
	dst := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	draw.Draw(dst, dst.Bounds(), &image.Uniform{C: color.White}, image.Point{}, draw.Src)
	draw.Draw(dst, dst.Bounds(), src, bounds.Min, draw.Over)
	return dst
}

func resizeToMaxLongEdge(src image.Image, maxLongEdge int) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= maxLongEdge && height <= maxLongEdge {
		return src
	}

	dstWidth := width
	dstHeight := height
	if width >= height {
		dstWidth = maxLongEdge
		dstHeight = max(1, height*maxLongEdge/width)
	} else {
		dstHeight = maxLongEdge
		dstWidth = max(1, width*maxLongEdge/height)
	}
	dst := image.NewRGBA(image.Rect(0, 0, dstWidth, dstHeight))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, bounds, draw.Src, nil)
	return dst
}

func dataURI(mime string, data []byte) string {
	return fmt.Sprintf("data:%s;base64,%s", mime, base64.StdEncoding.EncodeToString(data))
}

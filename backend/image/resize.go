package image

import (
	"image"
	"math"

	"golang.org/x/image/draw"
)

// Resize mode constants.
const (
	ResizeModeRatio      = "ratio"
	ResizeModeDimensions = "dimensions"
	ResizeModeMaxEdge    = "maxEdge"
	ResizeModeWidth      = "width"
)

// ResizeOptions specifies how to resize an image.
type ResizeOptions struct {
	Mode    string
	Value   float64
	Width   int
	Height  int
	MaxEdge int
}

func calcDimensions(src image.Image, opts ResizeOptions) (int, int) {
	srcW := src.Bounds().Dx()
	srcH := src.Bounds().Dy()

	switch opts.Mode {
	case ResizeModeRatio:
		w := int(math.Round(float64(srcW) * opts.Value))
		h := int(math.Round(float64(srcH) * opts.Value))
		if w < 1 {
			w = 1
		}
		if h < 1 {
			h = 1
		}
		return w, h

	case ResizeModeDimensions:
		return opts.Width, opts.Height

	case ResizeModeMaxEdge:
		maxSrc := srcW
		if srcH > maxSrc {
			maxSrc = srcH
		}
		ratio := float64(opts.MaxEdge) / float64(maxSrc)
		if ratio >= 1.0 {
			return srcW, srcH
		}
		w := int(math.Round(float64(srcW) * ratio))
		h := int(math.Round(float64(srcH) * ratio))
		if w < 1 {
			w = 1
		}
		if h < 1 {
			h = 1
		}
		return w, h

	case ResizeModeWidth:
		if opts.Width <= 0 {
			return srcW, srcH
		}
		ratio := float64(opts.Width) / float64(srcW)
		h := int(math.Round(float64(srcH) * ratio))
		if h < 1 {
			h = 1
		}
		return opts.Width, h

	default:
		return srcW, srcH
	}
}

// ResizeImage returns a new image scaled according to opts.
func ResizeImage(src image.Image, opts ResizeOptions) image.Image {
	dstW, dstH := calcDimensions(src, opts)
	if dstW == src.Bounds().Dx() && dstH == src.Bounds().Dy() {
		return src
	}

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	draw.ApproxBiLinear.Scale(dst, dst.Bounds(), src, src.Bounds(), draw.Over, nil)
	return dst
}

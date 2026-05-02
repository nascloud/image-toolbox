package image

import (
	"image"
	"image/color"
	"image/draw"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/font/basicfont"
	"golang.org/x/image/math/fixed"
)

// AddImageWatermark places or tiles a watermark image over the base.
func AddImageWatermark(base, watermark image.Image, opacity float64, position string) *image.RGBA {
	bounds := base.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, base, image.Point{}, draw.Src)

	wmBounds := watermark.Bounds()
	wmW := wmBounds.Dx()
	wmH := wmBounds.Dy()

	adjustedWM := adjustOpacity(watermark, opacity)

	switch strings.ToLower(position) {
	case "tile":
		for y := 0; y < bounds.Dy(); y += wmH {
			for x := 0; x < bounds.Dx(); x += wmW {
				draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
			}
		}
	case "center":
		x := (bounds.Dx() - wmW) / 2
		y := (bounds.Dy() - wmH) / 2
		draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
	case "bottomRight":
		x := bounds.Dx() - wmW - 10
		y := bounds.Dy() - wmH - 10
		if x < 0 {
			x = 0
		}
		if y < 0 {
			y = 0
		}
		draw.Draw(dst, image.Rect(x, y, x+wmW, y+wmH), adjustedWM, image.Point{}, draw.Over)
	default: // topLeft
		draw.Draw(dst, image.Rect(0, 0, wmW, wmH), adjustedWM, image.Point{}, draw.Over)
	}

	return dst
}

func adjustOpacity(src image.Image, opacity float64) *image.RGBA {
	bounds := src.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := src.At(x, y).RGBA()
			na := uint32(float64(a>>8) * opacity)
			dst.Set(x, y, color.RGBA{uint8(r >> 8), uint8(g >> 8), uint8(b >> 8), uint8(na)})
		}
	}
	return dst
}

// AddTextWatermark draws text onto an image.
func AddTextWatermark(base image.Image, text string, opacity float64, position string, fontSize int, fontColor string) *image.RGBA {
	bounds := base.Bounds()
	dst := image.NewRGBA(bounds)
	draw.Draw(dst, bounds, base, image.Point{}, draw.Src)

	c := parseHexColor(fontColor)
	c.A = uint8(opacity * 255)

	face := basicfont.Face7x13
	drawer := &font.Drawer{
		Dst:  dst,
		Src:  image.NewUniform(c),
		Face: face,
	}

	textW := font.MeasureString(face, text).Ceil()
	textH := face.Metrics().Height.Ceil()

	var x, y int
	switch strings.ToLower(position) {
	case "center":
		x = (bounds.Dx() - textW) / 2
		y = (bounds.Dy()-textH)/2 + textH
	case "bottomRight":
		x = bounds.Dx() - textW - 10
		y = bounds.Dy() - 10
	default:
		x = 10
		y = textH + 10
	}

	if x < 0 {
		x = 10
	}

	drawer.Dot = fixed.P(x, y)
	drawer.DrawString(text)

	return dst
}

func parseHexColor(hex string) color.RGBA {
	if len(hex) == 0 {
		return color.RGBA{255, 255, 255, 255}
	}
	hex = strings.TrimPrefix(hex, "#")
	if len(hex) != 6 {
		return color.RGBA{255, 255, 255, 255}
	}
	return color.RGBA{
		R: hexPair(hex[0:2]),
		G: hexPair(hex[2:4]),
		B: hexPair(hex[4:6]),
		A: 255,
	}
}

func hexPair(s string) uint8 {
	var v uint8
	for _, c := range s {
		v *= 16
		switch {
		case c >= '0' && c <= '9':
			v += uint8(c - '0')
		case c >= 'a' && c <= 'f':
			v += uint8(c - 'a' + 10)
		case c >= 'A' && c <= 'F':
			v += uint8(c - 'A' + 10)
		}
	}
	return v
}

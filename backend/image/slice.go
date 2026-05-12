package image

import (
	"image"
	"image/color"
	"math"
	"math/rand/v2"
)

// SliceOptions defines parameters for image slicing.
type SliceOptions struct {
	Count      int
	Contrast   float64
	Saturation float64
}

// SliceImage randomly divides an image into sliceCount horizontal strips.
func SliceImage(src image.Image, sliceCount int, contrast, saturation float64) []image.Image {
	img := src
	if contrast != 1.0 {
		img = adjustContrast(img, contrast)
	}
	if saturation != 1.0 {
		img = applySaturation(img, saturation)
	}

	bounds := img.Bounds()
	height := bounds.Dy()
	minH := 50
	if height/sliceCount < minH {
		minH = max(1, height/sliceCount)
	}

	heights := calcSliceHeights(height, sliceCount, minH)
	slices := make([]image.Image, 0, sliceCount)
	yOff := 0

	for _, h := range heights {
		slice := image.NewRGBA(image.Rect(0, 0, bounds.Dx(), h))
		for y := 0; y < h; y++ {
			for x := 0; x < bounds.Dx(); x++ {
				slice.Set(x, y, img.At(x, yOff+y))
			}
		}
		slices = append(slices, slice)
		yOff += h
	}

	return slices
}

// SliceImageByHeight divides an image into fixed-height horizontal strips.
// The last strip may be shorter if the image height is not evenly divisible.
func SliceImageByHeight(src image.Image, sliceHeight int, contrast, saturation float64) []image.Image {
	img := src
	if contrast != 1.0 {
		img = adjustContrast(img, contrast)
	}
	if saturation != 1.0 {
		img = applySaturation(img, saturation)
	}

	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	if sliceHeight <= 0 {
		return nil
	}

	var slices []image.Image
	for y := 0; y < height; y += sliceHeight {
		h := sliceHeight
		if y+h > height {
			h = height - y
		}
		slice := image.NewRGBA(image.Rect(0, 0, width, h))
		for sy := 0; sy < h; sy++ {
			for sx := 0; sx < width; sx++ {
				slice.Set(sx, sy, img.At(sx, y+sy))
			}
		}
		slices = append(slices, slice)
	}
	return slices
}

// calcSliceHeights generates random slice heights that sum to imageHeight.
func calcSliceHeights(imageHeight, sliceCount, minHeight int) []int {
	avgHeight := float64(imageHeight) / float64(sliceCount)

	heights := make([]int, sliceCount)
	remaining := imageHeight

	for i := 0; i < sliceCount; i++ {
		if i == sliceCount-1 {
			heights[i] = remaining
			break
		}

		minAllow := max(minHeight, int(math.Round(avgHeight*0.9)))
		maxAllow := max(minAllow+1, int(math.Round(avgHeight*1.1)))

		roomForOthers := remaining - (sliceCount-i-1)*minHeight
		if roomForOthers < maxAllow {
			maxAllow = roomForOthers
		}
		if maxAllow < minAllow {
			maxAllow = minAllow
		}

		h := rand.IntN(maxAllow-minAllow+1) + minAllow
		heights[i] = h
		remaining -= h
	}

	return heights
}

func adjustContrast(img image.Image, factor float64) *image.RGBA {
	if factor == 1.0 {
		return convertToRGBA(img)
	}
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			ri := float64(r >> 8)
			gi := float64(g >> 8)
			bi := float64(b >> 8)
			nr := uint8(clampFloat(128+(ri-128)*factor, 0, 255))
			ng := uint8(clampFloat(128+(gi-128)*factor, 0, 255))
			nb := uint8(clampFloat(128+(bi-128)*factor, 0, 255))
			dst.Set(x, y, color.RGBA{nr, ng, nb, uint8(a >> 8)})
		}
	}
	return dst
}

func applySaturation(img image.Image, factor float64) *image.RGBA {
	if factor == 1.0 {
		return convertToRGBA(img)
	}
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, a := img.At(x, y).RGBA()
			ri := float64(r >> 8)
			gi := float64(g >> 8)
			bi := float64(b >> 8)
			gray := 0.299*ri + 0.587*gi + 0.114*bi
			nr := uint8(clampFloat(gray+(ri-gray)*factor, 0, 255))
			ng := uint8(clampFloat(gray+(gi-gray)*factor, 0, 255))
			nb := uint8(clampFloat(gray+(bi-gray)*factor, 0, 255))
			dst.Set(x, y, color.RGBA{nr, ng, nb, uint8(a >> 8)})
		}
	}
	return dst
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func convertToRGBA(img image.Image) *image.RGBA {
	bounds := img.Bounds()
	dst := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			dst.Set(x, y, img.At(x, y))
		}
	}
	return dst
}

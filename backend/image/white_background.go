package image

import (
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"

	_ "github.com/deepteams/webp"
	_ "golang.org/x/image/bmp"
	_ "golang.org/x/image/tiff"

	"image-toolbox/backend/model"
)

// WhiteBackgroundOptions controls the local sampling heuristic.
type WhiteBackgroundOptions struct {
	NearWhiteThreshold uint8
	MinScore           float64
	MaxSampleDimension int
}

// DefaultWhiteBackgroundOptions is tuned for photographed products on near-white backgrounds.
func DefaultWhiteBackgroundOptions() WhiteBackgroundOptions {
	return WhiteBackgroundOptions{
		NearWhiteThreshold: 240,
		MinScore:           0.82,
		MaxSampleDimension: 256,
	}
}

// AnalyzeWhiteBackground checks image pixels locally. It never calls an AI service.
func AnalyzeWhiteBackground(path string, opts WhiteBackgroundOptions) (model.WhiteBackgroundAnalysis, error) {
	if opts.NearWhiteThreshold == 0 {
		opts.NearWhiteThreshold = 240
	}
	if opts.MinScore <= 0 || opts.MinScore > 1 {
		opts.MinScore = 0.82
	}
	if opts.MaxSampleDimension <= 0 {
		opts.MaxSampleDimension = 256
	}

	input, err := os.Open(path)
	if err != nil {
		return model.WhiteBackgroundAnalysis{}, fmt.Errorf("open image: %w", err)
	}
	defer input.Close()

	img, _, err := image.Decode(input)
	if err != nil {
		return model.WhiteBackgroundAnalysis{}, fmt.Errorf("decode image: %w", err)
	}
	bounds := img.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width < 2 || height < 2 {
		return model.WhiteBackgroundAnalysis{}, fmt.Errorf("image is too small")
	}

	step := int(math.Ceil(float64(max(width, height)) / float64(opts.MaxSampleDimension)))
	if step < 1 {
		step = 1
	}
	borderWidth := max(1, min(width, height)/20)
	cornerWidth := max(1, width/8)
	cornerHeight := max(1, height/8)

	var total, nearWhite, transparent int
	var borderTotal, borderWhite int
	var cornerTotal, cornerWhite int

	xSamples := samplePositions(bounds.Min.X, bounds.Max.X, step)
	ySamples := samplePositions(bounds.Min.Y, bounds.Max.Y, step)
	for _, y := range ySamples {
		for _, x := range xSamples {
			total++
			r, g, b, a := img.At(x, y).RGBA()
			isTransparent := a < 0x4000
			if isTransparent {
				transparent++
			}
			isWhite := isTransparent || nearWhitePixel(uint8(r>>8), uint8(g>>8), uint8(b>>8), opts.NearWhiteThreshold)
			if isWhite {
				nearWhite++
			}

			relX, relY := x-bounds.Min.X, y-bounds.Min.Y
			isBorder := relX < borderWidth || relX >= width-borderWidth || relY < borderWidth || relY >= height-borderWidth
			if isBorder {
				borderTotal++
				if isWhite {
					borderWhite++
				}
			}
			isCorner := (relX < cornerWidth || relX >= width-cornerWidth) && (relY < cornerHeight || relY >= height-cornerHeight)
			if isCorner {
				cornerTotal++
				if isWhite {
					cornerWhite++
				}
			}
		}
	}

	if total == 0 || borderTotal == 0 || cornerTotal == 0 {
		return model.WhiteBackgroundAnalysis{}, fmt.Errorf("no pixels sampled")
	}
	borderRatio := float64(borderWhite) / float64(borderTotal)
	cornerRatio := float64(cornerWhite) / float64(cornerTotal)
	overallRatio := float64(nearWhite) / float64(total)
	foregroundRatio := 1 - overallRatio
	transparentRatio := float64(transparent) / float64(total)
	score := clamp01(borderRatio*0.55 + cornerRatio*0.30 + overallRatio*0.15)

	// Nearly empty white/transparent canvases are not useful product references.
	isWhite := score >= opts.MinScore && foregroundRatio >= 0.03 && foregroundRatio <= 0.80
	return model.WhiteBackgroundAnalysis{
		IsWhiteBackground: isWhite,
		Score:             roundScore(score),
		BorderWhiteRatio:  roundScore(borderRatio),
		CornerWhiteRatio:  roundScore(cornerRatio),
		OverallWhiteRatio: roundScore(overallRatio),
		ForegroundRatio:   roundScore(foregroundRatio),
		TransparentRatio:  roundScore(transparentRatio),
	}, nil
}

func samplePositions(minimum, maximum, step int) []int {
	if maximum <= minimum {
		return nil
	}
	last := maximum - 1
	positions := make([]int, 0, (maximum-minimum)/step+2)
	for value := minimum; value <= last; value += step {
		positions = append(positions, value)
	}
	if positions[len(positions)-1] != last {
		positions = append(positions, last)
	}
	return positions
}

func nearWhitePixel(r, g, b, threshold uint8) bool {
	maximum := max(int(r), max(int(g), int(b)))
	minimum := min(int(r), min(int(g), int(b)))
	return r >= threshold && g >= threshold && b >= threshold && maximum-minimum <= 18
}

func roundScore(value float64) float64 {
	return math.Round(clamp01(value)*10000) / 10000
}

func clamp01(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 1 {
		return 1
	}
	return value
}

package ai

import "strings"

// ModelCapabilities describes API parameters accepted by a Seedream model.
type ModelCapabilities struct {
	SupportsImageInput         bool
	SupportsSequential         bool
	SupportsStream             bool
	SupportsGuidanceScale      bool
	SupportsOutputFormat       bool
	SupportsWebSearch          bool
	SupportsFastPromptOptimize bool
	DefaultOutputFormat        string
	AllowedSizes               map[string]bool
}

// CapabilitiesForModel returns the documented feature set for a Seedream model.
func CapabilitiesForModel(model string) ModelCapabilities {
	normalized := strings.ToLower(model)
	caps := ModelCapabilities{
		SupportsImageInput:  true,
		SupportsSequential:  true,
		SupportsStream:      true,
		DefaultOutputFormat: "jpeg",
		AllowedSizes:        map[string]bool{"1K": true, "2K": true, "3K": true, "4K": true},
	}

	switch {
	case strings.Contains(normalized, "3-0-t2i"):
		return ModelCapabilities{
			SupportsGuidanceScale: true,
			DefaultOutputFormat:   "jpeg",
			AllowedSizes:          map[string]bool{"2K": true, "3K": true},
		}
	case strings.Contains(normalized, "5-0"):
		caps.SupportsOutputFormat = true
		caps.SupportsWebSearch = true
		caps.DefaultOutputFormat = "jpeg"
		caps.AllowedSizes = map[string]bool{"1K": true, "2K": true, "3K": true}
		return caps
	case strings.Contains(normalized, "4-5"):
		caps.AllowedSizes = map[string]bool{"1K": true, "2K": true, "3K": true, "4K": true}
		return caps
	case strings.Contains(normalized, "4-0"):
		caps.SupportsFastPromptOptimize = true
		caps.AllowedSizes = map[string]bool{"1K": true, "2K": true, "3K": true, "4K": true}
		return caps
	default:
		return caps
	}
}

// EffectiveOutputFormat returns the actual file format the API can produce.
func EffectiveOutputFormat(model, requested string) string {
	if CapabilitiesForModel(model).SupportsOutputFormat {
		if requested == "png" || requested == "jpeg" {
			return requested
		}
	}
	return "jpeg"
}

func isPixelSize(size string) bool {
	parts := strings.Split(size, "x")
	if len(parts) != 2 {
		return false
	}
	return parts[0] != "" && parts[1] != ""
}

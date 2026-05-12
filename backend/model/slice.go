package model

// SliceRequest defines parameters for the image slicing operation.
type SliceRequest struct {
	SourcePaths []string `json:"sourcePaths"`
	OutputDir   string   `json:"outputDir"`
	SliceMode   string   `json:"sliceMode"`   // "count" | "height"
	SliceCount  int      `json:"sliceCount"`
	SliceHeight int      `json:"sliceHeight"` // pixels per slice, used when mode="height"
	Contrast    float64  `json:"contrast"`
	Saturation  float64  `json:"saturation"`
	SaveMode    string   `json:"saveMode,omitempty"`
	PrefixName  string   `json:"prefixName,omitempty"`
	SubdirName  string   `json:"subdirName,omitempty"`
}

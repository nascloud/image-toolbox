package model

// SliceRequest defines parameters for the image slicing operation.
type SliceRequest struct {
	SourcePaths []string `json:"sourcePaths"`
	OutputDir   string   `json:"outputDir"`
	SliceCount  int      `json:"sliceCount"`
	Contrast    float64  `json:"contrast"`
	Saturation  float64  `json:"saturation"`
}

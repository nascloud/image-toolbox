package model

// WatermarkRequest holds all parameters for a watermark batch operation.
type WatermarkRequest struct {
	SourcePaths    []string `json:"sourcePaths"`
	OutputDir      string   `json:"outputDir"`
	WatermarkImage string   `json:"watermarkImage"`
	WatermarkText  string   `json:"watermarkText"`
	Opacity        float64  `json:"opacity"`
	Position       string   `json:"position"`
	FontSize       int      `json:"fontSize"`
	FontColor      string   `json:"fontColor"`
	UniformWidth   int      `json:"uniformWidth"`
	OutputWidth    int      `json:"outputWidth"`
	SaveMode       string   `json:"saveMode,omitempty"`
	PrefixName     string   `json:"prefixName,omitempty"`
	SubdirName     string   `json:"subdirName,omitempty"`
}

// WatermarkPreviewRequest holds parameters for generating a watermark preview.
type WatermarkPreviewRequest struct {
	SourcePath     string  `json:"sourcePath"`
	WatermarkImage string  `json:"watermarkImage"`
	WatermarkText  string  `json:"watermarkText"`
	Opacity        float64 `json:"opacity"`
	Position       string  `json:"position"`
	FontSize       int     `json:"fontSize"`
	FontColor      string  `json:"fontColor"`
}

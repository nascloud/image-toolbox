package model

// BatchRequest holds all parameters for a local batch operation.
type BatchRequest struct {
	SourcePaths      []string `json:"sourcePaths"`
	OutputDir        string   `json:"outputDir"`
	ConvertTo        string   `json:"convertTo,omitempty"`
	ResizeMode       string   `json:"resizeMode,omitempty"`
	ResizeValue      float64  `json:"resizeValue,omitempty"`
	ResizeWidth      int      `json:"resizeWidth,omitempty"`
	ResizeHeight     int      `json:"resizeHeight,omitempty"`
	PreserveOriginal bool     `json:"preserveOriginal"`
	SaveMode         string   `json:"saveMode,omitempty"`
	PrefixName       string   `json:"prefixName,omitempty"`
	SubdirName       string   `json:"subdirName,omitempty"`
}

// BatchResult aggregates results from processing multiple images.
type BatchResult struct {
	Total   int           `json:"total"`
	Success int           `json:"success"`
	Failed  int           `json:"failed"`
	Results []ImageResult `json:"results"`
	Error   string        `json:"error,omitempty"`
}

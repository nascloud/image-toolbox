package model

// ImageJob represents a single image processing task.
type ImageJob struct {
	SourcePath       string `json:"sourcePath"`
	OutputPath       string `json:"outputPath"`
	PreserveOriginal bool   `json:"preserveOriginal"`
}

// ImageResult represents the outcome of processing one image.
type ImageResult struct {
	SourcePath  string   `json:"sourcePath"`
	OutputPath  string   `json:"outputPath,omitempty"`
	OutputPaths []string `json:"outputPaths,omitempty"`
	Success     bool     `json:"success"`
	Error       string   `json:"error,omitempty"`
}

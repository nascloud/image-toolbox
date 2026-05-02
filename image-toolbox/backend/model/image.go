package model

type ImageJob struct {
	SourcePath       string `json:"sourcePath"`
	OutputPath       string `json:"outputPath"`
	PreserveOriginal bool   `json:"preserveOriginal"`
}

type ImageResult struct {
	SourcePath string `json:"sourcePath"`
	OutputPath string `json:"outputPath,omitempty"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

package model

// AIImageRequest represents a request to an AI image generation API.
type AIImageRequest struct {
	Model                     string   `json:"model"`
	Prompt                    string   `json:"prompt"`
	Size                      string   `json:"size"`
	Image                     string   `json:"image,omitempty"`
	ReferenceImages           []string `json:"referenceImages,omitempty"`
	Seed                      int      `json:"seed,omitempty"`
	OutputFormat              string   `json:"outputFormat,omitempty"`
	Watermark                 bool     `json:"watermark"`
	GuidanceScale             float64  `json:"guidanceScale,omitempty"`
	ResponseFormat            string   `json:"responseFormat,omitempty"`
	Stream                    bool     `json:"stream"`
	SequentialImageGeneration string   `json:"sequentialImageGeneration,omitempty"`
	MaxImages                 int      `json:"maxImages,omitempty"`
	OptimizePromptMode        string   `json:"optimizePromptMode,omitempty"`
	WebSearch                 bool     `json:"webSearch"`
}

// AIImageResult represents the result of processing one image through AI.
type AIImageResult struct {
	SourcePath string `json:"sourcePath"`
	OutputPath string `json:"outputPath,omitempty"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

// AIImageResponse represents the API response from the image generation endpoint.
type AIImageResponse struct {
	Data []struct {
		URL     string `json:"url,omitempty"`
		B64JSON string `json:"b64_json,omitempty"`
		Size    string `json:"size,omitempty"`
		Error   *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	} `json:"data"`
	Usage *struct {
		GeneratedImages int `json:"generated_images"`
		OutputTokens    int `json:"output_tokens"`
		TotalTokens     int `json:"total_tokens"`
	} `json:"usage,omitempty"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// AIBatchRequest holds AI batch processing parameters.
type AIBatchRequest struct {
	SourcePaths               []string `json:"sourcePaths"`
	OutputDir                 string   `json:"outputDir"`
	Prompt                    string   `json:"prompt"`
	Model                     string   `json:"model"`
	Size                      string   `json:"size"`
	ReferenceImages           []string `json:"referenceImages"`
	Seed                      int      `json:"seed"`
	OutputFormat              string   `json:"outputFormat"`
	Watermark                 bool     `json:"watermark"`
	GuidanceScale             float64  `json:"guidanceScale"`
	ResponseFormat            string   `json:"responseFormat"`
	Stream                    bool     `json:"stream"`
	SequentialImageGeneration string   `json:"sequentialImageGeneration"`
	MaxImages                 int      `json:"maxImages"`
	OptimizePromptMode        string   `json:"optimizePromptMode"`
	WebSearch                 bool     `json:"webSearch"`
	Concurrent                int      `json:"concurrent"`
	DownloadWidth             int      `json:"downloadWidth"`
}

package model

// AIImageRequest represents a request to an AI image generation API.
type AIImageRequest struct {
	N int `json:"n,omitempty"`
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
type 	AIImageResponse struct {
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

// ModelCapabilities describes API parameters accepted by a model.
type ModelCapabilities struct {
	SupportsImageInput         bool     `json:"supportsImageInput"`
	SupportsEdits              bool     `json:"supportsEdits"`
	SupportsSequential         bool     `json:"supportsSequential"`
	SupportsStream             bool     `json:"supportsStream"`
	SupportsGuidanceScale      bool     `json:"supportsGuidanceScale"`
	SupportsOutputFormat       bool     `json:"supportsOutputFormat"`
	SupportsWebSearch          bool     `json:"supportsWebSearch"`
	SupportsFastPromptOptimize bool     `json:"supportsFastPromptOptimize"`
	SupportsSeed               bool     `json:"supportsSeed"`
	SupportsWatermark          bool     `json:"supportsWatermark"`
	SupportsN                  bool     `json:"supportsN"`
	DefaultOutputFormat        string   `json:"defaultOutputFormat"`
	AllowedSizes               []string `json:"allowedSizes"`
	NMax                       int      `json:"nMax"`
}

// ModelInfo describes a single model offered by a provider.
type ModelInfo struct {
	ID           string            `json:"id"`
	Capabilities ModelCapabilities `json:"capabilities"`
}

// ProviderConfigResponse is returned to the frontend (API key masked).
type ProviderConfigResponse struct {
	HasAPIKey bool   `json:"hasApiKey"`
	BaseURL   string `json:"baseURL"`
}

// AIBatchRequest holds AI batch processing parameters.
type AIBatchRequest struct {
	Provider string `json:"provider"`
	N        int    `json:"n"`
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

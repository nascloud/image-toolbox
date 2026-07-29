package model

const (
	BuyerShowImportParent = "parent"
	BuyerShowImportSingle = "single"

	BuyerShowBasisWhiteBackground = "white_background"
	BuyerShowBasisExistingScene   = "existing_scene"

	BuyerShowSlotWhite = "white"
	BuyerShowSlotBuyer = "buyer"
)

// BuyerShowProduct contains optional details used to keep generated images accurate.
type BuyerShowProduct struct {
	Name     string `json:"name"`
	Material string `json:"material,omitempty"`
	Color    string `json:"color,omitempty"`
	Spec     string `json:"spec,omitempty"`
}

// BuyerShowScanRequest controls whether RootPath is a parent folder or one complete set.
type BuyerShowScanRequest struct {
	RootPath string `json:"rootPath"`
	Mode     string `json:"mode"`
}

// WhiteBackgroundAnalysis describes a local, non-AI background check.
type WhiteBackgroundAnalysis struct {
	IsWhiteBackground bool    `json:"isWhiteBackground"`
	Score             float64 `json:"score"`
	BorderWhiteRatio  float64 `json:"borderWhiteRatio"`
	CornerWhiteRatio  float64 `json:"cornerWhiteRatio"`
	OverallWhiteRatio float64 `json:"overallWhiteRatio"`
	ForegroundRatio   float64 `json:"foregroundRatio"`
	TransparentRatio  float64 `json:"transparentRatio"`
}

// BuyerShowImageCandidate is an imported image that is not currently assigned to a slot.
type BuyerShowImageCandidate struct {
	Path            string                  `json:"path"`
	FileName        string                  `json:"fileName"`
	WhiteBackground WhiteBackgroundAnalysis `json:"whiteBackground"`
}

// BuyerShowSlot is one of the six fixed card positions. Index 1 is optional white background;
// indexes 2-6 are buyer-show images.
type BuyerShowSlot struct {
	Index      int    `json:"index"`
	Role       string `json:"role"`
	SourcePath string `json:"sourcePath,omitempty"`
	OutputPath string `json:"outputPath,omitempty"`
	Revision   int    `json:"revision"`
	Status     string `json:"status"`
	Error      string `json:"error,omitempty"`
}

// BuyerShowSet is one complete buyer-show folder and its locally scanned content.
type BuyerShowSet struct {
	ID               string                    `json:"id"`
	Name             string                    `json:"name"`
	FolderPath       string                    `json:"folderPath"`
	ImageCount       int                       `json:"imageCount"`
	ReviewPath       string                    `json:"reviewPath,omitempty"`
	ReviewText       string                    `json:"reviewText"`
	Slots            []BuyerShowSlot           `json:"slots"`
	UnassignedImages []BuyerShowImageCandidate `json:"unassignedImages"`
	BasisMode        string                    `json:"basisMode"`
	BasisSlotIndex   int                       `json:"basisSlotIndex"`
	BasisSlotIndices []int                     `json:"basisSlotIndices,omitempty"`
	Warnings         []string                  `json:"warnings,omitempty"`
}

// BuyerShowScanResult contains all sets found without invoking any AI provider.
type BuyerShowScanResult struct {
	Sets     []BuyerShowSet `json:"sets"`
	Warnings []string       `json:"warnings,omitempty"`
}

// BuyerShowGenerationOptions are shared by batch generation and one-slot redraw.
type BuyerShowGenerationOptions struct {
	Provider       string `json:"provider"`
	Model          string `json:"model"`
	Size           string `json:"size"`
	Quality        string `json:"quality,omitempty"`
	OutputFormat   string `json:"outputFormat,omitempty"`
	Watermark      bool   `json:"watermark"`
	Seed           int    `json:"seed"`
	Concurrent     int    `json:"concurrent"`
	OutputDir      string `json:"outputDir,omitempty"`
	GlobalPrompt   string `json:"globalPrompt,omitempty"`
	NegativePrompt string `json:"negativePrompt,omitempty"`
}

// BuyerShowGenerateSet is a snapshot of one set at generation start.
type BuyerShowGenerateSet struct {
	SetID            string           `json:"setId"`
	SetName          string           `json:"setName"`
	FolderPath       string           `json:"folderPath"`
	ReviewText       string           `json:"reviewText"`
	Product          BuyerShowProduct `json:"product"`
	BasisMode        string           `json:"basisMode"`
	BasisSlotIndex   int              `json:"basisSlotIndex"`
	BasisSlotIndices []int            `json:"basisSlotIndices,omitempty"`
	Slots            []BuyerShowSlot  `json:"slots"`
}

// BuyerShowBatchRequest generates buyer-show slots 2-6 for every set.
type BuyerShowBatchRequest struct {
	BatchID string                     `json:"batchId,omitempty"`
	Options BuyerShowGenerationOptions `json:"options"`
	Sets    []BuyerShowGenerateSet     `json:"sets"`
}

// BuyerShowRedrawRequest regenerates exactly one buyer-show slot.
type BuyerShowRedrawRequest struct {
	BatchID         string                     `json:"batchId,omitempty"`
	Options         BuyerShowGenerationOptions `json:"options"`
	Set             BuyerShowGenerateSet       `json:"set"`
	TargetSlotIndex int                        `json:"targetSlotIndex"`
	ExtraPrompt     string                     `json:"extraPrompt,omitempty"`
}

// BuyerShowSlotResult reports one isolated image task.
type BuyerShowSlotResult struct {
	SetID      string `json:"setId"`
	SlotIndex  int    `json:"slotIndex"`
	SourcePath string `json:"sourcePath,omitempty"`
	OutputPath string `json:"outputPath,omitempty"`
	Revision   int    `json:"revision"`
	Success    bool   `json:"success"`
	Error      string `json:"error,omitempty"`
}

// BuyerShowBatchResult aggregates isolated slot results.
type BuyerShowBatchResult struct {
	Total   int                   `json:"total"`
	Success int                   `json:"success"`
	Failed  int                   `json:"failed"`
	Results []BuyerShowSlotResult `json:"results"`
	Error   string                `json:"error,omitempty"`
}

// BuyerShowProgressUpdate identifies a set and fixed slot.
type BuyerShowProgressUpdate struct {
	BatchID   string               `json:"batchId,omitempty"`
	SetID     string               `json:"setId,omitempty"`
	SlotIndex int                  `json:"slotIndex,omitempty"`
	Completed int                  `json:"completed"`
	Total     int                  `json:"total"`
	Done      bool                 `json:"done"`
	Error     string               `json:"error,omitempty"`
	Result    *BuyerShowSlotResult `json:"result,omitempty"`
}

// BuyerShowReviewRewriteRequest rewrites only the current review text.
type BuyerShowReviewRewriteRequest struct {
	Provider   string `json:"provider"`
	ReviewText string `json:"reviewText"`
	Tone       string `json:"tone,omitempty"`
	MaxChars   int    `json:"maxChars,omitempty"`
}

// BuyerShowReviewRewriteResult contains editable text; it does not write the source file.
type BuyerShowReviewRewriteResult struct {
	Original  string `json:"original"`
	Rewritten string `json:"rewritten"`
}

package model

// ProgressUpdate is sent back to the frontend during batch processing.
type ProgressUpdate struct {
	Completed int    `json:"completed"`
	Total     int    `json:"total"`
	Current   string `json:"current"`
	Error     string `json:"error,omitempty"`
	Done      bool   `json:"done"`
}

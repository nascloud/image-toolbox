package ai

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DownloadImage downloads an image from URL and returns the bytes.
func DownloadImage(url string) ([]byte, error) {
	return DownloadImageWithContext(context.Background(), url)
}

// DownloadImageWithContext downloads an image from URL and returns the bytes.
func DownloadImageWithContext(ctx context.Context, url string) ([]byte, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create download request: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read download: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("download HTTP %d: %s", resp.StatusCode, string(data))
	}
	return data, nil
}

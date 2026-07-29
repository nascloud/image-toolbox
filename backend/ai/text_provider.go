package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const maxTextResponseBytes = 2 << 20

// OpenAICompatibleTextProvider calls an explicitly configured plain-text chat endpoint.
type OpenAICompatibleTextProvider struct {
	apiKey     string
	endpoint   string
	httpClient *http.Client
}

func NewOpenAICompatibleTextProvider(apiKey, endpoint string) *OpenAICompatibleTextProvider {
	return &OpenAICompatibleTextProvider{
		apiKey:     apiKey,
		endpoint:   strings.TrimSpace(endpoint),
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// Rewrite sends a non-streaming chat-completions request and returns plain text.
func (p *OpenAICompatibleTextProvider) Rewrite(ctx context.Context, modelID, systemPrompt, input string) (string, error) {
	if p.endpoint == "" {
		return "", fmt.Errorf("未配置评价重写 Endpoint")
	}
	if strings.TrimSpace(modelID) == "" {
		return "", fmt.Errorf("未配置评价重写模型")
	}
	payload, err := json.Marshal(map[string]any{
		"model": modelID,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": input},
		},
		"temperature": 0.7,
		"stream":      false,
	})
	if err != nil {
		return "", fmt.Errorf("marshal text request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", fmt.Errorf("create text request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("评价重写请求失败：%w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxTextResponseBytes+1))
	if err != nil {
		return "", fmt.Errorf("读取评价响应失败：%w", err)
	}
	if len(body) > maxTextResponseBytes {
		return "", fmt.Errorf("评价响应过大")
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析评价响应失败：%w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if result.Error != nil && result.Error.Message != "" {
			return "", fmt.Errorf("评价 API 错误：%s", result.Error.Message)
		}
		return "", fmt.Errorf("评价 API HTTP %d", resp.StatusCode)
	}
	if len(result.Choices) == 0 {
		return "", fmt.Errorf("评价 API 未返回文本")
	}
	text := cleanPlainText(result.Choices[0].Message.Content)
	if text == "" {
		return "", fmt.Errorf("评价 API 返回空文本")
	}
	return text, nil
}

func cleanPlainText(text string) string {
	text = strings.TrimSpace(text)
	text = strings.TrimPrefix(text, "```text")
	text = strings.TrimPrefix(text, "```plaintext")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	if len(text) >= 2 {
		pairs := [][2]string{{"\"", "\""}, {"“", "”"}, {"'", "'"}}
		for _, pair := range pairs {
			if strings.HasPrefix(text, pair[0]) && strings.HasSuffix(text, pair[1]) {
				text = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(text, pair[0]), pair[1]))
				break
			}
		}
	}
	return text
}

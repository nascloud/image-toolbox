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
	apiKey          string
	endpoint        string
	reasoningEffort string
	httpClient      *http.Client
}

func NewOpenAICompatibleTextProvider(apiKey, endpoint, reasoningEffort string) *OpenAICompatibleTextProvider {
	return &OpenAICompatibleTextProvider{
		apiKey:          apiKey,
		endpoint:        strings.TrimSpace(endpoint),
		reasoningEffort: strings.TrimSpace(reasoningEffort),
		httpClient:      &http.Client{Timeout: 60 * time.Second},
	}
}

// Rewrite sends a non-streaming request and returns plain text.
func (p *OpenAICompatibleTextProvider) Rewrite(ctx context.Context, modelID, systemPrompt, input string) (string, error) {
	if p.endpoint == "" {
		return "", fmt.Errorf("未配置评价重写 Endpoint")
	}
	if strings.TrimSpace(modelID) == "" {
		return "", fmt.Errorf("未配置评价重写模型")
	}
	if strings.HasSuffix(strings.TrimRight(p.endpoint, "/"), "/responses") {
		return p.rewriteResponses(ctx, modelID, systemPrompt, input)
	}
	return p.rewriteChatCompletions(ctx, modelID, systemPrompt, input)
}

func (p *OpenAICompatibleTextProvider) rewriteResponses(ctx context.Context, modelID, systemPrompt, input string) (string, error) {
	payload := map[string]any{
		"model":        modelID,
		"instructions": systemPrompt,
		"input":        input,
		"stream":       false,
	}
	if p.reasoningEffort != "" {
		payload["reasoning"] = map[string]string{"effort": p.reasoningEffort}
	}
	body, statusCode, err := p.doTextRequest(ctx, payload)
	if err != nil {
		return "", err
	}

	var result struct {
		OutputText string `json:"output_text,omitempty"`
		Output     []struct {
			Type    string `json:"type"`
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", fmt.Errorf("解析评价响应失败：%w", err)
	}
	if statusCode < 200 || statusCode >= 300 {
		return "", textAPIError(statusCode, result.Error)
	}

	text := cleanPlainText(result.OutputText)
	if text == "" {
		for _, item := range result.Output {
			if item.Type != "message" {
				continue
			}
			for _, content := range item.Content {
				if content.Type == "output_text" {
					text = cleanPlainText(content.Text)
					if text != "" {
						return text, nil
					}
				}
			}
		}
	}
	if text == "" {
		return "", fmt.Errorf("评价 API 未返回文本")
	}
	return text, nil
}

func (p *OpenAICompatibleTextProvider) rewriteChatCompletions(ctx context.Context, modelID, systemPrompt, input string) (string, error) {
	payload := map[string]any{
		"model": modelID,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": input},
		},
		"temperature": 0.7,
		"stream":      false,
	}
	body, statusCode, err := p.doTextRequest(ctx, payload)
	if err != nil {
		return "", err
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
	if statusCode < 200 || statusCode >= 300 {
		return "", textAPIError(statusCode, result.Error)
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

func (p *OpenAICompatibleTextProvider) doTextRequest(ctx context.Context, payloadFields map[string]any) ([]byte, int, error) {
	payload, err := json.Marshal(payloadFields)
	if err != nil {
		return nil, 0, fmt.Errorf("marshal text request: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.endpoint, bytes.NewReader(payload))
	if err != nil {
		return nil, 0, fmt.Errorf("create text request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, 0, fmt.Errorf("评价重写请求失败：%w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxTextResponseBytes+1))
	if err != nil {
		return nil, 0, fmt.Errorf("读取评价响应失败：%w", err)
	}
	if len(body) > maxTextResponseBytes {
		return nil, 0, fmt.Errorf("评价响应过大")
	}
	return body, resp.StatusCode, nil
}

func textAPIError(statusCode int, apiError *struct {
	Message string `json:"message"`
}) error {
	if apiError != nil && apiError.Message != "" {
		return fmt.Errorf("评价 API 错误：%s", apiError.Message)
	}
	return fmt.Errorf("评价 API HTTP %d", statusCode)
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

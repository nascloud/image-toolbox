package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"image-toolbox/backend/model"
)

func TestOpenAICompatibleTextProviderRewrite(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer sk-test" {
			t.Fatalf("authorization = %q", request.Header.Get("Authorization"))
		}
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["model"] != "review-model" {
			t.Fatalf("model = %v", payload["model"])
		}
		if payload["temperature"] != 0.7 {
			t.Fatalf("temperature = %v", payload["temperature"])
		}
		if _, exists := payload["reasoning"]; exists {
			t.Fatalf("chat completions payload must not contain reasoning: %v", payload["reasoning"])
		}
		writer.Header().Set("Content-Type", "application/json")
		response := map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": "```text\n真的挺好用，细节也不错。\n```"}}},
		}
		if err := json.NewEncoder(writer).Encode(response); err != nil {
			t.Fatal(err)
		}
	}))
	defer server.Close()

	provider := NewOpenAICompatibleTextProvider("sk-test", server.URL, "")
	result, err := provider.Rewrite(context.Background(), "review-model", "system", "input")
	if err != nil {
		t.Fatalf("Rewrite() error = %v", err)
	}
	if result != "真的挺好用，细节也不错。" {
		t.Fatalf("result = %q", result)
	}
}

func TestOpenAICompatibleTextProviderRewriteResponses(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/v1/responses" {
			t.Fatalf("path = %q", request.URL.Path)
		}
		var payload map[string]any
		if err := json.NewDecoder(request.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["model"] != "gpt-5.6-sol" {
			t.Fatalf("model = %v", payload["model"])
		}
		if payload["instructions"] != "system" || payload["input"] != "input" {
			t.Fatalf("unexpected Responses input: %#v", payload)
		}
		reasoning, ok := payload["reasoning"].(map[string]any)
		if !ok || reasoning["effort"] != "medium" {
			t.Fatalf("reasoning = %#v", payload["reasoning"])
		}
		if _, exists := payload["temperature"]; exists {
			t.Fatalf("Responses payload must omit temperature: %v", payload["temperature"])
		}
		if _, exists := payload["messages"]; exists {
			t.Fatalf("Responses payload must omit messages: %v", payload["messages"])
		}
		writer.Header().Set("Content-Type", "application/json")
		response := map[string]any{
			"output": []map[string]any{{
				"type": "message",
				"content": []map[string]string{{
					"type": "output_text",
					"text": "```text\n改写后的真实评价。\n```",
				}},
			}},
		}
		if err := json.NewEncoder(writer).Encode(response); err != nil {
			t.Fatal(err)
		}
	}))
	defer server.Close()

	provider := NewOpenAICompatibleTextProvider("sk-test", server.URL+"/v1/responses", "medium")
	result, err := provider.Rewrite(context.Background(), "gpt-5.6-sol", "system", "input")
	if err != nil {
		t.Fatalf("Rewrite() error = %v", err)
	}
	if result != "改写后的真实评价。" {
		t.Fatalf("result = %q", result)
	}
}

func TestBuildBuyerShowPromptRequiresBasis(t *testing.T) {
	if _, err := BuildBuyerShowPrompt("", "", modelProduct(), 2, ""); err == nil {
		t.Fatal("BuildBuyerShowPrompt() accepted empty basis")
	}
}

func TestBuildBuyerShowPromptUsesMultipleSceneAnchors(t *testing.T) {
	prompt, err := BuildBuyerShowPromptWithReferences("统一自然光", model.BuyerShowBasisExistingScene, modelProduct(), 3, 3, "")
	if err != nil {
		t.Fatalf("BuildBuyerShowPrompt() error = %v", err)
	}
	for _, expected := range []string{
		"输入的 3 张已有场景图",
		"同一真实空间",
		"锁定可见的墙面、地板",
		"整套五图应有明显差异",
		"低机位侧向中景",
		"全局补充要求：统一自然光",
	} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q:\n%s", expected, prompt)
		}
	}
	for _, forbidden := range []string{"评价仅作为使用感受", "放在厨房很方便"} {
		if strings.Contains(prompt, forbidden) {
			t.Fatalf("prompt unexpectedly contains %q:\n%s", forbidden, prompt)
		}
	}
}

func TestBuildBuyerShowPromptAssignsDistinctSameSceneShots(t *testing.T) {
	plans := []struct {
		slot int
		want string
	}{
		{slot: 2, want: "45 度平视全景"},
		{slot: 3, want: "低机位侧向中景"},
		{slot: 4, want: "结构、材质或关键部件近景"},
		{slot: 5, want: "轻俯视或不同高度的 45 度中远景"},
		{slot: 6, want: "真实使用状态中景"},
	}
	for _, plan := range plans {
		prompt, err := BuildBuyerShowPrompt("", model.BuyerShowBasisExistingScene, modelProduct(), plan.slot, "")
		if err != nil {
			t.Fatalf("slot %d error = %v", plan.slot, err)
		}
		for _, expected := range []string{"同一真实空间", "整套五图应有明显差异", "禁止复用同一机位", plan.want} {
			if !strings.Contains(prompt, expected) {
				t.Fatalf("slot %d prompt missing %q:\n%s", plan.slot, expected, prompt)
			}
		}
	}
}

func modelProduct() model.BuyerShowProduct {
	return model.BuyerShowProduct{Name: "工具柜", Color: "军绿色"}
}

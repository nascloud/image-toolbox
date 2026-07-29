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
		writer.Header().Set("Content-Type", "application/json")
		response := map[string]any{
			"choices": []map[string]any{{"message": map[string]string{"content": "```text\n真的挺好用，细节也不错。\n```"}}},
		}
		if err := json.NewEncoder(writer).Encode(response); err != nil {
			t.Fatal(err)
		}
	}))
	defer server.Close()

	provider := NewOpenAICompatibleTextProvider("sk-test", server.URL)
	result, err := provider.Rewrite(context.Background(), "review-model", "system", "input")
	if err != nil {
		t.Fatalf("Rewrite() error = %v", err)
	}
	if result != "真的挺好用，细节也不错。" {
		t.Fatalf("result = %q", result)
	}
}

func TestBuildBuyerShowPromptRequiresBasis(t *testing.T) {
	if _, err := BuildBuyerShowPrompt("", "", "", modelProduct(), 2, ""); err == nil {
		t.Fatal("BuildBuyerShowPrompt() accepted empty basis")
	}
}

func TestBuildBuyerShowPromptUsesMultipleSceneAnchors(t *testing.T) {
	prompt, err := BuildBuyerShowPromptWithReferences("统一自然光", "放在厨房很方便", model.BuyerShowBasisExistingScene, modelProduct(), 3, 3, "")
	if err != nil {
		t.Fatalf("BuildBuyerShowPrompt() error = %v", err)
	}
	for _, expected := range []string{"输入的 3 张已有场景图", "第一张图为主要场景锚点", "保持同一房间", "本图要求：真实居家或日常使用场景", "评价仅作为使用感受", "全局补充要求：统一自然光"} {
		if !strings.Contains(prompt, expected) {
			t.Fatalf("prompt missing %q:\n%s", expected, prompt)
		}
	}
}

func modelProduct() model.BuyerShowProduct {
	return model.BuyerShowProduct{Name: "工具柜", Color: "军绿色"}
}

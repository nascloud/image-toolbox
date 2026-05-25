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

func TestChatGPT2APIGenerateGenerations(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/v1/images/generations") {
			t.Fatalf("expected /v1/images/generations, got %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing or wrong auth header")
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "gpt-image-2" {
			t.Errorf("expected model gpt-image-2, got %v", req["model"])
		}
		if req["prompt"] != "test prompt" {
			t.Errorf("expected prompt, got %v", req["prompt"])
		}
		if req["n"] != float64(2) {
			t.Errorf("expected n=2, got %v", req["n"])
		}
		if req["response_format"] != "b64_json" {
			t.Errorf("expected response_format b64_json, got %v", req["response_format"])
		}
		if _, ok := req["image"]; ok {
			t.Error("did not expect image for generations")
		}
		if _, ok := req["images"]; ok {
			t.Error("did not expect images for generations")
		}

		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: "dGVzdC1pbWFnZS0x"},
				{B64JSON: "dGVzdC1pbWFnZS0y"},
			},
		})
	}))
	defer server.Close()

	p := NewChatGPT2APIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "test prompt",
		N:      2,
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("expected 2 results, got %d", len(resp.Data))
	}
}

func TestChatGPT2APIGenerateEdits(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/v1/images/edits") {
			t.Fatalf("expected /v1/images/edits, got %s", r.URL.Path)
		}
		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "gpt-image-2" {
			t.Errorf("expected model gpt-image-2, got %v", req["model"])
		}
		if req["prompt"] != "edit prompt" {
			t.Errorf("expected prompt, got %v", req["prompt"])
		}
		images, ok := req["images"].([]any)
		if !ok {
			t.Fatal("expected images array")
		}
		if len(images) != 2 {
			t.Fatalf("expected 2 images, got %d", len(images))
		}
		img0 := images[0].(map[string]any)
		if _, ok := img0["image_url"]; !ok {
			t.Error("expected image_url in images[0]")
		}
		if _, ok := req["response_format"]; ok {
			t.Error("did not expect response_format in edits JSON body")
		}

		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{B64JSON: "ZWRpdGVkLWltYWdl"},
			},
		})
	}))
	defer server.Close()

	p := NewChatGPT2APIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:           "gpt-image-2",
		Prompt:          "edit prompt",
		Image:           "data:image/png;base64,aW5wdXQ=",
		ReferenceImages: []string{"data:image/png;base64,cmVmMQ=="},
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
}

func TestChatGPT2APIModels(t *testing.T) {
	p := NewChatGPT2APIProvider("test-key", "")
	models := p.Models()
	if len(models) == 0 {
		t.Fatal("expected at least one model")
	}
	found := false
	for _, m := range models {
		if m.ID == "gpt-image-2" {
			found = true
			if !m.Capabilities.SupportsImageInput {
				t.Error("gpt-image-2 should support image input")
			}
			if !m.Capabilities.SupportsEdits {
				t.Error("gpt-image-2 should support edits")
			}
			if !m.Capabilities.SupportsN {
				t.Error("gpt-image-2 should support N")
			}
			if m.Capabilities.NMax != 4 {
				t.Errorf("expected NMax 4, got %d", m.Capabilities.NMax)
			}
		}
	}
	if !found {
		t.Fatal("expected gpt-image-2 in models")
	}
}

func TestChatGPT2APIErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]any{
			"error": map[string]any{
				"code":    "invalid_prompt",
				"message": "Prompt too long",
			},
		})
	}))
	defer server.Close()

	p := NewChatGPT2APIProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "this is a very long prompt that will fail",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "invalid_prompt") {
		t.Fatalf("expected error code in message, got: %v", err)
	}
}

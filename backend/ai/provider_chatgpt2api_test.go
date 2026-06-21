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
		ct := r.Header.Get("Content-Type")
		if !strings.HasPrefix(ct, "multipart/form-data") {
			t.Fatalf("expected multipart/form-data, got %s", ct)
		}

		if err := r.ParseMultipartForm(10 << 20); err != nil {
			t.Fatalf("parse multipart: %v", err)
		}

		if r.FormValue("model") != "gpt-image-2" {
			t.Errorf("expected model gpt-image-2, got %v", r.FormValue("model"))
		}
		if r.FormValue("prompt") != "edit prompt" {
			t.Errorf("expected prompt, got %v", r.FormValue("prompt"))
		}
		if r.FormValue("response_format") != "b64_json" {
			t.Errorf("expected response_format b64_json, got %v", r.FormValue("response_format"))
		}

		// Check image files were uploaded (main image + reference images share "image" field)
		imageFiles := r.MultipartForm.File["image"]
		if len(imageFiles) != 2 {
			t.Fatalf("expected 2 image files (1 main + 1 ref), got %d", len(imageFiles))
		}

		// First file is the main input image
		mainFile, err := imageFiles[0].Open()
		if err != nil {
			t.Fatalf("open main image: %v", err)
		}
		mainFile.Close()

		// Second file is the reference image
		refFile, err := imageFiles[1].Open()
		if err != nil {
			t.Fatalf("open ref image: %v", err)
		}
		refBuf := make([]byte, 4)
		refFile.Read(refBuf)
		refFile.Close()
		if string(refBuf) != "ref1" {
			t.Errorf("expected ref image content, got %x", refBuf)
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

func TestChatGPT2APIGenerateEditsRejectsInvalidInputImage(t *testing.T) {
	p := NewChatGPT2APIProvider("test-key", "http://127.0.0.1:1")

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "edit prompt",
		Image:  "not-a-data-uri",
	})
	if err == nil {
		t.Fatal("expected invalid input image error")
	}
	if !strings.Contains(err.Error(), "decode input image") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestChatGPT2APIModels(t *testing.T) {
	p := NewChatGPT2APIProvider("test-key", "")
	models := p.Models()
	if len(models) == 0 {
		t.Fatal("expected at least one model")
	}
	foundImage2 := false
	foundGPT5 := false
	for _, m := range models {
		switch m.ID {
		case "gpt-image-2":
			foundImage2 = true
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
		case "gpt-5":
			foundGPT5 = true
			if !m.Capabilities.SupportsImageInput {
				t.Error("gpt-5 should support image input")
			}
			if !m.Capabilities.SupportsEdits {
				t.Error("gpt-5 should support edits")
			}
		}
	}
	if !foundImage2 {
		t.Fatal("expected gpt-image-2 in models")
	}
	if !foundGPT5 {
		t.Fatal("expected gpt-5 in models")
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

package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"image-toolbox/backend/model"
)

func TestOpenAIGenerateGenerations(t *testing.T) {
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
		if req["prompt"] != "test prompt\n\nAspect ratio: 16:9." {
			t.Errorf("expected prompt, got %v", req["prompt"])
		}
		if req["n"] != float64(2) {
			t.Errorf("expected n=2, got %v", req["n"])
		}
		if req["quality"] != "high" {
			t.Errorf("expected quality high, got %v", req["quality"])
		}
		if req["output_format"] != "png" {
			t.Errorf("expected output_format png, got %v", req["output_format"])
		}
		if _, ok := req["response_format"]; ok {
			t.Errorf("did not expect response_format for gpt-image-* models")
		}
		if _, ok := req["size"]; ok {
			t.Errorf("did not expect size field")
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

	p := NewOpenAIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:        "gpt-image-2",
		Prompt:       "test prompt",
		N:            2,
		Size:         "16:9",
		Quality:      "high",
		OutputFormat: "png",
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 2 {
		t.Fatalf("expected 2 results, got %d", len(resp.Data))
	}
}

func TestOpenAIGenerateGenerationsWithV1BaseURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/generations" {
			t.Fatalf("expected /v1/images/generations, got %s", r.URL.Path)
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
			}{{B64JSON: "dGVzdA=="}},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL+"/v1")
	resp, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "test prompt",
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
}

func TestOpenAIGenerateNonGPTImageKeepsResponseFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req["response_format"] != "url" {
			t.Fatalf("expected response_format url, got %v", req["response_format"])
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
			}{{URL: "https://example.com/image.png"}},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)
	if _, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:          "custom-image-model",
		Prompt:         "test prompt",
		ResponseFormat: "url",
	}); err != nil {
		t.Fatal(err)
	}
}

func TestOpenAIGenerateAllowsConcurrentRequests(t *testing.T) {
	var active int32
	var maxActive int32
	allStarted := make(chan struct{})
	var started int32

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		current := atomic.AddInt32(&active, 1)
		for {
			max := atomic.LoadInt32(&maxActive)
			if current <= max || atomic.CompareAndSwapInt32(&maxActive, max, current) {
				break
			}
		}
		if atomic.AddInt32(&started, 1) == 3 {
			close(allStarted)
		}

		select {
		case <-allStarted:
		case <-time.After(time.Second):
			t.Error("requests did not run concurrently")
		}
		atomic.AddInt32(&active, -1)

		json.NewEncoder(w).Encode(model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{{B64JSON: "dGVzdA=="}},
		})
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)

	var wg sync.WaitGroup
	for i := 0; i < 3; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := p.Generate(context.Background(), model.AIImageRequest{
				Model:  "gpt-image-2",
				Prompt: "test prompt",
			}); err != nil {
				t.Errorf("generate: %v", err)
			}
		}()
	}
	wg.Wait()

	if got := atomic.LoadInt32(&maxActive); got != 3 {
		t.Fatalf("expected 3 concurrent requests, max active = %d", got)
	}
}

func TestOpenAINonJSONErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte("Bad Gateway"))
	}))
	defer server.Close()

	p := NewOpenAIProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:  "gpt-image-2",
		Prompt: "test prompt",
	})
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "HTTP 502: non-JSON response: Bad Gateway") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestOpenAIGenerateEdits(t *testing.T) {
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
		if r.FormValue("output_format") != "png" {
			t.Errorf("expected output_format png, got %v", r.FormValue("output_format"))
		}
		if r.FormValue("response_format") != "" {
			t.Errorf("did not expect response_format for gpt-image-* models")
		}

		imageFiles := r.MultipartForm.File["image[]"]
		if len(imageFiles) != 3 {
			t.Fatalf("expected 3 image files (1 main + 2 refs), got %d", len(imageFiles))
		}

		expectedContents := []string{"input", "ref1", "ref2"}
		for index, imageFile := range imageFiles {
			file, err := imageFile.Open()
			if err != nil {
				t.Fatalf("open image %d: %v", index, err)
			}
			content := make([]byte, len(expectedContents[index]))
			if _, err := file.Read(content); err != nil {
				file.Close()
				t.Fatalf("read image %d: %v", index, err)
			}
			file.Close()
			if string(content) != expectedContents[index] {
				t.Errorf("image %d content = %q, want %q", index, content, expectedContents[index])
			}
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

	p := NewOpenAIProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:           "gpt-image-2",
		Prompt:          "edit prompt",
		Image:           "data:image/png;base64,aW5wdXQ=",
		ReferenceImages: []string{"data:image/png;base64,cmVmMQ==", "data:image/png;base64,cmVmMg=="},
		OutputFormat:    "png",
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
}

func TestOpenAIGenerateEditsRejectsInvalidInputImage(t *testing.T) {
	p := NewOpenAIProvider("test-key", "http://127.0.0.1:1")

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

func TestOpenAIModels(t *testing.T) {
	p := NewOpenAIProvider("test-key", "http://127.0.0.1:1")
	models, err := p.Models(context.Background())
	if err != nil {
		t.Fatal(err)
	}
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
			if m.Capabilities.NMax != 10 {
				t.Errorf("expected NMax 10, got %d", m.Capabilities.NMax)
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

func TestOpenAIErrorResponse(t *testing.T) {
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

	p := NewOpenAIProvider("test-key", server.URL)

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

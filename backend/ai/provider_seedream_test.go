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

func TestSeedreamGenerateImage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("missing or wrong auth header")
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Error("wrong content type")
		}

		var req map[string]any
		json.NewDecoder(r.Body).Decode(&req)
		if req["model"] != "test-model" {
			t.Errorf("expected model test-model, got %v", req["model"])
		}
		if req["prompt"] != "test prompt" {
			t.Errorf("expected prompt 'test prompt', got %v", req["prompt"])
		}
		if req["response_format"] != "url" {
			t.Errorf("expected response_format url, got %v", req["response_format"])
		}
		if _, ok := req["responseFormat"]; ok {
			t.Error("did not expect camelCase responseFormat")
		}

		resp := model.AIImageResponse{
			Data: []struct {
				URL     string `json:"url,omitempty"`
				B64JSON string `json:"b64_json,omitempty"`
				Size    string `json:"size,omitempty"`
				Error   *struct {
					Code    string `json:"code"`
					Message string `json:"message"`
				} `json:"error,omitempty"`
			}{
				{URL: "http://example.com/img.png", Size: "1024x1024"},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	req := model.AIImageRequest{
		Model:  "test-model",
		Prompt: "test prompt",
		Size:   "1024x1024",
	}

	resp, err := p.Generate(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if len(resp.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(resp.Data))
	}
	if resp.Data[0].URL != "http://example.com/img.png" {
		t.Errorf("expected URL, got %v", resp.Data[0].URL)
	}
}

func TestSeedreamGenerateAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(model.AIImageResponse{
			Error: &struct {
				Code    string `json:"code"`
				Message string `json:"message"`
			}{Code: "unauthorized", Message: "Invalid API key"},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("bad-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model: "test", Prompt: "test", Size: "1024x1024",
	})
	if err == nil {
		t.Fatal("expected error for unauthorized, got nil")
	}
}

func TestSeedreamIncludesGuidanceScaleForSupportedModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req["guidance_scale"] != 2.5 {
			t.Fatalf("expected guidance_scale 2.5, got %v", req["guidance_scale"])
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
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:         "doubao-seedream-3-0-t2i-250415",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsGuidanceScaleForUnsupportedModel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["guidance_scale"]; ok {
			t.Fatalf("did not expect guidance_scale for unsupported model: %+v", req)
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
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:         "doubao-seedream-5-0-lite-260128",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsUnsupportedOutputFormat(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["output_format"]; ok {
			t.Fatalf("did not expect output_format for Seedream 4.5: %+v", req)
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
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:        "doubao-seedream-4-5-251128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamIncludesOutputFormatForSeedream5(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if req["output_format"] != "png" {
			t.Fatalf("expected output_format png, got %v", req["output_format"])
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
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:        "doubao-seedream-5-0-lite-260128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamOmitsImageAndSequentialForSeedream3(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]any
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if _, ok := req["image"]; ok {
			t.Fatalf("did not expect image for Seedream 3.0: %+v", req)
		}
		if _, ok := req["sequential_image_generation"]; ok {
			t.Fatalf("did not expect sequential_image_generation for Seedream 3.0: %+v", req)
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
			}{{URL: "http://example.com/img.png"}},
		})
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)

	_, err := p.Generate(context.Background(), model.AIImageRequest{
		Model:                     "doubao-seedream-3-0-t2i-250415",
		Prompt:                    "test",
		Size:                      "2K",
		Image:                     "data:image/png;base64,abc",
		ReferenceImages:           []string{"data:image/png;base64,def"},
		SequentialImageGeneration: "auto",
		MaxImages:                 4,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestSeedreamModels(t *testing.T) {
	p := NewSeedreamProvider("test-key", "")
	models := p.Models()
	if len(models) != 4 {
		t.Fatalf("expected 4 models, got %d", len(models))
	}

	expected := map[string]struct {
		hasImageInput bool
		hasSequential bool
		hasStream     bool
		hasSeed       bool
		hasOutputFmt  bool
		hasWebSearch  bool
		hasGuidance   bool
		hasPromptOpt  bool
		hasWatermark  bool
		sizes         int
	}{
		"doubao-seedream-5-0-260128": {
			hasImageInput: true, hasSequential: true, hasStream: true,
			hasSeed: true, hasOutputFmt: true, hasWebSearch: true, hasWatermark: true,
			sizes: 3,
		},
		"doubao-seedream-4-5-250130": {
			hasImageInput: true, hasSequential: true, hasStream: true,
			hasSeed: true, hasWatermark: true,
			sizes: 4,
		},
		"doubao-seedream-4-0-250130": {
			hasImageInput: true, hasSequential: true, hasStream: true,
			hasSeed: true, hasPromptOpt: true, hasWatermark: true,
			sizes: 4,
		},
		"doubao-seedream-3-0-t2i-250115": {
			hasGuidance: true,
			sizes:       2,
		},
	}

	for _, m := range models {
		exp, ok := expected[m.ID]
		if !ok {
			t.Errorf("unexpected model: %s", m.ID)
			continue
		}
		if m.Capabilities.SupportsImageInput != exp.hasImageInput {
			t.Errorf("%s: SupportsImageInput=%v, want %v", m.ID, m.Capabilities.SupportsImageInput, exp.hasImageInput)
		}
		if m.Capabilities.SupportsSequential != exp.hasSequential {
			t.Errorf("%s: SupportsSequential=%v, want %v", m.ID, m.Capabilities.SupportsSequential, exp.hasSequential)
		}
		if m.Capabilities.SupportsStream != exp.hasStream {
			t.Errorf("%s: SupportsStream=%v, want %v", m.ID, m.Capabilities.SupportsStream, exp.hasStream)
		}
		if m.Capabilities.SupportsSeed != exp.hasSeed {
			t.Errorf("%s: SupportsSeed=%v, want %v", m.ID, m.Capabilities.SupportsSeed, exp.hasSeed)
		}
		if m.Capabilities.SupportsOutputFormat != exp.hasOutputFmt {
			t.Errorf("%s: SupportsOutputFormat=%v, want %v", m.ID, m.Capabilities.SupportsOutputFormat, exp.hasOutputFmt)
		}
		if m.Capabilities.SupportsWebSearch != exp.hasWebSearch {
			t.Errorf("%s: SupportsWebSearch=%v, want %v", m.ID, m.Capabilities.SupportsWebSearch, exp.hasWebSearch)
		}
		if m.Capabilities.SupportsGuidanceScale != exp.hasGuidance {
			t.Errorf("%s: SupportsGuidanceScale=%v, want %v", m.ID, m.Capabilities.SupportsGuidanceScale, exp.hasGuidance)
		}
		if m.Capabilities.SupportsFastPromptOptimize != exp.hasPromptOpt {
			t.Errorf("%s: SupportsFastPromptOptimize=%v, want %v", m.ID, m.Capabilities.SupportsFastPromptOptimize, exp.hasPromptOpt)
		}
		if m.Capabilities.SupportsWatermark != exp.hasWatermark {
			t.Errorf("%s: SupportsWatermark=%v, want %v", m.ID, m.Capabilities.SupportsWatermark, exp.hasWatermark)
		}
		if len(m.Capabilities.AllowedSizes) != exp.sizes {
			t.Errorf("%s: AllowedSizes count=%d, want %d", m.ID, len(m.Capabilities.AllowedSizes), exp.sizes)
		}
		if m.Capabilities.DefaultOutputFormat != "jpeg" {
			t.Errorf("%s: DefaultOutputFormat=%s, want jpeg", m.ID, m.Capabilities.DefaultOutputFormat)
		}
	}
}

func TestSeedreamGenerateWithContextCancel(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("request should not have been sent")
	}))
	defer server.Close()

	p := NewSeedreamProvider("test-key", server.URL)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := p.Generate(ctx, model.AIImageRequest{
		Model:  "doubao-seedream-5-0-260128",
		Prompt: "test",
		Size:   "2K",
	})
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
	if !strings.Contains(err.Error(), context.Canceled.Error()) {
		t.Fatalf("expected context canceled error, got: %v", err)
	}
}

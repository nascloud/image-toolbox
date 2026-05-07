package ai

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"image-toolbox/backend/model"
)

func TestGenerateImage(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	req := model.AIImageRequest{
		Model:  "test-model",
		Prompt: "test prompt",
		Size:   "1024x1024",
	}

	resp, err := client.Generate(req)
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

func TestGenerateImageAPIError(t *testing.T) {
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

	client := NewClient("bad-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model: "test", Prompt: "test", Size: "1024x1024",
	})
	if err == nil {
		t.Fatal("expected error for unauthorized, got nil")
	}
}

func TestGenerateIncludesGuidanceScaleForSupportedModel(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model:         "doubao-seedream-3-0-t2i-250415",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGenerateOmitsGuidanceScaleForUnsupportedModel(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model:         "doubao-seedream-5-0-lite-260128",
		Prompt:        "test",
		Size:          "1024x1024",
		GuidanceScale: 2.5,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGenerateOmitsUnsupportedOutputFormat(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model:        "doubao-seedream-4-5-251128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGenerateIncludesOutputFormatForSeedream5(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
		Model:        "doubao-seedream-5-0-lite-260128",
		Prompt:       "test",
		Size:         "2K",
		OutputFormat: "png",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGenerateOmitsImageAndSequentialForSeedream3(t *testing.T) {
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

	client := NewClient("test-key")
	client.BaseURL = server.URL

	_, err := client.Generate(model.AIImageRequest{
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

func TestDownloadImageReturnsHTTPError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte("forbidden"))
	}))
	defer server.Close()

	_, err := DownloadImage(server.URL)
	if err == nil {
		t.Fatal("expected download error")
	}
	if !strings.Contains(err.Error(), "HTTP 403") {
		t.Fatalf("expected HTTP status in error, got %v", err)
	}
}

package batch

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"image-toolbox/backend/model"
)

func TestRunConcurrentCancellationSkipsQueuedJobs(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var started int32

	results := RunConcurrent(ctx, []string{"a", "b", "c"}, func(srcPath string) (string, error) {
		if atomic.AddInt32(&started, 1) == 1 {
			cancel()
			time.Sleep(20 * time.Millisecond)
		}
		return srcPath + ".out", nil
	}, 1, nil)

	if got := atomic.LoadInt32(&started); got != 1 {
		t.Fatalf("expected only the in-flight job to start, got %d", got)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	cancelled := 0
	for _, r := range results {
		if r.Error == "cancelled" {
			cancelled++
		}
	}
	if cancelled != 2 {
		t.Fatalf("expected 2 cancelled queued results, got %d: %+v", cancelled, results)
	}
}

func TestRunConcurrentNormalizesInvalidConcurrency(t *testing.T) {
	results := RunConcurrent(context.Background(), []string{"a"}, func(srcPath string) (string, error) {
		return srcPath + ".out", nil
	}, 0, make(chan model.ProgressUpdate, 2))

	if len(results) != 1 || !results[0].Success {
		t.Fatalf("expected successful result, got %+v", results)
	}
}

func TestRunConcurrentPathsReportsResultBeforeBatchReturns(t *testing.T) {
	resultCh := make(chan model.ImageResult, 2)
	returned := make(chan struct{})

	go func() {
		RunConcurrentPathsWithResultCallback(context.Background(), []string{"a", "b"}, func(srcPath string) ([]string, error) {
			if srcPath == "b" {
				time.Sleep(50 * time.Millisecond)
			}
			return []string{srcPath + ".out"}, nil
		}, 1, nil, resultCh)
		close(returned)
	}()

	select {
	case result := <-resultCh:
		if result.SourcePath != "a" || !result.Success {
			t.Fatalf("expected first successful result for a, got %+v", result)
		}
	case <-returned:
		t.Fatal("batch returned before emitting the first image result")
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for image result")
	}
}

func TestNormalizeAIConcurrency(t *testing.T) {
	tests := []struct {
		name      string
		requested int
		want      int
	}{
		{name: "default", requested: 0, want: defaultAIConcurrency},
		{name: "negative", requested: -1, want: defaultAIConcurrency},
		{name: "within limit", requested: 20, want: 20},
		{name: "clamped", requested: 80, want: maxAIConcurrency},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeAIConcurrency(tt.requested); got != tt.want {
				t.Fatalf("got %d, want %d", got, tt.want)
			}
		})
	}
}

func TestValidateAIBatchRequest(t *testing.T) {
	valid := model.AIBatchRequest{
		SourcePaths: []string{"input.png"},
		OutputDir:   t.TempDir(),
		Prompt:      "make it brighter",
	}
	if err := validateAIBatchRequest(valid); err != nil {
		t.Fatalf("expected valid request, got %v", err)
	}

	tests := []struct {
		name string
		req  model.AIBatchRequest
	}{
		{name: "missing source", req: model.AIBatchRequest{OutputDir: t.TempDir(), Prompt: "prompt"}},
		{name: "missing prompt", req: model.AIBatchRequest{SourcePaths: []string{"input.png"}, OutputDir: t.TempDir()}},
		{name: "missing output dir", req: model.AIBatchRequest{SourcePaths: []string{"input.png"}, Prompt: "prompt"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validateAIBatchRequest(tt.req); err == nil {
				t.Fatal("expected validation error")
			}
		})
	}
}

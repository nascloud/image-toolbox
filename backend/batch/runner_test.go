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

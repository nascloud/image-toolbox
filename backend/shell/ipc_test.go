package shell

import (
	"sync"
	"testing"
	"time"
)

func TestIPCStartAndSend(t *testing.T) {
	var mu sync.Mutex
	var received LaunchIntent
	handler := func(intent LaunchIntent) {
		mu.Lock()
		received = intent
		mu.Unlock()
	}

	port, err := StartIPCServer(handler)
	if err != nil {
		t.Fatalf("start server: %v", err)
	}
	defer CleanupIPCPort()

	intent := LaunchIntent{
		Page:  "convert",
		Files: []string{"C:\\test\\a.jpg", "C:\\test\\b.png"},
	}

	if err := SendLaunchIntent(port, intent); err != nil {
		t.Fatalf("send: %v", err)
	}

	time.Sleep(200 * time.Millisecond)

	mu.Lock()
	if received.Page != intent.Page {
		t.Errorf("page = %q, want %q", received.Page, intent.Page)
	}
	if len(received.Files) != len(intent.Files) {
		t.Errorf("files = %v, want %v", received.Files, intent.Files)
	}
	mu.Unlock()
}

func TestWriteReadIPCPort(t *testing.T) {
	defer CleanupIPCPort()
	expected := 23456
	if err := WriteIPCPort(expected); err != nil {
		t.Fatalf("write: %v", err)
	}
	got, err := ReadIPCPort()
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	if got != expected {
		t.Errorf("port = %d, want %d", got, expected)
	}
}

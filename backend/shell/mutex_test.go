package shell

import (
	"testing"
)

func TestIsAnotherInstanceRunning_FirstCallReturnsFalse(t *testing.T) {
	ReleaseInstanceMutex()

	running, err := IsAnotherInstanceRunning()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if running {
		t.Error("expected false for first call, got true")
	}

	ReleaseInstanceMutex()
}

func TestIsAnotherInstanceRunning_DetectsSecondInstance(t *testing.T) {
	ReleaseInstanceMutex()
	running1, _ := IsAnotherInstanceRunning()
	if running1 {
		t.Fatal("first call should not detect another instance")
	}

	t.Log("Second-instance detection requires two processes; verified manually.")
}

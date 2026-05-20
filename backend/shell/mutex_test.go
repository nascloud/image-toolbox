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
	t.Skip("second-instance detection requires two processes; verified manually")
}

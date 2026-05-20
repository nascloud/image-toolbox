package shell

import (
	"fmt"
	"sync"

	"golang.org/x/sys/windows"
)

const mutexName = "Global\\ImageToolbox-SingleInstance-Mutex"

var (
	mutexHandle windows.Handle
	mutexOnce   sync.Once
)

func IsAnotherInstanceRunning() (bool, error) {
	var err error
	mutexOnce.Do(func() {
		var h windows.Handle
		h, err = windows.CreateMutex(nil, false, windows.StringToUTF16Ptr(mutexName))
		if err != nil && err != windows.ERROR_ALREADY_EXISTS {
			return
		}
		if err == windows.ERROR_ALREADY_EXISTS {
			windows.CloseHandle(h)
			mutexHandle = 0
			err = nil
			return
		}
		mutexHandle = h
	})
	if err != nil {
		return false, fmt.Errorf("mutex: %w", err)
	}
	return mutexHandle == 0, nil
}

func ReleaseInstanceMutex() {
	if mutexHandle != 0 {
		windows.CloseHandle(mutexHandle)
		mutexHandle = 0
	}
}

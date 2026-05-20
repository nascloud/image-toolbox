package shell

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"time"
)

type LaunchIntent struct {
	Page  string   `json:"page"`
	Files []string `json:"files"`
}

const ipcPortFile = "imagetool-ipc-port.txt"

func ipcPortFilePath() string {
	return filepath.Join(os.TempDir(), ipcPortFile)
}

func StartIPCServer(handler func(LaunchIntent)) (int, error) {
	for port := 23456; port < 23461; port++ {
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		listener, err := net.Listen("tcp", addr)
		if err != nil {
			continue
		}
		go func() {
			for {
				conn, err := listener.Accept()
				if err != nil {
					return
				}
				go handleIPCConnection(conn, handler)
			}
		}()
		return port, nil
	}
	return 0, fmt.Errorf("could not find a free port (tried 23456-23460)")
}

func handleIPCConnection(conn net.Conn, handler func(LaunchIntent)) {
	defer conn.Close()
	conn.SetReadDeadline(time.Now().Add(5 * time.Second))
	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 65536), 65536)
	if scanner.Scan() {
		var intent LaunchIntent
		if err := json.Unmarshal([]byte(scanner.Text()), &intent); err == nil {
			handler(intent)
		}
	}
}

func WriteIPCPort(port int) error {
	data := fmt.Sprintf("%d", port)
	return os.WriteFile(ipcPortFilePath(), []byte(data), 0644)
}

func ReadIPCPort() (int, error) {
	data, err := os.ReadFile(ipcPortFilePath())
	if err != nil {
		return 0, fmt.Errorf("read ipc port: %w", err)
	}
	var port int
	if _, err := fmt.Sscanf(string(data), "%d", &port); err != nil {
		return 0, fmt.Errorf("parse port: %w", err)
	}
	return port, nil
}

func SendLaunchIntent(port int, intent LaunchIntent) error {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	conn, err := net.DialTimeout("tcp", addr, 3*time.Second)
	if err != nil {
		return fmt.Errorf("connect: %w", err)
	}
	defer conn.Close()

	data, err := json.Marshal(intent)
	if err != nil {
		return fmt.Errorf("marshal intent: %w", err)
	}
	data = append(data, '\n')

	if _, err := conn.Write(data); err != nil {
		return fmt.Errorf("write: %w", err)
	}
	return nil
}

func CleanupIPCPort() {
	os.Remove(ipcPortFilePath())
}

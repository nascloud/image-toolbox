package main

import (
	"embed"
	"log"
	"os"
	"time"

	"image-toolbox/backend/shell"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	intent := shell.ParseLaunchIntent(os.Args[1:])

	running, err := shell.IsAnotherInstanceRunning()
	if err != nil {
		log.Printf("single-instance check failed: %v", err)
	}
	if running {
		if intent != nil {
			// Wait for the IPC server of the first instance to become ready (since they might be launched at the exact same time by Windows Explorer)
			for retry := 0; retry < 150; retry++ {
				port, readErr := shell.ReadIPCPort()
				if readErr == nil {
					if sendErr := shell.SendLaunchIntent(port, *intent); sendErr == nil {
						log.Println("Forwarded launch intent to running instance, exiting.")
						return
					}
				}
				time.Sleep(100 * time.Millisecond)
			}
			log.Println("Failed to forward launch intent after retries. Starting new instance anyway.")
		} else {
			log.Println("Another instance of image-toolbox is already running. Exiting.")
			return
		}
	}

	app := NewApp()

	if intent != nil {
		app.SetPendingIntent(intent)
	}

	app.OnContextReady = func() {
		port, err := shell.StartIPCServer(func(intent shell.LaunchIntent) {
			app.HandleLaunchIntent(intent)
		})
		if err != nil {
			log.Printf("IPC server failed: %v", err)
			return
		}
		shell.WriteIPCPort(port)
	}

	err = wails.Run(&options.App{
		Title:  "image-toolbox",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop: true,
		},
		BackgroundColour: &options.RGBA{R: 27, G: 38, B: 54, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}

	shell.ReleaseInstanceMutex()
	shell.CleanupIPCPort()
}

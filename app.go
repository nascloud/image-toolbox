package main

import (
	"context"

	backendApp "image-toolbox/backend/app"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the top-level application struct used by Wails.
// It embeds the backend API layer so all its methods are automatically bound.
type App struct {
	*backendApp.App
	ctx context.Context
}

// NewApp creates a new App application struct with the embedded backend App.
func NewApp() *App {
	return &App{
		App: backendApp.NewApp(),
	}
}

// startup is called when the app starts. The context is saved
// and passed to the backend App for runtime operations (dialogs, events).
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.App.SetContext(ctx)
	runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
		runtime.EventsEmit(ctx, "app:file-drop", x, y, paths)
	})
}

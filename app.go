package main

import (
	"context"

	backendApp "image-toolbox/backend/app"
	"image-toolbox/backend/shell"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App is the top-level application struct used by Wails.
type App struct {
	*backendApp.App
	ctx            context.Context
	pendingIntent  *shell.LaunchIntent
	OnContextReady func()
}

func NewApp() *App {
	return &App{
		App: backendApp.NewApp(),
	}
}

func (a *App) SetPendingIntent(intent *shell.LaunchIntent) {
	a.pendingIntent = intent
}

func (a *App) HandleLaunchIntent(intent shell.LaunchIntent) {
	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "app:launch-intent", intent)
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.App.SetContext(ctx)

	runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
		runtime.EventsEmit(ctx, "app:file-drop", x, y, paths)
	})

	if a.pendingIntent != nil {
		runtime.EventsEmit(ctx, "app:launch-intent", *a.pendingIntent)
		a.pendingIntent = nil
	}

	if a.OnContextReady != nil {
		a.OnContextReady()
	}
}

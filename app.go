package main

import (
	"context"
	"sync"

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
	intentMu       sync.Mutex
}

func NewApp() *App {
	return &App{
		App: backendApp.NewApp(),
	}
}

func (a *App) SetPendingIntent(intent *shell.LaunchIntent) {
	a.intentMu.Lock()
	defer a.intentMu.Unlock()
	a.pendingIntent = intent
}

func (a *App) HandleLaunchIntent(intent shell.LaunchIntent) {
	a.intentMu.Lock()
	if a.pendingIntent != nil {
		// Frontend has not fetched the pending intent yet. Merge files directly.
		a.pendingIntent.Files = append(a.pendingIntent.Files, intent.Files...)
		a.intentMu.Unlock()
		return
	}
	a.intentMu.Unlock()

	if a.ctx == nil {
		return
	}
	runtime.EventsEmit(a.ctx, "app:launch-intent", intent)
}

func (a *App) GetPendingIntent() *shell.LaunchIntent {
	a.intentMu.Lock()
	defer a.intentMu.Unlock()
	intent := a.pendingIntent
	a.pendingIntent = nil
	return intent
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.App.SetContext(ctx)

	runtime.OnFileDrop(ctx, func(x, y int, paths []string) {
		runtime.EventsEmit(ctx, "app:file-drop", x, y, paths)
	})

	if a.OnContextReady != nil {
		a.OnContextReady()
	}
}

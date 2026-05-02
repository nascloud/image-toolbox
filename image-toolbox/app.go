package main

import (
	"context"

	backendApp "image-toolbox/backend/app"
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
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

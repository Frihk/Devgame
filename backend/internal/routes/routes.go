package routes

import (
	"net/http"

	"Devgame/backend/internal/handlers"
	"Devgame/backend/internal/services"
)

// RegisterRoutes maps all HTTP endpoints to their respective REST handlers.
func RegisterRoutes(
	mux *http.ServeMux,
	registry *services.RoomRegistry,
	authSvc handlers.AuthService,
	lbSvc handlers.LeaderboardService,
	playerSvc handlers.PlayerService,
) {
	mux.HandleFunc("POST /auth/register", handlers.RegisterHandler(authSvc))
	mux.HandleFunc("POST /auth/login", handlers.LoginHandler(authSvc))
	mux.HandleFunc("GET /leaderboard", handlers.GetLeaderboardHandler(lbSvc))
	mux.HandleFunc("GET /player/{id}", handlers.GetPlayerProfileHandler(playerSvc))
	mux.HandleFunc("POST /lobby/create", handlers.CreateLobbyHandler(registry))
	mux.HandleFunc("POST /lobby/{id}/join", handlers.JoinLobbyHandler(registry))
	mux.HandleFunc("POST /api/games", handlers.CreateLobbyHandler(registry))
	mux.HandleFunc("POST /api/games/{id}/join", handlers.JoinLobbyHandler(registry))
	mux.HandleFunc("GET /api/games/{id}", handlers.GetGameStateHandler(registry))
}

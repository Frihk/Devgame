package main

import (
	"log"
	"net/http"
	"os"
	"path/filepath"

	"Devgame/backend/internal/handlers"
	"Devgame/backend/internal/middleware"
	"Devgame/backend/internal/routes"
	"Devgame/backend/internal/services"
)

// mockAuthService provides mock auth operations for development compiling/testing.
type mockAuthService struct{}

func (s *mockAuthService) Register(username, password string) (string, error) {
	// Simple mock player ID generation
	return username + "_id", nil
}

func (s *mockAuthService) Login(username, password string) (string, error) {
	// Simple mock token generation
	return "mock_token_" + username, nil
}

// mockLeaderboardService provides mock leaderboard data.
type mockLeaderboardService struct{}

func (s *mockLeaderboardService) GetTopPlayers(limit int) ([]handlers.LeaderboardEntry, error) {
	return []handlers.LeaderboardEntry{
		{PlayerID: "player_1", Name: "Alice", NetWorth: 25000, Wins: 5, GamesPlayed: 10},
		{PlayerID: "player_2", Name: "Bob", NetWorth: 18000, Wins: 3, GamesPlayed: 8},
	}, nil
}

// mockPlayerService provides mock player profiles.
type mockPlayerService struct{}

func (s *mockPlayerService) GetProfile(playerID string) (*handlers.PlayerProfile, error) {
	return &handlers.PlayerProfile{
		PlayerID:    playerID,
		Name:        "Player " + playerID,
		GamesPlayed: 12,
		Wins:        4,
		TotalEarned: 150000,
	}, nil
}

func main() {
	registry := services.NewRoomRegistry()

	// Instantiate mock services for development.
	// These can be replaced with real database-backed services in production.
	authSvc := &mockAuthService{}
	lbSvc := &mockLeaderboardService{}
	playerSvc := &mockPlayerService{}

	mux := http.NewServeMux()

	// REST Endpoints (Stubs for Phase 0)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Register REST API Routes
	routes.RegisterRoutes(mux, registry, authSvc, lbSvc, playerSvc)

	// WebSocket Endpoint
	mux.HandleFunc("GET /ws/game/{roomID}", middleware.WSUpgradeHandler(registry))

	// Serve built frontend
	frontendDirs := []string{"frontend/dist", "../frontend/dist"}
	var staticDir string
	for _, d := range frontendDirs {
		if info, err := os.Stat(d); err == nil && info.IsDir() {
			staticDir, _ = filepath.Abs(d)
			break
		}
	}
	if staticDir != "" {
		fs := http.FileServer(http.Dir(staticDir))
		mux.Handle("/", fs)
		log.Printf("Serving frontend from %s", staticDir)
	} else {
		log.Println("No built frontend found at frontend/dist — run 'npm run build' in frontend/")
	}

	port := ":8080"
	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(port, middleware.CORS(mux)); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

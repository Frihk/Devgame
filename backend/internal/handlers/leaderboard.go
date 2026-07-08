package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// LeaderboardEntry represents a single row on the leaderboard.
type LeaderboardEntry struct {
	PlayerID    string `json:"playerId"`
	Name        string `json:"name"`
	NetWorth    int64  `json:"netWorth"`
	Wins        int    `json:"wins"`
	GamesPlayed int    `json:"gamesPlayed"`
}

// LeaderboardService defines the interface for retrieving leaderboard stats.
type LeaderboardService interface {
	GetTopPlayers(limit int) ([]LeaderboardEntry, error)
}

// GetLeaderboardHandler handles GET /leaderboard requests.
func GetLeaderboardHandler(svc LeaderboardService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
			return
		}

		limit := 10 // Default limit
		if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
			if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
				limit = l
			}
		}

		entries, err := svc.GetTopPlayers(limit)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(entries)
	}
}

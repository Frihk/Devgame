package handlers

import (
	"encoding/json"
	"net/http"
)

// PlayerProfile represents the stats and history of a player.
type PlayerProfile struct {
	PlayerID    string `json:"playerId"`
	Name        string `json:"name"`
	GamesPlayed int    `json:"gamesPlayed"`
	Wins        int    `json:"wins"`
	TotalEarned int64  `json:"totalEarned"`
}

// PlayerService defines the interface for retrieving player profiles.
type PlayerService interface {
	GetProfile(playerID string) (*PlayerProfile, error)
}

// GetPlayerProfileHandler handles GET /player/{id} requests.
func GetPlayerProfileHandler(svc PlayerService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
			return
		}

		playerID := r.PathValue("id")
		if playerID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Player ID is required"})
			return
		}

		profile, err := svc.GetProfile(playerID)
		if err != nil {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(profile)
	}
}

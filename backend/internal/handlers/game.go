package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

// CreateLobbyResponse holds the JSON response payload for lobby creation.
type CreateLobbyResponse struct {
	RoomID string `json:"roomId"`
	GameID string `json:"gameId"`
}

// JoinLobbyRequest holds the JSON request payload for joining a lobby.
type JoinLobbyRequest struct {
	PlayerID string `json:"playerId"`
}

// JoinLobbyResponse holds the JSON response payload for joining a lobby.
type JoinLobbyResponse struct {
	RoomID string `json:"roomId"`
	Token  string `json:"token"`
}

// CreateLobbyHandler handles POST /lobby/create.
func CreateLobbyHandler(registry *services.RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
			return
		}

		// Generate random 8-character hex room ID
		bytes := make([]byte, 4)
		if _, err := rand.Read(bytes); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]string{"error": "Failed to generate room ID"})
			return
		}
		roomID := hex.EncodeToString(bytes)

		// Create room in registry
		registry.CreateRoom(roomID)

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(CreateLobbyResponse{RoomID: roomID, GameID: roomID})
	}
}

// JoinLobbyHandler handles POST /lobby/{id}/join.
func JoinLobbyHandler(registry *services.RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(map[string]string{"error": "Method not allowed"})
			return
		}

		roomID := r.PathValue("id")
		if roomID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Room ID is required"})
			return
		}

		// Verify room exists
		if _, ok := registry.GetRoom(roomID); !ok {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Room not found"})
			return
		}

		var req JoinLobbyRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PlayerID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Player ID is required"})
			return
		}

		// For Phase 0/Development, the token returned is simply the player ID
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(JoinLobbyResponse{
			RoomID: roomID,
			Token:  req.PlayerID,
		})
	}
}

// GetGameStateHandler handles GET /api/games/{id}.
func GetGameStateHandler(registry *services.RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		roomID := r.PathValue("id")
		if roomID == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]string{"error": "Game ID is required"})
			return
		}

		room, ok := registry.GetRoom(roomID)
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Game not found"})
			return
		}

		w.WriteHeader(http.StatusOK)
		if room.State != nil {
			json.NewEncoder(w).Encode(room.State)
		} else {
			json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     roomID,
				"status": "lobby",
			})
		}
	}
}

// HandleGameCommand routes incoming WebSocket gameplay commands to specialized action handlers.
func HandleGameCommand(
	room *services.Room,
	cmd models.Command,
	propSvc *services.PropertyService,
	tradeSvc *services.TradeService,
	auctionSvc *services.AuctionService,
	liqSvc *services.LiquidationService,
) models.Result {
	switch cmd.Type {
	// Property-related WebSocket commands
	case models.ActionBuyProperty, models.ActionDeclineProperty, models.ActionPayRent,
		models.ActionMortgageProperty, models.ActionUnmortgageProperty,
		models.ActionBuildLodge, models.ActionSellLodge:
		return HandlePropertyAction(room, cmd, propSvc)

	// Event-related WebSocket commands
	case models.ActionRollDice, models.ActionEndTurn:
		return HandleEventAction(room, cmd)

	default:
		// Default acknowledgment fallback for unimplemented commands
		return models.Result{
			Events: []models.WSEvent{
				{
					Type:    string(cmd.Type) + "_ack",
					Payload: cmd.Payload,
				},
			},
		}
	}
}

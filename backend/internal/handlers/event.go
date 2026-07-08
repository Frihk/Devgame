package handlers

import (
	"encoding/json"
	"math/rand"
	"time"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

// HandleEventAction processes event-related gameplay actions.
func HandleEventAction(room *services.Room, cmd models.Command) models.Result {
	switch cmd.Type {
	case models.ActionRollDice:
		// Simulate rolling two 6-sided dice
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		d1 := r.Intn(6) + 1
		d2 := r.Intn(6) + 1

		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": cmd.PlayerID,
			"dice1":    d1,
			"dice2":    d2,
		})

		return models.Result{
			Events: []models.WSEvent{
				{
					Type:    "dice_rolled",
					Payload: payload,
				},
			},
		}

	case models.ActionEndTurn:
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": cmd.PlayerID,
		})

		return models.Result{
			Events: []models.WSEvent{
				{
					Type:    "turn_ended",
					Payload: payload,
				},
			},
		}

	default:
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

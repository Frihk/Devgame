package handlers

import (
	"encoding/json"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

// PropertyActionPayload holds the expected payload structure for property-based commands.
type PropertyActionPayload struct {
	PropertyID int `json:"propertyId"`
}

// HandlePropertyAction processes property-related commands.
func HandlePropertyAction(room *services.Room, cmd models.Command, propSvc *services.PropertyService) models.Result {
	var payload PropertyActionPayload
	if err := json.Unmarshal(cmd.Payload, &payload); err != nil {
		return models.Result{Error: err}
	}

	switch cmd.Type {
	case models.ActionBuildLodge:
		if err := propSvc.BuildLodge(payload.PropertyID, cmd.PlayerID); err != nil {
			return models.Result{Error: err}
		}

		// Find the updated lodge count from room state
		lodgeCount := 0
		for _, p := range room.State.Properties {
			if p.PropertyID == payload.PropertyID {
				lodgeCount = p.LodgeCount
				break
			}
		}

		resPayload, _ := json.Marshal(map[string]interface{}{
			"propertyId": payload.PropertyID,
			"lodgeCount": lodgeCount,
			"playerId":   cmd.PlayerID,
		})

		return models.Result{
			Events: []models.WSEvent{
				{
					Type:    "lodge_built",
					Payload: resPayload,
				},
			},
		}

	case models.ActionMortgageProperty:
		if err := propSvc.MortgageProperty(payload.PropertyID, cmd.PlayerID); err != nil {
			return models.Result{Error: err}
		}

		resPayload, _ := json.Marshal(map[string]interface{}{
			"propertyId": payload.PropertyID,
			"playerId":   cmd.PlayerID,
			"mortgaged":  true,
		})

		return models.Result{
			Events: []models.WSEvent{
				{
					Type:    "property_mortgaged",
					Payload: resPayload,
				},
			},
		}

	default:
		// Fallback/ack for buy, decline, unmortgage, build, etc.
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

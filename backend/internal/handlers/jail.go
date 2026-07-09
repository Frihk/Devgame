package handlers

import (
	"encoding/json"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

type JailActionPayload struct {
	Action string `json:"action"`
}

func HandleJailAction(room *services.Room, cmd models.Command, jailSvc *services.JailService) models.Result {
	var payload JailActionPayload
	if err := json.Unmarshal(cmd.Payload, &payload); err != nil {
		return models.Result{Error: err}
	}

	switch cmd.Type {
	case models.ActionPayBail:
		events, err := jailSvc.PayBail(room.State, cmd.PlayerID)
		if err != nil {
			return models.Result{Error: err}
		}
		return models.Result{Events: events}

	case models.ActionUseJailCard:
		events, err := jailSvc.UseJailFreeCard(room.State, cmd.PlayerID)
		if err != nil {
			return models.Result{Error: err}
		}
		return models.Result{Events: events}

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

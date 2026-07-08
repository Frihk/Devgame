package handlers

import (
	"encoding/json"
	"errors"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

type PropertyHandler struct {
	propService *services.PropertyService
}

func NewPropertyHandler(ps *services.PropertyService) *PropertyHandler {
	return &PropertyHandler{
		propService: ps,
	}
}

type PropertyActionPayload struct {
	PropertyID int `json:"propertyId"`
}

// HandleBuildLodge routes the "build_lodge" command for real estate development
func (h *PropertyHandler) HandleBuildLodge(userID string, gameState *models.GameState, rawMsg json.RawMessage) (*models.PropertyState, error) {
	var payload PropertyActionPayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return nil, errors.New("malformed lodge building payload")
	}

	// 1. Run your exact business logic
	err := h.propService.BuildLodge(payload.PropertyID, userID)
	if err != nil {
		return nil, err
	}
	return nil, nil 
}
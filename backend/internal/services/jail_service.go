package services

import (
	"encoding/json"
	"errors"

	"Devgame/backend/internal/models"
)

type JailService struct{}

func NewJailService() *JailService {
	return &JailService{}
}

func (s *JailService) SendToJail(state *models.GameState, playerID string, reason string) ([]models.WSEvent, error) {
	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}

	if player.Status == models.PlayerStatusBankrupt || player.Status == models.PlayerStatusEliminated {
		return nil, errors.New("cannot jail an eliminated player")
	}

	player.BoardPosition = 10
	player.Status = models.PlayerStatusJailed
	player.JailTurnsRemaining = MaxJailTurns

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
		"reason":   reason,
	})

	return []models.WSEvent{{
		Type:    "player_jailed",
		Payload: payload,
	}}, nil
}

func (s *JailService) PayBail(state *models.GameState, playerID string) ([]models.WSEvent, error) {
	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}

	if player.Status != models.PlayerStatusJailed {
		return nil, errors.New("player is not in jail")
	}

	if player.Cash < BailAmount {
		return nil, errors.New("insufficient cash to pay bail")
	}

	player.Cash -= BailAmount
	player.Status = models.PlayerStatusActive
	player.JailTurnsRemaining = 0

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
		"method":   "bail",
		"amount":   BailAmount,
	})

	return []models.WSEvent{{
		Type:    "player_released_from_jail",
		Payload: payload,
	}}, nil
}

func (s *JailService) UseJailFreeCard(state *models.GameState, playerID string) ([]models.WSEvent, error) {
	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}

	if player.Status != models.PlayerStatusJailed {
		return nil, errors.New("player is not in jail")
	}

	if !player.HasJailFreeCard {
		return nil, errors.New("player does not have a Get Out of Jail Free card")
	}

	player.HasJailFreeCard = false
	player.Status = models.PlayerStatusActive
	player.JailTurnsRemaining = 0

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
		"method":   "jail_free_card",
	})

	return []models.WSEvent{{
		Type:    "player_released_from_jail",
		Payload: payload,
	}}, nil
}

func (s *JailService) IsInJail(state *models.GameState, playerID string) bool {
	player := findPlayer(state, playerID)
	if player == nil {
		return false
	}
	return player.Status == models.PlayerStatusJailed
}

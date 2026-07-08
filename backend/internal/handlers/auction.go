package handlers

import (
	"encoding/json"
	"errors"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

type AuctionHandler struct {
	auctionService *services.AuctionService
}

func NewAuctionHandler(as *services.AuctionService) *AuctionHandler {
	return &AuctionHandler{
		auctionService: as,
	}
}

// BidPayload maps the inbound JSON schema sent via WebSocket command "submit_bid"
type BidPayload struct {
	PropertyID int   `json:"propertyId"`
	BidAmount  int64 `json:"bidAmount"`
}

// HandleSubmitBid processes the "submit_bid" command routing switch
func (h *AuctionHandler) HandleSubmitBid(userID string, gameState *models.GameState, rawMsg json.RawMessage) (*models.PendingAuction, error) {
	var payload BidPayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return nil, errors.New("malformed auction bid payload")
	}

	// Find the bidding player's current cash state to enforce liquidity constraints
	var playerCash int64 = -1
	for _, p := range gameState.Players {
		if p.ID == userID {
			// Fail early if the player is disqualified or liquidating
			if p.Status == models.PlayerStatusBankrupt || p.Status == models.PlayerStatusEliminated {
				return nil, errors.New("cannot place bids: player is eliminated from active competition")
			}
			playerCash = p.Cash
			break
		}
	}

	if playerCash == -1 {
		return nil, errors.New("player state context not found in this game instance")
	}

	// Trigger our secure business logic layer
	updatedAuction, err := h.auctionService.PlaceBid(payload.PropertyID, userID, payload.BidAmount, playerCash)
	if err != nil {
		return nil, err
	}

	return updatedAuction, nil
}

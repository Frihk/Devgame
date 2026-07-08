package handlers

import (
	"encoding/json"
	"errors"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
)

type TradeHandler struct {
	tradeService *services.TradeService
}

func NewTradeHandler(ts *services.TradeService) *TradeHandler {
	return &TradeHandler{
		tradeService: ts,
	}
}

// HandleProposeTrade acts as the routing switch for incoming "propose_trade" commands
func (h *TradeHandler) HandleProposeTrade(userID string, gameState *models.GameState, rawMsg json.RawMessage) (*models.PendingDeal, error) {
	var payload models.ProposeTradePayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return nil, errors.New("malformed trade proposal payload")
	}

	terms := models.TradeTerms{
		OfferedPropertyIDs:   payload.OfferedProperty,
		RequestedPropertyIDs: payload.RequestedProperty,
	}

	for _, p := range gameState.Players {
		if p.ID == userID {
			if p.Cash < payload.CashOffered {
				return nil, errors.New("insufficient liquidity")
			}
			break
		}
	}

	deal, err := h.tradeService.ProposeTrade(payload.DealID, userID, payload.CounterpartyID, terms)
	if err != nil {
		return nil, err
	}

	return deal, nil
}

// HandleRespondTrade routes the "respond_trade" commands
func (h *TradeHandler) HandleRespondTrade(userID string, gameState *models.GameState, rawMsg json.RawMessage) (*models.PendingDeal, error) {
	var payload models.TradeActionPayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return nil, errors.New("malformed trade response payload")
	}

	deal, err := h.tradeService.RespondToTrade(payload.DealID, userID, payload.Action)
	if err != nil {
		return nil, err
	}

	return deal, nil
}

// HandleCancelTrade routes the "cancel_trade" commands
func (h *TradeHandler) HandleCancelTrade(userID string, gameState *models.GameState, rawMsg json.RawMessage) error {
	var payload models.TradeActionPayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return errors.New("malformed trade cancellation payload")
	}

	return h.tradeService.CancelTrade(payload.DealID, userID)
}

// HandleInterceptOffer handles "submit_intercept_offer"
func (h *TradeHandler) HandleInterceptOffer(userID string, gameState *models.GameState, rawMsg json.RawMessage) (*models.PendingDeal, error) {
	var payload models.InterceptPayload
	if err := json.Unmarshal(rawMsg, &payload); err != nil {
		return nil, errors.New("malformed trade intercept payload")
	}

	deal, err := h.tradeService.SubmitIntercept(payload.DealID, userID, payload.CashOffset)
	if err != nil {
		return nil, err
	}

	return deal, nil
}

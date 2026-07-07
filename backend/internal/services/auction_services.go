package services

import (
	"errors"
	"sync"
	"time"

	"Devgame/backend/internal/models"
)

type AuctionService struct {
	mu       sync.RWMutex
	auctions map[int]*models.PendingAuction // Map keyed by PropertyID
}

// NewAuctionService initializes your auction manager
func NewAuctionService() *AuctionService {
	return &AuctionService{
		auctions: make(map[int]*models.PendingAuction),
	}
}

// StartAuction sets up an active auction when a player passes on a tile.
func (s *AuctionService) StartAuction(propertyID int) (*models.PendingAuction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Ensure there isn't an ongoing open auction for this exact tile
	if existing, exists := s.auctions[propertyID]; exists && existing.Phase == models.AuctionPhaseOpen {
		return nil, errors.New("an active auction is already running for this property")
	}

	// Calculate a clean 15-second bidding window deadline in Unix Milliseconds
	deadline := time.Now().Add(15 * time.Second).UnixNano() / int64(time.Millisecond)

	newAuction := &models.PendingAuction{
		PropertyID:      propertyID,
		Phase:           models.AuctionPhaseOpen,
		CurrentBid:      0, // Rulebook: bidding begins at Ksh 0 or base increments
		CurrentBidderID: nil,
		DeadlineMS:      deadline,
	}

	s.auctions[propertyID] = newAuction
	return newAuction, nil
}
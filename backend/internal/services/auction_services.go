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

// PlaceBid processes incoming user bids, validates increments, and handles sniper clock resets.
// PlaceBid processes incoming user bids, validates increments, checks affordability, and handles sniper clock resets.
func (s *AuctionService) PlaceBid(propertyID int, bidderID string, bidAmount int64, playerCash int64) (*models.PendingAuction, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	auction, exists := s.auctions[propertyID]
	if !exists || auction.Phase != models.AuctionPhaseOpen {
		return nil, errors.New("no active open auction found for this property")
	}

	// Calculate the current timestamp in Unix Epoch Milliseconds
	nowMS := time.Now().UnixNano() / int64(time.Millisecond)
	if nowMS > auction.DeadlineMS {
		auction.Phase = models.AuctionPhaseClosed
		return nil, errors.New("bidding windows have officially closed for this auction")
	}

	// Rule Check A: Anti-Self-Bidding Guard
	if auction.CurrentBidderID != nil && *auction.CurrentBidderID == bidderID {
		return nil, errors.New("invalid operation: you are already the highest bidder")
	}

	// Rule Check B: Increment Validation
	if bidAmount <= auction.CurrentBid {
		return nil, errors.New("bid must explicitly exceed the current highest bid")
	}

	// Rule Check C: Financial Solvency Check
	if bidAmount > playerCash {
		return nil, errors.New("insufficient funds: you cannot place a bid higher than your current liquid cash")
	}

	// Update auction bid state safely
	auction.CurrentBidderID = &bidderID
	auction.CurrentBid = bidAmount

	// Rule: Sniper Protection Loop
	// If a bid rolls in within the final 3 seconds (3000ms) of the clock, 
	// extend the deadline by an extra 5 seconds (5000ms).
	timeRemainingMS := auction.DeadlineMS - nowMS
	if timeRemainingMS <= 3000 {
		auction.DeadlineMS = nowMS + 5000
	}

	return auction, nil
}
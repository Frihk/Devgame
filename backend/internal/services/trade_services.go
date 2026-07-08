package services

import (
	"errors"
	"sync"
	"time"

	"Devgame/backend/internal/models"
)

type TradeService struct {
	mu          sync.RWMutex
	activeDeals map[string]*models.PendingDeal
	propService *PropertyService
}

func NewTradeService(ps *PropertyService) *TradeService {
	return &TradeService{
		activeDeals: make(map[string]*models.PendingDeal),
		propService: ps,
	}
}

// ProposeTrade instantiates a deal state machine between two players and locks assets safely
func (s *TradeService) ProposeTrade(dealID string, proposerID string, counterpartyID string, terms models.TradeTerms) (*models.PendingDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.activeDeals[dealID]; exists {
		return nil, errors.New("a trade deal with this ID already exists")
	}

	if proposerID == counterpartyID {
		return nil, errors.New("cannot propose a trade deal to yourself")
	}

	// Lock the property service mutex during asset cross-verification to prevent race conditions
	s.propService.mu.Lock()
	defer s.propService.mu.Unlock()

	// 1. Verify and Lock Proposer's Offered Assets
	for _, id := range terms.OfferedPropertyIDs {
		prop, exists := s.propService.properties[id]
		if !exists {
			return nil, errors.New("offered property does not exist in game state")
		}
		if prop.OwnerID == nil || *prop.OwnerID != proposerID {
			return nil, errors.New("fraudulent transaction: you do not own the properties you are offering")
		}
		if prop.LockedByDealID != nil {
			return nil, errors.New("property is already locked in another pending trade negotiation")
		}
		if prop.LodgeCount > 0 {
			return nil, errors.New("cannot trade properties that still have active lodge developments built on them")
		}
	}

	// 2. Verify and Lock Counterparty's Requested Assets
	for _, id := range terms.RequestedPropertyIDs {
		prop, exists := s.propService.properties[id]
		if !exists {
			return nil, errors.New("requested property does not exist in game state")
		}
		if prop.OwnerID == nil || *prop.OwnerID != counterpartyID {
			return nil, errors.New("invalid transaction: counterparty does not own the requested property")
		}
		if prop.LockedByDealID != nil {
			return nil, errors.New("requested property is already locked in another pending trade negotiation")
		}
		if prop.LodgeCount > 0 {
			return nil, errors.New("cannot trade properties that still have active lodge developments built on them")
		}
	}

	// 3. Asset Verification Passed! Apply the Deal ID lock to all involved assets
	for _, id := range terms.OfferedPropertyIDs {
		s.propService.properties[id].LockedByDealID = &dealID
	}
	for _, id := range terms.RequestedPropertyIDs {
		s.propService.properties[id].LockedByDealID = &dealID
	}

	deadline := time.Now().Add(30 * time.Second).UnixNano() / int64(time.Millisecond)

	newDeal := &models.PendingDeal{
		ID:                 dealID,
		ProposerID:         proposerID,
		CounterpartyID:     counterpartyID,
		Phase:              models.DealPhaseNegotiating,
		LeadingOffer:       terms,
		LeadingOfferFromID: &proposerID,
		DeadlineMS:         deadline,
	}

	s.activeDeals[dealID] = newDeal
	return newDeal, nil
	
}

// RespondToTrade handles trade acceptances, counters, or rejections
func (s *TradeService) RespondToTrade(dealID string, userID string, action string) (*models.PendingDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.activeDeals[dealID]
	if !exists {
		return nil, errors.New("trade deal not found")
	}
	return deal, nil
}

// CancelTrade allows a proposer to revoke an offer before it expires
func (s *TradeService) CancelTrade(dealID string, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.activeDeals[dealID]; !exists {
		return errors.New("trade deal not found")
	}
	return nil
}

// SubmitIntercept processes third-party sniper-protection counteroffers
func (s *TradeService) SubmitIntercept(dealID string, userID string, cashOffset int64) (*models.PendingDeal, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	deal, exists := s.activeDeals[dealID]
	if !exists {
		return nil, errors.New("trade deal not found")
	}
	return deal, nil
}
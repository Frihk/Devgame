package services

import (
	"errors"
	"sync"

	"Devgame/backend/internal/models"
)

type LiquidationService struct {
	mu          sync.RWMutex
	propService *PropertyService // Relies on your property mutations to safely drop lodges/mortgage
}

func NewLiquidationService(ps *PropertyService) *LiquidationService {
	return &LiquidationService{
		propService: ps,
	}
}

// CheckLiquidationCapacity calculates the maximum possible cash a player could raise in an emergency
func (s *LiquidationService) CheckLiquidationCapacity(player *models.PlayerState, playerProperties []*models.PropertyState) int64 {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Start with their current pocket cash
	maxCashRaised := player.Cash

	for _, prop := range playerProperties {
		if prop.OwnerID != nil && *prop.OwnerID == player.ID {
			// 1. Add cash value of selling developments (usually 50% of original purchase price)
			// Assuming a fixed base value for hackathon baseline rule, e.g., Ksh 1,000 per lodge sold
			if prop.LodgeCount > 0 {
				maxCashRaised += int64(prop.LodgeCount) * 1000
			}

			// 2. Add mortgage value if the property isn't already mortgaged
			// Assuming a standard mortgage liquidity value per property, e.g., Ksh 2,000
			if !prop.Mortgaged {
				maxCashRaised += 2000
			}
		}
	}

	return maxCashRaised
}

// DeclareBankruptcy processes total insolvency, stripping player assets.
func (s *LiquidationService) DeclareBankruptcy(player *models.PlayerState, playerProperties []*models.PropertyState, creditorID *string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Safety Check: If they can survive by liquidating assets, don't let them quit yet
	maxCapacity := s.CheckLiquidationCapacity(player, playerProperties)
	if maxCapacity >= 0 {
		return errors.New("cannot declare bankruptcy; player still has sufficient assets to liquidate and cover debt")
	}

	// 2. Asset Wipeout Loop
	for _, prop := range playerProperties {
		if prop.OwnerID != nil && *prop.OwnerID == player.ID {
			// Clear developments completely
			prop.LodgeCount = 0

			if creditorID != nil {
				// Hand the property directly to the player they owe money to
				prop.OwnerID = creditorID
				// The rulebook states properties transferred via bankruptcy retain their mortgage state,
				// but the new owner must immediately pay a fee (handled in later processing)
			} else {
				// Money was owed to the bank/game environment; return property to the open market
				prop.OwnerID = nil
				prop.Mortgaged = false
				prop.LockedByDealID = nil
			}
		}
	}

	// 3. Flag the player as completely eliminated
	player.Cash = 0

	return nil
}

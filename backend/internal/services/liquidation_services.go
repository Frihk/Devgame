package services

import (
	"errors"
	"sync"

	"Devgame/backend/internal/models"
)

type LiquidationService struct {
	mu          sync.RWMutex
	propService *PropertyService
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

	// Start with their current on-hand cash balance
	maxCashRaised := player.Cash

	for _, prop := range playerProperties {
		if prop.OwnerID != nil && *prop.OwnerID == player.ID {
			// 1. Add cash value of selling developments back to the bank (50% value = Ksh 1,000 per lodge)
			if prop.LodgeCount > 0 {
				maxCashRaised += int64(prop.LodgeCount) * 1000
			}

			// 2. Add mortgage liquidity value if the property isn't already mortgaged
			if !prop.Mortgaged && prop.SquareType == models.SquareTypeProperty {
				maxCashRaised += 2000
			}
		}
	}

	return maxCashRaised
}

// DeclareBankruptcy processes total insolvency, stripping player assets only if they cannot clear their debt.
func (s *LiquidationService) DeclareBankruptcy(player *models.PlayerState, playerProperties []*models.PropertyState, debtOwed int64, creditorID *string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 1. Safety Check: Verify if their maximum asset value could actually save them from this debt
	maxCapacity := s.CheckLiquidationCapacity(player, playerProperties)
	if maxCapacity >= debtOwed {
		return errors.New("cannot declare bankruptcy: player still has sufficient asset capacity to liquidate and cover this debt")
	}

	// 2. Asset Wipeout Loop (Forced transfer or return to market)
	for _, prop := range playerProperties {
		if prop.OwnerID != nil && *prop.OwnerID == player.ID {
			// Developments must be wiped out (sold back to bank implicitly)
			prop.LodgeCount = 0

			if creditorID != nil {
				// Hand the property directly to the player they owe money to
				prop.OwnerID = creditorID
				// Note: Per standard rules, properties retain mortgage state on transfer
			} else {
				// Money was owed to the bank; return unmortgaged property to the open market
				prop.OwnerID = nil
				prop.Mortgaged = false
				prop.LockedByDealID = nil
			}
		}
	}

	// 3. Flag the player as completely bankrupt and out of the game
	player.Cash = 0
	player.Status = models.PlayerStatusBankrupt

	return nil
}
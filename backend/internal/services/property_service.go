package services

import (
	"errors"
	"sync"

	"Devgame/backend/internal/models"
)

type PropertyService struct {
	mu sync.RWMutex
	// We map by int since PropertyID matches the 0-39 BoardPosition index
	properties map[int]*models.PropertyState 
}

func NewPropertyService(initialProperties map[int]*models.PropertyState) *PropertyService {
	return &PropertyService{
		properties: initialProperties,
	}
}

// BuildLodge handles the Phase 1 structural write-path for adding a building.
func (s *PropertyService) BuildLodge(propertyID int, userID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	prop, exists := s.properties[propertyID]
	if !exists {
		return errors.New("property tile not found in game state")
	}

	// 1. Core Rulebook Validations
	if prop.OwnerID == nil || *prop.OwnerID != userID {
		return errors.New("unauthorized: user does not own this property")
	}
	if prop.SquareType != models.SquareTypeProperty {
		return errors.New("cannot build lodges on utilities or transport hubs")
	}
	if prop.Mortgaged {
		return errors.New("cannot build on a mortgaged property")
	}
	if prop.LockedByDealID != nil {
		return errors.New("property is currently locked in a pending trade negotiation")
	}
	if prop.LodgeCount >= 4 { // Max 4 per rulebook (4 = Luxury Resort)
		return errors.New("property already reached maximum luxury resort development tier")
	}

	// 2. Even-Building Rule Checks
	// Sospeter will provide a way to check color groups via board config,
	// but for our structural state validation:
	for _, p := range s.properties {
		if p.SquareType == models.SquareTypeProperty && p.OwnerID != nil && *p.OwnerID == userID {
			if p.Mortgaged {
				return errors.New("cannot build while a property in this color group is mortgaged")
			}
			// Target property cannot exceed sister properties by more than 1 building
			if prop.LodgeCount+1 > p.LodgeCount+1 {
				return errors.New("must build evenly across all properties in this color group")
			}
		}
	}

	prop.LodgeCount++
	return nil
}
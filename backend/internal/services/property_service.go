package services

import (
	"errors"
	"sync"

	"Devgame/backend/internal/models"
)

type PropertyService struct {
	mu         sync.RWMutex
	properties map[int]*models.PropertyState
}

// NewPropertyService instantiates a new real estate controller.
func NewPropertyService(initialProperties map[int]*models.PropertyState) *PropertyService {
	return &PropertyService{
		properties: initialProperties,
	}
}

func getColorGroupIDs(id int) []int {
	// Static mapping based on standard Monopoly board layouts (0-39 positions)
	groups := [][]int{
		{1, 3},       // Brown
		{6, 8, 9},    // Light Blue
		{11, 13, 14}, // Pink
		{16, 18, 19}, // Orange
		{21, 23, 24}, // Red
		{26, 27, 29}, // Yellow
		{31, 32, 34}, // Green
		{37, 39},     // Dark Blue
	}

	for _, group := range groups {
		for _, memberID := range group {
			if memberID == id {
				return group
			}
		}
	}
	return nil // If it's a utility or transit hub, return nil
}

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
	if prop.LodgeCount >= 4 { // Max 4 per rulebook
		return errors.New("property already reached maximum luxury resort development tier")
	}

	// Fetch valid sister property IDs for this color set
	sisterIDs := getColorGroupIDs(propertyID)
	if sisterIDs == nil {
		return errors.New("invalid operation: target square does not belong to a valid buildable color set")
	}

	// 2. Monopoly Even-Building Rule Checks
	for _, id := range sisterIDs {
		sisterProp, exists := s.properties[id]
		if !exists {
			return errors.New("critical: sister property missing from game state")
		}

		// Rule A: Full Monopoly Requirement across the color block
		if sisterProp.OwnerID == nil || *sisterProp.OwnerID != userID {
			return errors.New("cannot build until you own the complete color group monopoly")
		}

		// Rule B: Mortgage Restriction across the set
		if sisterProp.Mortgaged {
			return errors.New("cannot build while a sister property in this color group is mortgaged")
		}

		// Rule C: The Airtight Even-Building Math
		// Your target's NEXT house count cannot be more than 1 house higher
		// than any sister property's CURRENT house count.
		if (prop.LodgeCount + 1) > (sisterProp.LodgeCount + 1) {
			return errors.New("must build evenly: this choice puts this property too far ahead of its sister properties")
		}
	}

	// All checks pass safely! Increment the lodge count.
	prop.LodgeCount++
	return nil
}

package services

import (
	"encoding/json"
	"errors"
	"fmt"

	"Devgame/backend/internal/models"
)

type SquareInfo struct {
	Position  int
	Name      string
	Type      models.SquareType
	Group     string
	Price     int64
	LodgeCost int64
	Rent      [5]int64
	TaxAmount int64
}

var boardLayout = func() []SquareInfo {
	return []SquareInfo{
		{Position: 0, Name: "Go", Type: models.SquareTypeGo},
		{Position: 1, Name: "Githurai", Type: models.SquareTypeProperty, Group: "Terracotta", Price: 600, LodgeCost: 300, Rent: [5]int64{60, 300, 900, 2700, 5500}},
		{Position: 2, Name: "Community Chest", Type: models.SquareTypeCommunityChest},
		{Position: 3, Name: "Eastleigh", Type: models.SquareTypeProperty, Group: "Terracotta", Price: 600, LodgeCost: 300, Rent: [5]int64{60, 300, 900, 2700, 5500}},
		{Position: 4, Name: "Gov Tax", Type: models.SquareTypeTax, TaxAmount: 1500},
		{Position: 5, Name: "Maasai Mara", Type: models.SquareTypeTransportHub, Price: 2000},
		{Position: 6, Name: "Ngong Road", Type: models.SquareTypeProperty, Group: "Sky Blue", Price: 1000, LodgeCost: 500, Rent: [5]int64{80, 400, 1200, 3600, 7500}},
		{Position: 7, Name: "Chance", Type: models.SquareTypeChance},
		{Position: 8, Name: "Thika Road", Type: models.SquareTypeProperty, Group: "Sky Blue", Price: 1000, LodgeCost: 500, Rent: [5]int64{80, 400, 1200, 3600, 7500}},
		{Position: 9, Name: "Jogoo Road", Type: models.SquareTypeProperty, Group: "Sky Blue", Price: 1200, LodgeCost: 600, Rent: [5]int64{100, 500, 1500, 4500, 9000}},
		{Position: 10, Name: "Gereza (Jail)", Type: models.SquareTypeJail},
		{Position: 11, Name: "Westlands", Type: models.SquareTypeProperty, Group: "Maasai Pink", Price: 1400, LodgeCost: 700, Rent: [5]int64{120, 600, 1800, 5400, 11000}},
		{Position: 12, Name: "KPLC", Type: models.SquareTypeUtility, Price: 1500},
		{Position: 13, Name: "Ngara", Type: models.SquareTypeProperty, Group: "Maasai Pink", Price: 1400, LodgeCost: 700, Rent: [5]int64{120, 600, 1800, 5400, 11000}},
		{Position: 14, Name: "Upper Hill", Type: models.SquareTypeProperty, Group: "Maasai Pink", Price: 1600, LodgeCost: 800, Rent: [5]int64{140, 700, 2100, 6300, 12500}},
		{Position: 15, Name: "Amboseli", Type: models.SquareTypeTransportHub, Price: 2000},
		{Position: 16, Name: "Kilimani", Type: models.SquareTypeProperty, Group: "Savanna Orange", Price: 1800, LodgeCost: 900, Rent: [5]int64{160, 800, 2400, 7200, 14000}},
		{Position: 17, Name: "Community Chest", Type: models.SquareTypeCommunityChest},
		{Position: 18, Name: "Kileleshwa", Type: models.SquareTypeProperty, Group: "Savanna Orange", Price: 1800, LodgeCost: 900, Rent: [5]int64{160, 800, 2400, 7200, 14000}},
		{Position: 19, Name: "Lavington", Type: models.SquareTypeProperty, Group: "Savanna Orange", Price: 2000, LodgeCost: 1000, Rent: [5]int64{180, 900, 2700, 8100, 16000}},
		{Position: 20, Name: "Uhuru Park (Free Parking)", Type: models.SquareTypeFreeParking},
		{Position: 21, Name: "Parklands", Type: models.SquareTypeProperty, Group: "Sunset Red", Price: 2200, LodgeCost: 1100, Rent: [5]int64{200, 1000, 3000, 9000, 17500}},
		{Position: 22, Name: "Chance", Type: models.SquareTypeChance},
		{Position: 23, Name: "Riverside", Type: models.SquareTypeProperty, Group: "Sunset Red", Price: 2200, LodgeCost: 1100, Rent: [5]int64{200, 1000, 3000, 9000, 17500}},
		{Position: 24, Name: "Spring Valley", Type: models.SquareTypeProperty, Group: "Sunset Red", Price: 2400, LodgeCost: 1200, Rent: [5]int64{220, 1100, 3300, 9900, 19500}},
		{Position: 25, Name: "Tsavo East", Type: models.SquareTypeTransportHub, Price: 2000},
		{Position: 26, Name: "Runda", Type: models.SquareTypeProperty, Group: "Savanna Gold", Price: 2600, LodgeCost: 1300, Rent: [5]int64{240, 1200, 3600, 10800, 21000}},
		{Position: 27, Name: "Gigiri", Type: models.SquareTypeProperty, Group: "Savanna Gold", Price: 2600, LodgeCost: 1300, Rent: [5]int64{240, 1200, 3600, 10800, 21000}},
		{Position: 28, Name: "Nairobi Water", Type: models.SquareTypeUtility, Price: 1500},
		{Position: 29, Name: "Nyari", Type: models.SquareTypeProperty, Group: "Savanna Gold", Price: 2800, LodgeCost: 1400, Rent: [5]int64{260, 1300, 3900, 11700, 23000}},
		{Position: 30, Name: "Nenda Gerezani", Type: models.SquareTypeGoToJail},
		{Position: 31, Name: "Loresho", Type: models.SquareTypeProperty, Group: "Acacia Green", Price: 3000, LodgeCost: 1500, Rent: [5]int64{280, 1400, 4200, 12600, 25000}},
		{Position: 32, Name: "Ridgeways", Type: models.SquareTypeProperty, Group: "Acacia Green", Price: 3000, LodgeCost: 1500, Rent: [5]int64{280, 1400, 4200, 12600, 25000}},
		{Position: 33, Name: "Chance", Type: models.SquareTypeChance},
		{Position: 34, Name: "Rosslyn", Type: models.SquareTypeProperty, Group: "Acacia Green", Price: 3200, LodgeCost: 1600, Rent: [5]int64{300, 1500, 4500, 13500, 26500}},
		{Position: 35, Name: "Lake Nakuru", Type: models.SquareTypeTransportHub, Price: 2000},
		{Position: 36, Name: "Community Chest", Type: models.SquareTypeCommunityChest},
		{Position: 37, Name: "Muthaiga", Type: models.SquareTypeProperty, Group: "Royal Gold", Price: 3500, LodgeCost: 1750, Rent: [5]int64{350, 1750, 5250, 15750, 31000}},
		{Position: 38, Name: "Luxury Tax", Type: models.SquareTypeTax, TaxAmount: 1000},
		{Position: 39, Name: "Karen", Type: models.SquareTypeProperty, Group: "Royal Gold", Price: 4000, LodgeCost: 2000, Rent: [5]int64{400, 2000, 6000, 18000, 35000}},
	}
}()

var squareByPosition map[int]*SquareInfo

func init() {
	squareByPosition = make(map[int]*SquareInfo, len(boardLayout))
	for i := range boardLayout {
		s := &boardLayout[i]
		squareByPosition[s.Position] = s
	}
}

func GetSquareInfo(position int) (*SquareInfo, error) {
	s, ok := squareByPosition[position]
	if !ok {
		return nil, fmt.Errorf("no square at position %d", position)
	}
	return s, nil
}

type BoardService struct{}

func NewBoardService() *BoardService {
	return &BoardService{}
}

func (s *BoardService) ResolveSquare(state *models.GameState, playerID string, position int, diceRoll int) ([]models.WSEvent, error) {
	info, err := GetSquareInfo(position)
	if err != nil {
		return nil, err
	}

	switch info.Type {
	case models.SquareTypeProperty, models.SquareTypeTransportHub, models.SquareTypeUtility:
		return s.resolveOwnableSquare(state, playerID, info, diceRoll)

	case models.SquareTypeTax:
		return s.resolveTaxSquare(state, playerID, info)

	case models.SquareTypeChance, models.SquareTypeCommunityChest:
		deckType := "chance"
		if info.Type == models.SquareTypeCommunityChest {
			deckType = "community_chest"
		}
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"deckType": deckType,
			"position": position,
		})
		return []models.WSEvent{{
			Type:    "card_drawn",
			Payload: payload,
		}}, nil

	case models.SquareTypeGoToJail:
		player := findPlayer(state, playerID)
		if player == nil {
			return nil, errors.New("player not found")
		}
		player.BoardPosition = 10
		player.Status = models.PlayerStatusJailed
		player.JailTurnsRemaining = 3

		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"reason":   "go_to_jail",
		})
		return []models.WSEvent{{
			Type:    "player_jailed",
			Payload: payload,
		}}, nil

	case models.SquareTypeGo, models.SquareTypeJail, models.SquareTypeFreeParking:
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"position": position,
		})
		return []models.WSEvent{{
			Type:    "landed",
			Payload: payload,
		}}, nil

	default:
		return nil, fmt.Errorf("unresolved square type %q at position %d", info.Type, position)
	}
}

func (s *BoardService) resolveOwnableSquare(state *models.GameState, playerID string, info *SquareInfo, diceRoll int) ([]models.WSEvent, error) {
	var prop *models.PropertyState
	for i := range state.Properties {
		if state.Properties[i].PropertyID == info.Position {
			prop = &state.Properties[i]
			break
		}
	}

	if prop == nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId":   playerID,
			"name":       info.Name,
			"price":      info.Price,
			"position":   info.Position,
			"squareType": info.Type,
		})
		return []models.WSEvent{{
			Type:    "unowned_landed",
			Payload: payload,
		}}, nil
	}

	if prop.OwnerID == nil {
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId":   playerID,
			"name":       info.Name,
			"price":      info.Price,
			"position":   info.Position,
			"squareType": info.Type,
		})
		return []models.WSEvent{{
			Type:    "property_available",
			Payload: payload,
		}}, nil
	}

	if *prop.OwnerID == playerID {
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"position": info.Position,
		})
		return []models.WSEvent{{
			Type:    "landed_own_property",
			Payload: payload,
		}}, nil
	}

	if prop.Mortgaged {
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId":   playerID,
			"ownerId":    *prop.OwnerID,
			"position":   info.Position,
			"mortgaged":  true,
		})
		return []models.WSEvent{{
			Type:    "landed_mortgaged",
			Payload: payload,
		}}, nil
	}

	rent := s.calculateRent(state, info, prop, diceRoll)

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId":   playerID,
		"ownerId":    *prop.OwnerID,
		"rent":       rent,
		"position":   info.Position,
		"lodgeCount": prop.LodgeCount,
	})
	return []models.WSEvent{{
		Type:    "rent_payable",
		Payload: payload,
	}}, nil
}

func (s *BoardService) resolveTaxSquare(state *models.GameState, playerID string, info *SquareInfo) ([]models.WSEvent, error) {
	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}

	if player.Cash < info.TaxAmount {
		payload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"amount":   info.TaxAmount,
			"reason":   "insufficient_funds",
		})
		return []models.WSEvent{{
			Type:    "tax_insolvent",
			Payload: payload,
		}}, nil
	}

	player.Cash -= info.TaxAmount

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
		"amount":   info.TaxAmount,
		"taxName":  info.Name,
	})
	return []models.WSEvent{{
		Type:    "tax_paid",
		Payload: payload,
	}}, nil
}

func (s *BoardService) calculateRent(state *models.GameState, info *SquareInfo, prop *models.PropertyState, diceRoll int) int64 {
	switch prop.SquareType {
	case models.SquareTypeProperty:
		return info.Rent[prop.LodgeCount]
	case models.SquareTypeTransportHub:
		count := countOwnedByGroup(state, *prop.OwnerID, models.SquareTypeTransportHub)
		switch count {
		case 1:
			return 250
		case 2:
			return 500
		case 3:
			return 1000
		case 4:
			return 2000
		default:
			return 250
		}
	case models.SquareTypeUtility:
		count := countOwnedByGroup(state, *prop.OwnerID, models.SquareTypeUtility)
		multiplier := int64(4)
		if count >= 2 {
			multiplier = 10
		}
		return multiplier * int64(diceRoll)
	default:
		return 0
	}
}

func countOwnedByGroup(state *models.GameState, ownerID string, squareType models.SquareType) int {
	count := 0
	for _, p := range state.Properties {
		if p.OwnerID != nil && *p.OwnerID == ownerID && p.SquareType == squareType {
			count++
		}
	}
	return count
}

func findPlayer(state *models.GameState, playerID string) *models.PlayerState {
	for i := range state.Players {
		if state.Players[i].ID == playerID {
			return &state.Players[i]
		}
	}
	return nil
}

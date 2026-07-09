package services

import (
	"encoding/json"
	"errors"
	"math/rand"
	"sync"

	"Devgame/backend/internal/models"
)

type CardEffectType string

const (
	CardEffectCash      CardEffectType = "cash"
	CardEffectMove      CardEffectType = "move"
	CardEffectGoToJail  CardEffectType = "go_to_jail"
	CardEffectJailFree  CardEffectType = "jail_free"
	CardEffectAdvance   CardEffectType = "advance"
)

type Card struct {
	ID     string         `json:"id"`
	Title  string         `json:"title"`
	Deck   string         `json:"deck"`
	Effect CardEffectType `json:"effect"`
	Amount int64          `json:"amount,omitempty"`
	Target int            `json:"target,omitempty"`
}

type CardService struct {
	mu              sync.RWMutex
	chanceDeck      []Card
	communityDeck   []Card
	chanceDrawIdx   int
	communityDrawIdx int
}

func NewCardService() *CardService {
	cs := &CardService{}
	cs.chanceDeck = make([]Card, len(chanceCards))
	cs.communityDeck = make([]Card, len(communityChestCards))
	copy(cs.chanceDeck, chanceCards[:])
	copy(cs.communityDeck, communityChestCards[:])
	cs.ShuffleDecks()
	return cs
}

func (s *CardService) ShuffleDecks() {
	s.mu.Lock()
	defer s.mu.Unlock()

	rand.Shuffle(len(s.chanceDeck), func(i, j int) {
		s.chanceDeck[i], s.chanceDeck[j] = s.chanceDeck[j], s.chanceDeck[i]
	})
	rand.Shuffle(len(s.communityDeck), func(i, j int) {
		s.communityDeck[i], s.communityDeck[j] = s.communityDeck[j], s.communityDeck[i]
	})
	s.chanceDrawIdx = 0
	s.communityDrawIdx = 0
}

func (s *CardService) DrawCard(deckType string) (Card, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var deck []Card
	var idx *int

	switch deckType {
	case "chance":
		deck = s.chanceDeck
		idx = &s.chanceDrawIdx
	case "community_chest":
		deck = s.communityDeck
		idx = &s.communityDrawIdx
	default:
		return Card{}, errors.New("unknown deck type: " + deckType)
	}

	if len(deck) == 0 {
		return Card{}, errors.New("deck is empty")
	}

	if *idx >= len(deck) {
		rand.Shuffle(len(deck), func(i, j int) {
			deck[i], deck[j] = deck[j], deck[i]
		})
		*idx = 0
	}

	card := deck[*idx]
	*idx++
	return card, nil
}

func (s *CardService) ExecuteCardEffect(state *models.GameState, playerID string, card Card, diceRoll int) ([]models.WSEvent, error) {
	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}

	switch card.Effect {
	case CardEffectCash:
		player.Cash += card.Amount

		cashPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"amount":   card.Amount,
			"reason":   card.Title,
		})
		return []models.WSEvent{{
			Type:    "card_effect",
			Payload: cashPayload,
		}}, nil

	case CardEffectGoToJail:
		player.BoardPosition = 10
		player.Status = models.PlayerStatusJailed
		player.JailTurnsRemaining = MaxJailTurns

		jailPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"reason":   "card",
			"card":     card.Title,
		})
		return []models.WSEvent{{
			Type:    "player_jailed",
			Payload: jailPayload,
		}}, nil

	case CardEffectJailFree:
		player.HasJailFreeCard = true

		cardPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"card":     card.Title,
		})
		return []models.WSEvent{{
			Type:    "card_effect",
			Payload: cardPayload,
		}}, nil

	case CardEffectMove:
		oldPosition := player.BoardPosition
		newPosition := card.Target

		if newPosition < oldPosition {
			player.Cash += GoSalary
			salaryPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": playerID,
				"amount":   GoSalary,
			})
			movePayload, _ := json.Marshal(map[string]interface{}{
				"playerId":  playerID,
				"from":      oldPosition,
				"to":        newPosition,
				"totalRoll": 0,
				"reason":    "card",
			})
			return []models.WSEvent{
				{Type: "salary_collected", Payload: salaryPayload},
				{Type: "player_moved", Payload: movePayload},
			}, nil
		}

		player.BoardPosition = newPosition
		movePayload, _ := json.Marshal(map[string]interface{}{
			"playerId":  playerID,
			"from":      oldPosition,
			"to":        newPosition,
			"totalRoll": 0,
			"reason":    "card",
		})
		return []models.WSEvent{{
			Type:    "player_moved",
			Payload: movePayload,
		}}, nil

	case CardEffectAdvance:
		oldPosition := player.BoardPosition
		newPosition := (oldPosition + card.Target) % BoardSize

		if newPosition < oldPosition || (oldPosition+card.Target) >= BoardSize {
			player.Cash += GoSalary
			salaryPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": playerID,
				"amount":   GoSalary,
			})
			movePayload, _ := json.Marshal(map[string]interface{}{
				"playerId":  playerID,
				"from":      oldPosition,
				"to":        newPosition,
				"totalRoll": card.Target,
				"reason":    "card",
			})
			player.BoardPosition = newPosition
			return []models.WSEvent{
				{Type: "salary_collected", Payload: salaryPayload},
				{Type: "player_moved", Payload: movePayload},
			}, nil
		}

		player.BoardPosition = newPosition
		movePayload, _ := json.Marshal(map[string]interface{}{
			"playerId":  playerID,
			"from":      oldPosition,
			"to":        newPosition,
			"totalRoll": card.Target,
			"reason":    "card",
		})
		return []models.WSEvent{{
			Type:    "player_moved",
			Payload: movePayload,
		}}, nil

	default:
		return nil, errors.New("unknown card effect type: " + string(card.Effect))
	}
}

var chanceCards = []Card{
	{ID: "ch_01", Deck: "chance", Title: "Advance to Go. Collect Ksh 2,000.", Effect: CardEffectMove, Target: 0},
	{ID: "ch_02", Deck: "chance", Title: "Advance to Githurai. If unowned, you may buy it.", Effect: CardEffectMove, Target: 1},
	{ID: "ch_03", Deck: "chance", Title: "Advance to Ngong Road. If unowned, you may buy it.", Effect: CardEffectMove, Target: 6},
	{ID: "ch_04", Deck: "chance", Title: "Bank pays you a dividend of Ksh 500.", Effect: CardEffectCash, Amount: 500},
	{ID: "ch_05", Deck: "chance", Title: "Go to Jail. Do not pass Go. Do not collect Ksh 2,000.", Effect: CardEffectGoToJail},
	{ID: "ch_06", Deck: "chance", Title: "Make general repairs on all your property. Pay Ksh 250 per lodge.", Effect: CardEffectCash, Amount: -250},
	{ID: "ch_07", Deck: "chance", Title: "Pay poor tax of Ksh 150.", Effect: CardEffectCash, Amount: -150},
	{ID: "ch_08", Deck: "chance", Title: "Advance to Westlands.", Effect: CardEffectMove, Target: 11},
	{ID: "ch_09", Deck: "chance", Title: "You have been elected Chairman of the Board. Pay each player Ksh 500.", Effect: CardEffectCash, Amount: -500},
	{ID: "ch_10", Deck: "chance", Title: "Your building loan matures. Collect Ksh 1,500.", Effect: CardEffectCash, Amount: 1500},
	{ID: "ch_11", Deck: "chance", Title: "Go back 3 spaces.", Effect: CardEffectAdvance, Target: -3},
	{ID: "ch_12", Deck: "chance", Title: "Advance to Karen. If unowned, you may buy it.", Effect: CardEffectMove, Target: 39},
	{ID: "ch_13", Deck: "chance", Title: "Take a trip to Maasai Mara. Advance to Maasai Mara.", Effect: CardEffectMove, Target: 5},
	{ID: "ch_14", Deck: "chance", Title: "You won a raffle! Collect Ksh 1,000.", Effect: CardEffectCash, Amount: 1000},
	{ID: "ch_15", Deck: "chance", Title: "Get Out of Jail Free.", Effect: CardEffectJailFree},
	{ID: "ch_16", Deck: "chance", Title: "Advance to Lavington. If unowned, you may buy it.", Effect: CardEffectMove, Target: 19},
}

var communityChestCards = []Card{
	{ID: "cc_01", Deck: "community_chest", Title: "Advance to Go. Collect Ksh 2,000.", Effect: CardEffectMove, Target: 0},
	{ID: "cc_02", Deck: "community_chest", Title: "Bank error in your favor. Collect Ksh 2,000.", Effect: CardEffectCash, Amount: 2000},
	{ID: "cc_03", Deck: "community_chest", Title: "Doctor's fees. Pay Ksh 500.", Effect: CardEffectCash, Amount: -500},
	{ID: "cc_04", Deck: "community_chest", Title: "From sale of matatu, you get Ksh 500.", Effect: CardEffectCash, Amount: 500},
	{ID: "cc_05", Deck: "community_chest", Title: "Get Out of Jail Free.", Effect: CardEffectJailFree},
	{ID: "cc_06", Deck: "community_chest", Title: "Go to Jail. Do not pass Go. Do not collect Ksh 2,000.", Effect: CardEffectGoToJail},
	{ID: "cc_07", Deck: "community_chest", Title: "Holiday fund matures. Collect Ksh 1,000.", Effect: CardEffectCash, Amount: 1000},
	{ID: "cc_08", Deck: "community_chest", Title: "Income tax refund. Collect Ksh 200.", Effect: CardEffectCash, Amount: 200},
	{ID: "cc_09", Deck: "community_chest", Title: "It is your birthday. Collect Ksh 100 from each player.", Effect: CardEffectCash, Amount: 100},
	{ID: "cc_10", Deck: "community_chest", Title: "Life insurance matures. Collect Ksh 1,000.", Effect: CardEffectCash, Amount: 1000},
	{ID: "cc_11", Deck: "community_chest", Title: "Pay hospital fees of Ksh 1,000.", Effect: CardEffectCash, Amount: -1000},
	{ID: "cc_12", Deck: "community_chest", Title: "Pay school fees of Ksh 500.", Effect: CardEffectCash, Amount: -500},
	{ID: "cc_13", Deck: "community_chest", Title: "Receive Ksh 250 consultancy fee.", Effect: CardEffectCash, Amount: 250},
	{ID: "cc_14", Deck: "community_chest", Title: "You are assessed for street repairs. Pay Ksh 400 per lodge.", Effect: CardEffectCash, Amount: -400},
	{ID: "cc_15", Deck: "community_chest", Title: "You have won second prize in a beauty contest. Collect Ksh 100.", Effect: CardEffectCash, Amount: 100},
	{ID: "cc_16", Deck: "community_chest", Title: "You inherit Ksh 2,000.", Effect: CardEffectCash, Amount: 2000},
}

package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"Devgame/backend/internal/models"
)

const (
	GoSalary         = 2000
	BailAmount       = 1000
	BoardSize        = 40
	MaxDoublesToJail = 3
	MaxJailTurns     = 3
	DefaultTurnSecs  = 60
)

type TurnService struct {
	boardService *BoardService
}

func NewTurnService(boardSvc *BoardService) *TurnService {
	return &TurnService{
		boardService: boardSvc,
	}
}

func (s *TurnService) StartTurn(state *models.GameState, playerID string) ([]models.WSEvent, error) {
	if state.Status != models.GameStatusInProgress {
		return nil, errors.New("game is not in progress")
	}

	player := findPlayer(state, playerID)
	if player == nil {
		return nil, errors.New("player not found")
	}
	if player.Status == models.PlayerStatusBankrupt || player.Status == models.PlayerStatusEliminated {
		return nil, errors.New("eliminated players cannot take turns")
	}

	turnID := fmt.Sprintf("turn_%s_%d", state.ID, time.Now().UnixNano())

	state.Turn = models.TurnState{
		TurnID:         turnID,
		ActivePlayerID: playerID,
		Phase:          models.TurnPhaseAwaitingRoll,
		DoublesCount:   0,
		TimerExpiresAt: time.Now().Add(DefaultTurnSecs * time.Second).UnixMilli(),
	}

	payload, _ := json.Marshal(map[string]interface{}{
		"playerId":        playerID,
		"turnId":          turnID,
		"timerExpiresAt":  state.Turn.TimerExpiresAt,
	})
	return []models.WSEvent{{
		Type:    "turn_started",
		Payload: payload,
	}}, nil
}

func (s *TurnService) RollDice(state *models.GameState, playerID string) (dice1, dice2 int, events []models.WSEvent, err error) {
	if state.Turn.ActivePlayerID != playerID {
		return 0, 0, nil, errors.New("it is not your turn")
	}
	if state.Turn.Phase != models.TurnPhaseAwaitingRoll {
		return 0, 0, nil, errors.New("cannot roll now: turn phase is not awaiting_roll")
	}

	player := findPlayer(state, playerID)
	if player == nil {
		return 0, 0, nil, errors.New("player not found")
	}

	dice1 = rand.Intn(6) + 1
	dice2 = rand.Intn(6) + 1
	total := dice1 + dice2
	isDoubles := dice1 == dice2

	dicePayload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
		"dice1":    dice1,
		"dice2":    dice2,
	})
	events = append(events, models.WSEvent{
		Type:    "dice_rolled",
		Payload: dicePayload,
	})

	if player.Status == models.PlayerStatusJailed {
		return s.handleJailRoll(state, player, dice1, dice2, isDoubles, events)
	}

	if isDoubles {
		state.Turn.DoublesCount++
		if state.Turn.DoublesCount >= MaxDoublesToJail {
			player.BoardPosition = 10
			player.Status = models.PlayerStatusJailed
			player.JailTurnsRemaining = MaxJailTurns
			state.Turn.Phase = models.TurnPhaseFreeAction

			jailPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": playerID,
				"reason":   "three_doubles",
			})
			events = append(events, models.WSEvent{
				Type:    "player_jailed",
				Payload: jailPayload,
			})
			return dice1, dice2, events, nil
		}
	} else {
		state.Turn.DoublesCount = 0
	}

	oldPosition := player.BoardPosition
	newPosition := (oldPosition + total) % BoardSize

	if newPosition < oldPosition || (oldPosition+total) >= BoardSize {
		player.Cash += GoSalary
		salaryPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"amount":   GoSalary,
		})
		events = append(events, models.WSEvent{
			Type:    "salary_collected",
			Payload: salaryPayload,
		})
	}

	player.BoardPosition = newPosition

	movePayload, _ := json.Marshal(map[string]interface{}{
		"playerId":   playerID,
		"from":       oldPosition,
		"to":         newPosition,
		"totalRoll":  total,
	})
	events = append(events, models.WSEvent{
		Type:    "player_moved",
		Payload: movePayload,
	})

	squareEvents, err := s.boardService.ResolveSquare(state, playerID, newPosition, total)
	if err != nil {

		fallbackPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": playerID,
			"position": newPosition,
		})
		events = append(events, models.WSEvent{
			Type:    "landed",
			Payload: fallbackPayload,
		})
	} else {
		events = append(events, squareEvents...)
	}

	if isDoubles {
		state.Turn.Phase = models.TurnPhaseAwaitingRoll
	} else {
		state.Turn.Phase = models.TurnPhaseFreeAction
	}

	return dice1, dice2, events, nil
}

func (s *TurnService) handleJailRoll(state *models.GameState, player *models.PlayerState, dice1, dice2 int, isDoubles bool, events []models.WSEvent) (int, int, []models.WSEvent, error) {
	if isDoubles {
		player.Status = models.PlayerStatusActive
		player.JailTurnsRemaining = 0

		releasePayload, _ := json.Marshal(map[string]interface{}{
			"playerId": player.ID,
			"method":   "doubles",
		})
		events = append(events, models.WSEvent{
			Type:    "player_released_from_jail",
			Payload: releasePayload,
		})

		oldPosition := player.BoardPosition
		total := dice1 + dice2
		newPosition := (oldPosition + total) % BoardSize

		if newPosition < oldPosition || (oldPosition+total) >= BoardSize {
			player.Cash += GoSalary
			salaryPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": player.ID,
				"amount":   GoSalary,
			})
			events = append(events, models.WSEvent{
				Type:    "salary_collected",
				Payload: salaryPayload,
			})
		}

		player.BoardPosition = newPosition

		movePayload, _ := json.Marshal(map[string]interface{}{
			"playerId":  player.ID,
			"from":      10,
			"to":        newPosition,
			"totalRoll": total,
		})
		events = append(events, models.WSEvent{
			Type:    "player_moved",
			Payload: movePayload,
		})

		squareEvents, err := s.boardService.ResolveSquare(state, player.ID, newPosition, total)
		if err != nil {
			fallbackPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": player.ID,
				"position": newPosition,
			})
			events = append(events, models.WSEvent{
				Type:    "landed",
				Payload: fallbackPayload,
			})
		} else {
			events = append(events, squareEvents...)
		}

		state.Turn.Phase = models.TurnPhaseFreeAction
		return dice1, dice2, events, nil
	}

	player.JailTurnsRemaining--

	if player.JailTurnsRemaining <= 0 {
		if player.Cash < BailAmount {
			player.Status = models.PlayerStatusBankrupt
			bankruptPayload, _ := json.Marshal(map[string]interface{}{
				"playerId": player.ID,
				"reason":   "cannot_afford_bail",
			})
			events = append(events, models.WSEvent{
				Type:    "player_bankrupt",
				Payload: bankruptPayload,
			})
			return dice1, dice2, events, nil
		}

		player.Cash -= BailAmount
		player.Status = models.PlayerStatusActive
		player.JailTurnsRemaining = 0

		bailPayload, _ := json.Marshal(map[string]interface{}{
			"playerId": player.ID,
			"method":   "auto_bail",
			"amount":   BailAmount,
		})
		events = append(events, models.WSEvent{
			Type:    "player_released_from_jail",
			Payload: bailPayload,
		})

		state.Turn.Phase = models.TurnPhaseFreeAction
	} else {
		state.Turn.Phase = models.TurnPhaseFreeAction
	}

	return dice1, dice2, events, nil
}

func (s *TurnService) EndTurn(state *models.GameState, playerID string) ([]models.WSEvent, error) {
	if state.Turn.ActivePlayerID != playerID {
		return nil, errors.New("it is not your turn")
	}
	if state.Turn.Phase != models.TurnPhaseFreeAction {
		return nil, errors.New("cannot end turn in current phase")
	}

	state.Turn.Phase = models.TurnPhaseEnded

	nextIdx := -1
	for i, p := range state.Players {
		if p.ID == playerID {
			nextIdx = (i + 1) % len(state.Players)
			break
		}
	}

	nextPlayer := advanceToNextActive(state, nextIdx)
	if nextPlayer == nil {
		endPayload, _ := json.Marshal(map[string]interface{}{
			"winnerId": playerID,
		})
		return []models.WSEvent{{
			Type:    "game_ended",
			Payload: endPayload,
		}}, nil
	}

	state.Turn.ActivePlayerID = nextPlayer.ID
	state.Turn.Phase = models.TurnPhaseAwaitingRoll
	state.Turn.DoublesCount = 0
	state.Turn.TimerExpiresAt = time.Now().Add(DefaultTurnSecs * time.Second).UnixMilli()

	turnPayload, _ := json.Marshal(map[string]interface{}{
		"previousPlayerId": playerID,
		"nextPlayerId":     nextPlayer.ID,
	})

	endPayload, _ := json.Marshal(map[string]interface{}{
		"playerId": playerID,
	})
	return []models.WSEvent{
		{Type: "turn_ended", Payload: endPayload},
		{Type: "turn_started", Payload: turnPayload},
	}, nil
}

func (s *TurnService) HandleTurnTimerExpiry(state *models.GameState) ([]models.WSEvent, error) {
	if state.Status != models.GameStatusInProgress {
		return nil, errors.New("game is not in progress")
	}

	playerID := state.Turn.ActivePlayerID

	state.Turn.Phase = models.TurnPhaseEnded

	nextIdx := -1
	for i, p := range state.Players {
		if p.ID == playerID {
			nextIdx = (i + 1) % len(state.Players)
			break
		}
	}

	nextPlayer := advanceToNextActive(state, nextIdx)
	if nextPlayer == nil {
		endPayload, _ := json.Marshal(map[string]interface{}{
			"winnerId": playerID,
		})
		return []models.WSEvent{{
			Type:    "game_ended",
			Payload: endPayload,
		}}, nil
	}

	state.Turn.ActivePlayerID = nextPlayer.ID
	state.Turn.Phase = models.TurnPhaseAwaitingRoll
	state.Turn.DoublesCount = 0
	state.Turn.TimerExpiresAt = time.Now().Add(DefaultTurnSecs * time.Second).UnixMilli()

	return []models.WSEvent{
		{Type: "turn_ended", Payload: func() json.RawMessage { p, _ := json.Marshal(map[string]interface{}{"playerId": playerID, "reason": "timer_expired"}); return p }()},
		{Type: "turn_started", Payload: func() json.RawMessage { p, _ := json.Marshal(map[string]interface{}{"previousPlayerId": playerID, "nextPlayerId": nextPlayer.ID}); return p }()},
	}, nil
}

func advanceToNextActive(state *models.GameState, startIdx int) *models.PlayerState {
	for i := 0; i < len(state.Players); i++ {
		idx := (startIdx + i) % len(state.Players)
		p := state.Players[idx]
		if p.Status != models.PlayerStatusBankrupt && p.Status != models.PlayerStatusEliminated {
			return &state.Players[idx]
		}
	}
	return nil
}

package services

import (
	"encoding/json"
	"fmt"
	"log"

	"Devgame/backend/internal/models"
)

// RoomTimers encapsulates time-driven logic.
type RoomTimers struct{}

// Room represents a single active game room actor.
type Room struct {
	ID             string
	State          *models.GameState
	Inbox          chan models.Command
	Timers         *RoomTimers
	clients        map[string]chan models.WSEvent // map of playerID to their write channel
	Broadcast      func(event models.WSEvent)
	propertySvc    *PropertyService
	tradeSvc       *TradeService
	auctionSvc     *AuctionService
	liquidationSvc *LiquidationService
}

// NewRoom creates a new game room actor.
func NewRoom(id string) *Room {
	r := &Room{
		ID: id,
		State: &models.GameState{
			ID:     id,
			Status: models.GameStatusLobby,
			Seq:    0,
		},
		Inbox:          make(chan models.Command, 100),
		Timers:         &RoomTimers{},
		clients:        make(map[string]chan models.WSEvent),
		propertySvc:    &PropertyService{},
		tradeSvc:       &TradeService{},
		auctionSvc:     &AuctionService{},
		liquidationSvc: &LiquidationService{},
	}

	r.Broadcast = func(event models.WSEvent) {
		event.RoomID = r.ID
		r.State.Seq++
		event.Seq = r.State.Seq
		
		for pid, ch := range r.clients {
			select {
			case ch <- event:
			default:
				log.Printf("Warning: Dropped message for player %s in room %s", pid, r.ID)
			}
		}
	}
	return r
}

func (r *Room) routeCommand(cmd models.Command) ([]models.WSEvent, error) {
	switch cmd.Type {
	case models.ActionRollDice:
		return r.handleRollDice(cmd)
	case models.ActionEndTurn:
		return r.handleEndTurn(cmd)
	case models.ActionBuildLodge:
		return r.handleBuildLodge(cmd)
	case models.ActionMortgageProperty:
		return r.handleMortgageProperty(cmd)
	case "start_game":
		return r.handleStartGame(cmd)
	case "get_state":
		return r.handleGetState(cmd)
	default:
		log.Printf("Room %s: Unknown command type %s from %s", r.ID, cmd.Type, cmd.PlayerID)
		return []models.WSEvent{{
			Type:    string(cmd.Type) + "_ack",
			Payload: cmd.Payload,
		}}, nil
	}
}

func (r *Room) handleRollDice(cmd models.Command) ([]models.WSEvent, error) {
	ts := NewTurnService(NewBoardService())
	_, _, events, err := ts.RollDice(r.State, cmd.PlayerID)
	return events, err
}

func (r *Room) handleEndTurn(cmd models.Command) ([]models.WSEvent, error) {
	ts := NewTurnService(NewBoardService())
	return ts.EndTurn(r.State, cmd.PlayerID)
}

func (r *Room) handleBuildLodge(cmd models.Command) ([]models.WSEvent, error) {
	var payload struct {
		PropertyID int `json:"propertyId"`
	}
	if err := json.Unmarshal(cmd.Payload, &payload); err != nil {
		return nil, err
	}
	if err := r.propertySvc.BuildLodge(payload.PropertyID, cmd.PlayerID); err != nil {
		return nil, err
	}
	resPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId": payload.PropertyID,
		"playerId":   cmd.PlayerID,
	})
	return []models.WSEvent{{
		Type:    "lodge_built",
		Payload: resPayload,
	}}, nil
}

func (r *Room) handleMortgageProperty(cmd models.Command) ([]models.WSEvent, error) {
	var payload struct {
		PropertyID int `json:"propertyId"`
	}
	if err := json.Unmarshal(cmd.Payload, &payload); err != nil {
		return nil, err
	}
	if err := r.propertySvc.MortgageProperty(payload.PropertyID, cmd.PlayerID); err != nil {
		return nil, err
	}
	resPayload, _ := json.Marshal(map[string]interface{}{
		"propertyId": payload.PropertyID,
		"playerId":   cmd.PlayerID,
		"mortgaged":  true,
	})
	return []models.WSEvent{{
		Type:    "property_mortgaged",
		Payload: resPayload,
	}}, nil
}

func (r *Room) handleStartGame(cmd models.Command) ([]models.WSEvent, error) {
	r.State.Status = models.GameStatusInProgress

	r.State.Players = nil
	for pid := range r.clients {
		r.State.Players = append(r.State.Players, models.PlayerState{
			ID:            pid,
			Name:          pid,
			Cash:          15000,
			Status:        models.PlayerStatusActive,
			BoardPosition: 0,
		})
	}

	r.State.Properties = nil
	for _, sq := range boardLayout {
		if sq.Type == models.SquareTypeProperty || sq.Type == models.SquareTypeTransportHub || sq.Type == models.SquareTypeUtility {
			r.State.Properties = append(r.State.Properties, models.PropertyState{
				PropertyID:    sq.Position,
				BoardPosition: sq.Position,
				SquareType:    sq.Type,
				OwnerID:       nil,
				Mortgaged:     false,
				LodgeCount:    0,
			})
		}
	}

	if len(r.State.Players) > 0 {
		turnService := NewTurnService(NewBoardService())
		turnService.StartTurn(r.State, r.State.Players[0].ID)
	}

	stateJSON, _ := json.Marshal(r.State)
	return []models.WSEvent{
		{Type: "game_started", Payload: stateJSON},
		{Type: "state_sync", Payload: stateJSON},
	}, nil
}

func (r *Room) handleGetState(cmd models.Command) ([]models.WSEvent, error) {
	stateJSON, _ := json.Marshal(r.State)
	return []models.WSEvent{{
		Type:    "state_sync",
		Payload: stateJSON,
	}}, nil
}

// Run starts the room actor's command processing loop.
func (r *Room) Run() {
	log.Printf("Room %s: Actor loop started", r.ID)
	for cmd := range r.Inbox {
		events, err := r.dispatch(cmd)
		if err != nil {
			errPayload, _ := json.Marshal(map[string]string{"message": err.Error()})
			r.Broadcast(models.WSEvent{
				Type:    "error",
				Payload: errPayload,
				CmdID:   cmd.CmdID,
			})
			continue
		}
		for _, event := range events {
			event.CmdID = cmd.CmdID
			r.Broadcast(event)
		}
	}
	log.Printf("Room %s: Actor loop stopped", r.ID)
}

// dispatch routes the command to the relevant service and handles panics safely.
func (r *Room) dispatch(cmd models.Command) (events []models.WSEvent, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("Room %s: PANIC in dispatch: %v", r.ID, rec)
			err = fmt.Errorf("internal error processing %s", cmd.Type)
		}
	}()

	switch cmd.Type {
	case "internal_register_client":
		reg := cmd.Internal.(models.ClientRegistration)
		r.clients[reg.PlayerID] = reg.Channel
		return []models.WSEvent{{
			Type:    "player_connected",
			Payload: json.RawMessage(fmt.Sprintf(`{"playerId": "%s"}`, reg.PlayerID)),
		}}, nil
	case "internal_unregister_client":
		pid := cmd.Internal.(string)
		delete(r.clients, pid)
		return []models.WSEvent{{
			Type:    "player_disconnected",
			Payload: json.RawMessage(fmt.Sprintf(`{"playerId": "%s"}`, pid)),
		}}, nil
	default:
		return r.routeCommand(cmd)
	}
}

// Package models defines the core game-state types shared across the
// backend. These are the Go-side half of the shared contract defined in
// shared/enums/gameStatus.js and shared/schemas/gameSchema.js -- keep
// field names and enum values in sync between the two. See
// docs/ARCHITECTURE.md Section 5.
//
// UNITS: every cash/price/rent field in this file is a whole Ksh amount
// (matches the rulebook's Ksh 15,000 / Ksh 2,000 figures directly) --
// there are no minor units (no cents-equivalent). Do not multiply or
// divide by 100 anywhere in the pipeline.
package models

// GameStatus mirrors shared/enums/gameStatus.js -> GameStatus
type GameStatus string

const (
	GameStatusLobby      GameStatus = "lobby"
	GameStatusInProgress GameStatus = "in_progress"
	GameStatusEnded      GameStatus = "ended"
)

// WinCondition mirrors shared/enums/gameStatus.js -> WinCondition.
// Rulebook Section 1: Bankruptcy is the default; NetWorth is optional and
// still needs design confirmation (rulebook "Open Items").
type WinCondition string

const (
	WinConditionBankruptcy WinCondition = "bankruptcy"
	WinConditionNetWorth   WinCondition = "net_worth"
)

// SquareType mirrors shared/enums/gameStatus.js -> SquareType. Covers all
// 40 board positions (rulebook Section 2). Only Property, TransportHub,
// and Utility squares are "ownable" and get an entry in
// GameState.Properties -- the other 7 types are fixed board furniture
// with no per-game dynamic state of their own.
//
// Rent/purchase logic differs by type (rulebook Sections 4.1-4.3):
//   SquareTypeProperty     -> rent scales with lodge development tier (Section 7)
//   SquareTypeTransportHub -> rent scales with count of hubs owned by same player
//   SquareTypeUtility      -> rent is a multiplier of the dice roll that landed here
type SquareType string

const (
	SquareTypeProperty       SquareType = "property"
	SquareTypeTransportHub   SquareType = "transport_hub"
	SquareTypeUtility        SquareType = "utility"
	SquareTypeGo             SquareType = "go"
	SquareTypeJail           SquareType = "jail" // doubles as "Just Visiting" depending on how the player arrived -- rulebook Section 4.4
	SquareTypeFreeParking    SquareType = "free_parking"
	SquareTypeGoToJail       SquareType = "go_to_jail"
	SquareTypeChance         SquareType = "chance"
	SquareTypeCommunityChest SquareType = "community_chest"
	SquareTypeTax            SquareType = "tax"
)

// GameState is the full authoritative state for one room, owned exclusively
// by that room's Room Actor goroutine (docs/ARCHITECTURE.md Section 3.1).
// Nothing outside game_room.go should mutate this directly. Mirrors
// shared/schemas/gameSchema.js -> GameState.
type GameState struct {
	ID             string          `json:"id"`
	Status         GameStatus      `json:"status"`
	WinCondition   WinCondition    `json:"winCondition"`
	Seq            uint64          `json:"seq"` // monotonically increasing broadcast sequence, used for reconnect replay
	Turn           TurnState       `json:"turn"`
	Players        []PlayerState   `json:"players"`
	// Properties holds the 28 ownable squares only (22 Properties + 4
	// Transport Hubs + 2 Utilities per rulebook Section 2). The other 12
	// board positions (GO, Jail, Free Parking, Go To Jail, 3x Chance, 3x
	// Community Chest, 2x Tax) have no ownership state and are NOT
	// entries here.
	Properties     []PropertyState `json:"properties"`
	PendingDeal    *PendingDeal    `json:"pendingDeal,omitempty"`
	PendingAuction *PendingAuction `json:"pendingAuction,omitempty"`
}

// TurnPhase mirrors the phase strings documented in gameSchema.js.
type TurnPhase string

const (
	TurnPhaseAwaitingRoll    TurnPhase = "awaiting_roll"
	TurnPhaseResolvingSquare TurnPhase = "resolving_square"
	TurnPhaseFreeAction      TurnPhase = "free_action"
	TurnPhaseEnded           TurnPhase = "ended"
)

type TurnState struct {
	TurnID         string    `json:"turnId"`
	ActivePlayerID string    `json:"activePlayerId"`
	Phase          TurnPhase `json:"phase"`
	DoublesCount   int       `json:"doublesCount"`   // consecutive doubles this turn -- 3 sends the player to Jail, rulebook Section 3
	TimerExpiresAt int64     `json:"timerExpiresAt"` // epoch ms
}

// PlayerStatus mirrors the status strings in gameSchema.js.
type PlayerStatus string

const (
	PlayerStatusActive      PlayerStatus = "active"
	PlayerStatusJailed      PlayerStatus = "jailed"
	PlayerStatusLiquidating PlayerStatus = "liquidating"
	PlayerStatusBankrupt    PlayerStatus = "bankrupt"
	PlayerStatusEliminated  PlayerStatus = "eliminated"
)

type PlayerState struct {
	ID                 string       `json:"id"`
	Name               string       `json:"name"`
	Cash               int64        `json:"cash"` // whole Ksh, see UNITS note above
	Status             PlayerStatus `json:"status"`
	BoardPosition      int          `json:"boardPosition"`      // 0-39, current token position
	JailTurnsRemaining int          `json:"jailTurnsRemaining"` // meaningful only when Status == Jailed, max 3 per rulebook Section 5
	HasJailFreeCard    bool         `json:"hasJailFreeCard"`
}

// PropertyState represents one of the 28 ownable squares. PropertyID is
// deliberately equal to BoardPosition -- board position already uniquely
// and permanently identifies a square, so there is no separate ID scheme.
type PropertyState struct {
	PropertyID     int        `json:"propertyId"`          // primary key; equal to BoardPosition (0-39, rulebook Section 2)
	BoardPosition  int        `json:"boardPosition"`       // always equal to PropertyID; kept as its own field so board-rendering code doesn't have to know the identity is intentional
	SquareType     SquareType `json:"squareType"`          // restricted to Property | TransportHub | Utility for entries in this array
	OwnerID        *string    `json:"ownerId,omitempty"`
	Mortgaged      bool       `json:"mortgaged"`
	LodgeCount     int        `json:"lodgeCount"`               // 0-4, 4 = Luxury Resort tier. Only meaningful when SquareType == SquareTypeProperty (rulebook Section 7)
	LockedByDealID *string    `json:"lockedByDealId,omitempty"` // set while attached to a pending_deal, addendum Sections 2.2/3.2
}

// DealPhase mirrors the phase strings in gameSchema.js.
type DealPhase string

const (
	DealPhaseNegotiating DealPhase = "negotiating"
	DealPhaseBroadcast   DealPhase = "broadcast"
	DealPhaseIntercept   DealPhase = "intercept"
	DealPhaseFinalized   DealPhase = "finalized"
	DealPhaseRejected    DealPhase = "rejected"
	DealPhaseFailed      DealPhase = "failed"
)

type TradeTerms struct {
	OfferedPropertyIDs   []int `json:"offeredPropertyIds"`   // references PropertyState.PropertyID
	RequestedPropertyIDs []int `json:"requestedPropertyIds"` // references PropertyState.PropertyID
	OfferedCash          int64 `json:"offeredCash"`          // whole Ksh
	RequestedCash        int64 `json:"requestedCash"`        // whole Ksh
	OfferedJailCard      bool  `json:"offeredJailCard"`
	RequestedJailCard    bool  `json:"requestedJailCard"`
}

type PendingDeal struct {
	ID             string     `json:"id"`
	ProposerID     string     `json:"proposerId"`
	CounterpartyID string     `json:"counterpartyId"`
	Phase          DealPhase  `json:"phase"`
	LeadingOffer   TradeTerms `json:"leadingOffer"`
	// LeadingOfferFromID is the player whose offer is currently leading
	// during the intercept window (rulebook Section 6.3). May be the
	// original proposer, the counterparty, or a third player who
	// submitted an intercept_offer -- NOT "bidder" terminology, this is
	// a trade, not an auction.
	LeadingOfferFromID *string `json:"leadingOfferFromId,omitempty"`
	DeadlineMS         int64   `json:"deadline"` // epoch ms
}

type AuctionPhase string

const (
	AuctionPhaseOpen   AuctionPhase = "open"
	AuctionPhaseClosed AuctionPhase = "closed"
)

type PendingAuction struct {
	PropertyID      int          `json:"propertyId"` // references PropertyState.PropertyID
	Phase           AuctionPhase `json:"phase"`
	CurrentBid      int64        `json:"currentBid"` // whole Ksh
	CurrentBidderID *string      `json:"currentBidderId,omitempty"`
	DeadlineMS      int64        `json:"deadline"` // epoch ms
}

const GameSchemaVersion = 2

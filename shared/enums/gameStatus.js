// shared/enums/gameStatus.js
//
// Mirrors backend/internal/models/game.go -> GameStatus, WinCondition,
// SquareType. Keep these in sync -- values are used as wire-format
// strings in WebSocket payloads (docs/ARCHITECTURE.md Section 6).

export const GameStatus = Object.freeze({
  LOBBY: 'lobby',
  IN_PROGRESS: 'in_progress',
  ENDED: 'ended',
});

// rulebook Section 1 -- win_condition. NET_WORTH mode is optional and
// still needs design confirmation (rulebook "Open Items").
export const WinCondition = Object.freeze({
  BANKRUPTCY: 'bankruptcy',
  NET_WORTH: 'net_worth',
});

// SquareType covers all 40 board positions (rulebook Section 2). Only
// PROPERTY, TRANSPORT_HUB, and UTILITY squares are "ownable" and get an
// entry in GameState.properties (see gameSchema.js) -- the other 7 types
// are fixed board furniture with no per-game dynamic state of their own.
//
// Rent/purchase logic differs by type (rulebook Sections 4.1-4.3):
//   PROPERTY       -> rent scales with lodge development tier (Section 7)
//   TRANSPORT_HUB  -> rent scales with count of hubs owned by same player
//   UTILITY        -> rent is a multiplier of the dice roll that landed here
export const SquareType = Object.freeze({
  PROPERTY: 'property',
  TRANSPORT_HUB: 'transport_hub',
  UTILITY: 'utility',
  GO: 'go',
  JAIL: 'jail', // doubles as "Just Visiting" depending on how the player arrived -- rulebook Section 4.4
  FREE_PARKING: 'free_parking',
  GO_TO_JAIL: 'go_to_jail',
  CHANCE: 'chance',
  COMMUNITY_CHEST: 'community_chest',
  TAX: 'tax',
});

// TurnPhase mirrors backend/internal/models/game.go -> TurnPhase
export const TurnPhase = Object.freeze({
  AWAITING_ROLL: 'awaiting_roll',
  RESOLVING_SQUARE: 'resolving_square',
  FREE_ACTION: 'free_action',
  ENDED: 'ended',
});

// PlayerStatus mirrors backend/internal/models/game.go -> PlayerStatus
export const PlayerStatus = Object.freeze({
  ACTIVE: 'active',
  JAILED: 'jailed',
  LIQUIDATING: 'liquidating',
  BANKRUPT: 'bankrupt',
  ELIMINATED: 'eliminated',
});

// DealPhase mirrors backend/internal/models/game.go -> DealPhase
export const DealPhase = Object.freeze({
  NEGOTIATING: 'negotiating',
  BROADCAST: 'broadcast',
  INTERCEPT: 'intercept',
  FINALIZED: 'finalized',
  REJECTED: 'rejected',
  FAILED: 'failed',
});

// AuctionPhase mirrors backend/internal/models/game.go -> AuctionPhase
export const AuctionPhase = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
});
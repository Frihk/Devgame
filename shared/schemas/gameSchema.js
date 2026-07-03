// shared/schemas/gameSchema.js
//
// Mirrors backend/internal/models/game.go -> GameState.
// This is the shape of the full game-state object embedded in a full
// state-sync broadcast. Not every WS event includes the full object --
// see docs/ARCHITECTURE.md Section 6 for the event catalog -- but any
// client reconciling from a full resync (e.g. after reconnect) should
// expect exactly this shape.
//
// Kept as JSDoc typedefs rather than a runtime validation library so
// there's zero added dependency risk for the hackathon timeline. If you
// want runtime validation later, these typedefs translate directly to a
// zod/io-ts schema without changing field names.
//
// UNITS: every cash/price/rent field in this file is a whole Ksh amount
// (matches the rulebook's Ksh 15,000 / Ksh 2,000 figures directly) --
// there are no minor units (no cents-equivalent). Do not multiply or
// divide by 100 anywhere in the pipeline.

/**
 * @typedef {Object} GameState
 * @property {string} id
 * @property {string} status - one of GameStatus values (shared/enums/gameStatus.js)
 * @property {string} winCondition - one of WinCondition values
 * @property {number} seq - monotonically increasing broadcast sequence number, used for reconnect replay
 * @property {TurnState} turn
 * @property {PlayerState[]} players
 * @property {PropertyState[]} properties - the 28 ownable squares only (22 Properties + 4 Transport Hubs + 2 Utilities per rulebook Section 2). The other 12 board positions (GO, Jail, Free Parking, Go To Jail, 3x Chance, 3x Community Chest, 2x Tax) have no ownership state and are NOT entries here -- see propertyId note below.
 * @property {PendingDeal|null} pendingDeal
 * @property {PendingAuction|null} pendingAuction
 */

/**
 * @typedef {Object} TurnState
 * @property {string} turnId
 * @property {string} activePlayerId
 * @property {string} phase - one of TurnPhase values (shared/enums/gameStatus.js)
 * @property {number} doublesCount - consecutive doubles rolled this turn; 3 sends the player to Jail (rulebook Section 3)
 * @property {number} timerExpiresAt - epoch ms
 */

/**
 * @typedef {Object} PlayerState
 * @property {string} id
 * @property {string} name
 * @property {number} cash - whole Ksh, see UNITS note above
 * @property {string} status - one of PlayerStatus values (shared/enums/gameStatus.js)
 * @property {number} boardPosition - 0-39, current token position (distinct from a property's boardPosition below -- a player's position is where their token sits; it happens to use the same 0-39 numbering as the board)
 * @property {number} jailTurnsRemaining - meaningful only when status === 'jailed'; max 3 (rulebook Section 5)
 * @property {boolean} hasJailFreeCard
 */

/**
 * @typedef {Object} PropertyState
 * @property {number} propertyId - primary key for this property. Equal to its fixed boardPosition (0-39, rulebook Section 2) -- there is deliberately no separate ID scheme, since board position already uniquely and permanently identifies a square. TradeTerms below references properties by this same value.
 * @property {number} boardPosition - always equal to propertyId; kept as its own named field so board-rendering code doesn't have to know the ID/position identity is intentional
 * @property {string} squareType - one of SquareType values, restricted to 'property' | 'transport_hub' | 'utility' for entries in this array (the only ownable types) -- determines which rent formula applies (rulebook Sections 4.1-4.3)
 * @property {string|null} ownerId
 * @property {boolean} mortgaged
 * @property {number} lodgeCount - 0-4, where 4 = Luxury Resort tier. Only meaningful when squareType === 'property' -- Transport Hubs and Utilities are never developed with lodges (rulebook Section 7)
 * @property {string|null} lockedByDealId - set while attached to a pending_deal (addendum Sections 2.2/3.2)
 */

/**
 * @typedef {Object} TradeTerms
 * @property {number[]} offeredPropertyIds - references PropertyState.propertyId
 * @property {number[]} requestedPropertyIds - references PropertyState.propertyId
 * @property {number} offeredCash - whole Ksh
 * @property {number} requestedCash - whole Ksh
 * @property {boolean} offeredJailCard
 * @property {boolean} requestedJailCard
 */

/**
 * @typedef {Object} PendingDeal
 * @property {string} id
 * @property {string} proposerId
 * @property {string} counterpartyId
 * @property {string} phase - one of DealPhase values (shared/enums/gameStatus.js)
 * @property {TradeTerms} leadingOffer
 * @property {string|null} leadingOfferFromId - the player whose offer is currently leading during the intercept window (rulebook Section 6.3). May be the original proposer, the counterparty, or a third player who submitted an intercept_offer -- NOT "bidder" terminology, this is a trade, not an auction.
 * @property {number} deadline - epoch ms
 */

/**
 * @typedef {Object} PendingAuction
 * @property {number} propertyId - references PropertyState.propertyId
 * @property {string} phase - one of AuctionPhase values (shared/enums/gameStatus.js)
 * @property {number} currentBid - whole Ksh
 * @property {string|null} currentBidderId
 * @property {number} deadline - epoch ms
 */

export const GAME_SCHEMA_VERSION = 2;
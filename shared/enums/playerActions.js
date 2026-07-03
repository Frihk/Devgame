// shared/enums/playerActions.js
//
// Mirrors backend/internal/models/actions.go -> ActionType.
// Every action a client can send to the backend over WebSocket. The `type`
// field of every outbound WS command (docs/ARCHITECTURE.md Section 3.4)
// must be one of these values. This file only defines the vocabulary --
// the dispatch logic that routes these into services lives in
// game_room.go (Ian, Phase 0).

export const PlayerAction = Object.freeze({
  // Turn actions -- rulebook Section 3
  ROLL_DICE: 'roll_dice',
  END_TURN: 'end_turn',

  // Property actions -- rulebook Sections 4.1-4.3, 7, 8
  BUY_PROPERTY: 'buy_property',
  DECLINE_PROPERTY: 'decline_property',
  PAY_RENT: 'pay_rent',
  MORTGAGE_PROPERTY: 'mortgage_property',
  UNMORTGAGE_PROPERTY: 'unmortgage_property',
  BUILD_LODGE: 'build_lodge',
  SELL_LODGE: 'sell_lodge',

  // Jail actions -- rulebook Section 5
  PAY_BAIL: 'pay_bail',
  USE_JAIL_CARD: 'use_jail_card',

  // Trade actions -- rulebook Section 6, addendum Section 1
  PROPOSE_TRADE: 'propose_trade',
  UPDATE_TRADE_OFFER: 'update_trade_offer',
  ACCEPT_TRADE: 'accept_trade',
  INTERCEPT_OFFER: 'intercept_offer',

  // Auction actions -- rulebook Section 10
  SUBMIT_BID: 'submit_bid',

  // Liquidation / raise-cash actions -- rulebook Section 9, addendum Section 2.3
  RAISE_CASH: 'raise_cash',
});

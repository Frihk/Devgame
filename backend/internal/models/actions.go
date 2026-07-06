package models

// ActionType mirrors shared/enums/playerActions.js -> PlayerAction.
// These are the legal values for Command.Type once the Room Actor
// (game_room.go, Ian, Phase 0) is in place. This file only defines the
// vocabulary, not the dispatch logic -- see docs/ARCHITECTURE.md
// Section 3.4.
type ActionType string

const (
	// Turn actions -- rulebook Section 3
	ActionRollDice ActionType = "roll_dice"
	ActionEndTurn  ActionType = "end_turn"

	// Property actions -- rulebook Sections 4.1-4.3, 7, 8
	ActionBuyProperty        ActionType = "buy_property"
	ActionDeclineProperty    ActionType = "decline_property"
	ActionPayRent            ActionType = "pay_rent"
	ActionMortgageProperty   ActionType = "mortgage_property"
	ActionUnmortgageProperty ActionType = "unmortgage_property"
	ActionBuildLodge         ActionType = "build_lodge"
	ActionSellLodge          ActionType = "sell_lodge"

	// Jail actions -- rulebook Section 5
	ActionPayBail     ActionType = "pay_bail"
	ActionUseJailCard ActionType = "use_jail_card"

	// Trade actions -- rulebook Section 6, addendum Section 1
	ActionProposeTrade     ActionType = "propose_trade"
	ActionUpdateTradeOffer ActionType = "update_trade_offer"
	ActionAcceptTrade      ActionType = "accept_trade"
	ActionInterceptOffer   ActionType = "intercept_offer"

	// Auction actions -- rulebook Section 10
	ActionSubmitBid ActionType = "submit_bid"

	// Liquidation / raise-cash actions -- rulebook Section 9, addendum Section 2.3
)
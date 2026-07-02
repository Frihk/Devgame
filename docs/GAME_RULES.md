# Zaji — Game Rulebook (v1.0)
### Backend Reference Specification

This document defines the core rules and state logic for Zaji (working title), a Kenyan-themed, real-time multiplayer property-trading game. It is written for backend developers implementing game state, turn logic, and WebSocket event handling — not as a player-facing manual.

---

## 1. Game Setup

- **Players per room:** 2–6
- **Starting cash:** configurable per room (default Ksh 15,000)
- **Turn timer:** configurable per room (default 60s per turn)
- **Win condition:** last player remaining who is not bankrupt (Bankruptcy goal mode), OR highest net worth when a configured turn/time limit is reached (Net Worth goal mode — optional, confirm before implementing)
- **Map:** selectable board theme (e.g., "Nairobi Central"); board layout structure is fixed at 40 squares regardless of theme skin.

---

## 2. Board Structure (40 Squares)

The board is a fixed 40-square loop, 11 squares per side including shared corners.

| Category | Count | Notes |
|---|---|---|
| Properties | 22 | 8 color-coded groups, sized 2-2-3-3-3-3-3-3 |
| Transport Hubs (Railroads) | 4 | Themed as rail/port/pier/junction |
| Utilities | 2 | Electric Company, Water Works equivalent |
| Corner squares | 4 | GO, Jail/Just Visiting, Free Parking, Go To Jail |
| Chance spaces | 3 | Distributed around the board, not clustered |
| Community Chest spaces | 3 | Distributed around the board, not clustered |
| Tax squares | 2 | Income Tax, Luxury/Super Tax |
| **Total** | **40** | |

Each square has a fixed `board_position` (0–39) used for movement calculations. Position 0 = GO.

---

## 3. Turn Structure

1. Active player rolls dice (two 6-sided dice).
2. Player token advances by the sum of the roll.
3. **Doubles rule:** rolling doubles grants an extra turn immediately after resolving the current square. Rolling doubles 3 times in a row sends the player directly to Jail (movement, not passing GO).
4. Resolve the landed square (see Section 4).
5. Player may initiate trades, mortgage/unmortgage properties, or build lodges during their turn (see Sections 6–7), subject to game-state restrictions (e.g., cannot build if in Jail).
6. Player ends turn (manually via "End Turn" or auto-ended when turn timer expires).
7. If turn timer expires with an unresolved mandatory action (e.g., unpaid rent), auto-resolve using the Bankruptcy/Liquidation flow (Section 9).

**Passing GO:** player collects a fixed salary (default Ksh 2,000) each time they pass or land on GO.

---

## 4. Square Resolution Logic

### 4.1 Property Square
- **Unowned + player can afford purchase price:** trigger property popup — options are `buy` or `auction`.
- **Unowned + player cannot afford purchase price:** trigger property popup — `buy` is disabled, `auction` is the only enabled action.
- **Owned by another player:** trigger rent popup — display rent due, single action `pay_rent`. Rent is calculated based on development level (see Section 7). Payment is mandatory; if player cannot pay, trigger Bankruptcy/Liquidation flow.
- **Owned by current player:** no popup required, informational only.
- **Mortgaged property owned by another player:** no rent is due while mortgaged.

### 4.2 Transport Hub (Railroad)
- Same buy/rent logic as properties, but rent scales by number of hubs owned by the same player (not by "lodges"), typically doubling per additional hub owned (standard: 1 hub = base rent, 2 = 2x, 3 = 4x, 4 = 8x — confirm exact multiplier table with design before implementing).

### 4.3 Utility
- Same buy/rent logic as properties, but rent is calculated as a multiplier of the dice roll that landed the player on the square (standard: 1 utility owned = 4x dice roll, both utilities owned = 10x dice roll — confirm multiplier with design).

### 4.4 Corner Squares
- **GO:** collect salary (see Section 3), no further action.
- **Jail / Just Visiting:** if arriving via normal movement, player is "Just Visiting" (no penalty). If sent to Jail (via Go To Jail square, Chance/Community Chest card, or 3x doubles), player enters `in_jail` state (see Section 5).
- **Free Parking:** no action (standard rules — no cash pool accumulation unless a house rule is explicitly enabled per room settings).
- **Go To Jail:** player is immediately moved to the Jail square and flagged `in_jail = true`. Does NOT collect GO salary even if this movement would pass GO.

### 4.5 Chance / Community Chest
- Draw a card from the respective deck (each deck is a fixed set of cards, shuffled at game start, reshuffled when exhausted).
- Card effects execute automatically (no player decision required) — examples: cash gain/loss, movement to a specific square (may trigger GO salary if passed), "Get Out of Jail Free" card (stored on player state until used or traded).
- Resolve any square-landing effects triggered by card-driven movement (e.g., if a card moves the player onto an owned property, resolve rent normally).

### 4.6 Tax Squares
- Player pays a fixed amount (Income Tax) or a fixed higher amount (Luxury/Super Tax) directly to the bank. No popup decision required — mandatory deduction. Insufficient funds triggers Bankruptcy/Liquidation flow.

---

## 5. Jail Rules

- A player `in_jail` may not move on their turn until released.
- Release conditions (any one):
  - Roll doubles on their turn (immediately moves by the doubled amount, no extra turn granted from this doubles roll).
  - Pay a fixed bail amount voluntarily.
  - Use a stored "Get Out of Jail Free" card.
  - Remain in jail a maximum of 3 turns; on the 3rd failed attempt, bail is auto-deducted and the player is released and moves per that turn's roll.
- While in jail, a player may still trade, mortgage, and receive rent from other players landing on their properties.

---

## 6. Trading System

### 6.1 Direct Trade (no interception)
Used for simple, low-value trades where speed matters more than fairness — configurable per room whether this path is enabled at all, or whether ALL trades must go through broadcast (Section 6.3).

### 6.2 PUBLIC Negotiation Room (eVERYONE IS ABLE TO SEE THE DEAL MAKING PROCESS)
- Any two players may open a private chat room (text + optional voice) to negotiate terms.
- Room is scoped to exactly two participants; not visible or joinable by other players.
- Trade offers are composed within this room as structured objects (properties offered/requested by each side, cash offered/requested by each side).
- Both parties must explicitly `accept` the same finalized offer before it proceeds to broadcast.

### 6.3 Public Broadcast & Intercept Phase
Once both negotiating players accept, the deal does not complete immediately:

1. A `pending_deal` object is broadcast to all players in the room via WebSocket, containing: proposing players, offered terms, and a countdown timer (default 20s).
2. Any other player may submit exactly **one** counter-offer during this window (`intercept_offer`).
3. If a counter-offer is submitted with less than 15 seconds remaining on the timer, extend the timer by 15 seconds ("sniper protection"). This may repeat multiple times if late counters keep coming in.
4. The current leading offer is tracked and broadcast live to all players as it changes.
5. When the timer expires with no further counters:
   - Execute the leading offer: transfer properties and cash between the relevant parties, update ownership markers on the board state, and mark all other submitted counter-offers as `rejected`.
   - Notify the original negotiating pair in their private room of the outcome (`deal_completed` if their offer won, `deal_intercepted` if outbid).
   - Log the finalized trade as a `recent_activity` entry visible to all players.

*** It is worthing nothing that the deal can also be intercepted when you are doing the negotiation, other players are free to give you offers that they see better than the one you are currently offered ***


### 6.4 Trade Validation Rules
- A property currently mortgaged may still be traded, but the receiving player must either pay off the mortgage immediately or accept the property in its mortgaged state (confirm which behavior is intended before implementing — standard Monopoly rule requires immediate payoff or a 10% fee).
- Players cannot offer properties they do not currently own, or cash they do not currently have — validate server-side, not just client-side, before accepting any offer.

---

## 7. Property Development (Lodges)

- Only a player who owns **all properties in a color group** may build lodges on that group.
- Lodges must be built evenly across a group (cannot build a 2nd lodge on one property in a group until all properties in that group have at least 1 lodge) — standard "even building" rule.
- Development tiers per property: 0 lodges (base rent) → 1 → 2 → 3 lodges → Luxury Resort (max tier).
- Each tier has a fixed build cost (`lodge_cost`) and a fixed resulting rent value, both defined per property in the board config data.
- Selling lodges (reverse of building) returns a fixed fraction of build cost to the player (standard: 50%) and must also be done evenly across the group.

---

## 8. Mortgaging

- A player may mortgage any unmortgaged, lodge-free property they own to receive its `mortgage_value` in cash immediately.
- A property with lodges built on it must have all lodges sold before it can be mortgaged.
- A mortgaged property earns no rent from other players landing on it.
- To unmortgage, the owning player pays back the mortgage value plus a fixed interest fee (standard: 10%).

---

## 9. Bankruptcy & Liquidation Flow

Triggered whenever a player owes a debt (rent, tax, card effect) they cannot immediately cover with cash on hand.

1. **Liquidation phase:** player is presented with their full property portfolio and may mortgage properties and/or sell lodges to raise cash, in any order, until either the debt is covered or no further assets remain.
2. **If debt is covered:** deduct the amount owed, pay the creditor (another player or the bank), resume normal turn flow.
3. **If debt cannot be covered after full liquidation:** player is marked `bankrupt` and `eliminated`.
   - If the debt was owed to another player, all remaining assets (mortgaged properties, cash) transfer to that creditor.
   - If the debt was owed to the bank (tax, etc.), all remaining properties return to the bank and become available for auction.
   - Eliminated player is removed from the active turn order but remains in the room as a spectator.

---

## 10. Auctions

- Triggered when: a property is declined at purchase (or the buyer cannot afford it), or a bankrupt player's properties return to the bank.
- All active players (excluding, where applicable, the player who declined to buy) may submit bids.
- Standard ascending-bid auction: players submit increasing bids within a short time window; auction closes after a period of no new bids (recommend a short "sniper protection" extension identical in pattern to Section 6.3, e.g., 10s reset per new bid).
- Highest bidder pays their bid amount to the bank and receives the property. If no bids are submitted, the property remains unowned by the bank.

---

## 11. Voice & Chat

- **Main game room:** all active players share one voice/text channel by default (mute controls are per-player, client-side).
- **Private negotiation rooms:** scoped voice + text channel limited to exactly the two negotiating players; not accessible or audible to others in the game.
- Spectators (eliminated players) may retain read access to main game chat but should not have voice/text access to any active private negotiation room.

---

## 12. State Sync Requirements (WebSocket Events — non-exhaustive)

Backend should emit events for at minimum:

- `player_moved`, `dice_rolled`
- `property_purchased`, `property_declined`, `auction_started`, `auction_bid`, `auction_closed`
- `rent_paid`
- `card_drawn` (Chance/Community Chest)
- `tax_paid`
- `lodge_built`, `lodge_sold`
- `property_mortgaged`, `property_unmortgaged`
- `trade_proposed`, `trade_accepted_pending_broadcast`, `intercept_offer_submitted`, `trade_finalized`, `trade_intercepted`
- `player_jailed`, `player_released_from_jail`
- `player_bankrupt`, `player_eliminated`
- `turn_started`, `turn_ended`, `turn_timer_extended`
- `game_ended`

All state-changing events should be validated server-side before broadcast — client-submitted actions (bids, trade offers, purchase decisions) must never be trusted at face value given the real-money-equivalent stakes within the game economy.


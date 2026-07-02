# Zaji — Rules Addendum: Deals, Mortgages & Lodges (v1.0)
### Backend Reference Specification

This addendum expands on three subsystems that need precise allowed/not-allowed logic for backend enforcement: trading/deal-making, mortgaging, and lodge (house) building. It should be read alongside the main rulebook (`GAME_RULES.md`).

---

## 1. Deal-Making Rules

### 1.1 What can be included in a deal
A trade offer between two players may include any combination of:
- One or more properties (unowned-by-bank, i.e. currently owned by one of the two trading players)
- Cash (either direction, or both — e.g., "Property A + Ksh 1,000" for "Property B")
- A stored "Get Out of Jail Free" card

A trade offer may **not** include:
- Properties currently owned by a third player not part of the negotiation
- Properties with lodges still built on them (see 1.3 below — must be cleared first)
- Cash the offering player does not currently have available (validated server-side against current balance at time of offer submission, not at time of original chat message)

### 1.2 When deals can happen
- Deals may be proposed and negotiated **at any time during the game**, including on a player's own turn or during another player's turn, and while a player is in Jail.
- A deal may **not** be finalized (i.e., cannot exit the broadcast/intercept phase — see main rulebook Section 6.3) while either negotiating player is in the middle of an unresolved mandatory action (e.g., mid-liquidation for an unpaid debt). The deal remains pending until that action resolves.
- A deal involving an eliminated/bankrupt player is invalid and must be blocked server-side — a player's assets transfer away immediately on elimination, so they have nothing left to trade.

### 1.3 Properties with lodges cannot be traded directly
- A property must have **all lodges sold back to the bank** before it can be included in a trade offer.
- Rationale: prevents a receiving player from ending up with an under-capitalized, over-developed property whose lodge value was never paid for by them, and keeps development bookkeeping (even-building rule) consistent.
- The trade-offer builder UI should simply exclude lodge-bearing properties from the selectable list until the owning player sells the lodges first.

### 1.4 Mortgaged properties in a dealRemain in jail a maximum of 3 turns; on the 3rd failed attempt, bail is auto-deducted and the player is released and moves per that turn's roll.
- A mortgaged property **may** be included in a trade.
- The **receiving player must immediately pay off the mortgage** (mortgage value + 10% interest fee) as part of accepting the deal — this is deducted automatically from the receiving player's cash balance at the moment the deal finalizes.
- If the receiving player cannot cover the mortgage payoff at the moment the deal finalizes, the deal **fails automatically** and reverts — both parties are notified, and the properties/cash remain with their original owners. This check happens server-side immediately before executing the trade, after the intercept window closes.

---

## 2. Mortgage Rules

### 2.1 When mortgaging IS allowed
- On the property-owning player's own turn, at any point after their dice roll has been resolved (i.e., not mid-movement).
- During a forced Liquidation flow (main rulebook Section 9), to raise cash to cover a debt.
- At any time in response to an active purchase decision on the player's own turn, **including proactively mortgaging other properties to afford a property they've just landed on** — see 2.3 below.

### 2.2 When mortgaging is NOT allowed
- A property currently developed with lodges cannot be mortgaged until all lodges on it are sold back to the bank first (standard rule, enforced here for mortgaging specifically as well as trading).
- A player cannot mortgage a property that is not theirs, obviously, but also cannot mortgage a property mid-trade-negotiation if that property is currently attached to a `pending_deal` in the broadcast/intercept phase — lock the property's mortgage-eligibility while a deal involving it is unresolved, to prevent state conflicts.
- Mortgaging is not available to a player who is not the current active player **except** when it's part of their own forced Liquidation flow (which can occur on another player's turn, e.g., paying rent when landed on by someone else).

### 2.3 Mortgaging to afford a property purchase — explicitly allowed
**Yes — a player is allowed to mortgage other properties they own in order to raise the cash needed to buy a property they've just landed on.**

Implementation logic:
- When the property-landing popup appears and the player does not have enough liquid cash to cover the purchase price, do **not** immediately lock them into the "Auction only" state (State 2 from the property popup design).
- Instead, offer a **"Raise Cash" option** within the same popup — functionally identical to the Liquidation screen (mortgage/sell-lodges grid with a running total), but voluntary rather than debt-triggered.
- If, after mortgaging, the player's cash now covers the purchase price, the "Buy Property" button becomes enabled.
- If the player closes the Raise Cash panel without reaching the required amount (or chooses not to raise cash at all), the popup reverts to State 2 (Auction only).
- This action must complete within the same turn — a player cannot "pause" a purchase decision, mortgage on a future turn, and come back to buy the same landed-on property later. Declining or failing to raise sufficient cash immediately moves the property to auction.

Rationale: this keeps the mortgage system genuinely useful as a liquidity tool (matching real property-investing behavior, which fits the Zaji theme) rather than purely a bankruptcy-avoidance mechanic.

### 2.4 Unmortgaging
- Only the current active player, on their own turn, may unmortgage a property they own.
- Payment required: mortgage value + 10% interest fee, deducted immediately from cash on hand.
- A property remains mortgaged (earns no rent) until explicitly unmortgaged — there is no automatic unmortgage.

---

## 3. Lodge (House) Building Rules

### 3.1 When building IS allowed
- Only on the owning player's own turn. ( If you are in a postion that you can build, there will be a notification that will always remind you to build when it is your turn)
- Only if the player owns **all properties in that color group** (monopoly requirement).
- Only if **none of the properties in that group are currently mortgaged** — all must be unmortgaged before any lodge can be built on the group.
- Only if building maintains the **even-building rule**: no property in the group may have more than 1 lodge more than the property in that group with the fewest lodges. (E.g., in a 3-property group at [1,1,0] lodges, the next lodge must go on the property with 0; you cannot build a 2nd lodge on either of the properties already at 1 until the third reaches 1.)
- Player must have sufficient cash to cover the fixed `lodge_cost` for that property at time of building.

### 3.2 When building is NOT allowed
- If the player does not own the complete color group.
- If any property in the group is mortgaged (must unmortgage first).
- If building would violate the even-building rule (see 3.1).
- If a property in the group is currently attached to a `pending_deal` in the broadcast/intercept phase (lock building on that property, same rationale as 2.2).
- Beyond the max tier (Luxury Resort) — no further building possible regardless of cash available.
- During another player's turn, or while the building player is in Jail (Jail does not block trading or mortgaging per Section 1.2/2.1, but does block active development actions — confirm this restriction with design if a different behavior is preferred).

### 3.3 Selling lodges
- Reverse of 3.1: must also respect the even-building rule in reverse (sell from the property with the most lodges first, cannot create a gap greater than 1 between properties in the group).
- Returns 50% of the original `lodge_cost` to the player, deducted from... i.e. paid to the player by the bank.
- Required before mortgaging or trading that specific property (see Sections 1.3 and 2.2).


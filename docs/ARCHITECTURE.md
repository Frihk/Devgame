# Wekonomy (Reddit Monopoly Rush) — Architecture

### Status: Draft v1.0 — targets full rulebook spec (`wekonomy-rulebook.md` + deals/mortgages/lodges addendum)

This document describes how the system is put together: process model, real-time
architecture, persistence, and how the existing directory structure maps to
responsibilities. It assumes the rulebook and addendum as the source of truth for
*game rules*; this doc is the source of truth for *how those rules are implemented*.

---

## 1. Guiding Principles

1. **Server is the only authority.** The Go backend owns all game state. The
   Phaser client never computes rent, ownership, or legality of a move — it
   sends intents (`roll_dice`, `buy_property`, `submit_bid`, …) and renders
   whatever state the server broadcasts back. This isn't optional given
   Section 12 of the rulebook explicitly calls out that client-submitted
   actions must never be trusted at face value.
2. **One game = one serialized stream of commands.** Concurrency bugs in a
   game with trading, jail, auctions, and forced liquidation all potentially
   firing near-simultaneously are the biggest risk in this project. We avoid
   them structurally (Section 3) rather than with fine-grained locking.
3. **`shared/` is a contract, not a convenience.** Anything in
   `shared/enums`, `shared/constants`, `shared/schemas` must have a matching
   Go type. Drift between the JS shape and the Go shape is the #1 source of
   "works locally, breaks in the room" bugs in real-time games. See Section 6.
4. **REST for anything that happens before or after a game. WebSocket for
   everything that happens during one.** Auth, lobby creation, leaderboard —
   REST. Dice rolls, trades, rent, jail, auctions — WebSocket only.

---

## 2. System Overview

```
┌─────────────────┐        REST (auth, lobby, leaderboard)       ┌──────────────────┐
│                  │ ───────────────────────────────────────────▶│                  │
│  Phaser Client   │                                              │   Go Backend     │
│  (frontend/src)  │        WebSocket (single conn / player)      │  (backend/*)     │
│                  │ ◀────────────────────────────────────────────▶│                  │
└─────────────────┘          game commands / state broadcasts      └────────┬─────────┘
                                                                             │
                                                                    ┌────────▼─────────┐
                                                                    │  Room Registry    │
                                                                    │  (in-memory)      │
                                                                    │  1 goroutine per  │
                                                                    │  active game       │
                                                                    └────────┬─────────┘
                                                                             │ write-behind
                                                                    ┌────────▼─────────┐
                                                                    │  SQLite            │
                                                                    │  (snapshots, log,  │
                                                                    │   leaderboard)     │
                                                                    └────────────────────┘
```

---

## 3. Backend Architecture

### 3.1 Concurrency model — the Room Actor pattern

Each active game room is a single goroutine ("room actor") owning a
`GameState` struct. It reads a single `chan Command` and processes commands
**one at a time, in arrival order**. Nothing else is allowed to mutate
`GameState` directly.

```go
// internal/services/game_room.go (new file)
type Command struct {
    PlayerID string
    Type     string          // "roll_dice", "buy_property", "submit_trade", ...
    Payload  json.RawMessage
    Reply    chan Result      // used for request/response-style acks if needed
}

type Room struct {
    ID       string
    State    *models.GameState
    Inbox    chan Command
    Timers   *RoomTimers       // turn timer, intercept timer, auction timer
    Broadcast func(event WSEvent) // fan-out to all connected sockets in this room
}

func (r *Room) Run() {
    for cmd := range r.Inbox {
        result := r.dispatch(cmd)   // routes into the relevant service
        r.Broadcast(result.Events)  // e.g. player_moved, rent_paid, trade_finalized
    }
}
```

Why this over a mutex-guarded shared struct: the rulebook has several flows
that are inherently multi-step and *interleaved* with other players' actions
— trade intercept windows (Section 6.3) run concurrently with the active
player's turn, jail allows trading/mortgaging on other players' turns
(addendum 1.2/2.1), and liquidation can be triggered by another player
landing on you. A single serialized command queue makes "is this action
legal *right now*" a simple sequential check against `GameState`, instead of
a distributed-locking problem across trade timers, turn timers, and auction
timers.

**Timers** (turn timer, intercept countdown, auction countdown, sniper
extensions) are implemented as goroutines that, on expiry, push a synthetic
`Command` (e.g. `{Type: "turn_timer_expired"}`) into the room's own inbox —
they never touch `GameState` directly. This keeps the "one writer" guarantee
intact even for time-driven state transitions like Section 3.7 (auto-resolve
via Bankruptcy/Liquidation on timer expiry) or 6.3's sniper protection.

### 3.2 Directory mapping

| Existing path | Responsibility |
|---|---|
| `cmd/server/main.go` | Process entrypoint: load config, open SQLite, start HTTP+WS server, start `RoomRegistry` |
| `internal/handlers/*` | Thin layer: REST handlers stay REST (auth, leaderboard, player profile). `game.go`, `property.go`, `event.go` become **WebSocket message routers**, not REST handlers — see 3.4 |
| `internal/middleware/*` | Unchanged — auth (JWT/session), CORS, logging, panic recovery. Recovery middleware is important here: a panic inside a room actor's command loop must not kill the goroutine silently — wrap `dispatch()` in a `recover()` that converts panics into an `action_failed` event + logs, rather than crashing the room |
| `internal/models/*` | Pure data structs mirroring `shared/schemas/*`. `game.go` becomes the home of `GameState`, `TurnState`, `JailState`, `PendingDeal`, `PendingAuction` |
| `internal/repository/*` | SQLite read/write. **Not called during live gameplay hot path** — only on: game creation, periodic snapshot (e.g. every N turns or every trade/bankruptcy), and game end |
| `internal/services/*` | The actual rule engine — this is where rulebook Sections 4–10 live in code. New file `game_room.go` (Room Actor) and `room_registry.go` (map of active rooms) added here |
| `internal/database/schema.sql` | Extended per Section 3.7 below |
| `shared/*` | JS-side mirror of enums/constants/schemas — Go types in `internal/models` must match field-for-field |

### 3.3 REST API surface (unchanged pattern, narrowed scope)

Only things that happen **outside** an active game:

- `POST /auth/register`, `POST /auth/login` — `auth_service.go`
- `POST /lobby/create`, `POST /lobby/:id/join` — new thin layer over `game_service.go`, returns a WS connection token scoped to that room
- `GET /leaderboard` — `leaderboard_service.go`, reads from SQLite
- `GET /player/:id` — profile/history, reads from SQLite

Everything else (dice, purchase, trade, mortgage, lodge build, auction bid,
jail actions) moves to WebSocket **commands**, not REST endpoints — a REST
call per dice roll doesn't fit a system with 20s intercept windows and
sniper-protection timers that need to push unsolicited state to *all*
players, not just the one who acted.

### 3.4 WebSocket architecture

**Connection lifecycle:**
1. Client connects to `/ws/game/:roomID?token=...` (gorilla/websocket upgrade)
2. Token (issued by `POST /lobby/:id/join`) is validated, resolved to `(playerID, roomID)`
3. Connection registered with the `Room`'s socket set; a `player_connected`
   event (not in the rulebook's list but needed operationally) is broadcast
4. All inbound frames are decoded into `Command{PlayerID, Type, Payload}` and
   pushed onto `Room.Inbox`
5. All outbound frames are `WSEvent{Type, Payload, RoomID}` from the
   rulebook's Section 12 catalog (see Section 7 of this doc)

**Message envelope** (both directions), matches `shared/schemas`:

```json
{
  "type": "buy_property",
  "payload": { "propertyId": 6 },
  "clientMsgId": "uuid-for-optimistic-UI-reconciliation"
}
```

Server broadcasts wrap the same shape but always include `roomId` and a
monotonically increasing `seq` per room, so a reconnecting client can request
"replay from seq N" instead of a full state resync — useful given turn
timers keep running even if one player's socket drops (rulebook doesn't
special-case disconnection, so the default here is: **disconnection does not
pause the game**; a disconnected player is treated as unresponsive and their
turn timer runs out normally, triggering the same auto-resolve flow as
Section 3.7).

**Private negotiation rooms (Section 6.2)** reuse the same WS connection —
they are *not* a separate socket. A `PendingDeal` (pre-broadcast) is scoped
server-side to the two participant IDs, and the `Room` only relays
`trade_offer_updated` events to those two connections until both `accept`,
at which point it becomes a room-wide broadcast (Section 6.3). This avoids
managing a second connection type for something that's really just a
visibility filter on the existing broadcast.

### 3.5 Domain services (rule engine)

Each maps directly to a rulebook section — this is deliberate so a rule
change in the design doc has an obvious single file to change:

| Service | Rulebook section(s) | Key responsibility |
|---|---|---|
| `turn_service.go` | 3 | Dice roll, doubles tracking (incl. 3x-doubles→jail), turn timer, end-turn |
| `board_service.go` | 4 | Square resolution dispatch by square type |
| `property_service.go` | 4.1–4.3, 7, 8 | Buy/rent/mortgage/lodge logic, even-building enforcement |
| `card_service.go` | 4.5 | Chance/Community Chest deck state, draw, effect execution |
| `jail_service.go` | 5 | `in_jail` state machine, release conditions, 3-turn cap |
| `trade_service.go` | 6, addendum §1 | Negotiation room, broadcast/intercept/sniper, validation (addendum 1.1, 1.4) |
| `liquidation_service.go` | 9 | Forced mortgage/lodge-sell flow, bankruptcy, asset transfer |
| `auction_service.go` | 10 | Ascending bid, sniper-protection reset, close |

`property_service.go` is deliberately the biggest file — mortgaging (§8),
lodge building (§7), and the addendum's "Raise Cash to afford a purchase"
flow (addendum §2.3) all touch the same property-ownership + cash
invariants and are easiest to keep consistent in one place rather than
split across files that each re-derive "can this property be mortgaged
right now."

**Cross-cutting lock addendum rules that don't map to one service:**
- A property attached to a `pending_deal` is mortgage- and build-locked
  (addendum §2.2, §3.2). Implemented as a `LockedBy *string` field on the
  property's in-memory state, set when a `PendingDeal` referencing it is
  created and cleared when that deal resolves or is rejected — checked by
  both `property_service.go` and `trade_service.go`.
- A deal cannot finalize while either party is mid-liquidation (addendum
  §1.2). Implemented as a `player.Status` enum check
  (`normal | liquidating | bankrupt`) that `trade_service.go` consults
  before allowing the intercept timer to close out.

### 3.6 State machine summary

```
GameState.Phase:      lobby → in_progress → ended
TurnState.Phase:      awaiting_roll → resolving_square → free_action → ended
PlayerState.Status:   active → (jailed | liquidating)* → active | eliminated
PendingDeal.Phase:    negotiating → broadcast → intercept → finalized | rejected | failed
PendingAuction.Phase: open → closed
```

`*` a jailed player can simultaneously be in `liquidating` if a rent/tax
debt hits them while jailed (rulebook §5 explicitly allows jailed players to
receive rent and be otherwise economically active).

### 3.7 Persistence (SQLite)

SQLite is **not** on the hot path of gameplay — every dice roll hitting disk
would be both slow and unnecessary. Split responsibility:

- **In-memory (`Room.State`)**: authoritative during an active game. Lost on
  server restart — acceptable for a hackathon scope; noted as a follow-up
  otherwise (see Open Items).
- **SQLite writes happen at**:
  - Game creation (row in `games`)
  - Every *finalized* economic event — `trade_finalized`, `property_purchased`,
    `player_bankrupt`, `lodge_built/sold`, `player_eliminated` — appended to
    an `activity_log` table (also serves rulebook §11's `recent_activity`
    requirement directly)
  - Game end (final snapshot + leaderboard update)

Suggested schema additions to `schema.sql` (kept intentionally close to the
existing `models/*` set — `game.go`, `player.go`, `property.go`, `event.go`,
`leaderboard.go`):

```sql
-- extends existing schema.sql
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,           -- lobby | in_progress | ended
    win_condition TEXT NOT NULL,    -- bankruptcy | net_worth
    started_at DATETIME,
    ended_at DATETIME
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL REFERENCES games(id),
    seq INTEGER NOT NULL,           -- matches WS broadcast seq for replay
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS game_snapshots (
    game_id TEXT NOT NULL REFERENCES games(id),
    seq INTEGER NOT NULL,
    state_json TEXT NOT NULL,       -- full GameState serialization
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, seq)
);
```

`activity_log` + periodic `game_snapshots` together give cheap crash
recovery: reload latest snapshot, replay log entries after its `seq`.

---

## 4. Frontend Architecture (Phaser)

### 4.1 Scene flow

```
BootScene → PreloadScene → MenuScene → LobbyScene → GameScene → ResultScene
```

Unchanged from existing structure — `LobbyScene` is where the REST
`lobby/create|join` calls happen and the WS connection is opened, handing
off to `GameScene` once `game_started` (or equivalent) arrives.

### 4.2 Manager layer (`frontend/src/manager/*`)

These become **pure reducers over server events**, not local rule engines:

- `TurnManager.js` — tracks whose turn it is, turn timer display, enables/disables the local player's action buttons. Never decides *whether* an action is legal — it just reflects `turn_started`/`turn_ended`/`turn_timer_extended`.
- `EconomyManager.js` — tracks cash/property ownership for HUD rendering, driven entirely by `property_purchased`, `rent_paid`, `tax_paid`, `lodge_built/sold`, `property_mortgaged/unmortgaged`, `trade_finalized`.
- `EventManager.js` — Chance/Community Chest card draw animations, driven by `card_drawn`.

Each manager subscribes to `gameService.js`'s event emitter rather than
polling; `gameService.js` is the single owner of the WebSocket connection
and is the only place that knows the wire format.

### 4.3 Services layer

- `api.js` — REST calls only (auth, lobby, leaderboard)
- `gameService.js` — WS connection, command sending (`send('buy_property', {...})`), event subscription, reconnect/replay-from-seq logic
- `playerService.js` — thin wrapper for player profile REST calls

### 4.4 UI modals map directly to server-driven popups

`buymodal.js` and `upgrademodal.js` are triggered by server events, not
local square-landing logic — e.g. the server emits a `property_decision_required`
event (State 1/State 2/"Raise Cash" variant from addendum §2.3) with the
exact set of legal actions the player has right now; the modal renders
whatever action set it's given rather than re-deriving affordability
client-side. This keeps the "server is the only authority" principle
(Section 1) intact even in the UI layer — the client can't be tricked into
enabling a `buy` button the server would reject.

---

## 5. Shared Contracts (`shared/`)

`shared/enums`, `shared/constants`, `shared/schemas` are the wire contract.
Recommended discipline: generate Go structs from these (or vice versa) at
build time rather than hand-maintaining two copies — even for a hackathon,
a `propertyLevels.js` enum drifting from its Go counterpart is the kind of
bug that only shows up mid-demo. If codegen is too much setup for the
timeline, at minimum keep them in adjacent files with a comment
cross-referencing the other language's version, and add a cheap CI/test
step that fails if the two lists of enum values don't match.

| shared file | Go counterpart |
|---|---|
| `enums/gameStatus.js` | `models.GameStatus` |
| `enums/playerActions.js` | `Command.Type` values in `game_room.go` |
| `enums/propertyLevels.js` | `models.LodgeTier` |
| `schemas/gameSchema.js` | `models.GameState` |
| `schemas/playerSchema.js` | `models.PlayerState` |
| `schemas/propertySchema.js` | `models.Property` |
| `constants/tileTypes.js` | `models.SquareType` (Section 2 of rulebook: 8 category types) |

---

## 6. WebSocket Event Catalog

Directly from rulebook Section 12, grouped by the service that emits them:

| Emits from | Events |
|---|---|
| `turn_service.go` | `dice_rolled`, `player_moved`, `turn_started`, `turn_ended`, `turn_timer_extended` |
| `board_service.go` / `property_service.go` | `property_purchased`, `property_declined`, `rent_paid`, `tax_paid` |
| `card_service.go` | `card_drawn` |
| `jail_service.go` | `player_jailed`, `player_released_from_jail` |
| `trade_service.go` | `trade_proposed`, `trade_accepted_pending_broadcast`, `intercept_offer_submitted`, `trade_finalized`, `trade_intercepted` |
| `property_service.go` | `lodge_built`, `lodge_sold`, `property_mortgaged`, `property_unmortgaged` |
| `auction_service.go` | `auction_started`, `auction_bid`, `auction_closed` |
| `liquidation_service.go` | `player_bankrupt`, `player_eliminated` |
| room lifecycle | `game_ended`, plus operational (not in rulebook) `player_connected`/`player_disconnected` |

---

## 7. Subsystem Deep-Dives

### 7.1 Trading & Intercept (rulebook §6, addendum §1)

State lives on the `Room`, not per-connection:

```go
type PendingDeal struct {
    ID           string
    Proposer     string
    Counterparty string
    Terms        TradeTerms
    Phase        string // negotiating | broadcast | intercept | finalized | rejected | failed
    LeadingOffer TradeTerms
    LeadingBidder string
    Deadline     time.Time
    LockedPropertyIDs []int // enforced against §2.2/§3.2 build/mortgage locks
}
```

Sniper protection (rulebook §6.3.3) is a timer-reset, not a new timer type:
on any `intercept_offer` command, if `time.Until(deal.Deadline) < 15s`, push
`deal.Deadline = time.Now() + 15s` and emit `turn_timer_extended`-equivalent
(`trade timer extended` — not separately named in the catalog, worth adding
as an explicit event if you want the UI to show "extended!" rather than just
a ticking number jumping).

Finalization order (addendum §1.4) matters: mortgage payoff check happens
**after** the intercept window closes but **before** ownership actually
transfers, and failure reverts everything atomically — since this all
happens inside one `dispatch()` call on the room actor, this is a plain
sequential check-then-commit with no separate rollback machinery needed.

### 7.2 Mortgage-to-buy flow (addendum §2.3)

This is the one place the "buy property" popup needs multi-step server
round-trips within a single turn: `property_decision_required` (State 2) →
client requests "raise cash" panel → `mortgage_property` commands (each
re-emits updated running total) → client sends `buy_property` again once
affordable, or turn timer / explicit decline routes to `auction_started`.
Server enforces the "must complete within the same turn" rule (addendum
§2.3) by keying the whole flow to the current `TurnState.turnId` — any
`buy_property` command referencing a stale `turnId` is rejected.

### 7.3 Bankruptcy/Liquidation (rulebook §9)

Shares its state shape with the voluntary "raise cash" flow above
(same mortgage/sell-lodges primitives), differing only in trigger (forced
debt vs. voluntary purchase) and in what happens on failure (auction vs.
asset transfer to creditor / bank). Recommend implementing one
`liquidation_service.RaiseCash(playerID, targetAmount, voluntary bool)`
used by both call sites.

---

## 8. Security & Validation

- Every command handler in `internal/services/*` re-validates against
  current `GameState`, never trusts payload-supplied ownership/cash figures
  (rulebook §12's explicit requirement, addendum §1.1's "validated
  server-side... not at time of original chat message").
- JWT/session (existing `middleware/auth.go`) authenticates the WS upgrade,
  and every inbound `Command.PlayerID` is set server-side from that
  authenticated identity — never trusted from the payload — so a player
  can't submit actions as someone else.
- Rate-limit inbound WS commands per connection (simple token bucket in the
  connection handler) to prevent a malicious client from flooding a room's
  `Inbox` channel.

---

## 9. Deployment

`docker-compose.yml` (existing) — two services (`frontend` static build /
dev server, `backend` Go binary) + SQLite as a mounted volume file, no
separate DB container needed at this scale.

---

## 10. Open Items (carried over + architecture-specific)

From the rulebook/addendum (needs design, not engineering, input):
- [ ] Rent multiplier tables for Transport Hubs / Utilities
- [ ] Whether Direct Trade (§6.1) bypasses intercept entirely
- [ ] Win condition: Bankruptcy-only vs. optional Net Worth mode
- [ ] Free Parking house rule on/off default
- [ ] Full Chance/Community Chest card list

Architecture-specific, needs a decision before/during build:
- [ ] Server restart behavior: acceptable to lose in-progress games for the
      hackathon, or is snapshot-based recovery on boot in scope?
- [ ] Reconnect UX: client-side replay-from-seq is designed above but not
      yet in any handler — worth scoping down to "just show a reconnect
      spinner and full-resync" if time is tight
- [ ] Net Worth win-condition mode (if enabled) needs a tie-break rule
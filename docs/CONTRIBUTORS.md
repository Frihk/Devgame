# Wekonomy (Reddit Monopoly Rush) — Team & Roles

Maps the team roster against the subsystems in `ARCHITECTURE.md`: who owns
which files, who depends on whom, and what order work needs to happen in.

---

## 1. Roster

| Name | Area | Owns |
|---|---|---|
| Emmaculate Akinyi | Frontend | Board & board-driven UI |
| Ashley Omondi | Frontend + PM | Scenes, HUD, modals — plus project coordination |
| Sospeter Kinyanjui | Backend | Core turn loop & board resolution — plus shared contracts |
| Ian Kimani | Backend + UI/UX | Room/WS plumbing & infra — plus UI/UX direction |
| Evans Juma | Backend | Economic subsystems (trading, auctions, liquidation) |
| Quinton | Full stack + QA | WS client, cross-stack QA |

Assets (board art, sprites, icons, SFX) has no current owner — flagged in
Section 5.

---

## 2. Build order — who blocks whom

```
Phase 0 (foundation — everyone else waits on this)
  Sospeter → shared/ contracts (enums, schemas)      ─┐
  Ian      → Room Actor skeleton (game_room.go,        ├─ must exist first
             room_registry.go, WS upgrade handler)    ─┘

Phase 1 (parallel, once Phase 0 lands)
  Sospeter → turn/board services      ─┐
  Evans    → economic services        ─┤  build against Ian's Room Actor +
  Emmaculate/Ashley → scenes, board,  ─┘  Sospeter's shared contracts
             UI (can start against
             mocked WS events before
             backend is fully wired)

Phase 2 (integration)
  Real WS events flowing end-to-end: Sospeter/Evans's services emit real
  events → Quinton's gameService.js receives them → Emmaculate/Ashley's
  managers render them. This is where mismatches between shared/ and the
  Go models actually surface.

Ongoing
  Quinton's QA runs throughout, but concentrates once Phase 2 starts —
  can't meaningfully test trade intercept or liquidation flows until
  they're wired end-to-end.
```

**Practical takeaway:** Ian and Sospeter should be first to commit
something, even a stub. Everyone else's estimates should assume that
scaffolding exists, not that they build it themselves mid-task.

---

## 3. Backend

### Sospeter — core turn loop & board resolution, plus shared contracts
- `internal/services/turn_service.go` — dice, doubles tracking, turn timer
- `internal/services/board_service.go` — square-type dispatch
- `internal/services/card_service.go` — Chance/Community Chest deck + effects
- `internal/services/jail_service.go` — jail state machine
- `shared/*` — enum/schema parity against `internal/models/*` (Phase 0 — this blocks Evans, Quinton, and Emmaculate/Ashley, so it goes first)
- Emits: `player_moved`, `dice_rolled`, `turn_started/ended`, `card_drawn`, `player_jailed/released`
- Depends on: Ian's Room Actor (dispatch loop must exist to call into this)
- Shares `property_service.go` with Evans — see note below

### Evans — economic subsystems
- `internal/services/trade_service.go` — negotiation, broadcast/intercept, sniper protection
- `internal/services/auction_service.go` — ascending bid, sniper reset
- `internal/services/liquidation_service.go` — forced liquidation, bankruptcy, mortgage-to-buy
- `internal/services/property_service.go` — leads on mortgage/lodge/even-building rules
- Emits: `trade_*`, `auction_*`, `player_bankrupt/eliminated`, `lodge_built/sold`, `property_mortgaged/unmortgaged`
- Depends on: Ian's Room Actor; Sospeter's board resolution for square-landing triggers into property logic

**`property_service.go` split:** Sospeter owns "is this square resolvable,
what's rent right now" (read path); Evans owns "can this mutation happen"
(mortgage/build/sell — write path). Agree on that function boundary before
either starts, so it's not two people editing the same functions.

### Ian — room/WS plumbing & infra, plus UI/UX direction
- `internal/services/game_room.go` — Room Actor: command channel, dispatch loop, panic recovery
- `internal/services/room_registry.go` — active room lifecycle
- `cmd/server/main.go`, `internal/middleware/*` — WS upgrade, auth wiring, CORS, logging
- `internal/database/*` — SQLite write-behind (activity log, snapshots)
- UI/UX, specific responsibilities:
  - Visual direction and design system: color palette, typography, spacing
    rules that Emmaculate/Ashley implement against (per the Figma tooling
    already in the README) — a design system, not per-screen mockups
    handed over piecemeal
  - Wireframes for the trade negotiation UI (private room + broadcast/
    intercept countdown) before Ashley builds it — this is the one UI
    surface with no existing scaffolding to work from
  - Board tile and HUD visual layout: how property color groups, rent
    tiers, and lodge counts read at a glance — informs both Emmaculate's
    tile rendering and the `assets/tiles`/`assets/buildings` art direction
  - Modal/popup consistency across `buymodal.js`, `upgrademodal.js`, and
    the liquidation/raise-cash screen (addendum §2.3) so a player doesn't
    have to relearn the UI for each decision type
  - First input on the assets-gap decision (Section 6) if the team goes
    with in-house art — style guide for whoever produces it
  - This is design direction feeding Emmaculate/Ashley's implementation,
    not competing code ownership over `frontend/src/*`
- Blocks: Sospeter and Evans — their services can't run without a dispatch loop to plug into
- Depends on: nothing upstream — this is Phase 0 work

---

## 4. Frontend

### Emmaculate — board & board-driven UI
- `frontend/src/board/*` — `Board.js`, `Tile.js`, `PropertyTile.js`, `EventTile.js`
- `frontend/src/player/*` — `movement.js`, `dice.js`, token rendering
- Consumes: `player_moved`, `dice_rolled`, `card_drawn`, ownership-marker updates
- Can start against mocked events in Phase 1; needs real backend events for Phase 2 integration

### Ashley — scenes, HUD, modals + project management
- `frontend/src/scenes/*` — full scene flow (Boot → Preload → Menu → Lobby → Game → Result)
- `frontend/src/ui/*` — `HUD.js`, `buymodal.js`, `upgrademodal.js`, `notification.js`, `diceUI.js`
- `frontend/src/manager/*` — `TurnManager.js`, `EconomyManager.js`, `EventManager.js` (reducers over server events, not local rule logic)
- Owns the trade negotiation UI (private room + broadcast/intercept countdown) — new UI, not in current scaffolding
- Can start against mocked events in Phase 1; needs real backend events for Phase 2 integration

**PM responsibilities, specific to this project's shape:**
- Owns the Phase 0 → 1 → 2 timeline in Section 2 — confirms Ian and
  Quinton's scaffolding has actually landed before treating Phase 1 as
  unblocked, rather than everyone assuming it's ready
- Tracks the `property_service.go` split between Sospeter and Evans — that
  boundary (read path vs. write path) is agreed once, up front, and PM is
  the one who notices if it's drifting
- Calls the open items in `ARCHITECTURE.md` §10 (rent multiplier tables,
  Direct Trade vs. intercept, win condition mode, Free Parking rule, card
  list) — these block Sospeter and Evans from finishing specific services
  and need a design decision, not more engineering time
- Owns the assets gap decision (Section 6 below) — someone has to actually
  pick one of the three options rather than it staying open indefinitely
- Given the hackathon deadline, owns any scope-cut calls (e.g. trimming
  intercept/sniper trading if Phase 2 integration is running late)

---

## 5. Quinton — full stack + QA

- `frontend/src/services/gameService.js` — WebSocket client: command sending, event subscription, reconnect/replay-from-seq
- Depends on: Sospeter's `shared/*` contracts (Phase 0) and Ian's Room Actor being in place before this can talk to a real backend
- `docker-compose.yml` — keeps frontend/backend/SQLite volume config working as the two sides evolve; first point of contact if "works on my machine" comes up
- `Makefile`(s) — wraps the install/build/run/test commands for both `frontend/` and `backend/` into single targets (e.g. `make dev`, `make test`, `make build`) so no one has to remember the exact `npm`/`go` invocations by hand
- Build/run pipeline: `npm install && npm run dev` (frontend) and `go mod tidy && go run ./cmd/server` (backend) staying reliable as dependencies get added — catches broken installs before they hit someone mid-task
- Environment/config handling: anything that differs between a dev machine and the demo environment (ports, `.env` values, SQLite file path) gets owned here rather than discovered live at the demo
- QA scope, specific responsibilities:
  - **Unit tests (Go):** rulebook edge cases per service — 3x-doubles-to-
    jail (Sospeter's `turn_service.go`), even-building violations and
    mortgage-locked-during-pending-deal (Evans's `property_service.go`
    portion), mortgage payoff failure on trade finalize (addendum §1.4,
    `trade_service.go`), jail's 3-turn auto-release cap (`jail_service.go`)
  - **WS contract tests:** every event in `ARCHITECTURE.md` §6's catalog is
    actually emitted, with the shape Sospeter's `shared/schemas` and
    `gameService.js` both expect — run this against Sospeter/Evans's
    services directly, not just through the UI
  - **Concurrency/integration tests:** scenarios a single-player unit test
    can't catch — two players submitting `intercept_offer` in the same
    tick, a player landing on a property mid-liquidation of another player,
    sniper-protection timer resets stacking correctly (rulebook §6.3.3)
  - **Manual multiplayer playtesting:** full games run with the whole team,
    specifically targeting trade negotiation, jail, and bankruptcy flows
    since those are the highest-complexity/highest-risk paths
  - **Regression pass before demo/submission:** re-run the above against
    the final build, not just during development
  - **Bug triage:** owns the intake point for issues found in playtesting —
    files them against the right person's files from Sections 3–4 rather
    than issues floating without an owner

---

## 6. Open gap: assets

`assets/` (board art, character sprites, building icons, cards, SFX) is
currently all placeholder/empty-byte files, and no one on the roster above
has it as a primary focus. Three options, in order of how much they cost
the team's time this cycle:
- Source it externally (asset pack, freelancer, late addition)
- Split it thinly across the six people above as a secondary task
- Scope the visual bar down (flat colors/labeled rects instead of
  illustrated assets) so no one needs to own an art pipeline at all
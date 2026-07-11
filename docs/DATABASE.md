

# Database

Status: connection lifecycle and schema in place (`internal/database/db.go`,
`internal/database/migrate.go`). Query layer (`internal/repository/*`) not yet
implemented — see [Open Items](#open-items).

## 1. Where this fits

SQLite is **not on the gameplay hot path**. `Room.State` (in-memory,
owned exclusively by that room's actor goroutine) is authoritative during
an active game — see `ARCHITECTURE.md` Section 3.1. This database exists
for exactly three things:

1. Surviving a server restart (via `game_snapshots` + `activity_log` replay)
2. Serving `GET /leaderboard` and `GET /player/:id` after a game ends
3. Recording history for `recent_activity` (rulebook §11)

Nothing in `internal/services/*` should query SQLite mid-turn. If a code
path added later needs a synchronous DB round-trip to resolve a dice roll,
a rent payment, or anything else on the per-command critical path, that's
a sign it's in the wrong layer, not a sign this schema needs a new index.

## 2. Connection lifecycle

`database.Open(cfg database.Config)` opens the SQLite file and returns a
configured `*sql.DB`:

| Setting | Value | Why |
|---|---|---|
| Driver | `modernc.org/sqlite` | Pure Go, no CGO — keeps the Docker build simple |
| `journal_mode` | `WAL` | Lets reads (leaderboard, profile) proceed without blocking on the one active writer |
| `busy_timeout` | `5000` (ms) | Queues a second writer instead of failing immediately when two Rooms write near-simultaneously |
| `foreign_keys` | `ON` | Off by default per-connection in SQLite; needed since `activity_log`/`game_snapshots` reference `games(id)` |
| `MaxOpenConns` | `4` | SQLite has exactly one writer regardless of pool size — this avoids opening more file handles than useful without funneling every read through a single connection |

`database.Migrate(db *sql.DB)` applies the schema below. It's idempotent
(`CREATE TABLE IF NOT EXISTS`) and runs inside a transaction, so it's safe
to call unconditionally on every server boot.

**Expected wiring in `cmd/server/main.go`** (not yet added):

```go
db, err := database.Open(database.Config{Path: "backend/database/monopoly.db"})
// handle err
if err := database.Migrate(db); err != nil {
    // handle err
}
// pass db into whatever constructs the repository layer
```

## 3. Schema

### `games`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | Matches `GameState.ID` (`models/game.go`) |
| `status` | `TEXT NOT NULL` | Mirrors `models.GameStatus` — `lobby` \| `in_progress` \| `ended` |
| `win_condition` | `TEXT NOT NULL` | Mirrors `models.WinCondition` — `bankruptcy` \| `net_worth` |
| `started_at` | `DATETIME` | Set when status moves to `in_progress` |
| `ended_at` | `DATETIME` | Set when status moves to `ended` |

One row per game, written once at creation and updated at start/end —
never touched mid-game.

### `activity_log`

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Local row id, not game-scoped |
| `game_id` | `TEXT NOT NULL REFERENCES games(id)` | |
| `seq` | `INTEGER NOT NULL` | **Must match `WSEvent.Seq`** (`models/event.go`) — this is what lets a reconnecting client "replay from seq N" per `ARCHITECTURE.md` 3.4 |
| `event_type` | `TEXT NOT NULL` | **Maps to `WSEvent.Type`** — e.g. `trade_finalized`, `property_purchased`, `player_bankrupt` |
| `payload_json` | `TEXT NOT NULL` | **Maps to `WSEvent.Payload`** (already `json.RawMessage` in Go — store it as-is, don't re-marshal) |
| `created_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | |

Indexed on `(game_id, seq)` since every real query against this table is
"give me this game's events in order," not an ad hoc scan.

Per `ARCHITECTURE.md` 3.7, a row is appended here only for **finalized**
economic events — `trade_finalized`, `property_purchased`,
`player_bankrupt`, `lodge_built`/`sold`, `player_eliminated` — not every
`WSEvent` that gets broadcast. Broadcasting `dice_rolled` or
`turn_timer_extended` to clients doesn't imply writing it here.

### `game_snapshots`

| Column | Type | Notes |
|---|---|---|
| `game_id` | `TEXT NOT NULL REFERENCES games(id)` | |
| `seq` | `INTEGER NOT NULL` | Same `seq` space as `activity_log` — a snapshot at seq N plus replaying `activity_log` rows after N reconstructs current state |
| `state_json` | `TEXT NOT NULL` | Full serialization of `models.GameState` |
| `created_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | |

Primary key is `(game_id, seq)` — multiple snapshots per game are
expected (periodic, per `ARCHITECTURE.md` 3.7: "every N turns or every
trade/bankruptcy").

## 4. Compatibility notes with existing Go types

- `activity_log.payload_json` and `game_snapshots.state_json` are stored
  as `TEXT`, which is what `json.RawMessage` (`WSEvent.Payload`) and a
  marshaled `models.GameState` both serialize to directly — no
  transformation needed at the repository layer beyond `json.Marshal`.
- **Known gap:** `models/game.go` defines `GameSchemaVersion = 2`, but
  `game_snapshots` has no column for it. If `GameState`'s shape changes
  later, an old `state_json` blob has no recorded version to unmarshal
  against. Recommend adding a `schema_version INTEGER NOT NULL` column
  to `game_snapshots` before this schema sees real snapshots written
  against it — flagging here rather than adding it silently, since it's
  a schema change someone should sign off on.
- `games.status` / `games.win_condition` are stored as free-text `TEXT`,
  not a SQL `CHECK` constraint against `models.GameStatus` /
  `models.WinCondition`'s known values. This mirrors the existing
  discipline in `shared/` (Section 5 of `ARCHITECTURE.md`): the Go enum
  is the source of truth, the column just stores whatever string the Go
  side sends. A typo in a hand-written query bypasses this — the
  repository layer, once built, should write these using the Go
  constants directly (e.g. `models.GameStatusInProgress`), never a raw
  string literal.

## 5. Open Items

- [ ] `internal/repository/*.go` — all four files (`game_repository.go`,
      `leaderboard_repository.go`, `player_repository.go`,
      `property_repository.go`) are still empty stubs. No queries exist
      against this schema yet.
- [ ] No named owner for the repository layer in `docs/CONTRIBUTORS.md`
      — same gap the handler layer had before it was resolved.
- [ ] `game_snapshots.schema_version` column (see Section 4 above).
- [ ] `main.go` doesn't yet call `database.Open` / `database.Migrate` —
      these two files are unreachable dead code until that wiring lands.
- [ ] No decision yet on snapshot cadence ("every N turns" — N is
      undefined) or a pruning/retention policy for old snapshots.
# Database

Status: connection lifecycle and schema in place (`internal/database/db.go`,
`internal/database/migrate.go`). Query layer (`internal/repository/*`) not yet
implemented — see [Open Items](#open-items).

## 1. Where this fits

SQLite is **not on the gameplay hot path**. `Room.State` (in-memory,
owned exclusively by that room's actor goroutine) is authoritative during
an active game — see `ARCHITECTURE.md` Section 3.1. This database exists
for exactly three things:

1. Surviving a server restart (via `game_snapshots` + `activity_log` replay)
2. Serving `GET /leaderboard` and `GET /player/:id` after a game ends
3. Recording history for `recent_activity` (rulebook §11)

Nothing in `internal/services/*` should query SQLite mid-turn. If a code
path added later needs a synchronous DB round-trip to resolve a dice roll,
a rent payment, or anything else on the per-command critical path, that's
a sign it's in the wrong layer, not a sign this schema needs a new index.

## 2. Connection lifecycle

`database.Open(cfg database.Config)` opens the SQLite file and returns a
configured `*sql.DB`:

| Setting | Value | Why |
|---|---|---|
| Driver | `modernc.org/sqlite` | Pure Go, no CGO — keeps the Docker build simple |
| `journal_mode` | `WAL` | Lets reads (leaderboard, profile) proceed without blocking on the one active writer |
| `busy_timeout` | `5000` (ms) | Queues a second writer instead of failing immediately when two Rooms write near-simultaneously |
| `foreign_keys` | `ON` | Off by default per-connection in SQLite; needed since `activity_log`/`game_snapshots` reference `games(id)` |
| `MaxOpenConns` | `4` | SQLite has exactly one writer regardless of pool size — this avoids opening more file handles than useful without funneling every read through a single connection |

`database.Migrate(db *sql.DB)` applies the schema below. It's idempotent
(`CREATE TABLE IF NOT EXISTS`) and runs inside a transaction, so it's safe
to call unconditionally on every server boot.

**Expected wiring in `cmd/server/main.go`** (not yet added):

```go
db, err := database.Open(database.Config{Path: "backend/database/monopoly.db"})
// handle err
if err := database.Migrate(db); err != nil {
    // handle err
}
// pass db into whatever constructs the repository layer
```

## 3. Schema

### `games`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | Matches `GameState.ID` (`models/game.go`) |
| `status` | `TEXT NOT NULL` | Mirrors `models.GameStatus` — `lobby` \| `in_progress` \| `ended` |
| `win_condition` | `TEXT NOT NULL` | Mirrors `models.WinCondition` — `bankruptcy` \| `net_worth` |
| `started_at` | `DATETIME` | Set when status moves to `in_progress` |
| `ended_at` | `DATETIME` | Set when status moves to `ended` |

One row per game, written once at creation and updated at start/end —
never touched mid-game.

### `activity_log`

| Column | Type | Notes |
|---|---|---|
| `id` | `INTEGER PRIMARY KEY AUTOINCREMENT` | Local row id, not game-scoped |
| `game_id` | `TEXT NOT NULL REFERENCES games(id)` | |
| `seq` | `INTEGER NOT NULL` | **Must match `WSEvent.Seq`** (`models/event.go`) — this is what lets a reconnecting client "replay from seq N" per `ARCHITECTURE.md` 3.4 |
| `event_type` | `TEXT NOT NULL` | **Maps to `WSEvent.Type`** — e.g. `trade_finalized`, `property_purchased`, `player_bankrupt` |
| `payload_json` | `TEXT NOT NULL` | **Maps to `WSEvent.Payload`** (already `json.RawMessage` in Go — store it as-is, don't re-marshal) |
| `created_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | |

Indexed on `(game_id, seq)` since every real query against this table is
"give me this game's events in order," not an ad hoc scan.

Per `ARCHITECTURE.md` 3.7, a row is appended here only for **finalized**
economic events — `trade_finalized`, `property_purchased`,
`player_bankrupt`, `lodge_built`/`sold`, `player_eliminated` — not every
`WSEvent` that gets broadcast. Broadcasting `dice_rolled` or
`turn_timer_extended` to clients doesn't imply writing it here.

### `game_snapshots`

| Column | Type | Notes |
|---|---|---|
| `game_id` | `TEXT NOT NULL REFERENCES games(id)` | |
| `seq` | `INTEGER NOT NULL` | Same `seq` space as `activity_log` — a snapshot at seq N plus replaying `activity_log` rows after N reconstructs current state |
| `state_json` | `TEXT NOT NULL` | Full serialization of `models.GameState` |
| `created_at` | `DATETIME DEFAULT CURRENT_TIMESTAMP` | |

Primary key is `(game_id, seq)` — multiple snapshots per game are
expected (periodic, per `ARCHITECTURE.md` 3.7: "every N turns or every
trade/bankruptcy").

## 4. Compatibility notes with existing Go types

- `activity_log.payload_json` and `game_snapshots.state_json` are stored
  as `TEXT`, which is what `json.RawMessage` (`WSEvent.Payload`) and a
  marshaled `models.GameState` both serialize to directly — no
  transformation needed at the repository layer beyond `json.Marshal`.
- **Known gap:** `models/game.go` defines `GameSchemaVersion = 2`, but
  `game_snapshots` has no column for it. If `GameState`'s shape changes
  later, an old `state_json` blob has no recorded version to unmarshal
  against. Recommend adding a `schema_version INTEGER NOT NULL` column
  to `game_snapshots` before this schema sees real snapshots written
  against it — flagging here rather than adding it silently, since it's
  a schema change someone should sign off on.
- `games.status` / `games.win_condition` are stored as free-text `TEXT`,
  not a SQL `CHECK` constraint against `models.GameStatus` /
  `models.WinCondition`'s known values. This mirrors the existing
  discipline in `shared/` (Section 5 of `ARCHITECTURE.md`): the Go enum
  is the source of truth, the column just stores whatever string the Go
  side sends. A typo in a hand-written query bypasses this — the
  repository layer, once built, should write these using the Go
  constants directly (e.g. `models.GameStatusInProgress`), never a raw
  string literal.

## 5. Open Items

- [ ] `internal/repository/*.go` — all four files (`game_repository.go`,
      `leaderboard_repository.go`, `player_repository.go`,
      `property_repository.go`) are still empty stubs. No queries exist
      against this schema yet.
- [ ] No named owner for the repository layer in `docs/CONTRIBUTORS.md`
      — same gap the handler layer had before it was resolved.
- [ ] `game_snapshots.schema_version` column (see Section 4 above).
- [ ] `main.go` doesn't yet call `database.Open` / `database.Migrate` —
      these two files are unreachable dead code until that wiring lands.
- [ ] No decision yet on snapshot cadence ("every N turns" — N is
      undefined) or a pruning/retention policy for old snapshots.
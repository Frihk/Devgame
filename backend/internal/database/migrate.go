// Migrations for the persistence layer described in
// docs/ARCHITECTURE.md Section 3.7. SQLite is not on the gameplay hot
// path -- Room.State is authoritative in-memory during an active game --
// these tables only exist to survive a server restart and to serve the
// REST leaderboard / player-profile reads. That's why the schema is
// small and mirrors the doc directly rather than growing organically.
package database

import (
	"database/sql"
	"fmt"
)

// schemaStatements are plain CREATE TABLE IF NOT EXISTS statements
// rather than a versioned migration framework -- the schema is small,
// additive, and needs to be safe to re-run on every server boot without
// a separate migration-tracking table to maintain under deadline. If
// the schema ever needs a breaking change (column rename/drop), that's
// the point to introduce real migrations, not before.
//
// Executed as individual statements (not one multi-statement string)
// since not every database/sql driver supports multiple statements per
// Exec call, and this way a single bad statement fails clearly instead
// of silently skipping the rest.
var schemaStatements = []string{
	`CREATE TABLE IF NOT EXISTS games (
		id            TEXT PRIMARY KEY,
		status        TEXT NOT NULL,   -- lobby | in_progress | ended
		win_condition TEXT NOT NULL,   -- bankruptcy | net_worth
		started_at    DATETIME,
		ended_at      DATETIME
	)`,

	`CREATE TABLE IF NOT EXISTS activity_log (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		game_id      TEXT NOT NULL REFERENCES games(id),
		seq          INTEGER NOT NULL, -- matches the WS broadcast seq, for reconnect replay
		event_type   TEXT NOT NULL,
		payload_json TEXT NOT NULL,
		created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
	)`,

	// Every read against activity_log in practice is "give me this
	// game's events in order" (replay-from-seq, recent_activity) --
	// this index is what makes that a lookup instead of a scan.
	`CREATE INDEX IF NOT EXISTS idx_activity_log_game_seq
		ON activity_log(game_id, seq)`,

	`CREATE TABLE IF NOT EXISTS game_snapshots (
		game_id    TEXT NOT NULL REFERENCES games(id),
		seq        INTEGER NOT NULL,
		state_json TEXT NOT NULL,      -- full GameState serialization
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (game_id, seq)
	)`,

	// players: added to unblock PlayerRepository/LeaderboardRepository.
	// Identity assumption: `id` is whatever PlayerID string the client
	// already carries (currently mockAuthService's `username + "_id"`,
	// see cmd/server/main.go). If that assumption is wrong -- e.g. you
	// want real accounts with separate auth -- this table's `id` column
	// is still the right shape, just fed by a different upstream source.
	`CREATE TABLE IF NOT EXISTS players (
		id             TEXT PRIMARY KEY,
		name           TEXT NOT NULL,
		games_played   INTEGER NOT NULL DEFAULT 0,
		wins           INTEGER NOT NULL DEFAULT 0,
		best_net_worth INTEGER NOT NULL DEFAULT 0,
		created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
	)`,

	// Leaderboard queries always sort by wins first, net worth second --
	// this index is what makes GetTop a lookup instead of a full scan.
	`CREATE INDEX IF NOT EXISTS idx_players_wins_networth
		ON players(wins DESC, best_net_worth DESC)`,
}

// Migrate applies the schema above. Safe to call on every server boot --
// CREATE TABLE IF NOT EXISTS makes it a no-op once tables already exist.
// Runs inside a transaction so a failure partway through the statement
// list can't leave the database half-migrated.
func Migrate(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("database: begin migration: %w", err)
	}
	defer tx.Rollback() // no-op once Commit succeeds

	for _, stmt := range schemaStatements {
		if _, err := tx.Exec(stmt); err != nil {
			return fmt.Errorf("database: apply schema: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("database: commit migration: %w", err)
	}

	return nil
}

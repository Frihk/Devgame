// Package database owns the SQLite connection lifecycle for the backend.
// It does not know about game rules or domain models -- it only opens a
// connection, configures it for the access pattern this server actually
// has, and verifies it's alive. See docs/ARCHITECTURE.md Section 3.7 for
// what gets written here and when.
package database

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite" // pure-Go SQLite driver, registers as "sqlite"
)

// Config holds the settings needed to open the database. Kept as its own
// type rather than a bare path string so main.go has one obvious place
// to add settings later (e.g. a busy-timeout override) without changing
// Open's signature.
type Config struct {
	// Path is the filesystem path to the SQLite file, e.g.
	// "backend/database/monopoly.db". Use ":memory:" for tests.
	Path string
}

// Open establishes the SQLite connection and configures it for this
// server's actual access pattern: many Room-actor goroutines each doing
// occasional writes (game creation, activity_log inserts, snapshots),
// plus REST handlers doing occasional reads (leaderboard, player
// profile). It does not run migrations -- call Migrate separately once
// Open succeeds.
func Open(cfg Config) (*sql.DB, error) {
	if cfg.Path == "" {
		return nil, fmt.Errorf("database: Config.Path must not be empty")
	}

	// busy_timeout: SQLite allows exactly one writer at a time. Without
	// this, two Rooms writing at roughly the same moment (e.g. two
	// games finishing close together) would get an immediate
	// SQLITE_BUSY error instead of queueing. journal_mode=WAL lets
	// reads proceed without blocking on that one writer. foreign_keys
	// is off by default per-connection in SQLite and has to be
	// requested explicitly -- activity_log and game_snapshots both
	// reference games(id) and that should be enforced.
	dsn := fmt.Sprintf(
		"%s?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(ON)",
		cfg.Path,
	)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("database: open %q: %w", cfg.Path, err)
	}

	// SQLite only ever has one active writer regardless of pool size;
	// capping open connections avoids Go's pool opening more file
	// handles than SQLite can usefully use, while still letting reads
	// (leaderboard, profile) proceed without funneling through a
	// single serialized connection.
	db.SetMaxOpenConns(4)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("database: ping %q: %w", cfg.Path, err)
	}

	return db, nil
}

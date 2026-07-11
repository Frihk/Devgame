// Package repository contains SQL query logic against the schema
// defined in internal/database. Nothing in here knows about game rules
// -- it only translates between Go values and rows. See docs/DATABASE.md.
// meaning of 'repository' in database terms -> a place where things are stored and can be retrieved

package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"Devgame/backend/internal/models"
)

// GameRepository reads and writes the games, activity_log, and
// game_snapshots tables (docs/DATABASE.md Section 3).
type GameRepository struct {
	db *sql.DB
}

func NewGameRepository(db *sql.DB) *GameRepository {
	return &GameRepository{db: db}
}

// GameRecord is the persisted row shape for `games` -- deliberately a
// separate type from models.GameState (the full in-memory authoritative
// state). Only what's actually persisted lives here.
type GameRecord struct {
	ID           string
	Status       models.GameStatus
	WinCondition models.WinCondition
	StartedAt    *time.Time
	EndedAt      *time.Time
}

// CreateGame inserts a new game row with status=lobby. Called once at
// game creation (docs/ARCHITECTURE.md Section 3.7).
func (r *GameRepository) CreateGame(ctx context.Context, id string, winCondition models.WinCondition) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO games (id, status, win_condition) VALUES (?, ?, ?)`,
		id, models.GameStatusLobby, winCondition,
	)
	if err != nil {
		return fmt.Errorf("repository: create game %q: %w", id, err)
	}
	return nil
}

// StartGame marks a game in_progress and stamps started_at.
func (r *GameRepository) StartGame(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE games SET status = ?, started_at = CURRENT_TIMESTAMP WHERE id = ?`,
		models.GameStatusInProgress, id,
	)
	if err != nil {
		return fmt.Errorf("repository: start game %q: %w", id, err)
	}
	return nil
}

// EndGame marks a game ended and stamps ended_at. Called once at game
// end, alongside the final snapshot/leaderboard update per
// ARCHITECTURE.md Section 3.7.
func (r *GameRepository) EndGame(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE games SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?`,
		models.GameStatusEnded, id,
	)
	if err != nil {
		return fmt.Errorf("repository: end game %q: %w", id, err)
	}
	return nil
}

// GetGame fetches a single game row. Returns a wrapped sql.ErrNoRows if
// no game with this id exists -- callers should check with errors.Is.
func (r *GameRepository) GetGame(ctx context.Context, id string) (*GameRecord, error) {
	var rec GameRecord
	var startedAt, endedAt sql.NullTime

	err := r.db.QueryRowContext(ctx,
		`SELECT id, status, win_condition, started_at, ended_at FROM games WHERE id = ?`,
		id,
	).Scan(&rec.ID, &rec.Status, &rec.WinCondition, &startedAt, &endedAt)
	if err != nil {
		return nil, fmt.Errorf("repository: get game %q: %w", id, err)
	}

	if startedAt.Valid {
		rec.StartedAt = &startedAt.Time
	}
	if endedAt.Valid {
		rec.EndedAt = &endedAt.Time
	}
	return &rec, nil
}

// ActivityLogEntry is one row of activity_log -- corresponds directly
// to a models.WSEvent that was finalized and persisted (docs/DATABASE.md
// Section 3).
type ActivityLogEntry struct {
	Seq       uint64
	EventType string
	Payload   json.RawMessage
	CreatedAt time.Time
}

// AppendActivityLog records one finalized event. Per docs/DATABASE.md,
// this should only be called for finalized economic events -- not every
// WSEvent broadcast to clients (dice_rolled, turn_timer_extended, etc.
// don't get a row here).
func (r *GameRepository) AppendActivityLog(ctx context.Context, gameID string, seq uint64, eventType string, payload json.RawMessage) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO activity_log (game_id, seq, event_type, payload_json) VALUES (?, ?, ?, ?)`,
		gameID, seq, eventType, string(payload),
	)
	if err != nil {
		return fmt.Errorf("repository: append activity log for game %q: %w", gameID, err)
	}
	return nil
}

// GetActivityLogSince returns every entry with seq > sinceSeq, ordered
// ascending -- this is the query behind reconnect "replay from seq N"
// (docs/ARCHITECTURE.md Section 3.4).
func (r *GameRepository) GetActivityLogSince(ctx context.Context, gameID string, sinceSeq uint64) ([]ActivityLogEntry, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT seq, event_type, payload_json, created_at
		 FROM activity_log
		 WHERE game_id = ? AND seq > ?
		 ORDER BY seq ASC`,
		gameID, sinceSeq,
	)
	if err != nil {
		return nil, fmt.Errorf("repository: get activity log for game %q: %w", gameID, err)
	}
	defer rows.Close()

	var entries []ActivityLogEntry
	for rows.Next() {
		var e ActivityLogEntry
		var payload string
		if err := rows.Scan(&e.Seq, &e.EventType, &payload, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("repository: scan activity log row for game %q: %w", gameID, err)
		}
		e.Payload = json.RawMessage(payload)
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate activity log for game %q: %w", gameID, err)
	}
	return entries, nil
}

// SnapshotRecord is one row of game_snapshots.
type SnapshotRecord struct {
	Seq       uint64
	StateJSON json.RawMessage
	CreatedAt time.Time
}

// SaveSnapshot persists a full GameState serialization at a given seq.
// stateJSON is expected to already be the marshaled models.GameState --
// this method doesn't know about GameState's shape, only that it's JSON.
// (docs/DATABASE.md flags the missing schema_version column as an open
// item -- add it here once that column exists.)
func (r *GameRepository) SaveSnapshot(ctx context.Context, gameID string, seq uint64, stateJSON json.RawMessage) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO game_snapshots (game_id, seq, state_json) VALUES (?, ?, ?)`,
		gameID, seq, string(stateJSON),
	)
	if err != nil {
		return fmt.Errorf("repository: save snapshot for game %q at seq %d: %w", gameID, seq, err)
	}
	return nil
}

// GetLatestSnapshot returns the highest-seq snapshot for a game -- the
// starting point for crash recovery (reload snapshot, then replay
// activity_log entries after its seq, per ARCHITECTURE.md 3.7).
func (r *GameRepository) GetLatestSnapshot(ctx context.Context, gameID string) (*SnapshotRecord, error) {
	var rec SnapshotRecord
	var stateJSON string

	err := r.db.QueryRowContext(ctx,
		`SELECT seq, state_json, created_at
		 FROM game_snapshots
		 WHERE game_id = ?
		 ORDER BY seq DESC
		 LIMIT 1`,
		gameID,
	).Scan(&rec.Seq, &stateJSON, &rec.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("repository: get latest snapshot for game %q: %w", gameID, err)
	}
	rec.StateJSON = json.RawMessage(stateJSON)
	return &rec, nil
}

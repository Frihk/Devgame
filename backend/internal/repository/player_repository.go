// Package repository -- see game_repository.go for the general pattern.
package repository

import (
	"context"
	"database/sql"
	"fmt"
)

// PlayerRepository reads and writes the players table (added in
// migrate.go specifically to unblock this file -- see the comment on
// that table for the identity assumption this rests on: `id` is
// whatever PlayerID string the client already carries).
type PlayerRepository struct {
	db *sql.DB
}

func NewPlayerRepository(db *sql.DB) *PlayerRepository {
	return &PlayerRepository{db: db}
}

// PlayerProfile is the row shape for GET /player/:id.
type PlayerProfile struct {
	PlayerID     string
	Name         string
	GamesPlayed  int
	Wins         int
	BestNetWorth int64
}

// GetProfile fetches one player's accumulated stats. Returns a wrapped
// sql.ErrNoRows if this PlayerID has never finished a game.
func (r *PlayerRepository) GetProfile(ctx context.Context, playerID string) (*PlayerProfile, error) {
	var p PlayerProfile
	err := r.db.QueryRowContext(ctx,
		`SELECT id, name, games_played, wins, best_net_worth FROM players WHERE id = ?`,
		playerID,
	).Scan(&p.PlayerID, &p.Name, &p.GamesPlayed, &p.Wins, &p.BestNetWorth)
	if err != nil {
		return nil, fmt.Errorf("repository: get profile %q: %w", playerID, err)
	}
	return &p, nil
}

// UpsertAfterGame records the result of one finished game against a
// player's running totals. Call this once per player at game end
// (alongside GameRepository.EndGame), not mid-game -- see
// ARCHITECTURE.md 3.7 for the "write only on finalized events" rule
// this follows.
//
// won: whether this player won this specific game (per the game's
// WinCondition -- bankruptcy-last-standing or net-worth, whichever
// GameState.WinCondition says).
// finalNetWorth: this player's net worth at game end -- only raises
// best_net_worth if higher than any previous game's result.
func (r *PlayerRepository) UpsertAfterGame(ctx context.Context, playerID, name string, won bool, finalNetWorth int64) error {
	winIncrement := 0
	if won {
		winIncrement = 1
	}

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO players (id, name, games_played, wins, best_net_worth)
		VALUES (?, ?, 1, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name           = excluded.name,
			games_played   = players.games_played + 1,
			wins           = players.wins + excluded.wins,
			best_net_worth = MAX(players.best_net_worth, excluded.best_net_worth)
	`, playerID, name, winIncrement, finalNetWorth)
	if err != nil {
		return fmt.Errorf("repository: upsert player %q after game: %w", playerID, err)
	}
	return nil
}

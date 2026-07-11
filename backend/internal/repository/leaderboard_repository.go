// Package repository -- see game_repository.go for the general pattern.
//
// LeaderboardRepository is designed-but-unimplemented for the same
// reason as PlayerRepository: docs/DATABASE.md's schema has no table
// that ranks players across games. A leaderboard needs, at minimum,
// (playerID, some ranking metric, gameID) rows to aggregate over --
// none of that exists as queryable columns today, only as opaque JSON
// inside game_snapshots.state_json and activity_log.payload_json.
//
// Concretely blocked on the same open question as PlayerRepository:
// what identifies a player across games? Until that's answered, "top 10
// by net worth" or "most wins" has nothing stable to GROUP BY.
package repository

import (
	"context"
	"database/sql"
)

type LeaderboardRepository struct {
	db *sql.DB
}

func NewLeaderboardRepository(db *sql.DB) *LeaderboardRepository {
	return &LeaderboardRepository{db: db}
}

// LeaderboardEntry is a placeholder shape -- not a finalized contract.
type LeaderboardEntry struct {
	PlayerID string
	Name     string
	Score    int64 // net worth, wins, or whatever metric gets decided
}

func (r *LeaderboardRepository) GetTop(ctx context.Context, limit int) ([]LeaderboardEntry, error) {
	return nil, ErrNotImplemented
}
ai// Package repository -- see game_repository.go for the general pattern.
package repository

import (
	"context"
	"database/sql"
	"fmt"
)

// LeaderboardRepository reads the players table (see migrate.go and
// player_repository.go for how rows get there -- PlayerRepository's
// UpsertAfterGame is the only writer).
type LeaderboardRepository struct {
	db *sql.DB
}

func NewLeaderboardRepository(db *sql.DB) *LeaderboardRepository {
	return &LeaderboardRepository{db: db}
}

// LeaderboardEntry mirrors handlers.LeaderboardEntry's JSON shape
// (playerId, name, netWorth, wins, gamesPlayed) so the handler can
// return this directly without a translation step.
type LeaderboardEntry struct {
	PlayerID    string
	Name        string
	NetWorth    int64
	Wins        int
	GamesPlayed int
}

// GetTop returns the top `limit` players ranked by wins, then by best
// net worth as a tiebreaker (matches the index in migrate.go).
func (r *LeaderboardRepository) GetTop(ctx context.Context, limit int) ([]LeaderboardEntry, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, best_net_worth, wins, games_played
		FROM players
		ORDER BY wins DESC, best_net_worth DESC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("repository: get top %d players: %w", limit, err)
	}
	defer rows.Close()

	var entries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.PlayerID, &e.Name, &e.NetWorth, &e.Wins, &e.GamesPlayed); err != nil {
			return nil, fmt.Errorf("repository: scan leaderboard row: %w", err)
		}
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("repository: iterate leaderboard rows: %w", err)
	}
	return entries, nil
}

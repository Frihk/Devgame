// this code is opted out intentionally by sospeter
// we don't need a serpate table for properties, we're already keeping track of
// activity log, so we already know who owns what
// for more info take a look at section 3.7 of ARCHITECTURE.md
// i'll leave the code though, for future reference

// // Package repository -- see game_repository.go for the general pattern.
// //
// // PropertyRepository is designed-but-unimplemented. There is no
// // standalone `properties` table in docs/DATABASE.md's schema --
// // property ownership (models.PropertyState) only exists as part of the
// // GameState blob inside game_snapshots.state_json for a given game, or
// // live in Room.State while that game is active.
// //
// // Before implementing this, worth deciding: does anything actually need
// // to query a single property's history independent of its parent game's
// // snapshot? If not, this file may not need to exist at all -- reading
// // property state might belong entirely to
// // GameRepository.GetLatestSnapshot plus a JSON unmarshal, not a separate
// // query path with its own table.
package repository

// import (
// 	"context"
// 	"database/sql"
// )

// type PropertyRepository struct {
// 	db *sql.DB
// }

// func NewPropertyRepository(db *sql.DB) *PropertyRepository {
// 	return &PropertyRepository{db: db}
// }

// func (r *PropertyRepository) GetOwnershipHistory(ctx context.Context, gameID string, propertyID int) (interface{}, error) {
// 	return nil, ErrNotImplemented
// }

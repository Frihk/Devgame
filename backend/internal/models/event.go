package models

import "encoding/json"

// WSEvent is the outbound message envelope broadcast to all clients in a room.
// Mirrors the shape expected by frontend/src/services/gameService.js
type WSEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
	RoomID  string          `json:"roomId"`
	Seq     uint64          `json:"seq"`
}

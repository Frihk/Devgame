package models

import "encoding/json"

// WSEvent is the outbound message envelope broadcast to all clients in a room.
type WSEvent struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
	CmdID   string          `json:"cmdId,omitempty"`
	RoomID  string          `json:"roomId"`
	Seq     uint64          `json:"seq"`
}

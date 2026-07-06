package models

import "encoding/json"

// Command is the inbound message envelope from a client to the Room Actor.
type Command struct {
	PlayerID string
	Type     ActionType      // Matches ActionType from actions.go
	Payload  json.RawMessage
	Reply    chan Result     // Used for request/response-style acks if needed

	// Internal allows passing non-JSON data for internal actor commands (e.g. socket registration)
	Internal interface{}
}

// ClientRegistration encapsulates internal registration data.
type ClientRegistration struct {
	PlayerID string
	Channel  chan WSEvent
}

// Result is the output of a command dispatch.
type Result struct {
	Events []WSEvent
	Error  error
}

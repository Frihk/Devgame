package middleware

import (
	"encoding/json"
	"log"
	"net/http"

	"Devgame/backend/internal/models"
	"Devgame/backend/internal/services"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for development
		return true
	},
}

// WSClient wraps the websocket connection.
type WSClient struct {
	Conn     *websocket.Conn
	PlayerID string
	Room     *services.Room
	Send     chan models.WSEvent
}

// readPump pumps messages from the websocket connection to the room actor.
func (c *WSClient) readPump() {
	defer func() {
		c.Room.Inbox <- models.Command{
			Type:     "internal_unregister_client",
			Internal: c.PlayerID,
		}
		c.Conn.Close()
	}()

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WS error: %v", err)
			}
			break
		}

		// Decode the envelope
		var env struct {
			Type    models.ActionType `json:"type"`
			Payload json.RawMessage   `json:"payload"`
			CmdID   string            `json:"cmdId"`
		}
		if err := json.Unmarshal(message, &env); err != nil {
			log.Printf("Invalid message format from %s: %v", c.PlayerID, err)
			continue
		}

		// Forward to room actor
		c.Room.Inbox <- models.Command{
			PlayerID: c.PlayerID,
			Type:     env.Type,
			Payload:  env.Payload,
			CmdID:    env.CmdID,
		}
	}
}

// writePump pumps messages from the actor back to the websocket connection.
func (c *WSClient) writePump() {
	defer func() {
		c.Conn.Close()
	}()

	for {
		event, ok := <-c.Send
		if !ok {
			// Room closed the channel
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		b, err := json.Marshal(event)
		if err != nil {
			log.Printf("Failed to marshal event: %v", err)
			continue
		}

		if err := c.Conn.WriteMessage(websocket.TextMessage, b); err != nil {
			log.Printf("Failed to write message to %s: %v", c.PlayerID, err)
			return
		}
	}
}

// WSUpgradeHandler upgrades the HTTP connection to a WebSocket and registers the client.
func WSUpgradeHandler(registry *services.RoomRegistry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		roomID := r.PathValue("roomID")
		if roomID == "" {
			http.Error(w, "roomID is required", http.StatusBadRequest)
			return
		}

		token := r.URL.Query().Get("token")
		if token == "" {
			http.Error(w, "token is required", http.StatusUnauthorized)
			return
		}

		// For Phase 0, we simply use the token as the playerID.
		playerID := token

		room, ok := registry.GetRoom(roomID)
		if !ok {
			// Auto-create room for development if it doesn't exist
			room = registry.CreateRoom(roomID)
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WS upgrade failed: %v", err)
			return
		}

		client := &WSClient{
			Conn:     conn,
			PlayerID: playerID,
			Room:     room,
			Send:     make(chan models.WSEvent, 256),
		}

		// Register client with room actor
		room.Inbox <- models.Command{
			Type: "internal_register_client",
			Internal: models.ClientRegistration{
				PlayerID: playerID,
				Channel:  client.Send,
			},
		}

		go client.writePump()
		go client.readPump()
	}
}

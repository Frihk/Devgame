package main

import (
	"log"
	"net/http"

	"Devgame/backend/internal/middleware"
	"Devgame/backend/internal/services"
)

func main() {
	registry := services.NewRoomRegistry()

	mux := http.NewServeMux()

	// REST Endpoints (Stubs for Phase 0)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// WebSocket Endpoint
	mux.HandleFunc("GET /ws/game/{roomID}", middleware.WSUpgradeHandler(registry))

	port := ":8080"
	log.Printf("Starting server on port %s", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

package handlers

import (
	"encoding/json"
	"net/http"
)

// AuthService defines the interface for authentication logic.
type AuthService interface {
	Register(username, password string) (string, error) // Returns playerID/token or error
	Login(username, password string) (string, error)    // Returns playerID/token or error
}

// RegisterRequest holds the JSON payload for registration.
type RegisterRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginRequest holds the JSON payload for login.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// AuthResponse holds the JSON response payload.
type AuthResponse struct {
	Token    string `json:"token,omitempty"`
	PlayerID string `json:"playerId,omitempty"`
	Error    string `json:"error,omitempty"`
}

// RegisterHandler creates an HTTP handler for player registration.
func RegisterHandler(svc AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Method not allowed"})
			return
		}

		var req RegisterRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Invalid request payload"})
			return
		}

		if req.Username == "" || req.Password == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Username and password are required"})
			return
		}

		playerID, err := svc.Register(req.Username, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(AuthResponse{Error: err.Error()})
			return
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(AuthResponse{PlayerID: playerID})
	}
}

// LoginHandler creates an HTTP handler for player login.
func LoginHandler(svc AuthService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Method not allowed"})
			return
		}

		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Invalid request payload"})
			return
		}

		if req.Username == "" || req.Password == "" {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(AuthResponse{Error: "Username and password are required"})
			return
		}

		token, err := svc.Login(req.Username, req.Password)
		if err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			json.NewEncoder(w).Encode(AuthResponse{Error: err.Error()})
			return
		}

		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(AuthResponse{Token: token, PlayerID: req.Username}) // basic fallback ID
	}
}

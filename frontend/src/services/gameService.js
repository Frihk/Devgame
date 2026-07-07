class GameService {
  constructor() {
    this.socket = null;
    this.listeners = new Set();
  }

  /**
   * Establishes a persistent WebSocket connection to the Go multiplayer backend.
   * @param {string} gameId - Unique room ID for the match
   * @param {string} token - User's authorization token for middleware validation
   */
  connect(gameId, token) {
    if (this.socket) {
      console.warn("WebSocket connection already active.");
      return;
    }

    const wsUrl = `ws://localhost:8080/ws/game/${gameId}?token=${token}`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onopen = () => {
      console.log(`📡 Connected to game session: ${gameId}`);
    };

    this.socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        
        // Pass the incoming message out to any subscribed UI scenes or managers
        this.listeners.forEach((callback) => callback(payload));
      } catch (err) {
        console.error("Malformed state payload received from server:", err);
      }
    };

    this.socket.onclose = (event) => {
      console.warn(`🔌 Disconnected from game server. Code: ${event.code}, Reason: ${event.reason}`);
      this.socket = null;
    };

    this.socket.onerror = (error) => {
      console.error("Critical WebSocket pipeline exception:", error);
    };
  }

  /**
   * Subscribes a UI scene or component view to receive incoming network frames
   * @param {Function} callback - Method triggered on socket events
   * @returns {Function} Unsubscribe cleanup closure
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Dispatches a mutation command down to the Go game loop server
   * @param {string} actionType - Must align with constants in shared/enums/playerActions.js
   * @param {object} metadata - Custom execution keys (e.g., propertyId, tradeOfferPayload)
   */
  sendAction(actionType, metadata = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error("Action dropped: Connection stream is closed or uninitialized.");
      return;
    }

    const standardFrame = {
      action: actionType,
      payload: metadata,
      timestamp: new Date().toISOString()
    };

    this.socket.send(JSON.stringify(standardFrame));
  }


  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

const gameService = new GameService();
export default gameService;
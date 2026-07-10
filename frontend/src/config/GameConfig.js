const GameConfig = {
  // API (override with VITE_API_BASE_URL)
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:5173",

  // Match settings
  match: {
    maxPlayers: 4,
    minPlayersToStart: 2,

    // Quick hackathon pacing
    durationMs: 180000, // 3 minutes
    turnTimeoutMs: 15000,
  },

  // Dice
  dice: {
    sides: 6,
    minRoll: 1,
    maxRoll: 6,
  },

  // Board
  board: {
    tileCount: 16,
  },

  // Tile types (must match what the backend uses)
  tileTypes: {
    business: "business",
    ownedIncome: "income",
    event: "event",
    challenge: "challenge",
  },

  // Actions (must match what the backend expects)
  actions: {
    buy: "buy",
    upgrade: "upgrade",
    skip: "skip",
    collect: "collect",
    resolveEvent: "draw_event",
  },

  // UI/Client refresh
  client: {
    stateRefreshMs: 500,
  },
};

export default GameConfig;

export const GAME_CONFIG = {
  // Networking
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",

  // Match pacing (keep short for hackathon)
  MATCH: {
    MAX_PLAYERS: 4,
    TURN_TIMEOUT_MS: 15000, // optional client-side guard
    MATCH_DURATION_MS: 180000, // 3 minutes
    MIN_PLAYERS_TO_START: 2,
  },

  // Dice / movement
  DICE: {
    SIDES: 6,
    MIN_ROLL: 1,
    MAX_ROLL: 6,
  },

  // Board
  BOARD: {
    TILE_COUNT: 16, // change to 8/12/24 as needed
  },

  // Tile types (server should use same identifiers)
  TILE_TYPES: {
    BUSINESS: "business",
    UPGRADE_BUSINESS: "upgrade_business", // (if you split into separate tile kinds)
    OWNED_INCOME: "income",
    EVENT: "event",
    CHALLENGE: "challenge",
  },

  // Actions
  ACTIONS: {
    BUY: "buy",
    UPGRADE: "upgrade",
    SKIP: "skip",
    COLLECT: "collect",
    DRAW_EVENT: "draw_event", // if your server requires an action to resolve
  },

  // Client polling / syncing
  CLIENT: {
    STATE_REFRESH_MS: 500, // if you poll state from the server
  },
};

export const VISUALS = {
  PALETTE: {
    bg: 0x0b1020,
    panel: 0x121a33,
    text: 0xe9eefc,
    subtle: 0x7f8bb3,
    accent: 0x5eead4,
    danger: 0xfb7185,
    warning: 0xfbbf24,
    success: 0x34d399,
  },

  // Phaser texture keys (use whatever you’ve created in assets)
  TEXTURE_KEYS: {
    pawn: "pawn",
    dice: "dice",
    uiPanel: "uiPanel",
  },
};

export const AUDIO = {
  // Audio file/keys you’ll preload in Phaser
  KEYS: {
    diceRoll: "sfx_dice_roll",
    buy: "sfx_buy",
    upgrade: "sfx_upgrade",
    payRent: "sfx_pay_rent",
    event: "sfx_event",
    win: "sfx_win",
  },

  VOLUME: {
    sfx: 0.6,
    music: 0.2,
  },
};

export const UI_STRINGS = {
  // Keep these centralized so your UI can stay consistent
  BUTTONS: {
    ROLL: "Roll",
    BUY: "Buy",
    UPGRADE: "Upgrade",
    SKIP: "Skip",
    COLLECT: "Collect",
  },
};

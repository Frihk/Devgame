// src/config/GameConfig.js
import Phaser from 'phaser';

/**
 * Global Consolidated Game Engine & API Configuration.
 */
export const GameConfig = {
  // --- Phaser Specific Engine Attributes ---
  type: Phaser.AUTO, 
  width: 1200,       
  height: 800,       
  parent: 'game-container', 
  backgroundColor: '#1a1a1a', 
  
  scale: {
    mode: Phaser.Scale.FIT, 
    autoCenter: Phaser.Scale.CENTER_BOTH 
  },

  physics: {
    default: 'arcade', 
    arcade: {
      debug: false, 
      gravity: { y: 0 } 
    }
  },

  // LEAVE THIS EMPTY HERE TO BREAK THE CIRCULAR DEPENDENCY LOOP!
  scene: [],

  // --- Network API Rest Endpoints & State Sync Settings ---
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",

  match: {
    maxPlayers: 4,
    minPlayersToStart: 2,
    durationMs: 180000, 
    turnTimeoutMs: 15000,
  },

  dice: {
    sides: 6,
    minRoll: 1,
    maxRoll: 6,
  },

  board: {
    tileCount: 16, 
  },

  tileTypes: {
    business: "business",
    ownedIncome: "income",
    event: "event",
    challenge: "challenge",
  },

  actions: {
    buy: "buy",
    upgrade: "upgrade",
    skip: "skip",
    collect: "collect",
    resolveEvent: "draw_event",
  },

  client: {
    stateRefreshMs: 500,
  },
};

export default GameConfig;
// src/config/GameConfig.js
import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene.js';

/**
 * Global Phaser Game Engine configuration.
 * Configures canvas scaling, rendering engines, and boots game scenes.
 */
export const GameConfig = {
  type: Phaser.AUTO, // Automatically choices WebGL or Canvas based on device capability
  width: 1200,       // Baseline coordinate width for the board game layout
  height: 800,       // Baseline coordinate height
  parent: 'game-container', // Ties the canvas to an HTML element with id="game-container"
  backgroundColor: '#1a1a1a', // Sleek dark mode background matching modern gaming UIs
  
  scale: {
    mode: Phaser.Scale.FIT, // Auto-scales the game canvas to fit parent dimensions
    autoCenter: Phaser.Scale.CENTER_BOTH // Keeps the board centered horizontally and vertically
  },

  physics: {
    default: 'arcade', // Arcade physics engine included for moving tokens/dice animations
    arcade: {
      debug: false, // Turn on true during local debugging to see bounding boxes
      gravity: { y: 0 } // Overhead board games don't require down-pulling gravity
    }
  },

  // Registers scenes to the Phaser runner framework
  // GameScene will be booted automatically as the primary scene
  scene: [GameScene]
};

// CRITICAL: This fixes the default export error appearing in your browser console!
export default GameConfig;
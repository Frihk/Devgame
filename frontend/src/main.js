// src/main.js
import Phaser from 'phaser';
import GameConfig from './config/GameConfig.js';
import GameScene from './scenes/GameScene.js';

// 1. Break the circular loop by registering the scene dynamically at runtime 
// after both files have finished evaluating.
GameConfig.scene = [GameScene];

// 2. Initialize the global game instance using the standard shared config
const game = new Phaser.Game(GameConfig);

// 3. Keep your responsive window resizing listener running
window.addEventListener('resize', () => {
  if (game && game.scale) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});
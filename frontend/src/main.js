import Phaser from 'phaser';
import GameConfig from './config/GameConfig.js';
import BootScene from './scenes/BootScene.js';
import AuthScene from './scenes/AuthScene.js';
import MenuScene from './scenes/MenuScene.js';
import LobbyScene from './scenes/LobbyScene.js';
import GameScene from './scenes/GameScene.js';

GameConfig.scene = [BootScene, AuthScene, MenuScene, LobbyScene, GameScene];

const game = new Phaser.Game(GameConfig);

window.addEventListener('resize', () => {
  if (game && game.scale) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});

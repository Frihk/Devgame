import Phaser from 'phaser';
import GameConfig from './config/GameConfig.js';
import BootScene from './scenes/BootScene.js';
import AuthScene from './scenes/AuthScene.js';
import MenuScene from './scenes/MenuScene.js';
import LobbyScene from './scenes/LobbyScene.js';
import GameScene from './scenes/GameScene.js';
import ResultScene from './scenes/ResultScene.js';
import ProfileScene from './scenes/ProfileScene.js';

GameConfig.scene = [BootScene, AuthScene, MenuScene, LobbyScene, GameScene, ResultScene, ProfileScene];

const game = new Phaser.Game(GameConfig);

window.addEventListener('resize', () => {
  if (game && game.scale) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});

// frontend/src/scene/BootScene.js

import Phaser from "phaser";

export default class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    // --- Audio ---
    // Add these files under: frontend/src/assets/... (or whatever path you use)
    // If you don't have them yet, keep the preload lines for later—Phaser will error if missing.
    // this.load.audio("sfx_dice_roll", "assets/audio/sfx_dice_roll.mp3");
    // this.load.audio("sfx_buy", "assets/audio/sfx_buy.mp3");
    // this.load.audio("sfx_upgrade", "assets/audio/sfx_upgrade.mp3");
    // this.load.audio("sfx_pay_rent", "assets/audio/sfx_pay_rent.mp3");
    // this.load.audio("sfx_event", "assets/audio/sfx_event.mp3");
    // this.load.audio("sfx_win", "assets/audio/sfx_win.mp3");

    // --- Images / Sprites / Atlases ---
    // Ensure these exist or comment them out until assets are ready.
    // this.load.image("uiPanel", "assets/ui/uiPanel.png");
    // this.load.image("diceFace", "assets/ui/diceFace.png");
    // this.load.image("tileBusiness", "assets/tiles/tile_business.png");
    // this.load.image("tileEvent", "assets/tiles/tile_event.png");

    // Token
    // this.load.image("pawn", "assets/pawn/pawn.png");

    // If you want a quick hackathon placeholder without images:
    // we can still render graphics in GameScene, so nothing is required here.
  }

  create() {
    // Make sure textures/graphics are ready; then start the game.
    this.scene.start("AuthScene");
  }
}

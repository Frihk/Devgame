import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // Load small assets needed for the loading screen itself, if any.
  }

  create() {
    // Transition immediately to the Preload scene
    this.scene.start('PreloadScene');
  }
}

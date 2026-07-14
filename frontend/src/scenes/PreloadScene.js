import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Beautiful gradient background
    let graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
    graphics.fillRect(0, 0, width, height);

    // Premium Typography setup (Using Google Fonts via index.html)
    const loadingText = this.add.text(width / 2, height / 2 - 50, 'LOADING WEKONOMY...', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '32px',
      fontWeight: 'bold',
      color: '#ffffff',
      letterSpacing: 4
    }).setOrigin(0.5);

    // Progress Box
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x0f3460, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2, 320, 20, 10);

    this.load.on('progress', (value) => {
      progressBar.clear();
      progressBar.fillStyle(0xe94560, 1);
      progressBar.fillRoundedRect(width / 2 - 158, height / 2 + 2, 316 * value, 16, 8);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      
      this.scene.start('MenuScene');
    });

    // Simulate loading for demonstration (since we don't have many assets yet)
    for (let i = 0; i < 150; i++) {
      this.load.image(`logo${i}`, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');
    }
  }
}

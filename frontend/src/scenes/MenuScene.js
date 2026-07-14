import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Premium Background
    let bg = this.add.graphics();
    bg.fillGradientStyle(0x0f2027, 0x203a43, 0x2c5364, 0x2c5364, 1);
    bg.fillRect(0, 0, width, height);

    // Title
    this.add.text(width / 2, height / 3, 'WEKONOMY', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '64px',
      fontWeight: '900',
      color: '#ffffff',
      shadow: { blur: 10, color: '#000000', fill: true }
    }).setOrigin(0.5);

    // Start Button (DOM Element for premium CSS styling)
    const startBtnHtml = `<button class="premium-btn">START GAME</button>`;
    const startBtn = this.add.dom(width / 2, height / 2 + 50).createFromHTML(startBtnHtml);

    // Transition to Game Scene
    startBtn.addListener('click');
    startBtn.on('click', () => {
      this.scene.start('GameScene');
    });
  }
}

import Phaser from 'phaser';
import { Board } from '../board/Board.js';
import { EventBridge } from '../utils/EventBridge.js';

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Beautiful placeholder background for the Game Scene
    let bg = this.add.graphics();
    bg.fillGradientStyle(0x1a2a6c, 0x11998e, 0x2bc0e4, 0x38ef7d, 1);
    bg.fillRect(0, 0, width, height);

    // Placeholder Text
    this.add.text(width / 2, height / 2, 'GAME BOARD \n (Under Construction - Phase 3)', {
      fontFamily: 'Inter, sans-serif',
      fontSize: '48px',
      fontWeight: 'bold',
      color: '#ffffff',
      align: 'center',
      shadow: { blur: 10, color: '#000000', fill: true }
    }).setOrigin(0.5);

    this.board = new Board(this);

    // Emit event when Phaser canvas is clicked
    this.input.on('pointerdown', () => {
      EventBridge.emit('PHASER_CLICKED', { time: Date.now() });
    });

    // Listen to React events
    EventBridge.on('REACT_CLICKED', (data) => {
      console.log('Phaser received event from React:', data.message);
      // Change background color temporarily as visual feedback
      this.cameras.main.setBackgroundColor('#ff0000');
      setTimeout(() => this.cameras.main.setBackgroundColor('#000000'), 500);
    });

    this.setupUIListeners();
  }

  setupUIListeners() {
    const rollBtn = document.getElementById('roll-dice-btn');
    if (rollBtn) {
      rollBtn.addEventListener('click', () => this.handleDiceRoll());
    }
  }

  handleDiceRoll() {
    console.log('Dice rolled! Communicating with Go API...');
  }

  showPropertyModal(propertyData) {
    const modalHtml = `
      <div class="modal-backdrop">
        <div class="property-card tourism-sector">
          <h3>${propertyData.sector}</h3>
          <h2>${propertyData.name}</h2>
          <div class="rent-schedule">Base Rent: ${propertyData.rent}</div>
          <button id="buy-btn">Buy Property (${propertyData.cost})</button>
          <button id="auction-btn">Auction</button>
        </div>
      </div>
    `;

    const modal = this.add
      .dom(window.innerWidth / 2, window.innerHeight / 2)
      .createFromHTML(modalHtml);

    document.getElementById('buy-btn').addEventListener('click', () => {
      modal.destroy();
    });
  }

  showLiquidationModal(debtAmount) {
    const liquidationHtml = `
      <div class="liquidation-container">
        <h2>⚠️ Liquidation Required</h2>
        <p>Debt Owed: Ksh ${debtAmount}</p>
        <div class="progress-bar"><div class="fill" style="width: 0%"></div></div>
        <button class="confirm-btn">Confirm & Pay</button>
      </div>
    `;

    this.add
      .dom(window.innerWidth / 2, window.innerHeight / 2)
      .createFromHTML(liquidationHtml);
  }
}

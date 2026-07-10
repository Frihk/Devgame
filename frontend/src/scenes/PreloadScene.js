import Phaser from "phaser";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    const { width } = this.scale;

    // Simple loading text
    const style = { fontFamily: "Arial", fontSize: "18px", color: "#e9eefc" };
    this.add.text(width / 2, 220, "Loading assets...", style).setOrigin(0.5);

    // If you have assets, load them here (examples):
    // this.load.image("pawn", "assets/pawn/pawn.png");
    // this.load.image("uiPanel", "assets/ui/uiPanel.png");
    // this.load.audio("sfx_dice_roll", "assets/audio/sfx_dice_roll.mp3");

    // Boot quickly for hackathon prototype
  }

  create() {
    this.scene.start("BootScene");
  }
}

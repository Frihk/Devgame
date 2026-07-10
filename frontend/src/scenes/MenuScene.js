// frontend/src/scene/MenuScene.js

import Phaser from "phaser";

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super("MenuScene");

    this.ui = {
      titleText: null,
      startButton: null,
      lobbyButton: null,
      howToText: null,
    };
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    this.ui.titleText = this.add
      .text(width / 2, height / 2 - 180, "Monopoly Devgame", {
        fontFamily: "Arial",
        fontSize: "44px",
        color: "#e9eefc",
      })
      .setOrigin(0.5, 0.5);

    this.ui.howToText = this.add
      .text(width / 2, height / 2 - 110, "Fast matches. Strategic buys & upgrades.", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#7f8bb3",
        align: "center",
        wordWrap: { width: width - 40 },
      })
      .setOrigin(0.5, 0.5);

    const btnW = 320;
    const btnH = 60;

    const mkButton = (y, label, onClick) => {
      const container = this.add.container(width / 2, y);

      const bg = this.add
        .rectangle(0, 0, btnW, btnH, 0x121a33, 0.95)
        .setStrokeStyle(2, 0x5eead4, 0.85);

      const txt = this.add
        .text(0, 0, label, {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#e9eefc",
        })
        .setOrigin(0.5, 0.5);

      container.add([bg, txt]);

      container.setSize(btnW, btnH);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
        Phaser.Geom.Rectangle.Contains
      );

      container.on("pointerup", () => onClick?.());
      container.on("pointerover", () => bg.setFillStyle(0x162645, 1));
      container.on("pointerout", () => bg.setFillStyle(0x121a33, 0.95));

      return container;
    };

    this.ui.lobbyButton = mkButton(height / 2 - 10, "Go to Lobby", () => {
      this.scene.start("LobbyScene");
    });

    this.ui.startButton = mkButton(height / 2 + 70, "Quick Demo (Local)", () => {
      this.scene.start("GameScene", { gameId: null });
    });
  }
}

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

    const mkButton = (y, label, onClick) => {
      const bg = this.add
        .rectangle(width / 2, y, 320, 60, 0x121a33, 0.95)
        .setStrokeStyle(2, 0x5eead4, 0.85)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(width / 2, y, label, {
          fontFamily: "Arial",
          fontSize: "20px",
          color: "#e9eefc",
        })
        .setOrigin(0.5, 0.5);

      bg.on("pointerup", onClick);
      bg.on("pointerover", () => bg.setFillStyle(0x162645, 1));
      bg.on("pointerout", () => bg.setFillStyle(0x121a33, 0.95));

      return bg;
    };

    this.ui.lobbyButton = mkButton(height / 2 - 10, "Go to Lobby", () => {
      this.scene.start("LobbyScene");
    });

    this.ui.startButton = mkButton(height / 2 + 70, "Quick Demo (Local)", () => {
      this.scene.start("GameScene", { gameId: null });
    });

    const profileBtn = this.add
      .text(16, 16, "Profile", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#5eead4",
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    profileBtn.on("pointerup", () => {
      this.scene.start("ProfileScene");
    });

    const logoutBtn = this.add
      .text(width - 16, 16, "Logout", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#fb7185",
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    logoutBtn.on("pointerup", () => {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("playerId");
      sessionStorage.removeItem("sessionTime");
      this.scene.start("AuthScene");
    });
  }
}

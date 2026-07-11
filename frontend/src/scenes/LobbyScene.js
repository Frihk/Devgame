import Phaser from "phaser";
import GameConfig from "../config/GameConfig";

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super("LobbyScene");
    this.api = null;
    this.gameId = null;

    this.ui = {
      titleText: null,
      statusText: null,
      playersText: null,
      startButton: null,
      rollOverButton: null,
    };
  }

  preload() {}

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    this.ui.titleText = this.add
      .text(width / 2, height / 2 - 160, "Monopoly Devgame", {
        fontFamily: "Arial",
        fontSize: "34px",
        color: "#e9eefc",
      })
      .setOrigin(0.5, 0);

    this.ui.statusText = this.add
      .text(width / 2, height / 2 - 110, "Starting lobby...", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#5eead4",
      })
      .setOrigin(0.5, 0);

    this.ui.playersText = this.add
      .text(width / 2, height / 2 - 60, "Players: (waiting)", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#7f8bb3",
        align: "center",
      })
      .setOrigin(0.5, 0);

    const mkButton = (y, label, onClick) => {
      const bg = this.add
        .rectangle(width / 2, y, 240, 52, 0x121a33, 0.95)
        .setStrokeStyle(2, 0x5eead4, 0.8)
        .setInteractive({ useHandCursor: true });

      const txt = this.add
        .text(width / 2, y, label, {
          fontFamily: "Arial",
          fontSize: "18px",
          color: "#e9eefc",
        })
        .setOrigin(0.5);

      bg.on("pointerup", onClick);

      return bg;
    };

    this.ui.startButton = mkButton(height / 2 + 90, "Start Match", async () => {
      await this._createAndStartMatch();
    });

    this.ui.rollOverButton = mkButton(height / 2 + 160, "Quick Demo (Local)", () => {
      this._startLocalDemo();
    });

    this._initApi();
    this._renderLocalWaitHint();
  }

  async _createAndStartMatch() {
    try {
      this.ui.statusText.setText("Creating match...");
      const created = await this.api.post("/api/games", {
        match: { durationMs: GameConfig.match.durationMs, board: { tileCount: GameConfig.board.tileCount } },
      });

      this.gameId = created?.gameId ?? created?.id ?? created?.game?.id;
      if (!this.gameId) throw new Error("No gameId returned");

      await this.api.post(`/api/games/${this.gameId}/join`, {
        name: `Host ${Math.floor(Math.random() * 999)}`,
      });

      this.ui.statusText.setText("Starting...");
      this.scene.start("GameScene", { gameId: this.gameId });
    } catch (e) {
      this.ui.statusText.setText("Server unavailable. Starting local demo...");
      this._startLocalDemo();
    }
  }

  _startLocalDemo() {
    this.scene.start("GameScene", { gameId: null });
  }

  _initApi() {
    const apiBaseUrl = GameConfig.apiBaseUrl;

    this.api = {
      async post(path, body) {
        const res = await fetch(`${apiBaseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
    };
  }

  _renderLocalWaitHint() {
    const needed = GameConfig.match.minPlayersToStart;
    const max = GameConfig.match.maxPlayers;
    this.ui.playersText.setText(`Players: waiting for ${needed}-${max} players`);
  }
}

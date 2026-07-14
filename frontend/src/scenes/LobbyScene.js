import Phaser from "phaser";
import GameConfig from "../config/GameConfig";
import gameService from "../services/gameService";
import { PlayerAction } from "../../../shared/enums/playerActions";

export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super("LobbyScene");
    this.gameId = null;
    this.players = [];
    this.isHost = false;
    this.unsub = null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    this.add.text(width / 2, height / 2 - 160, "Monopoly Devgame", {
      fontFamily: "Arial", fontSize: "34px", color: "#e9eefc",
    }).setOrigin(0.5, 0);

    this.statusText = this.add.text(width / 2, height / 2 - 110, "Setting up...", {
      fontFamily: "Arial", fontSize: "16px", color: "#5eead4",
    }).setOrigin(0.5, 0);

    this.roomIdText = this.add.text(width / 2, height / 2 - 80, "", {
      fontFamily: "Arial", fontSize: "14px", color: "#7f8bb3",
    }).setOrigin(0.5, 0);

    this.playerListText = this.add.text(width / 2, height / 2 - 30, "", {
      fontFamily: "Arial", fontSize: "15px", color: "#e9eefc", align: "center",
    }).setOrigin(0.5, 0);

    const mkBtn = (y, label, color, onClick) => {
      const bg = this.add.rectangle(width / 2, y, 240, 52, color, 0.9)
        .setStrokeStyle(2, 0xffffff, 0.15)
        .setInteractive({ useHandCursor: true });
      const txt = this.add.text(width / 2, y, label, {
        fontFamily: "Arial", fontSize: "18px", color: "#ffffff",
      }).setOrigin(0.5);
      bg.on("pointerup", onClick);
      bg.on("pointerover", () => bg.setFillStyle(color, 1));
      bg.on("pointerout", () => bg.setFillStyle(color, 0.9));
      return { bg, txt };
    };

    this.startBtn = mkBtn(height / 2 + 90, "Start Match", 0x1a5a5a, () => {
      if (this.isHost && this.players.length >= 2) this._startMatch();
    });

    mkBtn(height / 2 + 160, "Quick Demo (Local)", 0x2a2a4a, () => {
      gameService.disconnect();
      this.scene.start("GameScene", { gameId: null });
    });

    this._createLobby();
  }

  async _createLobby() {
    const baseUrl = GameConfig.apiBaseUrl;
    const playerName = sessionStorage.getItem("playerId") || "guest";

    try {
      const created = await fetch(`${baseUrl}/lobby/create`, { method: "POST" });
      if (!created.ok) throw new Error("HTTP " + created.status);
      const data = await created.json();
      this.gameId = data.roomId || data.gameId;
      this.isHost = true;

      await fetch(`${baseUrl}/lobby/${this.gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName, playerId: playerName }),
      });

      this.roomIdText.setText(`Room: ${this.gameId}`);
      this.statusText.setText("Connecting...");
      this.players = [playerName];
      this._renderPlayers();
      this._connectWS();
    } catch (e) {
      this.statusText.setText("Server offline. Use Quick Demo instead.");
    }
  }

  _connectWS() {
    gameService.disconnect();
    const token = sessionStorage.getItem("playerId") || "guest";
    gameService.connect(this.gameId, token);

    this.unsub = gameService.subscribe((event) => {
      if (event.type === "player_connected") {
        const pid = event.payload?.playerId || event.playerId;
        if (pid && !this.players.includes(pid)) {
          this.players.push(pid);
          this._renderPlayers();
        }
      } else if (event.type === "player_disconnected") {
        const pid = event.payload?.playerId || event.playerId;
        this.players = this.players.filter(p => p !== pid);
        this._renderPlayers();
      } else if (event.type === "game_started") {
        this.scene.start("GameScene", { gameId: this.gameId });
      }
    });

    this.statusText.setText("Waiting for players...");
  }

  _renderPlayers() {
    const list = this.players.length
      ? this.players.map((p, i) => `${i + 1}. ${p}`).join("\n")
      : "(waiting for players...)";
    this.playerListText.setText(`Players in room:\n${list}`);
    const enabled = this.isHost && this.players.length >= 2;
    this.startBtn.bg.setAlpha(enabled ? 1 : 0.35);
    this.startBtn.txt.setAlpha(enabled ? 1 : 0.35);
  }

  _startMatch() {
    this.statusText.setText("Starting game...");
    gameService.sendAction(PlayerAction.START_GAME, {}).then(() => {}).catch(() => {
      this.statusText.setText('Server unreachable. Starting local demo...');
      this.time.delayedCall(1500, () => {
        this.scene.start('GameScene', { gameId: null });
      });
    });
  }

  shutdown() {
    if (this.unsub) this.unsub();
  }
}

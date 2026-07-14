import Phaser from "phaser";
import GameConfig from "../config/GameConfig";

export default class ProfileScene extends Phaser.Scene {
  constructor() {
    super("ProfileScene");
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    const cx = width / 2;
    let y = 60;

    this.add.text(cx, y, "Player Profile", {
      fontFamily: "Arial", fontSize: "32px", color: "#e9eefc", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);
    y += 60;

    const playerId = sessionStorage.getItem("playerId") || "guest";
    const playerName = playerId.replace("_id", "").replace("mock_token_", "");

    const info = [
      { label: "Username", value: playerName },
      { label: "Player ID", value: playerId },
    ];

    for (const row of info) {
      const bg = this.add.graphics();
      bg.fillStyle(0x121a33, 0.95);
      bg.fillRoundedRect(cx - 200, y, 400, 44, 8);
      bg.lineStyle(1, 0x2a3a5a, 0.5);
      bg.strokeRoundedRect(cx - 200, y, 400, 44, 8);
      this.add.text(cx - 180, y + 22, row.label, {
        fontFamily: "Arial", fontSize: "14px", color: "#7f8bb3",
      }).setOrigin(0, 0.5);
      this.add.text(cx + 180, y + 22, row.value, {
        fontFamily: "Arial", fontSize: "14px", color: "#e9eefc", fontStyle: "bold",
      }).setOrigin(1, 0.5);
      y += 54;
    }

    y += 20;
    this.add.text(cx, y, "Stats from server", {
      fontFamily: "Arial", fontSize: "13px", color: "#5a6a8a",
    }).setOrigin(0.5, 0.5);
    y += 30;

    this._fetchStats(cx, y);
  }

  async _fetchStats(cx, y) {
    const token = sessionStorage.getItem("token");
    const playerId = sessionStorage.getItem("playerId");

    try {
      const res = await fetch(`${GameConfig.apiBaseUrl}/player/${playerId || "me"}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      const stats = [
        { label: "Games Played", value: data.gamesPlayed ?? data.GamesPlayed ?? "—" },
        { label: "Wins", value: data.wins ?? data.Wins ?? "—" },
        { label: "Total Earned", value: data.totalEarned ?? data.TotalEarned ?? "—" },
      ];

      for (const row of stats) {
        const bg = this.add.graphics();
        bg.fillStyle(0x121a33, 0.95);
        bg.fillRoundedRect(cx - 200, y, 400, 44, 8);
        bg.lineStyle(1, 0x2a3a5a, 0.5);
        bg.strokeRoundedRect(cx - 200, y, 400, 44, 8);
        this.add.text(cx - 180, y + 22, row.label, {
          fontFamily: "Arial", fontSize: "14px", color: "#7f8bb3",
        }).setOrigin(0, 0.5);
        const color = row.label === "Wins" ? "#34d399" : "#e9eefc";
        this.add.text(cx + 180, y + 22, String(row.value), {
          fontFamily: "Arial", fontSize: "14px", color, fontStyle: "bold",
        }).setOrigin(1, 0.5);
        y += 54;
      }
    } catch {
      this.add.text(cx, y + 20, "Could not load server stats", {
        fontFamily: "Arial", fontSize: "14px", color: "#7f8bb3",
      }).setOrigin(0.5, 0.5);
    }

    const backBtn = this.add.text(16, 16, "← Back", {
      fontFamily: "Arial", fontSize: "14px", color: "#5eead4",
    }).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(10);
    backBtn.on("pointerup", () => this.scene.start("MenuScene"));
  }
}

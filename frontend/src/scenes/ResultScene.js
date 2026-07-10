// frontend/src/scene/ResultScene.js

import Phaser from "phaser";

export default class ResultScene extends Phaser.Scene {
  constructor() {
    super("ResultScene");
    this.result = null;
  }

  init(data) {
    this.result = data?.result ?? data?.state ?? null;
  }

  create() {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(0x0b1020);

    this.add
      .text(width / 2, 120, "Match Results", {
        fontFamily: "Arial",
        fontSize: "40px",
        color: "#e9eefc",
      })
      .setOrigin(0.5);

    const resultObj = this.result ?? {};
    const winnerId = resultObj.winnerId ?? resultObj.winner_player_id ?? null;

    const players = Array.isArray(resultObj.players)
      ? resultObj.players
      : Array.isArray(resultObj.leaderboard)
      ? resultObj.leaderboard
      : [];

    const winnerName =
      players.find(p => p.id === winnerId)?.name ??
      resultObj.winnerName ??
      "—";

    this.add
      .text(width / 2, 185, `Winner: ${winnerName}`, {
        fontFamily: "Arial",
        fontSize: "22px",
        color: "#34d399",
      })
      .setOrigin(0.5);

    const headerY = 260;

    this.add
      .text(width / 2, headerY, "Leaderboard", {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#7f8bb3",
      })
      .setOrigin(0.5);

    const listYStart = headerY + 40;
    const rowH = 34;

    if (!players.length) {
      this.add
        .text(width / 2, listYStart + 40, "No player data received.", {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#fb7185",
        })
        .setOrigin(0.5);
    } else {
      // sort by netWorth/score if available
      const sorted = [...players].sort((a, b) => {
        const av = Number(a.netWorth ?? a.net_worth ?? a.score ?? 0);
        const bv = Number(b.netWorth ?? b.net_worth ?? b.score ?? 0);
        return bv - av;
      });

      sorted.slice(0, 10).forEach((p, i) => {
        const rank = i + 1;
        const name = p.name ?? `Player ${p.id ?? ""}`;
        const score = Number(p.netWorth ?? p.net_worth ?? p.score ?? 0);

        const isWinner = winnerId != null && p.id === winnerId;

        const color = isWinner ? "#34d399" : "#e9eefc";

        this.add
          .text(width / 2, listYStart + i * rowH, `${rank}. ${name}  —  $${score.toLocaleString()}`, {
            fontFamily: "Arial",
            fontSize: "16px",
            color,
          })
          .setOrigin(0.5);
      });
    }

    const mkButton = (y, label, onClick) => {
      const btnW = 320;
      const btnH = 56;

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
        .setOrigin(0.5);

      container.add([bg, txt]);

      container.setSize(btnW, btnH);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH),
        Phaser.Geom.Rectangle.Contains
      );

      container.on("pointerover", () => bg.setFillStyle(0x162645, 1));
      container.on("pointerout", () => bg.setFillStyle(0x121a33, 0.95));
      container.on("pointerup", () => onClick?.());

      return container;
    };

    mkButton(height - 120, "Back to Menu", () => {
      this.scene.start("MenuScene");
    });
  }
}

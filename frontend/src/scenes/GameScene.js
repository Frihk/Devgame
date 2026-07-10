// frontend/src/scene/GameScene.js

import Phaser from "phaser";
import GameConfig from "../config/GameConfig.js";
import TurnManager from "../manager/TurnManager";
import EconomyManager from "../manager/EconomyManager";
import EventManager from "../manager/EventManager";
import Player from "../player/player";
import { rollDice } from "../player/dice";
import { moveForwardCircular, getTilePosition } from "../player/movement";

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");

    this.gameId = null;

    this.state = {
      phase: "waiting",
      game: null, // authoritative state from server
      players: [],
      playerById: {},
      board: null, // tile list with positions/types
      currentPlayerId: null,
      canCurrentPlayerAct: true,
      allowedActions: [],
      events: [],
      summary: [],
      winnerId: null,
      gameOver: false,
      match: null,
    };

    this.api = null;

    this.turnManager = new TurnManager({
      onTurnResolved: (normalized) => this._renderTurnResolved(normalized),
      onGameOver: () => this._renderGameOver(),
    });

    this.economy = new EconomyManager({ startingCash: 1500 });

    this.eventManager = new EventManager({
      onResolve: (normalizedEvent) => {
        if (normalizedEvent?.message) this._pushToast(normalizedEvent.message);
      },
    });

    this.ui = {
      statusText: null,
      toastText: null,
      boardContainer: null,
      diceButton: null,
      buyButton: null,
      upgradeButton: null,
      skipButton: null,
      collectButton: null,
    };

    this.assetsReady = false;
  }

  preload() {
  }

  async create() {
    this._setupUI();
    this._setupBoardPlaceholder();
    this._hookInput();

    try {
      await this._bootstrapFromServer();
    } catch (e) {
      this._pushToast("Server not connected. Running local placeholder.");
      this._runLocalPlaceholder();
    }
  }

  update() {}

  // -----------------------------
  // Server bootstrap + polling
  // -----------------------------
  async _bootstrapFromServer() {
    this.apiBaseUrl = GameConfig.apiBaseUrl;
    this.api = {
      async post(path, body) {
        const res = await fetch(`${this.apiBaseUrl}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
      async get(path) {
        const res = await fetch(`${this.apiBaseUrl}${path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
    };

    const created = await this.api.post("/api/games", {
      match: { durationMs: GameConfig.match.durationMs, board: { tileCount: GameConfig.board.tileCount } },
    });

    this.gameId = created?.gameId ?? created?.id ?? created?.game?.id ?? null;

    if (!this.gameId) throw new Error("No gameId in response");

    if (this.api.post) {
      await this.api.post(`/api/games/${this.gameId}/join`, { name: `Player ${Math.floor(Math.random() * 999)}` });
    }

    // Initial state
    await this._syncState();

    // Poll state (fast hackathon friendly)
    this.time.addEvent({
      delay: GameConfig.client.stateRefreshMs,
      loop: true,
      callback: () => this._syncState().catch(() => {}),
    });
  }

  async _syncState() {
    if (!this.gameId || !this.api) return;

    const s = await this.api.get(`/api/games/${this.gameId}`);
    this._applyServerState(s);
    this._renderFromState();
  }

  _applyServerState(serverState = {}) {
    const phase = serverState.phase ?? serverState?.match?.phase ?? "turn";
    const board = serverState.board?.tiles ? serverState.board : serverState.board ?? null;

    this.state.phase = phase;
    this.state.game = serverState;

    const playersRaw = serverState.players ?? serverState?.match?.players ?? [];
    const players = Array.isArray(playersRaw)
      ? playersRaw.map(p => Player.fromServer(p))
      : [];

    const playerById = {};
    for (const p of players) playerById[p.id] = p;

    this.state.players = players;
    this.state.playerById = playerById;

    this.state.board = board;
    this.state.currentPlayerId = serverState.currentPlayerId ?? serverState.current_player_id ?? null;

    this.state.canCurrentPlayerAct = serverState.canCurrentPlayerAct ?? serverState.can_act ?? true;
    this.state.allowedActions = serverState.allowedActions ?? serverState.allowed_actions ?? [];

    this.state.events = serverState.events ?? [];
    this.state.summary = serverState.summary ?? [];
    this.state.winnerId = serverState.winnerId ?? serverState.winner_player_id ?? null;
    this.state.gameOver = !!(serverState.gameOver ?? serverState.game_over ?? false);
  }

  // -----------------------------
  // Local placeholder (no server)
  // -----------------------------
  _runLocalPlaceholder() {
    // Create a tiny 4-player placeholder match that still lets you click Roll.
    const tileCount = GameConfig.board.tileCount;

    // Create dummy tiles & positions if we didn't already.
    if (!this.state.board?.tiles) {
      this._setupBoardPlaceholder(tileCount);
    }

    const players = [
      new Player({ id: 1, name: "Alice", cash: 1500, positionIndex: 0 }),
      new Player({ id: 2, name: "Bob", cash: 1500, positionIndex: 4 }),
      new Player({ id: 3, name: "Cara", cash: 1500, positionIndex: 8 }),
    ];

    this.state.players = players;
    this.state.playerById = players.reduce((acc, p) => ((acc[p.id] = p), acc), {});
    this.state.currentPlayerId = 1;
    this.state.canCurrentPlayerAct = true;
    this.state.allowedActions = ["roll"];
    this.state.gameOver = false;
    this.state.summary = [];

    this._renderFromState();
  }

  // -----------------------------
  // UI
  // -----------------------------
  _setupUI() {
    const { width, height } = this.scale;

    // Background
    this.cameras.main.setBackgroundColor(0x0b1020);

    // Board container
    this.ui.boardContainer = this.add.container(width / 2, height / 2 - 30);

    // Status
    this.ui.statusText = this.add
      .text(0, -220, "Connecting...", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#e9eefc",
      })
      .setOrigin(0.5, 0);

    // Toast
    this.ui.toastText = this.add
      .text(0, -180, "", {
        fontFamily: "Arial",
        fontSize: "14px",
        color: "#5eead4",
      })
      .setOrigin(0.5, 0);

    // Buttons
    const btnY = height / 2 + 180;

    const mkBtn = (x, label, onClick) => {
      const btn = this.add
        .text(x, btnY, label, {
          fontFamily: "Arial",
          fontSize: "16px",
          color: "#121a33",
          backgroundColor: "#5eead4",
          padding: { left: 10, right: 10, top: 8, bottom: 8 },
        })
        .setOrigin(0.5, 0.5)
        .setPadding(8);

      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerup", () => onClick?.());

      return btn;
    };

    // We'll position buttons in a row.
    this.ui.diceButton = mkBtn(-180, "Roll", () => this._onRollClicked());
    this.ui.buyButton = mkBtn(-60, "Buy", () => this._onBuyClicked());
    this.ui.upgradeButton = mkBtn(60, "Upgrade", () => this._onUpgradeClicked());
    this.ui.skipButton = mkBtn(180, "Skip", () => this._onSkipClicked());

    this.ui.collectButton = this.add
      .text(0, btnY + 40, "Collect", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: "#121a33",
        backgroundColor: "#34d399",
        padding: { left: 10, right: 10, top: 8, bottom: 8 },
      })
      .setOrigin(0.5, 0.5)
      .setPadding(8)
      .setInteractive({ useHandCursor: true });

    this.ui.collectButton.on("pointerup", () => this._onCollectClicked());

    this._setButtonsEnabled({ roll: true, buy: false, upgrade: false, skip: false, collect: false });
  }

  _setupBoardPlaceholder(tileCount = GameConfig.board.tileCount) {
    const n = tileCount;
    const radius = 220;
    const centerX = 0;
    const centerY = 0;

    const tiles = [];
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      // Placeholder tile types:
      // business on most tiles, event occasionally, challenge occasionally
      let type = "business";
      if (i % 7 === 0) type = "event";
      if (i % 11 === 0) type = "challenge";
      if (i % 5 === 0 && type === "business") type = "income";

      tiles.push({ id: i, type, x, y, ownedBy: null, upgradeLevel: 0 });
    }

    this.state.board = { tiles, tileCount: n };

    // Render board visuals
    this._renderBoardTiles();
    this._renderPawns();
  }

  _renderBoardTiles() {
    this.ui.boardContainer.removeAll(true);

    const tiles = this.state.board?.tiles ?? [];
    for (const t of tiles) {
      const bgColor =
        t.type === "event" ? 0xfbbf24 : t.type === "challenge" ? 0xfb7185 : t.type === "income" ? 0x34d399 : 0x5eead4;

      const rect = this.add.rectangle(t.x, t.y, 70, 45, bgColor, 0.95).setStrokeStyle(2, 0xffffff, 0.25);

      const label = this.add
        .text(t.x, t.y, String(t.id), { fontFamily: "Arial", fontSize: "14px", color: "#0b1020" })
        .setOrigin(0.5, 0.5);

      this.ui.boardContainer.add([rect, label]);
    }
  }

  _renderPawns() {
    this._renderBoardTiles();

    const tiles = this.state.board?.tiles ?? [];
    const players = this.state.players ?? [];

    for (const p of players) {
      const tile = tiles[p.positionIndex] ?? tiles[0];
      const pawn = this.add.circle(tile?.x ?? 0, tile?.y ?? 0, 10, 0x9ad1ff);
      const pawnText = this.add
        .text(tile?.x ?? 0, (tile?.y ?? 0) - 18, p.name?.slice(0, 6) ?? "", {
          fontFamily: "Arial",
          fontSize: "11px",
          color: "#e9eefc",
        })
        .setOrigin(0.5, 0);

      this.ui.boardContainer.add([pawn, pawnText]);
    }
  }

  _hookInput() {
    // Optional: keyboard shortcuts for roll
    this.input.keyboard?.on("keydown-R", () => this._onRollClicked());
  }

  _setButtonsEnabled({ roll, buy, upgrade, skip, collect }) {
    const setEnabled = (btn, enabled) => {
      if (!btn) return;
      btn.setInteractive(enabled);
      btn.alpha = enabled ? 1 : 0.35;
      btn.disableInteractive();
      if (enabled) btn.setInteractive({ useHandCursor: true });
    };

    // roll
    setEnabled(this.ui.diceButton, !!roll);
    setEnabled(this.ui.buyButton, !!buy);
    setEnabled(this.ui.upgradeButton, !!upgrade);
    setEnabled(this.ui.skipButton, !!skip);
    setEnabled(this.ui.collectButton, !!collect);
  }

  _renderFromState() {
    const s = this.state;
    const phaseText = s.gameOver ? "Game Over" : `Phase: ${s.phase}`;
    const currentPlayerName = s.playerById?.[s.currentPlayerId]?.name ?? "—";

    this.ui.statusText.setText(
      `Match ${phaseText} | Current: ${currentPlayerName}`
    );

    const allowed = Array.isArray(s.allowedActions) ? s.allowedActions : [];
    const isCurrent = s.currentPlayerId && this.state.playerById?.[s.currentPlayerId];

    // Enable UI based on allowed actions / server gate.
    this._setButtonsEnabled({
      roll: allowed.includes("roll") && !!s.canCurrentPlayerAct,
      buy: allowed.includes("buy") && !!s.canCurrentPlayerAct,
      upgrade: allowed.includes("upgrade") && !!s.canCurrentPlayerAct,
      skip: allowed.includes("skip") && !!s.canCurrentPlayerAct,
      collect: allowed.includes("collect") && !!s.canCurrentPlayerAct,
    });
  }

  // -----------------------------
  // Actions (client -> server)
  // -----------------------------
  async _onRollClicked() {
    if (!this.state.canCurrentPlayerAct) return;

    // If server exists: call roll endpoint.
    if (this.api && this.gameId) {
      await this.api.post(`/api/games/${this.gameId}/roll`, {});
      return;
    }

    // Local placeholder: resolve immediately.
    const res = rollDice({ diceCount: 2, sides: GameConfig.dice.sides });
    this._applyLocalRoll(res.total);
  }

  async _onBuyClicked() {
    if (this.api && this.gameId) {
      await this._postAction("buy");
      return;
    }
    this._pushToast("Buy (placeholder).");
  }

  async _onUpgradeClicked() {
    if (this.api && this.gameId) {
      await this._postAction("upgrade");
      return;
    }
    this._pushToast("Upgrade (placeholder).");
  }

  async _onSkipClicked() {
    if (this.api && this.gameId) {
      await this._postAction("skip");
      return;
    }
    this._pushToast("Skip (placeholder).");
  }

  async _onCollectClicked() {
    if (this.api && this.gameId) {
      await this._postAction("collect");
      return;
    }
    this._pushToast("Collect (placeholder).");
  }

  async _postAction(actionType, payload = {}) {
    await this.api.post(`/api/games/${this.gameId}/action`, {
      action: { type: actionType, ...payload },
    });
  }

  // -----------------------------
  // Turn resolution rendering
  // -----------------------------
  _renderTurnResolved(normalized) {
    const lines = normalized?.summary ?? this.state.summary ?? [];
    if (Array.isArray(lines) && lines.length) {
      this._pushToast(lines[0]);
    } else if (normalized?.events?.length) {
      const e = this.eventManager.normalizeEventPayload(normalized.events[0]);
      this.eventManager.applyToLocalState(this.state, e, {});
      this._pushToast(e.message);
    }

    // Re-render pawns to reflect updated positions/cash/net worth.
    this._renderPawns();
    this._renderFromState();
  }

  _renderGameOver() {
    const winnerName = this.state.playerById?.[this.state.winnerId]?.name ?? "—";
    this.ui.statusText.setText(`Game Over | Winner: ${winnerName}`);
    this._setButtonsEnabled({ roll: false, buy: false, upgrade: false, skip: false, collect: false });
    this._renderPawns();
  }

  _pushToast(text) {
    if (!this.ui.toastText) return;
    this.ui.toastText.setText(text || "");
    this.tweens.killTweensOf(this.ui.toastText);
    this.ui.toastText.alpha = 1;
    this.tweens.add({
      targets: this.ui.toastText,
      alpha: 0.0,
      duration: 1400,
      delay: 600,
      ease: "Power2",
      onComplete: () => {
        if (this.ui.toastText) this.ui.toastText.setText("");
        if (this.ui.toastText) this.ui.toastText.alpha = 1;
      },
    });
  }

  // -----------------------------
  // Local turn resolution
  // -----------------------------
  _applyLocalRoll(totalSteps) {
    const current = this.state.playerById[this.state.currentPlayerId];
    if (!current) return;

    const { endIndex, path } = moveForwardCircular({
      startIndex: current.positionIndex,
      steps: totalSteps,
      tileCount: this.state.board.tileCount ?? this.state.board.tiles.length,
    });

    current.moveTo(endIndex);
    this._pushToast(`${current.name} rolled ${totalSteps} → moved to tile ${endIndex}.`);

    // Simple placeholder rent/buy loop:
    const tile = this.state.board.tiles[endIndex];
    if (tile && tile.type === "business" && !tile.ownedBy) {
      // Buy it automatically for MVP
      tile.ownedBy = current.id;
      current.applyCashDelta(-50);
      this._pushToast(`${current.name} bought tile ${endIndex}.`);
    } else if (tile && tile.type === "business" && tile.ownedBy && tile.ownedBy !== current.id) {
      const rent = 20;
      const owner = this.state.playerById[tile.ownedBy];
      if (owner) {
        current.applyCashDelta(-rent);
        owner.applyCashDelta(rent);
        this._pushToast(`${current.name} paid ${rent} rent to ${owner.name}.`);
      }
    }

    // Rotate turn
    const idx = this.state.players.findIndex(p => p.id === this.state.currentPlayerId);
    const next = this.state.players[(idx + 1) % this.state.players.length];
    this.state.currentPlayerId = next.id;

    this.state.allowedActions = ["roll"];
    this.state.canCurrentPlayerAct = true;

    this._renderPawns();
    this._renderFromState();
  }
}

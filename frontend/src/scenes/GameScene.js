import Phaser from "phaser";
import GameConfig from "../config/GameConfig.js";
import TurnManager from "../manager/TurnManager";
import EconomyManager from "../manager/EconomyManager";
import EventManager from "../manager/EventManager";
import Player from "../player/player";
import { rollDice } from "../player/dice";
import { moveForwardCircular } from "../player/movement";
import tiles, {
  getTileRect,
  getTileCenter,
  BOARD_ORIGIN,
  CELL_SIZE,
  TILE_DEPTH,
} from "../board/boardData";
import DiceUI from "../ui/diceUI";
import HUD from "../ui/HUD";
import BuyModal from "../ui/buymodal";
import UpgradeModal from "../ui/upgrademodal";
import Notification from "../ui/notification";
import CardModal from "../ui/cardmodal";
import RentModal from "../ui/rentmodal";
import gameService from "../services/gameService";
import { PlayerAction } from "../../../shared/enums/playerActions";
import { drawCard } from "../board/cardData";

const PLAYER_COLORS = [0x5eead4, 0xfbbf24, 0xfb7185, 0x818cf8];
const PLAYER_INITIALS = ['A', 'B', 'C', 'D'];

export default class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
    this.gameId = null;
    this.state = {
      phase: "waiting", game: null, players: [], playerById: {},
      currentPlayerId: null, canCurrentPlayerAct: true,
      allowedActions: [], events: [], summary: [],
      winnerId: null, gameOver: false,
    };
    this.api = null;
    this.pawns = [];
    this.ownerMarkers = [];
    this.tileZones = [];
    this.boardContainer = null;
    this.diceUI = null;
    this.hud = null;
    this.buyModal = null;
    this.upgradeModal = null;
    this.notification = null;
    this.turnManager = null;
    this.economy = null;
    this.eventManager = null;
    this.pendingBuyTile = null;
    this.pendingCard = null;
    this.lastRollWasDoubles = false;
    this.rolling = false;
    this.wsUnsub = null;
  }

  init(data) {
    if (data?.gameId) this.gameId = data.gameId;
    if (data?.token) this.token = data.token;
    this.multiplayer = !!this.gameId;
  }

  create() {
    this.economy = new EconomyManager({ startingCash: 15000 });
    this.eventManager = new EventManager({
      onResolve: (ev) => { if (ev?.message) this.notification.push(ev.message); },
    });
    this.turnManager = new TurnManager({
      onTurnResolved: (n) => this._onTurnResolved(n),
      onGameOver: () => this._onGameOver(),
    });
    this._setupUI();
    this._buildBoard();
    this._createTooltip();
    this._initGame();
  }

  _setupUI() {
    this.cameras.main.setBackgroundColor(0x0b1020);
    this.boardContainer = this.add.container(BOARD_ORIGIN.x, BOARD_ORIGIN.y);
    this.diceUI = new DiceUI(this);
    this.diceUI.create(
      BOARD_ORIGIN.x + (CELL_SIZE * 11) / 2,
      BOARD_ORIGIN.y + (CELL_SIZE * 11) / 2 + 120,
      42
    );
    this.hud = new HUD(this);
    this.hud.create(880);
    this.buyModal = new BuyModal(this);
    this.buyModal.create();
    this.upgradeModal = new UpgradeModal(this);
    this.upgradeModal.create();
    this.cardModal = new CardModal(this);
    this.cardModal.create();
    this.rentModal = new RentModal(this);
    this.rentModal.create();
    this.notification = new Notification(this);
    this.notification.create(
      BOARD_ORIGIN.x + (CELL_SIZE * 11) / 2,
      BOARD_ORIGIN.y + (CELL_SIZE * 11) / 2 - 140
    );
    this._setupButtons();
    this._setupQuitButton();
  }

  _setupButtons() {
    const rightX = 880;
    let btnY = 440;

    const mkBtn = (label, color, callback) => {
      const x = rightX;
      const bg = this.add.graphics();
      bg.fillStyle(color, 0.9);
      bg.fillRoundedRect(x - 90, btnY, 180, 40, 8);
      const txt = this.add.text(x, btnY + 20, label, {
        fontFamily: 'Arial', fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      const hit = this.add.rectangle(x, btnY + 20, 180, 40, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', callback);
      hit.on('pointerover', () => { bg.clear(); bg.fillStyle(color, 1); bg.fillRoundedRect(x - 90, btnY, 180, 40, 8); });
      hit.on('pointerout', () => { bg.clear(); bg.fillStyle(color, 0.9); bg.fillRoundedRect(x - 90, btnY, 180, 40, 8); });
      const result = { bg, txt, hit, setEnabled: (en) => {
        hit.setInteractive(en ? { useHandCursor: true } : false);
        bg.alpha = en ? 1 : 0.3;
        txt.alpha = en ? 1 : 0.3;
      }};
      btnY += 50;
      return result;
    };

    this.rollBtn = mkBtn('🎲 Roll Dice', 0x1a5a5a, () => this._onRoll());
    this.buyBtn = mkBtn('💰 Buy', 0x1a4a2a, () => this._onBuy());
    this.upgradeBtn = mkBtn('⬆ Upgrade', 0x4a4a1a, () => this._onUpgrade());
    this.skipBtn = mkBtn('⏭ End Turn', 0x4a1a1a, () => this._onSkip());

    [this.rollBtn, this.buyBtn, this.upgradeBtn, this.skipBtn].forEach(b => b.setEnabled(false));
  }

  _setupQuitButton() {
    const quitBtn = this.add.text(1280, 10, '✕ Quit', {
      fontFamily: 'Arial', fontSize: '13px', color: '#fb7185',
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(300);

    quitBtn.on('pointerup', () => {
      this.scene.start('MenuScene');
    });
    quitBtn.on('pointerover', () => quitBtn.setColor('#ff0000'));
    quitBtn.on('pointerout', () => quitBtn.setColor('#fb7185'));
  }

  _buildBoard() {
    const total = CELL_SIZE * 11;
    const gap = 2;

    const boardBg = this.add.graphics();
    boardBg.fillStyle(0x080c18, 1);
    boardBg.fillRoundedRect(-4, -4, total + 8, total + 8, 10);
    this.boardContainer.add(boardBg);

    const titleText = this.add.text(total / 2, total / 2, 'WEKONOMY', {
      fontFamily: 'Arial', fontSize: '16px', color: '#0d1a2e', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.boardContainer.add(titleText);

    for (const tile of tiles) {
      const r = getTileRect(tile.pos);
      const isCorner = tile.pos % 10 === 0;
      const isProp = tile.type === 'property';
      const isH = isProp && (tile.pos >= 1 && tile.pos <= 9 || tile.pos >= 21 && tile.pos <= 29);
      const onLeft = !isCorner && tile.pos >= 11 && tile.pos <= 19;
      const onRight = !isCorner && tile.pos >= 31 && tile.pos <= 39;

      const g = this.add.graphics();

      g.fillStyle(0x1a2a4a, 1);
      if (isCorner) g.fillRoundedRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 5);
      else g.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

      let borderAlpha = 0.8;
      let borderColor = 0x3a5a7a;
      if (tile.type === 'go') { borderColor = 0x0a3a2a; borderAlpha = 0.6; }
      else if (tile.type === 'jail') { borderColor = 0x3a1a1a; borderAlpha = 0.6; }
      else if (tile.type === 'free_parking') { borderColor = 0x0a3a2a; borderAlpha = 0.6; }
      else if (tile.type === 'go_to_jail') { borderColor = 0x3a1a1a; borderAlpha = 0.6; }

      g.lineStyle(gap, borderColor, borderAlpha);
      g.strokeRect(r.x, r.y, r.w, r.h);

      if (isProp) {
        const bandGap = 1;
        const bandDepth = Math.floor(TILE_DEPTH * 0.45);
        const band = this.add.graphics();
        band.fillStyle(tile.color, 0.95);
        if (isH) band.fillRect(r.x + bandGap, r.y + bandGap, r.w - bandGap * 2, bandDepth);
        else band.fillRect(r.x + r.w - bandDepth - bandGap, r.y + bandGap, bandDepth, r.h - bandGap * 2);

        const bandBorder = this.add.graphics();
        bandBorder.lineStyle(1, tile.color, 0.3);
        if (isH) bandBorder.strokeRect(r.x + bandGap, r.y + bandGap, r.w - bandGap * 2, bandDepth);
        else bandBorder.strokeRect(r.x + r.w - bandDepth - bandGap, r.y + bandGap, bandDepth, r.h - bandGap * 2);

        this.boardContainer.add(band);
        this.boardContainer.add(bandBorder);
      }

      this.boardContainer.add(g);
    }

    for (const tile of tiles) {
      const r = getTileRect(tile.pos);
      const isCorner = tile.pos % 10 === 0;
      const isProp = tile.type === 'property';
      const isH = isProp && (tile.pos >= 1 && tile.pos <= 9 || tile.pos >= 21 && tile.pos <= 29);
      const onLeft = !isCorner && tile.pos >= 11 && tile.pos <= 19;
      const onRight = !isCorner && tile.pos >= 31 && tile.pos <= 39;

      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const lbl = tile.label || '';
      let textColor = '#b0b8d0';
      let angle = 0;

      if (!isCorner) {
        if (onLeft) angle = 90;
        if (onRight) angle = -90;
      }

      if (tile.type === 'chance') textColor = '#fbbf24';
      else if (tile.type === 'community') textColor = '#4ade80';
      else if (tile.type === 'tax') textColor = '#fb7185';
      else if (tile.type === 'transport' || tile.type === 'utility') textColor = '#a78bfa';
      else if (tile.type === 'go' || tile.type === 'jail') textColor = '#5eead4';
      else if (tile.type === 'free_parking') textColor = '#4ade80';
      else if (tile.type === 'go_to_jail') textColor = '#fb7185';

      if (isProp) {
        const txt = this.add.text(cx, isH ? cy : cy, lbl, {
          fontFamily: 'Arial', fontSize: isH ? '13px' : '12px', color: '#f0f4ff', fontStyle: 'bold',
          stroke: '#000', strokeThickness: 1.5,
        }).setOrigin(0.5, 0.5);
        if (!isH) txt.setAngle(angle);
        this.boardContainer.add(txt);
      } else {
        const txt = this.add.text(cx, cy, lbl, {
          fontFamily: 'Arial', fontSize: isCorner ? '18px' : '14px',
          color: textColor, fontStyle: 'bold',
          stroke: '#000', strokeThickness: isCorner ? 1 : 1.5,
        }).setOrigin(0.5, 0.5);
        if (angle) txt.setAngle(angle);
        this.boardContainer.add(txt);
      }
    }
    this._renderInfoBoxes();
  }

  _renderInfoBoxes() {
    const S = CELL_SIZE;
    const total = 11 * S;
    const hMargin = S + 64;
    const vMargin = S + 24;
    const bh = 54;

    const SIDE_COLORS = { bottom: 0x5eead4, left: 0xfb7185, top: 0xfbbf24, right: 0x818cf8 };

    const sideTiles = {
      bottom: { props: tiles.filter(t => t.rent && t.pos >= 1 && t.pos <= 9), color: SIDE_COLORS.bottom },
      left: { props: tiles.filter(t => t.rent && t.pos >= 11 && t.pos <= 19), color: SIDE_COLORS.left },
      top: { props: tiles.filter(t => t.rent && t.pos >= 21 && t.pos <= 29), color: SIDE_COLORS.top },
      right: { props: tiles.filter(t => t.rent && t.pos >= 31 && t.pos <= 39), color: SIDE_COLORS.right },
    };

    const gap = 6;
    const xMin = hMargin;
    const xMax = total - hMargin;
    const yMin = vMargin;
    const yMax = total - vMargin;
    const xRange = xMax - xMin;
    const yRange = yMax - yMin;

    const placeV = (props, x, sideColor, staggerAway) => {
      const count = props.length;
      const totalH = count * bh + (count - 1) * gap;
      const finalBh = totalH > yRange ? yRange / count - gap : bh;
      const adjustedH = Math.min(bh, finalBh);
      const finalTotalH = count * adjustedH + (count - 1) * gap;
      let startY = yMin + (yRange - finalTotalH) / 2;
      props.forEach((tile) => {
        const offset = Math.floor(adjustedH * 0.25);
        const bx = staggerAway ? x + offset : x - offset;
        const by = startY + adjustedH / 2;
        const r = getTileRect(tile.pos);
        this._drawInfoBox(tile, bx, by, 90, adjustedH, r, sideColor);
        startY += adjustedH + gap;
      });
    };

    const placeH = (props, y, sideColor, staggerAway) => {
      const count = props.length;
      const maxBw = Math.floor((xRange - (count - 1) * gap) / count);
      const bw2 = Math.min(90, maxBw);
      const totalW = count * bw2 + (count - 1) * gap;
      let startX = xMin + (xRange - totalW) / 2;
      props.forEach((tile) => {
        const offset = Math.floor(bw2 * 0.25);
        const bx = startX + bw2 / 2;
        const by = staggerAway ? y - offset : y + offset;
        const r = getTileRect(tile.pos);
        this._drawInfoBox(tile, bx, by, bw2, bh, r, sideColor);
        startX += bw2 + gap;
      });
    };

    placeH(sideTiles.bottom.props, yMax, sideTiles.bottom.color, true);
    placeV(sideTiles.left.props, xMin, sideTiles.left.color, true);
    placeH(sideTiles.top.props, yMin, sideTiles.top.color, false);
    placeV(sideTiles.right.props, xMax, sideTiles.right.color, false);
  }

  _drawInfoBox(tile, bx, by, bw, bh, tileRect, sideColor) {
    const h1 = tile.rent[1];
    const hotel = tile.rent[4];
    const hx = bx - bw / 2;
    const hy = by - bh / 2;
    const tx = tileRect.x + tileRect.w / 2;
    const ty = tileRect.y + tileRect.h / 2;

    const dx = tx - bx;
    const dy = ty - by;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      const g = this.add.graphics();
      g.lineStyle(1, sideColor, 0.35);
      g.lineBetween(bx, by, tx, ty);
      const angle = Math.atan2(dy, dx);
      const aSize = 6;
      g.fillStyle(sideColor, 0.6);
      g.beginPath();
      g.moveTo(tx, ty);
      g.lineTo(tx - aSize * Math.cos(angle - 0.4), ty - aSize * Math.sin(angle - 0.4));
      g.lineTo(tx - aSize * Math.cos(angle + 0.4), ty - aSize * Math.sin(angle + 0.4));
      g.closePath();
      g.fillPath();
      this.boardContainer.add(g);
    }

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1424, 0.93);
    bg.fillRoundedRect(hx, hy, bw, bh, 5);
    bg.lineStyle(1, sideColor, 0.6);
    bg.strokeRoundedRect(hx, hy, bw, bh, 5);
    this.boardContainer.add(bg);

    const nameTxt = this.add.text(bx, hy + 10, tile.label, {
      fontFamily: 'Arial', fontSize: '11px', color: '#e0e8f0', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.boardContainer.add(nameTxt);

    const rentTxt = this.add.text(bx, hy + 27, `1H:${h1}`, {
      fontFamily: 'Arial', fontSize: '10px', color: '#8a9ab0',
    }).setOrigin(0.5, 0.5);
    this.boardContainer.add(rentTxt);

    const hotelTxt = this.add.text(bx, hy + 42, `Ht:${hotel}`, {
      fontFamily: 'Arial', fontSize: '10px', color: '#fbbf24',
    }).setOrigin(0.5, 0.5);
    this.boardContainer.add(hotelTxt);
  }

  _renderPawns() {
    if (!this.boardContainer) return;
    for (const p of this.pawns) { if (p && p.destroy) p.destroy(); }
    this.pawns = [];
    for (const m of this.ownerMarkers) { if (m && m.destroy) m.destroy(); }
    this.ownerMarkers = [];

    const players = this.state.players || [];
    if (!players.length) return;
    const colors = PLAYER_COLORS;

    players.forEach((p, idx) => {
      const center = getTileCenter(p.positionIndex);
      const count = players.length;
      const offsetX = (idx - (count - 1) / 2) * 18;
      const offsetY = -10;

      const px = center.x + offsetX;
      const py = center.y + offsetY;

      const glow = this.add.graphics();
      glow.fillStyle(colors[idx % colors.length], 0.2);
      glow.fillCircle(px, py, 28);

      const circle = this.add.graphics();
      circle.fillStyle(colors[idx % colors.length], 1);
      circle.fillCircle(px, py, 16);
      circle.lineStyle(3, 0xffffff, 1);
      circle.strokeCircle(px, py, 16);

      const label = this.add.text(px, py, PLAYER_INITIALS[idx] || '?', {
        fontFamily: 'Arial', fontSize: '16px', color: '#ffffff', fontStyle: 'bold',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5);

      this.pawns.push(glow, circle, label);
      this.boardContainer.add(glow);
      this.boardContainer.add(circle);
      this.boardContainer.add(label);
    });

    const owned = new Map();
    for (const p of players) {
      for (const propId of (p.ownedProperties || [])) {
        if (!owned.has(propId)) owned.set(propId, p);
      }
    }

    for (const [pos, owner] of owned) {
      const tile = tiles.find(t => t.pos === pos);
      if (!tile) continue;
      const rect = getTileRect(tile.pos);
      const ownerIdx = players.indexOf(owner);
      const dotColor = colors[ownerIdx % colors.length];
      const isH = tile.pos >= 1 && tile.pos <= 9 || tile.pos >= 21 && tile.pos <= 29;
      const dx = isH ? rect.x + rect.w - 8 : rect.x + 6;
      const dy = isH ? rect.y + 6 : rect.y + rect.h - 6;
      const dot = this.add.graphics();
      dot.fillStyle(dotColor, 1);
      dot.fillCircle(dx, dy, 4);
      const ring = this.add.graphics();
      ring.fillStyle(0xffffff, 0.3);
      ring.fillCircle(dx, dy, 5);
      this.ownerMarkers.push(dot, ring);
      this.boardContainer.add(ring);
      this.boardContainer.add(dot);
    }
  }

  _createTooltip() {
    this.tooltipContainer = this.add.container(0, 0).setDepth(300).setVisible(false);

    for (const tile of tiles) {
      const rect = getTileRect(tile.pos);
      const zone = this.add.rectangle(
        BOARD_ORIGIN.x + rect.x + rect.w / 2,
        BOARD_ORIGIN.y + rect.y + rect.h / 2,
        rect.w, rect.h, 0xffffff, 0
      ).setInteractive({ useHandCursor: false });

      zone.on('pointerover', () => this._showTileInfo(tile));
      zone.on('pointerout', () => this.tooltipContainer.setVisible(false));
      zone.on('pointermove', (p) => {
        this.tooltipContainer.setPosition(p.x + 15, p.y + 15);
      });
      this.tileZones.push(zone);
    }
  }

  _showTileInfo(tile) {
    this.tooltipContainer.removeAll(true);
    const owner = this.state.players.find(p => p.ownsProperty(tile.pos));
    const panelW = 200;
    const lines = [tile.name];
    lines.push(tile.type === 'property' ? `Group: ${tile.group}` : `Type: ${tile.type}`);
    if (tile.price) lines.push(`Price: KES ${tile.price.toLocaleString()}`);
    if (owner) lines.push(`Owner: ${owner.name}`);
    if (tile.type === 'property' && owner) {
      const lvl = owner.getUpgradeLevel(tile.pos);
      if (lvl) lines.push(`Level: ${lvl}/4`);
    }

    const panelH = 20 + lines.length * 22 + 10;

    const bg = this.add.graphics();
    bg.fillStyle(0x0d1b2a, 0.95);
    bg.fillRoundedRect(0, 0, panelW, panelH, 8);
    bg.lineStyle(1, 0x5eead4, 0.5);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8);

    this.tooltipContainer.add(bg);

    lines.forEach((line, i) => {
      const isTitle = i === 0;
      const txt = this.add.text(12, 12 + i * 22, line, {
        fontFamily: 'Arial', fontSize: isTitle ? '14px' : '12px',
        color: isTitle ? '#5eead4' : '#c0c8e0',
        fontStyle: isTitle ? 'bold' : 'normal',
      });
      this.tooltipContainer.add(txt);
    });

    this.tooltipContainer.setVisible(true);
  }

  _initGame() {
    if (this.multiplayer) {
      this.notification.push("Connecting to game...");
      this._connectMultiplayer();
    } else {
      this.notification.push("Starting local demo...");
      this._runLocalPlaceholder();
    }
  }

  _connectMultiplayer() {
    const token = this.token || sessionStorage.getItem("token") || "guest";
    if (!gameService.socket) {
      gameService.connect(this.gameId, token);
    }

    this.wsUnsub = gameService.subscribe((event) => {
      if (event.type === "state_sync") {
        const state = event.payload || event;
        this._applyServerState(state);
        this._renderFromState();
      } else if (event.type === "turn_started") {
        this.state.currentPlayerId = event.payload?.playerId || event.playerId;
        this._renderFromState();
      } else if (event.type === "game_ended") {
        this.state.gameOver = true;
        this._renderFromState();
      }
    });

    gameService.sendAction(PlayerAction.GET_STATE, {}).catch(() => {});
  }

  _onRemoteDiceRoll(event) {}
  _onRemotePlayerMoved(event) {
    const pid = event.payload?.playerId || event.playerId;
    const pos = event.payload?.position ?? event.payload?.to ?? 0;
    const player = this.state.playerById[pid];
    if (player) {
      player.positionIndex = pos;
      this._renderPawns();
    }
  }

  async _bootstrapFromServer() {
    const baseUrl = GameConfig.apiBaseUrl;
    this.api = {
      async post(path, body) {
        const res = await fetch(`${baseUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
      async get(path) {
        const res = await fetch(`${baseUrl}${path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      },
    };

    const created = await this.api.post("/api/games", {
      match: { durationMs: GameConfig.match.durationMs, board: { tileCount: GameConfig.board.tileCount } },
    });

    this.gameId = created?.gameId ?? created?.id ?? created?.game?.id ?? null;
    if (!this.gameId) throw new Error("No gameId in response");

    await this.api.post(`/api/games/${this.gameId}/join`, { name: `Player ${Math.floor(Math.random() * 999)}` });

    await this._syncState();
    this.time.addEvent({
      delay: GameConfig.client.stateRefreshMs, loop: true,
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
    this.state.phase = phase;
    this.state.game = serverState;
    const playersRaw = serverState.players ?? serverState?.match?.players ?? [];
    const players = Array.isArray(playersRaw) ? playersRaw.map(p => Player.fromServer(p)) : [];
    const playerById = {};
    for (const p of players) playerById[p.id] = p;
    this.state.players = players;
    this.state.playerById = playerById;
    this.state.board = serverState.board ?? null;
    this.state.currentPlayerId = serverState.currentPlayerId ?? serverState.current_player_id ?? null;
    this.state.canCurrentPlayerAct = serverState.canCurrentPlayerAct ?? serverState.can_act ?? true;
    this.state.allowedActions = serverState.allowedActions ?? serverState.allowed_actions ?? [];
    this.state.events = serverState.events ?? [];
    this.state.summary = serverState.summary ?? [];
    this.state.winnerId = serverState.winnerId ?? serverState.winner_player_id ?? null;
    this.state.gameOver = !!(serverState.gameOver ?? serverState.game_over ?? false);
  }

  _runLocalPlaceholder() {
    this.state.board = { tiles, tileCount: 40 };
    const players = [
      new Player({ id: 1, name: "Alice", cash: 15000, positionIndex: 0 }),
      new Player({ id: 2, name: "Bob", cash: 15000, positionIndex: 0 }),
      new Player({ id: 3, name: "Cara", cash: 15000, positionIndex: 0 }),
    ];
    this.state.players = players;
    this.state.playerById = players.reduce((acc, p) => ((acc[p.id] = p), acc), {});
    this.state.currentPlayerId = 1;
    this.state.canCurrentPlayerAct = true;
    this.state.allowedActions = ["roll"];
    this.state.gameOver = false;
    this.turnManager.startTurn({ currentPlayerId: 1 });
    this._renderFromState();
  }

  _renderFromState() {
    this._renderPawns();
    this.hud.update(this.state.players, this.state.currentPlayerId, this.state.phase);
    const allowed = Array.isArray(this.state.allowedActions) ? this.state.allowedActions : [];
    this.rollBtn.setEnabled(allowed.includes("roll") && !this.state.gameOver);
    this.buyBtn.setEnabled(allowed.includes("buy") && !this.state.gameOver);
    this.upgradeBtn.setEnabled(allowed.includes("upgrade") && !this.state.gameOver);
    this.skipBtn.setEnabled(allowed.includes("skip") && !this.state.gameOver);
    if (this.state.gameOver) {
      this.time.delayedCall(1500, () => this._goToResults());
    }
  }

  async _onRoll() {
    if (this.rolling) return;
    this.rolling = true;
    this.rollBtn.setEnabled(false);

    const res = rollDice({ diceCount: 2, sides: GameConfig.dice.sides });
    this.lastRollWasDoubles = res.results[0] === res.results[1];
    this.diceUI.show();
    await this.diceUI.animateRoll(res);

    const current = this.state.playerById[this.state.currentPlayerId];
    if (!current) { this.rolling = false; return; }

    const { endIndex, path } = moveForwardCircular({
      startIndex: current.positionIndex, steps: res.total, tileCount: 40,
    });

    for (let i = 0; i < path.length; i++) {
      current.positionIndex = path[i];
      this._renderPawns();
      await this._delay(200);
    }

    current.positionIndex = endIndex;
    this._renderPawns();
    this.diceUI.hide();

    const landedTile = tiles.find(t => t.pos === endIndex);
    const selfOwned = current.ownsProperty(endIndex);
    const otherOwner = selfOwned ? null : this.state.players.find(p =>
      p.id !== current.id && p.ownsProperty(endIndex)
    );

    if (landedTile.type === 'go') {
      current.applyCashDelta(2000);
      this.notification.push(`${current.name} passed GO! +KES 2,000`);
      this._endTurn();
    } else if (selfOwned) {
      this.notification.push(`${current.name} landed on their own ${landedTile.name}`);
      this._endTurn();
    } else if (otherOwner && (landedTile.type === 'property' || landedTile.type === 'transport' || landedTile.type === 'utility')) {
      const rent = Math.floor(landedTile.price * 0.1);
      this.rentModal.show(current.name, otherOwner.name, rent, current.cash, () => {
        current.applyCashDelta(-rent);
        otherOwner.applyCashDelta(rent);
        this._renderFromState();
        this._endTurn();
      });
      this.state.allowedActions = [];
      this._renderFromState();
      this.rolling = false;
      return;
    } else if (!otherOwner && (landedTile.type === 'property' || landedTile.type === 'transport' || landedTile.type === 'utility')) {
      this.pendingBuyTile = landedTile;
      this.notification.push(`${current.name} landed on ${landedTile.name} (KES ${landedTile.price})`);
      this.state.allowedActions = ["buy", "skip"];
      this._renderFromState();
    } else if (landedTile.type === 'chance' || landedTile.type === 'community') {
      this.pendingCard = { player: current, tile: landedTile, deck: landedTile.type === 'chance' ? 'chance' : 'community' };
      this.cardModal.show(this.pendingCard.deck, null, () => this._drawCard());
      this.state.allowedActions = [];
      this._renderFromState();
      this.rolling = false;
      return;
    } else if (landedTile.type === 'tax') {
      current.applyCashDelta(-landedTile.price);
      this.notification.push(`${current.name} paid KES ${landedTile.price} tax`);
      this._endTurn();
    } else if (landedTile.type === 'go_to_jail') {
      current.positionIndex = 10;
      this.notification.push(`${current.name} is going to jail!`);
      this._endTurn();
    } else {
      this.notification.push(`${current.name} landed on ${landedTile.name}`);
      this._endTurn();
    }

    this.rolling = false;
  }

  _drawCard() {
    if (!this.pendingCard) return;
    const { player, deck } = this.pendingCard;
    const card = drawCard(deck);

    if (card.effect === 'cash' && card.amount) {
      player.applyCashDelta(card.amount);
    } else if (card.effect === 'go_to_jail') {
      player.positionIndex = 10;
    } else if (card.effect === 'move' && card.target !== undefined) {
      player.positionIndex = card.target;
    } else if (card.effect === 'advance' && card.target) {
      const newPos = (player.positionIndex + card.target + 40) % 40;
      if ((card.target > 0 && player.positionIndex + card.target >= 40) ||
          (card.target < 0 && player.positionIndex + card.target < 0)) {
        player.applyCashDelta(2000);
      }
      player.positionIndex = newPos;
    } else if (card.effect === 'jail_free') {
      player.hasJailFreeCard = true;
    }

    this._renderPawns();
    this.cardModal.show(deck, card, () => {
      this.pendingCard = null;
      this.cardModal.hide();
      this._endTurn();
    });
  }

  _onBuy() {
    const tile = this.pendingBuyTile;
    const current = this.state.playerById[this.state.currentPlayerId];
    if (!tile || !current) return;
    if (current.cash >= tile.price) {
      current.applyCashDelta(-tile.price);
      current.addProperty(tile.pos);
      this.notification.push(`${current.name} bought ${tile.name} for KES ${tile.price}`);
      this.pendingBuyTile = null;
      this._endTurn();
    } else {
      this.notification.push(`Not enough cash to buy ${tile.name}`);
      this._endTurn();
    }
  }

  _onUpgrade() {
    const current = this.state.playerById[this.state.currentPlayerId];
    if (!current) return;
    const upgradable = (current.ownedProperties || []).map(pos => {
      const tile = tiles.find(t => t.pos === pos);
      if (!tile || tile.type !== 'property') return null;
      const level = current.getUpgradeLevel(pos);
      if (level >= 4) return null;
      const cost = tile.price * 0.5;
      return { pos, name: tile.name, level, cost: Math.floor(cost) };
    }).filter(Boolean);
    if (upgradable.length === 0) {
      this.notification.push('No upgradable properties');
      return;
    }
    this.upgradeModal.show(upgradable, (item) => {
      const current = this.state.playerById[this.state.currentPlayerId];
      if (current && current.cash >= item.cost) {
        current.applyCashDelta(-item.cost);
        current.setUpgradeLevel(item.pos, item.level + 1);
        this.notification.push(`${current.name} upgraded ${item.name} to level ${item.level + 1}`);
        this._renderPawns();
      } else {
        this.notification.push('Not enough cash');
      }
    });
  }

  _onSkip() {
    if (this.pendingBuyTile) this.pendingBuyTile = null;
    this._endTurn();
  }

  _endTurn() {
    if (this.lastRollWasDoubles) {
      this.lastRollWasDoubles = false;
      this.state.allowedActions = ["roll"];
      this.state.canCurrentPlayerAct = true;
      this.pendingBuyTile = null;
      this.notification.push('Doubles! Roll again.');
      this._renderFromState();
      return;
    }
    const idx = this.state.players.findIndex(p => p.id === this.state.currentPlayerId);
    const next = this.state.players[(idx + 1) % this.state.players.length];
    this.state.currentPlayerId = next.id;
    this.state.allowedActions = ["roll"];
    this.state.canCurrentPlayerAct = true;
    this.pendingBuyTile = null;
    this.turnManager.startTurn({ currentPlayerId: next.id });
    this._renderFromState();
  }

  _onTurnResolved(normalized) {
    if (normalized?.summary?.length) this.notification.push(normalized.summary[0]);
    this._renderFromState();
  }

  _onGameOver() {
    this.state.gameOver = true;
    this._renderFromState();
  }

  shutdown() {
    if (this.wsUnsub) this.wsUnsub();
  }

  _goToResults() {
    const sorted = [...this.state.players].sort((a, b) => {
      const av = a.getNetWorth ? a.getNetWorth() : a.cash;
      const bv = b.getNetWorth ? b.getNetWorth() : b.cash;
      return bv - av;
    });
    this.scene.start("ResultScene", {
      result: {
        winnerId: sorted[0]?.id || null,
        players: sorted.map(p => ({
          id: p.id, name: p.name,
          netWorth: p.getNetWorth ? p.getNetWorth() : p.cash,
          cash: p.cash, properties: p.ownedProperties?.length || 0,
        })),
        winnerName: sorted[0]?.name || '—',
      },
    });
  }

  _delay(ms) {
    return new Promise(resolve => this.time.delayedCall(ms, resolve));
  }
}

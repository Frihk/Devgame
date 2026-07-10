export default class TurnManager {
  constructor({
    onTurnStart,
    onTurnResolved,
    onGameOver,
    onActionValidationError,
  } = {}) {
    this.onTurnStart = onTurnStart;
    this.onTurnResolved = onTurnResolved;
    this.onGameOver = onGameOver;
    this.onActionValidationError = onActionValidationError;

    this._turnState = {
      status: "idle", // idle | waiting_roll | waiting_action | resolving | done | game_over
      currentPlayerId: null,
      lastRoll: null, // { diceTotal, diceDetail: [...] }
      resolution: null, // server payload normalized for UI
    };
  }

  getState() {
    return { ...this._turnState };
  }

  // Call when server indicates a new turn has started
  startTurn({ currentPlayerId, turnNumber, phase } = {}) {
    this._turnState.status = "waiting_roll";
    this._turnState.currentPlayerId = currentPlayerId ?? this._turnState.currentPlayerId;
    this._turnState.lastRoll = null;
    this._turnState.resolution = null;

    if (typeof this.onTurnStart === "function") {
      this.onTurnStart({ currentPlayerId, turnNumber, phase });
    }
  }

  // Call when client rolls (or server returns roll result)
  setRoll({ diceTotal, diceDetail } = {}) {
    this._turnState.lastRoll = {
      diceTotal: Number(diceTotal ?? 0),
      diceDetail: Array.isArray(diceDetail) ? diceDetail : null,
    };
    this._turnState.status = "waiting_action";
  }

  // Call with server turn resolution payload (authoritative)
  resolveTurn(serverResolutionPayload = {}) {
    this._turnState.status = "resolving";
    this._turnState.resolution = serverResolutionPayload;

    const normalized = this._normalizeResolution(serverResolutionPayload);

    this._turnState.status = normalized.gameOver ? "game_over" : "done";

    if (typeof this.onTurnResolved === "function") {
      this.onTurnResolved(normalized);
    }

    if (normalized.gameOver && typeof this.onGameOver === "function") {
      this.onGameOver(normalized);
    }

    return normalized;
  }

  getAvailableActions(gameState = {}) {
    const phase = gameState?.phase ?? this._turnState.resolution?.phase ?? "turn";
    const canAct = !!(gameState?.canCurrentPlayerAct ?? gameState?.canAct ?? true);

    if (!canAct) return [];

    // If backend sends explicit allowedActions, prefer that.
    const allowed = gameState?.allowedActions ?? this._turnState.resolution?.allowedActions;
    if (Array.isArray(allowed)) return allowed;

    // Otherwise fall back to phase heuristics.
    if (phase === "waiting_roll") return ["roll"];
    if (phase === "waiting_action") {
      // common set; UI should still validate via server
      return ["buy", "upgrade", "skip", "collect", "resolveEvent"];
    }
    if (phase === "resolving") return [];
    if (phase === "game_over") return [];
    return ["roll"];
  }

  validateActionForUI(actionType, gameState = {}) {
    const allowed = this.getAvailableActions(gameState);
    if (!allowed.includes(actionType)) {
      if (typeof this.onActionValidationError === "function") {
        this.onActionValidationError({ actionType, allowed });
      }
      return false;
    }
    return true;
  }

  _normalizeResolution(payload) {
    const p = payload ?? {};

    const gameOver = !!p.gameOver;
    const winnerId = p.winnerId ?? p.winner_player_id ?? null;

    const events = Array.isArray(p.events) ? p.events : [];
    const summary = Array.isArray(p.summary) ? p.summary : (Array.isArray(p.messages) ? p.messages : []);

    return {
      gameOver,
      winnerId,
      currentPlayerId: p.currentPlayerId ?? p.playerId ?? p.actingPlayerId ?? null,
      board: p.board ?? p.state?.board ?? null,
      position: p.position ?? p.toPosition ?? null,
      events,
      summary,
      state: p.state ?? null,
      raw: p,
      // Optional: the backend can tell you what step to show in UI
      phase: p.phase ?? null,
      turnNumber: p.turnNumber ?? null,
    };
  }
}

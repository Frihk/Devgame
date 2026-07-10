export default class EventManager {
  constructor({ onResolve } = {}) {
    this.onResolve = onResolve; // optional callback: (resolvedEvent, context) => void
  }

  normalizeEventPayload(eventPayload) {
    const ep = eventPayload ?? {};
    const type = ep.type ?? "unknown";

    const message = ep.message || this._defaultMessage(type, ep);

    const effects = Array.isArray(ep.effects) ? ep.effects : [];
    const cashDelta = Number(ep.cashDelta ?? ep.amount ?? 0);

    return {
      id: ep.id,
      type,
      message,
      cashDelta: Number.isFinite(cashDelta) ? cashDelta : 0,
      turns: ep.turns ?? null,
      propertyId: ep.propertyId ?? ep.property_id ?? null,
      fromPlayerId: ep.fromPlayerId ?? ep.from_player_id ?? null,
      toPlayerId: ep.toPlayerId ?? ep.to_player_id ?? null,
      effects,
      raw: ep,
    };
  }

  applyToLocalState(state, normalizedEvent, context = {}) {
    if (!state || !normalizedEvent) return state;

    const next = state;

    const playerId = context.playerId ?? normalizedEvent.toPlayerId ?? normalizedEvent.fromPlayerId;
    if (!playerId) return next;

    const player = next.playerById?.[playerId] || next.players?.find(p => p.id === playerId);
    if (!player) return next;

    if (typeof normalizedEvent.cashDelta === "number" && normalizedEvent.cashDelta !== 0) {
      player.cash = Number(player.cash || 0) + normalizedEvent.cashDelta;
    }

    if (normalizedEvent.type === "rent_modifier" && normalizedEvent.propertyId) {
      const props = next.properties || next.boardProperties || [];
      const prop =
        props.find(p => p.id === normalizedEvent.propertyId) ||
        props.find(p => p.propertyId === normalizedEvent.propertyId);

      if (prop) {
        // UI-only hint; backend should compute real rent values.
        prop.uiRentMultiplier = normalizedEvent.raw?.multiplier ?? normalizedEvent.raw?.multiplierFactor ?? 1;
        prop.uiRentModifierTurns = normalizedEvent.turns ?? null;
      }
    }

    if (typeof this.onResolve === "function") {
      this.onResolve(normalizedEvent, context);
    }

    return next;
  }

  _defaultMessage(type, ep) {
    switch (type) {
      case "gain":
        return `You gained $${Number(ep.amount ?? ep.cashDelta ?? 0).toLocaleString()}.`;
      case "pay_rent":
        return `You paid $${Number(ep.amount ?? ep.cashDelta ?? 0).toLocaleString()} in rent.`;
      case "rent_modifier":
        return `Rent was modified${ep.turns ? ` for ${ep.turns} turns` : ""}.`;
      case "custom":
        return ep.description || "Event resolved.";
      default:
        return ep.description || "Event resolved.";
    }
  }
}

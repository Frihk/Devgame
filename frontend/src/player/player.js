export default class Player {
  constructor({
    id,
    name,
    cash = 1500,
    positionIndex = 0,
    upgradeLevels = {}, // propertyId -> upgradeLevel
    ownedProperties = [], // array of propertyIds
    isActive = true,
  } = {}) {
    this.id = id;
    this.name = name || `Player ${id ?? ""}`.trim();
    this.cash = Number(cash);
    this.positionIndex = Number(positionIndex);

    this.upgradeLevels = { ...upgradeLevels };
    this.ownedProperties = Array.isArray(ownedProperties) ? [...ownedProperties] : [];

    this.isActive = !!isActive;

    // Optional UI-only helpers
    this.ui = {
      isTurn: false,
      lastDelta: null,
    };
  }

  setTurn(isTurn) {
    this.ui.isTurn = !!isTurn;
  }

  getNetWorth(properties = []) {
    const owned = Array.isArray(properties) ? properties : [];
    const ownedIds = new Set(this.ownedProperties);

    const ownedValue = owned.reduce((sum, p) => {
      const pid = p?.id ?? p?.propertyId;
      if (!ownedIds.has(pid)) return sum;

      const v =
        p?.currentValue ??
        p?.value ??
        p?.purchasePrice ??
        p?.price ??
        0;

      return sum + Number(v || 0);
    }, 0);

    return Number(this.cash || 0) + ownedValue;
  }

  moveTo(index) {
    this.positionIndex = Number(index);
  }

  applyCashDelta(delta) {
    const d = Number(delta || 0);
    this.cash = Number(this.cash || 0) + d;
    return this.cash;
  }

  canAfford(cost) {
    return Number(this.cash || 0) >= Number(cost || 0);
  }

  ownsProperty(propertyId) {
    return this.ownedProperties.includes(propertyId);
  }

  addProperty(propertyId) {
    const pid = propertyId;
    if (pid === undefined || pid === null) return;

    if (!this.ownsProperty(pid)) this.ownedProperties.push(pid);
    if (this.upgradeLevels[pid] === undefined) this.upgradeLevels[pid] = 0;
  }

  removeProperty(propertyId) {
    const pid = propertyId;
    this.ownedProperties = this.ownedProperties.filter(x => x !== pid);
    delete this.upgradeLevels[pid];
  }

  getUpgradeLevel(propertyId) {
    return Number(this.upgradeLevels[propertyId] ?? 0);
  }

  setUpgradeLevel(propertyId, level) {
    this.upgradeLevels[propertyId] = Number(level ?? 0);
  }

  // Utility to build/update from server state
  static fromServer(playerState = {}) {
    const ownedProperties =
      playerState.ownedProperties ??
      playerState.propertiesOwned ??
      playerState.owned_property_ids ??
      playerState.properties ??
      [];

    // If server returns properties as objects, map to ids.
    const normalizedOwnedIds = Array.isArray(ownedProperties)
      ? ownedProperties.map(p => {
          if (typeof p === "string" || typeof p === "number") return p;
          return p?.id ?? p?.propertyId;
        }).filter(x => x !== undefined && x !== null)
      : [];

    const upgradeLevels = playerState.upgradeLevels ?? playerState.upgrades ?? {};

    // If server returns property objects with upgradeLevel, hydrate upgradeLevels.
    if (Array.isArray(playerState.properties)) {
      for (const prop of playerState.properties) {
        const pid = prop?.id ?? prop?.propertyId;
        if (pid === undefined || pid === null) continue;
        const lvl = prop?.upgradeLevel ?? prop?.upgrade_level ?? 0;
        upgradeLevels[pid] = Number(lvl || 0);
      }
    }

    return new Player({
      id: playerState.id ?? playerState.playerId ?? playerState.player_id,
      name: playerState.name ?? `Player ${playerState.id ?? ""}`.trim(),
      cash: playerState.cash ?? playerState.money ?? playerState.balance ?? 0,
      positionIndex: playerState.positionIndex ?? playerState.position_index ?? playerState.position ?? 0,
      upgradeLevels,
      ownedProperties: normalizedOwnedIds,
      isActive: playerState.isActive ?? playerState.active ?? true,
    });
  }
}

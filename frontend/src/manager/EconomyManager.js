export default class EconomyManager {
  constructor({ startingCash = 1500 } = {}) {
    this.startingCash = startingCash;
  }

  // --- Currency helpers ---
  formatMoney(amount) {
    const n = Number(amount) || 0;
    return `$${n.toLocaleString()}`;
  }

  // --- Net worth ---
  computeNetWorth(player, properties = []) {
    const cash = Number(player?.cash ?? 0);

    const owned = properties.length ? properties : (player?.properties ?? []);
    const totalPropertyValue = owned.reduce((sum, p) => {
      const v =
        p?.currentValue ??
        p?.value ??
        p?.purchasePrice ??
        p?.price ??
        0;
      return sum + Number(v || 0);
    }, 0);

    return cash + totalPropertyValue;
  }

  // --- Turn resolution helpers (client-side only; server remains source of truth) ---
  applyCashDelta(player, delta) {
    const cashDelta = Number(delta?.cashDelta ?? 0);
    player.cash = Number(player.cash || 0) + cashDelta;
    return player.cash;
  }

  applyUpgradeCost(player, upgrade) {
    const cost = Number(upgrade?.upgradeCost ?? 0);
    player.cash = Number(player.cash || 0) - cost;
    return player.cash;
  }

  // --- Purchase / upgrade validation (optional; UI gating only) ---
  canAfford(player, cost) {
    const cash = Number(player?.cash ?? 0);
    return cash >= Number(cost ?? 0);
  }
}

export function rollDie(sides = 6) {
  const n = Number(sides);
  if (!Number.isFinite(n) || n < 2) throw new Error("sides must be >= 2");
  return Math.floor(Math.random() * n) + 1;
}

export function rollDice({ diceCount = 2, sides = 6 } = {}) {
  const count = Number(diceCount);
  const n = Number(sides);

  if (!Number.isFinite(count) || count < 1) throw new Error("diceCount must be >= 1");
  if (!Number.isFinite(n) || n < 2) throw new Error("sides must be >= 2");

  const results = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const r = rollDie(n);
    results.push(r);
    total += r;
  }

  return { diceCount: count, diceSides: n, results, total };
}

export function rollDiceWithRng({ diceCount = 2, sides = 6, rng } = {}) {
  const count = Number(diceCount);
  const n = Number(sides);

  if (!rng || typeof rng !== "function") throw new Error("rng must be a function returning [0,1) values");
  if (!Number.isFinite(count) || count < 1) throw new Error("diceCount must be >= 1");
  if (!Number.isFinite(n) || n < 2) throw new Error("sides must be >= 2");

  const results = [];
  let total = 0;

  for (let i = 0; i < count; i++) {
    const x = rng(); // [0,1)
    const r = Math.floor(x * n) + 1;
    results.push(r);
    total += r;
  }

  return { diceCount: count, diceSides: n, results, total };
}

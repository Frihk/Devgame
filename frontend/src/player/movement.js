/**
 * Moves a token around a circular board.
 * @param {number} startIndex - current tile index (0..tileCount-1)
 * @param {number} steps - how many tiles to move forward
 * @param {number} tileCount - total tiles on board
 * @returns {{ endIndex: number, path: number[] }}
 */
export function moveForwardCircular({ startIndex, steps, tileCount } = {}) {
  const start = Number(startIndex);
  const s = Number(steps);
  const n = Number(tileCount);

  if (!Number.isFinite(start) || start < 0) throw new Error("startIndex must be a non-negative number");
  if (!Number.isFinite(s) || s < 0) throw new Error("steps must be a non-negative number");
  if (!Number.isFinite(n) || n < 1) throw new Error("tileCount must be >= 1");

  const endIndex = (start + s) % n;

  const path = [];
  for (let i = 1; i <= s; i++) {
    path.push((start + i) % n);
  }

  return { endIndex, path };
}

/**
 * Given a board tile index, compute pixel position using a tile map.
 * @param {{x:number,y:number}} startPos - starting token position (unused by default)
 * @param {number} index - tile index
 * @param {Array<{x:number,y:number}>|Object<string,{x:number,y:number}>} tilePositions
 * @returns {{x:number,y:number}}
 */
export function getTilePosition(index, tilePositions) {
  if (!tilePositions) throw new Error("tilePositions is required");

  if (Array.isArray(tilePositions)) {
    const p = tilePositions[index];
    if (!p) throw new Error(`Missing tile position for index ${index}`);
    return { x: p.x, y: p.y };
  }

  const p = tilePositions[String(index)];
  if (!p) throw new Error(`Missing tile position for index ${index}`);
  return { x: p.x, y: p.y };
}

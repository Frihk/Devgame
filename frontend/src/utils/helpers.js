/**
 * Maps a classic 40-tile Monopoly index (0-39) to its correct 11x11 CSS Grid area and side alignment.
 * @param {number} index - Tile index from 0 to 39
 * @returns {object} { gridArea: string, side: string }
 */
export function getGridConfiguration(index) {
  let row, col, side;

  if (index >= 0 && index <= 10) {
    row = 11;
    col = 11 - index;
    side = 'bottom';
  } else if (index > 10 && index <= 20) {
    row = 11 - (index - 10);
    col = 1;
    side = 'left';
  } else if (index > 20 && index <= 30) {
    row = 1;
    col = index - 19;
    side = 'top';
  } else if (index > 30 && index < 40) {
    row = index - 29;
    col = 11;
    side = 'right';
  }

  return {
    gridArea: `${row} / ${col}`,
    side
  };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}
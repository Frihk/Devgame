export const PropertyLevels = Object.freeze({
    UNDEVELOPED: 0,
    ONE_LODGE: 1,
    TWO_LODGES: 2,
    THREE_LODGES: 3,
    FOUR_LODGES: 4,
    LUXURY_RESORT: 5,
});

/**
 * Returns a readable text display title for a property's development tier status.
 * Useful for building out tooltip panels and dashboard cards.
 * @param {number} level - 0 to 5 coordinate integer
 * @returns {string}
 */
export function getLevelLabel(level) {
  switch (level) {
    case PropertyLevels.UNDEVELOPED:   return 'Vacant Plot';
    case PropertyLevels.ONE_LODGE:     return 'Single Lodge';
    case PropertyLevels.TWO_LODGES:    return 'Dual Lodges';
    case PropertyLevels.THREE_LODGES:  return 'Triple Lodges';
    case PropertyLevels.FOUR_LODGES:   return 'Quad Lodges';
    case PropertyLevels.LUXURY_RESORT: return 'Luxury Resort';
    default:                           return 'Unknown Tier';
  }
}
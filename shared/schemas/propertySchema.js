/**
 * @typedef {Object} PropertyState
 * @property {number} propertyId - Primary key equal to its fixed boardPosition (0-39)
 * @property {number} boardPosition - Always equal to propertyId for rendering ease
 * @property {string} squareType - Restricted to 'property' | 'transport_hub' | 'utility'
 * @property {string|null} ownerId - Unique identifier of holding player, or null if unowned
 * @property {boolean} mortgaged - True if the property is currently under mortgage
 * @property {number} lodgeCount - 0-4, where 4 = Luxury Resort tier. Only for 'property' type.
 * @property {string|null} lockedByDealId - Set while attached to a pending trade deal
 */

export const propertySchema = {
  propertyId: "number",
  boardPosition: "number",
  squareType: "string",
  ownerId: "string",
  mortgaged: "boolean",
  lodgeCount: "number",
  lockedByDealId: "string"
};

/**
 * Factory to safely seed an initial default Property State structure.
 * @param {Object} partialData 
 * @returns {PropertyState}
 */
export function createPropertyInstance(partialData = {}) {
  const id = typeof partialData.propertyId === 'number' ? partialData.propertyId : 0;
  return {
    propertyId: id,
    boardPosition: id,
    squareType: partialData.squareType || "property",
    ownerId: partialData.ownerId || null,
    mortgaged: partialData.mortgaged || false,
    lodgeCount: typeof partialData.lodgeCount === 'number' ? partialData.lodgeCount : 0,
    lockedByDealId: partialData.lockedByDealId || null,
    ...partialData
  };
}

/**
 * Validates incoming property payloads from the WebSocket stream.
 * @param {Object} obj 
 * @returns {boolean}
 */
export function validatePropertyStructure(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  const requiredKeys = ['propertyId', 'boardPosition', 'squareType', 'mortgaged'];
  return requiredKeys.every(key => Object.prototype.hasOwnProperty.call(obj, key));
}
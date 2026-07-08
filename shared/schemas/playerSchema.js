/**
 * @typedef {Object} PlayerState
 * @property {string} id - Unique identifier (e.g., UUID or Guest ID string)
 * @property {string} name - Display handle or name
 * @property {number} cash - Current fluid balance in whole Ksh
 * @property {string} status - One of PlayerStatus values ('active' | 'jailed' | 'bankrupt')
 * @property {number} boardPosition - 0-39, current token board coordinate position
 * @property {number} jailTurnsRemaining - Max 3 turns, meaningful only if status is 'jailed'
 * @property {boolean} hasJailFreeCard - True if holding a Get Out of Jail Free card
 */

export const playerSchema = {
  id: "string",
  name: "string",
  cash: "number",
  status: "string",
  boardPosition: "number",
  jailTurnsRemaining: "number",
  hasJailFreeCard: "boolean"
};

/**
 * Creates a default structured Player Instance object for state initialization.
 * @param {Partial<PlayerState>} partialData 
 * @returns {PlayerState}
 */
export function createPlayerInstance(partialData = {}) {
  return {
    id: partialData.id || "",
    name: partialData.name || "Anonymous Player",
    cash: typeof partialData.cash === 'number' ? partialData.cash : 15000, // Starting Ksh 15,000 per rulebook
    status: partialData.status || "active",
    boardPosition: partialData.boardPosition || 0, // Starts at GO
    jailTurnsRemaining: partialData.jailTurnsRemaining || 0,
    hasJailFreeCard: partialData.hasJailFreeCard || false,
    ...partialData
  };
}

/**
 * Runtime validator to safely parse incoming server WebSocket state updates.
 * @param {Object} obj 
 * @returns {boolean}
 */
export function validatePlayerStructure(obj) {
  if (!obj || typeof obj !== 'object') return false;
  
  const requiredKeys = ['id', 'name', 'cash', 'status', 'boardPosition'];
  return requiredKeys.every(key => Object.prototype.hasOwnProperty.call(obj, key));
}

const playerSchemaBundle = {
  schema: playerSchema,
  create: createPlayerInstance,
  validate: validatePlayerStructure
};

export default playerSchemaBundle;
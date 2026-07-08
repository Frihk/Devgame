/**
 * @typedef {Object} LeaderboardRow
 * @property {number} rank - Current positioning on global ladder
 * @property {string} userId - Unique database reference identifier
 * @property {string} username - Display name or Reddit handle
 * @property {number} gamesWon - Total match victories
 * @property {number} totalEarnings - Lifetime accumulated cash in whole Ksh
 * @property {number} peakNetWorth - Highest net worth achieved in a single match (whole Ksh)
 */

export const leaderboardSchema = {
  rank: "number",
  userId: "string",
  username: "string",
  gamesWon: "number",
  totalEarnings: "number",
  peakNetWorth: "number"
};

/**
 * Safely sanitizes incoming database entries for UI table rendering.
 * Provides logical defaults to prevent screen breaks.
 * @param {Object} data 
 * @returns {LeaderboardRow}
 */
export function formatLeaderboardRow(data = {}) {
  return {
    rank: typeof data.rank === 'number' ? data.rank : 999, // Fallback to low rank if unassigned
    userId: data.userId || "",
    username: data.username || "Anonymous Redditor",
    gamesWon: typeof data.gamesWon === 'number' ? data.gamesWon : 0,
    totalEarnings: typeof data.totalEarnings === 'number' ? data.totalEarnings : 0,
    peakNetWorth: typeof data.peakNetWorth === 'number' ? data.peakNetWorth : 0
  };
}
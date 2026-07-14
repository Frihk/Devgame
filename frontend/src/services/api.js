// src/services/api.js
import { formatLeaderboardRow } from '../../shared/schemas/leaderboardSchema.js';

const BASE_URL = 'http://localhost:8080/api';

/**
 * Global HTTP request dispatcher with automatic Authorization injection.
 */
async function request(endpoint, options = {}) {
  const token = sessionStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  
  // Standard handling for 204 No Content responses
  if (response.status === 204) return null;
  
  return response.json();
}

export const apiService = {
  request: (endpoint, options) => request(endpoint, options),

  // Authentication Actions
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),

  // Lobby and Session Matchmaking Management
  getLobbies: () => request('/games'),
  createLobby: (lobbyData) => request('/games', { method: 'POST', body: JSON.stringify(lobbyData) }),
  joinLobby: (gameId) => request(`/games/${gameId}/join`, { method: 'POST' }),

  /**
   * Retrieves and automatically formats global rankings via shared schemas,
   * guaranteeing fallback structures for cash attributes (whole Ksh numbers).
   * @returns {Promise<import('../../shared/schemas/leaderboardSchema.js').LeaderboardRow[]>}
   */
  getLeaderboard: async () => {
    const rawData = await request('/leaderboard');
    if (!Array.isArray(rawData)) return [];
    return rawData.map(row => formatLeaderboardRow(row));
  }
};

export default apiService;
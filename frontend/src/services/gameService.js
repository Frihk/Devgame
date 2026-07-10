import { api } from "./api";

export const gameService = {
  // Games
  listGames: (params) => api.get(`/games${params ? `?${new URLSearchParams(params)}` : ""}`),

  getGame: (gameId) => api.get(`/games/${gameId}`),

  // Sessions / Matchmaking (customize paths as needed)
  createGame: (data) => api.post(`/games`, data),

  joinGame: (gameId, data) => api.post(`/games/${gameId}/join`, data),

  leaveGame: (gameId) => api.post(`/games/${gameId}/leave`),

  // Gameplay (customize paths as needed)
  getGameState: (gameId) => api.get(`/games/${gameId}/state`),

  makeMove: (gameId, move) => api.post(`/games/${gameId}/moves`, move),

  // Common
  getLeaderboard: (params) =>
    api.get(`/leaderboard${params ? `?${new URLSearchParams(params)}` : ""}`),
};

export default gameService;

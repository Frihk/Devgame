const BASE_URL = 'http://localhost:8080/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
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
  
  return response.json();
}

export const apiService = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),

  getLobbies: () => request('/games'),
  createLobby: (lobbyData) => request('/games', { method: 'POST', body: JSON.stringify(lobbyData) }),
  joinLobby: (gameId) => request(`/games/${gameId}/join`, { method: 'POST' }),

  getLeaderboard: () => request('/leaderboard'),
};

export default apiService;

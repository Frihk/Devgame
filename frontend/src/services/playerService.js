import apiService from './api';

export const playerService = {

  getCurrentPlayerProfile: async () => {
    try {
      return await apiService.request('/players/me');
    } catch (error) {
      console.error("Failed to fetch player profile:", error);
      return null;
    }
  },

  
  getLocalPreferences: () => {
    const prefs = localStorage.getItem('monopoly_prefs');
    return prefs ? JSON.parse(prefs) : { preferredColor: '#ff4500', preferredPiece: 'alien' };
  },

  saveLocalPreferences: (prefs) => {
    localStorage.setItem('monopoly_prefs', JSON.stringify(prefs));
  }
};

export default playerService;
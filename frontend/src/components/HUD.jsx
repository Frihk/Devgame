import React, { useEffect, useState } from 'react';
import { EventBridge } from '../utils/EventBridge';
import '../ui/styles.css';

export function HUD() {
  const [playerInfo, setPlayerInfo] = useState({
    name: 'Player 1',
    cash: 1500,
    position: 0,
    isMyTurn: true
  });

  useEffect(() => {
    // Listen for updates from game state
    const unsub = EventBridge.on('GAME_STATE_UPDATE', (state) => {
      if (state.myPlayer) {
        setPlayerInfo(state.myPlayer);
      }
    });
    return unsub;
  }, []);

  return (
    <div className="hud-container">
      <div className="hud-profile">
        <div className="hud-avatar"></div>
        <div className="hud-details">
          <h2>{playerInfo.name}</h2>
          <p className="hud-cash">Ksh {playerInfo.cash}</p>
        </div>
      </div>
      <div className="hud-actions">
        {playerInfo.isMyTurn ? (
          <button 
            className="premium-btn action-roll"
            onClick={() => EventBridge.emit('REACT_ROLL_DICE')}
          >
            ROLL DICE
          </button>
        ) : (
          <div className="hud-waiting">Waiting for turn...</div>
        )}
      </div>
    </div>
  );
}

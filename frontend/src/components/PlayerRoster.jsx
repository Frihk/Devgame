import React, { useEffect, useState } from 'react';
import { EventBridge } from '../utils/EventBridge';
import '../ui/styles.css';

export function PlayerRoster() {
  const [players, setPlayers] = useState([
    { id: 2, name: 'Player 2', cash: 1500 },
    { id: 3, name: 'Player 3', cash: 1500 },
    { id: 4, name: 'Player 4', cash: 1500 }
  ]);

  useEffect(() => {
    const unsub = EventBridge.on('GAME_STATE_UPDATE', (state) => {
      if (state.opponents) {
        setPlayers(state.opponents);
      }
    });
    return unsub;
  }, []);

  return (
    <div className="roster-container">
      <h3>Opponents</h3>
      <div className="roster-list">
        {players.map(p => (
          <div key={p.id} className="roster-item">
            <span className="roster-name">{p.name}</span>
            <span className="roster-cash">Ksh {p.cash}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

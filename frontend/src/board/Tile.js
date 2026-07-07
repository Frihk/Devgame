import React from 'react';
import './Tile.css'; 

export default function Tile({ data, children }) {
  const currentPlayers = data.players || []; 

  return (
    <div 
      className={`tile-base tile-${data.side}`} 
      style={{ gridArea: data.gridArea }}
      onClick={() => console.log(`Clicked on ${data.name}`)}
    >
      <div className="tile-content">
        {children}
      </div>

      {/* Token Container: Shows who is currently standing here */}
      <div className="tile-tokens">
        {currentPlayers.map((player, idx) => (
          <span 
            key={idx} 
            className="player-token" 
            style={{ backgroundColor: player.color }}
            title={player.name}
          />
        ))}
      </div>
    </div>
  );
}
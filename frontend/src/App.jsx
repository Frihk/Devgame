import React, { useEffect, useState } from 'react';
import { EventBridge } from './utils/EventBridge';
import { HUD } from './components/HUD';
import { PlayerRoster } from './components/PlayerRoster';

function App() {
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    const unsubscribe = EventBridge.on('PHASER_CLICKED', (data) => {
      setClickCount((prev) => prev + 1);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="ui-overlay">
      <div className="top-bar">
        <PlayerRoster />
      </div>
      
      <div className="bottom-bar">
        <HUD />
      </div>
      
      {/* Dev Debug Tools */}
      <div style={{ position: 'absolute', top: 10, left: 10, padding: '10px', background: 'rgba(0,0,0,0.5)', color: 'white', borderRadius: 8 }}>
        <p style={{ margin: 0, fontSize: 12 }}>Debug: Phaser clicks {clickCount}</p>
      </div>
    </div>
  );
}

export default App;

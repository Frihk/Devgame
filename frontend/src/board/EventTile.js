import React from 'react';
import Tile from './Tile';

export default function EventTile({ data }) {
  const renderEventIcon = () => {
    switch (data.subType) {
      case 'chance': return <div className="icon-chance">?</div>;
      case 'community-chest': return <div className="icon-chest">📦</div>;
      case 'tax': return <div className="icon-tax">💸</div>;
      case 'go': return <div className="icon-go">➡️</div>;
      default: return null;
    }
  };

  return (
    <Tile data={data}>
      <div className={`event-layout type-${data.subType}`}>
        <span className="event-name">{data.name}</span>
        {renderEventIcon()}
        {data.price && <span className="event-price">Pay ${data.price}</span>}
      </div>
    </Tile>
  );
}
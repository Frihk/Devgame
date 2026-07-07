import React from 'react';
import Tile from './Tile';

export default function PropertyTile({ data }) {
  return (
    <Tile data={data}>
      <div className={`property-layout side-${data.side}`}>
        {/* The classic colored header band */}
        <div 
          className="property-color-bar" 
          style={{ backgroundColor: data.color }} 
        />
        
        {/* Info Area */}
        <div className="property-info">
          <span className="property-name">{data.name}</span>
          <span className="property-price">${data.price}</span>
        </div>
      </div>
    </Tile>
  );
}
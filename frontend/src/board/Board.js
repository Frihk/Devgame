import React from 'react';
import Tile from './Tile';
import PropertyTile from './PropertyTile';
import EventTile from './EventTile';
import './Board.css';

const boardData = [
    {id: 0, name: "GO", type: "special", gridArea: "11 / 11"},
    { id: 1, name: "Mediterranean Ave", type: "property", color: "brown", gridArea: "11 / 10" },
  { id: 2, name: "Community Chest", type: "event", gridArea: "11 / 9" },
];

export default function Board() {
  return (
    <div className="monopoly-board-container">
      <div className="monopoly-board">
        
        {/* Render your tiles dynamically based on their type */}
        {boardData.map((tile) => {
          if (tile.type === 'property') return <PropertyTile key={tile.id} data={tile} />;
          if (tile.type === 'event') return <EventTile key={tile.id} data={tile} />;
          return <Tile key={tile.id} data={tile} />;
        })}

        {/* The Winning Centerpiece */}
        <div className="board-center">
          <h1>REDDIT MONOPOLY</h1>
          <div className="dice-area">
            {/* Put your dice rolling component here */}
          </div>
        </div>

      </div>
    </div>
  );
}
export class Board {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.createBoardGrid();
    }

    createBoardGrid() {
        console.log("Board mapping initialized.");
    }
}

export class Board {
    constructor(scene) {
        this.scene = scene;
        this.tiles = [];
        this.boardSize = Math.min(scene.cameras.main.width, scene.cameras.main.height) * 0.8;
        this.cornerSize = this.boardSize * 0.13;
        this.tileSize = (this.boardSize - (this.cornerSize * 2)) / 9;
        
        this.offsetX = (scene.cameras.main.width - this.boardSize) / 2;
        this.offsetY = (scene.cameras.main.height - this.boardSize) / 2;

        this.createBoardGrid();
    }

    createBoardGrid() {
        this.graphics = this.scene.add.graphics();
        this.graphics.lineStyle(2, 0xffffff, 1);
        this.graphics.fillStyle(0xdddddd, 1);

        for (let i = 0; i < 40; i++) {
            let x, y, width, height;

            if (i < 10) { // Bottom row (Right to Left)
                if (i === 0) { // Bottom Right Corner (Go)
                    width = height = this.cornerSize;
                    x = this.boardSize - this.cornerSize;
                    y = this.boardSize - this.cornerSize;
                } else {
                    width = this.tileSize;
                    height = this.cornerSize;
                    x = this.boardSize - this.cornerSize - (i * this.tileSize);
                    y = this.boardSize - this.cornerSize;
                }
            } else if (i < 20) { // Left column (Bottom to Top)
                if (i === 10) { // Bottom Left Corner (Jail)
                    width = height = this.cornerSize;
                    x = 0;
                    y = this.boardSize - this.cornerSize;
                } else {
                    width = this.cornerSize;
                    height = this.tileSize;
                    x = 0;
                    y = this.boardSize - this.cornerSize - ((i - 10) * this.tileSize);
                }
            } else if (i < 30) { // Top row (Left to Right)
                if (i === 20) { // Top Left Corner (Free Parking)
                    width = height = this.cornerSize;
                    x = 0;
                    y = 0;
                } else {
                    width = this.tileSize;
                    height = this.cornerSize;
                    x = this.cornerSize + ((i - 21) * this.tileSize);
                    y = 0;
                }
            } else { // Right column (Top to Bottom)
                if (i === 30) { // Top Right Corner (Go To Jail)
                    width = height = this.cornerSize;
                    x = this.boardSize - this.cornerSize;
                    y = 0;
                } else {
                    width = this.cornerSize;
                    height = this.tileSize;
                    x = this.boardSize - this.cornerSize;
                    y = this.cornerSize + ((i - 31) * this.tileSize);
                }
            }

            // Apply offsets to center the board
            x += this.offsetX;
            y += this.offsetY;

            this.graphics.fillRect(x, y, width, height);
            this.graphics.strokeRect(x, y, width, height);
            
            // Add square index text for debugging
            this.scene.add.text(x + width/2, y + height/2, i.toString(), {
                fontFamily: 'Inter',
                fontSize: '12px',
                color: '#000000'
            }).setOrigin(0.5);

            this.tiles.push({ id: i, x: x + width/2, y: y + height/2, w: width, h: height });
        }
    }
}

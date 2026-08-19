import Phaser from 'phaser';
import { GAME_CONFIG, COLORS, LEVELS } from './config';
import BootScene from './scenes/boot';
import MenuScene from './scenes/menu';
import GameScene from './scenes/game';

export class Game {
    private game: Phaser.Game;
    private gameState: {
        score: number;
        level: number;
        moves: number;
        maxMoves: number;
        board: any[];
        holdSlots: any[];
    };

    constructor() {
        this.gameState = {
            score: 0,
            level: 1,
            moves: 0,
            maxMoves: 20,
            board: [],
            holdSlots: [],
        };

        this.game = new Phaser.Game({
            type: Phaser.AUTO,
            ...GAME_CONFIG,
            scene: [
                new BootScene(),
                new MenuScene(),
                new GameScene(this.gameState),
            ],
        });

        // Expose for playtest automation
        (window as any).__game = this.game;

        console.log('Color Block Jam loaded');
    }

    getScore(): number {
        return this.gameState.score;
    }

    getLevel(): number {
        return this.gameState.level;
    }
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new Game());
} else {
    new Game();
}

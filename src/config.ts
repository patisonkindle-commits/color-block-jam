import Phaser from 'phaser';

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 720,
    height: 1280,
    backgroundColor: '#1a1a2e',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false,
        },
    },
    render: {
        antialias: false,
        pixelArt: true,
    },
    parent: 'game-container',
};

export const COLORS = {
    red: '#FF6B6B',
    orange: '#FF8E53',
    yellow: '#FFC733',
    green: '#4CAF50',
    blue: '#2196F3',
    purple: '#7C4DFF',
};

export const LEVELS = [
    { moves: 20, target: 500 },
    { moves: 22, target: 700 },
    { moves: 24, target: 900 },
    { moves: 26, target: 1100 },
    { moves: 28, target: 1300 },
];

export const BOARD_SIZE = {
    cols: 6,
    rows: 8,
};

export const CELL_SIZE = 80;
export const CELL_GAP = 10;
export const BOARD_OFFSET_X = 90;
export const BOARD_OFFSET_Y = 200;

import Phaser from 'phaser';

export const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
    type: Phaser.CANVAS,
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

// Hold slots layout (single source of truth — was duplicated 5x in GameScene)
export const HOLD_SLOTS = 7;
export const MAX_HOLD_SLOTS = 8;
export const HOLD_DX = CELL_SIZE + 10; // slot pitch
export const HOLD_START_X = (720 - HOLD_SLOTS * HOLD_DX) / 2;
export const HOLD_Y = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
export const HOLD_DROP_TOP = HOLD_Y - 50;  // drag-release zone bounds
export const HOLD_DROP_BOTTOM = HOLD_Y + 100;
export const HOLD_INDICATOR_Y = HOLD_Y + 50;

// Stone obstacle constants — never shuffled, non-removable
export const OBSTACLE = 8;
export const OBSTACLES_PER_LEVEL = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8]; // 0-9

// Combo window (moves) + chain multiplier (levels 0, 1, 2, 3+)
export const COMBO_WINDOW = 3;
export const COMBO_MULT = [1, 1.5, 2, 2];

// Booster button positions
export const BOOSTER_Y = 1100;
export const BOOSTER_COUNTS = { undo: 1, slot: 1, shuffle: 1, swap: 1, bomb: 1 };

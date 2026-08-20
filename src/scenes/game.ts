import Phaser from 'phaser';
import {
    COLORS, BOARD_SIZE, CELL_SIZE, CELL_GAP, BOARD_OFFSET_X, BOARD_OFFSET_Y,
    LEVELS, MAX_HOLD_SLOTS, HOLD_SLOTS, HOLD_DX, HOLD_START_X, HOLD_Y, HOLD_DROP_TOP,
    HOLD_DROP_BOTTOM, HOLD_INDICATOR_Y, BOOSTER_COUNTS, BOOSTER_Y, COMBO_WINDOW, COMBO_MULT,
    OBSTACLE, OBSTACLES_PER_LEVEL
} from '../config';
import { saveGame, loadGame, hasSave, clearSave, setBestScore } from '../systems/save';
import { SFX } from '../systems/audio';

export default class GameScene extends Phaser.Scene {
    private board: any[][] = [];
    private holdSlots: any[] = [];
    private selectedBlock: any = null;
    private isHoldingBlock: boolean = false;
    private holdTimer: Phaser.Time.TimerEvent | null = null;
    private score: number = 0;
    private movesLeft: number = 30;
    private currentLevel: number = 0;
    private levelCleared: boolean = false;
    private holdIndicator!: Phaser.GameObjects.Graphics;
    private blocksMatched: number = 0;
    private comboLevel: number = 0;
    private lastMatchMove: number = -1;
    private maxCombo: number = 0;
    private popups: { text: Phaser.GameObjects.Text; x: number; y: number; vy: number; life: number; maxLife: number }[] = [];

    private undoBtn!: Phaser.GameObjects.Container;
    private slotBtn!: Phaser.GameObjects.Container;
    private shuffleBtn!: Phaser.GameObjects.Container;
    private undoCountText!: Phaser.GameObjects.Text;
    private slotCountText!: Phaser.GameObjects.Text;
    private shuffleCountText!: Phaser.GameObjects.Text;
    private swapBtn!: Phaser.GameObjects.Container;
    private swapCountText!: Phaser.GameObjects.Text;
    private bombBtn!: Phaser.GameObjects.Container;
    private bombCountText!: Phaser.GameObjects.Text;

    private undoStack: { boardState: any[][]; movesLeft: number; score: number; level: number; slotCount: number; heldState: any[] }[] = [];

    // Booster target modes — SWAP waits for 2 board blocks, BOMB waits for 1
    private boosterMode: 'swap' | 'bomb' | null = null;
    private swapFirst: { row: number; col: number; block: any } | null = null;

    private colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'cyan', 'stone'];
    private colorValues = [0xFF6B6B, 0xFF8E53, 0xFFC733, 0x4CAF50, 0x2196F3, 0x7C4DFF, 0x00E5FF, 0x8A8A8A];

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }
        // per-level state reset — scene.restart() reuses this instance
        this.boostersUsed = { undo: 0, slot: 0, shuffle: 0, swap: 0, bomb: 0 };
        this.boosterMode = null;
        this.swapFirst = null;
        this.levelCleared = false;
        this.comboLevel = 0;
        this.lastMatchMove = -1;
        this.maxCombo = 0;
        this.popups.forEach(p => p.text.destroy());
        this.popups = [];

        const save = loadGame();
        if (save && save.level <= this.currentLevel) {
            // CONTINUE from save — restore board + held blocks
            this.movesLeft = save.movesLeft;
            this.score = save.score;
            this.currentLevel = save.level;
            this.undoStack = [];
            this.createHoldSlots();

            // Build board from snapshot
            this.board = [];
            for (let row = 0; row < BOARD_SIZE.rows; row++) {
                this.board[row] = [];
                for (let col = 0; col < BOARD_SIZE.cols; col++) {
                    const cell = save.board[row][col];
                    if (!cell) {
                        this.board[row][col] = null;
                        continue;
                    }
                    const x = BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                    const y = BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                    const block = this.addBlock(x, y, cell.color);
                    if (cell.color !== OBSTACLE) block.setInteractive({ useHandCursor: true });
                    block.column = cell.col;
                    block.row = cell.row;
                    block.isHeld = false;
                    block.holdingSlot = -1;
                    block.setData('color', cell.color);
                    this.board[row][col] = block;
                }
            }

            // Place held blocks into slots
            for (let i = 0; i < Math.min(save.heldSlots.length, this.holdSlots.length); i++) {
                const hd = save.heldSlots[i];
                const x = HOLD_START_X + i * HOLD_DX + CELL_SIZE / 2;
                const y = HOLD_Y;
                const block = this.addBlock(x, y, hd.color);
                if (hd.color !== OBSTACLE) block.setInteractive({ useHandCursor: true });
                block.column = hd.boardCol;
                block.row = hd.boardRow;
                block.isHeld = true;
                block.holdingSlot = i;
                this.holdSlots[i].block = block;
            }
        } else {
            // Fresh game
            this.movesLeft = LEVELS[this.currentLevel].moves;
            this.score = 0;
            this.currentLevel = 0;
            this.board = [];
            this.createBoard();
            this.createHoldSlots();
        }

        this.createHoldIndicator();
        this.setupInputHandlers();
        this.setupBoosterButtons();
        this.updateUI();
    }

    private createBackground() {
        this.add.rectangle(0, 0, 720, 1280, 0x1a1a2e).setOrigin(0, 0);
    }

    // Create a block image at (x,y) with real-texture scaling; stones use 'stone' texture
    private addBlock(x: number, y: number, colorIdx: number) {
        const key = colorIdx === OBSTACLE ? 'stone' : this.colorNames[colorIdx];
        const block = this.add.image(x, y, key);
        block.setDisplaySize(CELL_SIZE, CELL_SIZE);
        if (colorIdx !== OBSTACLE) block.setInteractive({ useHandCursor: true });
        return block;
    }

    private createBoard() {
        this.board = [];
        const startX = BOARD_OFFSET_X;
        const startY = BOARD_OFFSET_Y;

        // Stone obstacles: N cells per level (level 0 = none), never in a 3-cell straight line
        const stoneCount = OBSTACLES_PER_LEVEL[Math.min(this.currentLevel, OBSTACLES_PER_LEVEL.length - 1)] || 0;
        const stones = new Set<number>();
        let attempts = 0;
        const all = [];
        for (let r = 0; r < BOARD_SIZE.rows; r++)
            for (let c = 0; c < BOARD_SIZE.cols; c++) all.push(r * BOARD_SIZE.cols + c);

        outer:
        while (stones.size < stoneCount && attempts++ < stoneCount * 40) {
            const idx = all[Math.floor(Math.random() * all.length)];
            const r = Math.floor(idx / BOARD_SIZE.cols);
            const c = idx % BOARD_SIZE.cols;
            // reject if it would complete a 3-in-a-row of stones
            for (let d = -2; d <= 0; d++) {
                const inRow = c + d >= 0 && c + d + 2 < BOARD_SIZE.cols;
                const inCol = r + d >= 0 && r + d + 2 < BOARD_SIZE.rows;
                if (inRow && stones.has(r * BOARD_SIZE.cols + (c + d)) && stones.has(r * BOARD_SIZE.cols + (c + d + 1)) && stones.has(r * BOARD_SIZE.cols + (c + d + 2))) continue outer;
                if (inCol && stones.has((r + d) * BOARD_SIZE.cols + c) && stones.has((r + d + 1) * BOARD_SIZE.cols + c) && stones.has((r + d + 2) * BOARD_SIZE.cols + c)) continue outer;
            }
            stones.add(idx);
        }

        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                const x = startX + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const y = startY + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

                const isStone = stones.has(row * BOARD_SIZE.cols + col);
                if (isStone) {
                    const stone: any = this.addBlock(x, y, OBSTACLE);
                    stone.column = col;
                    stone.row = row;
                    stone.isHeld = false;
                    stone.holdingSlot = -1;
                    stone.setData('color', OBSTACLE);
                    this.board[row][col] = stone;
                    continue;
                }

                const colorIdx = Math.floor(Math.random() * 7);
                const block = this.addBlock(
                    BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                    BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                    colorIdx
                );
                block.setInteractive({ useHandCursor: true });
                block.column = col;
                block.row = row;
                block.isHeld = false;
                block.holdingSlot = -1;
                block.setData('color', colorIdx);

                this.board[row][col] = block;
            }
        }
    }

    private createHoldSlots() {
        this.holdSlots = [];
        const holdY = HOLD_Y;
        const holdStartX = HOLD_START_X;

        for (let i = 0; i < HOLD_SLOTS; i++) {
            const x = holdStartX + i * HOLD_DX + CELL_SIZE / 2;

            const slotBg = this.add.rectangle(x, holdY, CELL_SIZE, CELL_SIZE, 0x000000, 0.3);
            slotBg.setAngle(0);
            slotBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
            slotBg.x = x;
            slotBg.y = holdY;
            slotBg.slotIndex = i;
            (slotBg as any).block = undefined;

            this.holdSlots.push(slotBg);
        }
    }

    private createHoldIndicator() {
        const holdY = HOLD_Y;
        const holdStartX = HOLD_START_X;

        this.holdIndicator = this.add.graphics();
        this.holdIndicator.fillStyle(0x4CAF50, 0.2);
        this.holdIndicator.fillRoundedRect(holdStartX - 10, holdY - 40, MAX_HOLD_SLOTS * HOLD_DX + 20, 80, 15);
    }

    private setupInputHandlers() {
        // Block click/hold detection
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.boosterMode) { this.handleBoosterTap(pointer); return; }
            const boardY = BOARD_OFFSET_Y;
            const boardHeight = BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + CELL_SIZE;

            if (pointer.y >= boardY && pointer.y <= boardY + boardHeight) {
                if (this.levelCleared) return;
                const col = Math.floor((pointer.x - BOARD_OFFSET_X) / (CELL_SIZE + CELL_GAP));
                const row = Math.floor((pointer.y - boardY) / (CELL_SIZE + CELL_GAP));

                if (row >= 0 && row < BOARD_SIZE.rows && col >= 0 && col < BOARD_SIZE.cols) {
                    // stones are obstacles — can't move them, remove the empty cell under selection
                    if (!this.board[row][col] || this.board[row][col].getData('color') === OBSTACLE) return;
                    if (!this.board[row][col].isHeld) {
                        this.selectBlock(this.board[row][col]);
                        this.armHoldTimer();
                        SFX.click();
                    }
                }
            }
        });

        // Drag detection
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.selectedBlock && this.isHoldingBlock) {
                const holdY = HOLD_Y;
                if (pointer.y > HOLD_DROP_TOP && pointer.y < HOLD_DROP_BOTTOM) {
                    this.holdIndicator.setAlpha(0.5);
                    this.holdIndicator.fillStyle(0x4CAF50, 0.4);
                    this.holdIndicator.clear();
                    this.holdIndicator.fillRoundedRect(
                        HOLD_START_X - 10, holdY - 40, MAX_HOLD_SLOTS * HOLD_DX + 20, 80, 15
                    );
                } else {
                    this.holdIndicator.setAlpha(0.2);
                    this.holdIndicator.fillStyle(0x4CAF50, 0.2);
                    this.holdIndicator.clear();
                    this.holdIndicator.fillRoundedRect(
                        HOLD_START_X - 10, holdY - 40, MAX_HOLD_SLOTS * HOLD_DX + 20, 80, 15
                    );
                }
            }
        });

        // Release block
        this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.selectedBlock && this.isHoldingBlock) {
                this.releaseBlock(pointer);
            }
        });

        // Hold timer
        this.holdTimer = this.time.delayedCall(300, () => {
            if (this.selectedBlock) {
                this.isHoldingBlock = true;
                this.selectedBlock.setAlpha(0.7);
            }
        }, [], this);
    }

    private armHoldTimer() {
        if (this.holdTimer) {
            this.holdTimer.remove();
            this.holdTimer = null;
        }
        this.holdTimer = this.time.delayedCall(300, () => {
            if (this.selectedBlock) {
                this.isHoldingBlock = true;
                this.selectedBlock.setAlpha(0.7);
            }
        }, [], this);
    }

    private selectBlock(block: any) {
        this.selectedBlock = block;

        if (this.holdTimer) {
            this.holdTimer.remove();
            this.holdTimer = null;
        }
    }

    private releaseBlock(pointer: Phaser.Input.Pointer) {
        if (!this.selectedBlock) return;

        const holdY = HOLD_Y;
        const block = this.selectedBlock;

        if (this.isHoldingBlock && pointer.y > HOLD_DROP_TOP && pointer.y < HOLD_DROP_BOTTOM) {
            const col = Math.floor((pointer.x - HOLD_START_X) / HOLD_DX);
            const slotIdx = Math.max(0, Math.min(this.holdSlots.length - 1, col));

            if (this.holdSlots[slotIdx].block === undefined) {
                this.moveBlockToHold(this.selectedBlock, slotIdx);
            }
        } else if (block.getData('color') === OBSTACLE) {
            // stone dragged away from board — snap back without lifting the stone (it stays put below)
        } else {
            // Animate back to original position
            this.tweens.add({
                targets: this.selectedBlock,
                x: BOARD_OFFSET_X + this.selectedBlock.column * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                y: BOARD_OFFSET_Y + this.selectedBlock.row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                alpha: 1,
                duration: 200,
                ease: 'Back.easeOut',
            });
        }

        this.selectedBlock.setAlpha(1);
        this.selectedBlock = null;
        this.isHoldingBlock = false;

        if (this.holdTimer) {
            this.holdTimer.remove();
            this.holdTimer = null;
        }
    }

    private moveBlockToHold(block: any, slotIndex: number) {
        // Save undo state before move
        this.saveUndoState();

        const holdY = HOLD_Y;
        const holdStartX = HOLD_START_X;

        const targetX = holdStartX + slotIndex * HOLD_DX + CELL_SIZE / 2;
        const targetY = holdY;

        block.isHeld = true;
        block.holdingSlot = slotIndex;
        this.holdSlots[slotIndex].block = block;

        // Remove from board
        this.board[block.row][block.column] = null;

        // Combo decay: if last match was too many moves ago, reset chain
        if (this.lastMatchMove >= 0 && this.lastMatchMove - this.movesLeft >= COMBO_WINDOW) {
            this.comboLevel = 0;
        }

        this.tweens.add({
            targets: block,
            x: targetX,
            y: targetY,
            duration: 300,
            ease: 'Cubic.easeOut',
        });

        this.movesLeft--;
        this.updateUI();

        this.time.delayedCall(300, () => {
            this.checkHoldSlots();
        }, [], this);
    }

    private checkHoldSlots() {
        let consecutiveCount = 1;
        let startSlot = 0;
        let bestMatch = { count: 0, start: 0 };

        for (let i = 1; i < this.holdSlots.length; i++) {
            const currentBlock = this.holdSlots[i].block;
            const prevBlock = this.holdSlots[i - 1].block;

            if (currentBlock && prevBlock && currentBlock.getData('color') === prevBlock.getData('color')) {
                consecutiveCount++;
            } else {
                if (consecutiveCount > bestMatch.count) {
                    bestMatch = { count: consecutiveCount, start: startSlot };
                }
                consecutiveCount = 1;
                startSlot = i;
            }
        }

        if (consecutiveCount > bestMatch.count) {
            bestMatch = { count: consecutiveCount, start: startSlot };
        }

        if (bestMatch.count >= 3) {
            // Found a match
            const matchedBlocks = [];
            for (let i = bestMatch.start; i < bestMatch.start + bestMatch.count; i++) {
                matchedBlocks.push(this.holdSlots[i].block);
                this.holdSlots[i].block = undefined;
                matchedBlocks[i - bestMatch.start].isHeld = false;
                matchedBlocks[i - bestMatch.start].holdingSlot = -1;
            }

            // Animate removal
            this.tweens.add({
                targets: matchedBlocks,
                scale: 0,
                alpha: 0,
                duration: 300,
                ease: 'Back.easeIn',
                onComplete: () => {
                    matchedBlocks.forEach(block => {
                        block.destroy();
                    });

                    // Calculate score — stepped: 3-match=30, 4=60, 5+=120
                    const base = bestMatch.count >= 5 ? 120 : bestMatch.count * 10 + (bestMatch.count - 3) * 20;
                    // Combo chain: matches within COMBO_WINDOW moves multiply ×1.5 → ×2
                    if (this.lastMatchMove >= 0 && this.lastMatchMove - this.movesLeft < COMBO_WINDOW) {
                        this.comboLevel = Math.min(this.comboLevel + 1, COMBO_MULT.length - 1);
                    } else {
                        this.comboLevel = 0;
                    }
                    this.lastMatchMove = this.movesLeft;
                    this.maxCombo = Math.max(this.maxCombo, this.comboLevel);
                    const mult = COMBO_MULT[this.comboLevel];
                    const points = Math.round(base * mult);
                    this.score += points;
                    this.blocksMatched += bestMatch.count;
                    SFX.match(this.comboLevel + 1);
                    this.spawnPopup(`+${points}${mult > 1 ? ` ×${mult}` : ''}`, this.holdSlots[bestMatch.start].x, HOLD_Y - 60, mult > 1 ? '#FFD700' : '#FFFFFF');
                    if (bestMatch.count >= 4 || mult > 1) this.cameras.main.shake(150, 0.004);
                    this.updateUI();

                    // Refill board
                    this.refillBoard();
                    this.checkVictory();
                },
            });
        } else {
            // No match: keep blocks in slots unless all are occupied
            const allFull = this.holdSlots.every(x => x.block);
            if (!allFull) return;

            // Return blocks to board
            for (let i = 0; i < this.holdSlots.length; i++) {
                if (this.holdSlots[i].block) {
                    const block = this.holdSlots[i].block;
                    this.holdSlots[i].block = undefined;
                    block.isHeld = false;
                    block.holdingSlot = -1;

                    // Find empty slot on board
                    let placed = false;
                    for (let row = 0; row < BOARD_SIZE.rows; row++) {
                        for (let col = 0; col < BOARD_SIZE.cols; col++) {
                            if (!this.board[row][col]) {
                                const targetX = BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                                const targetY = BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

                                this.tweens.add({
                                    targets: block,
                                    x: targetX,
                                    y: targetY,
                                    duration: 300,
                                    ease: 'Cubic.easeOut',
                                    onComplete: () => {
                                        this.board[row][col] = block;
                                        block.row = row;
                                        block.column = col;
                                    },
                                });

                                placed = true;
                                break;
                            }
                        }
                        if (placed) break;
                    }
                }
            }
        }
    }

    private refillBoard() {
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (!this.board[row][col]) {
                    const colorIdx = Math.floor(Math.random() * 7);
                    const block = this.addBlock(
                                    BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                                    -CELL_SIZE,
                                    colorIdx
                                );
                    block.setInteractive({ useHandCursor: true });
                    block.column = col;
                    block.row = row;
                    block.isHeld = false;
                    block.holdingSlot = -1;
                    block.setData('color', colorIdx);

                    this.tweens.add({
                        targets: block,
                        y: BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                        duration: 400,
                        ease: 'Cubic.easeOut',
                    });

                    this.board[row][col] = block;
                }
            }
        }
    }

    private spawnPopup(text: string, x: number, y: number, color = '#FFFFFF') {
        if (this.popups.length > 10) { const old = this.popups.shift(); if (old) old.text.destroy(); }
        const t = this.add.text(x, y + 20, text, {
            fontSize: '30px',
            fontFamily: 'Arial Black',
            color,
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5).setDepth(990);
        this.popups.push({ text: t, x, y: y + 20, vy: -45, life: 0.9, maxLife: 0.9 });
    }

    private updatePopups(dt: number) {
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.y += p.vy * dt;
            p.life -= dt;
            p.text.setY(p.y);
            p.text.setAlpha(Math.max(0, p.life / p.maxLife));
            p.text.setFontSize(`${30 + (0.9 - p.life) * 20}px`);
            if (p.life <= 0) {
                p.text.destroy();
                this.popups.splice(i, 1);
            }
        }
    }

    update(_time: number, delta: number) {
        const dt = Math.min(delta / 1000, 0.05);
        this.updatePopups(dt);
    }

    private updateUI() {
        this.registry.set('hud', {
            score: this.score,
            moves: this.movesLeft,
            level: this.currentLevel,
            maxCombo: this.maxCombo,
            combo: this.comboLevel,
            target: LEVELS[this.currentLevel].target,
            undosLeft: 3 - this.undoStack.length,  // max 3 undos per level
            boostersUsed: this.boostersUsed,
        });

        if (this.undoCountText) this.undoCountText.setText(`${BOOSTER_COUNTS.undo - this.boostersUsed.undo}×`);
        if (this.slotCountText) this.slotCountText.setText(`${BOOSTER_COUNTS.slot - this.boostersUsed.slot}×`);
        if (this.shuffleCountText) this.shuffleCountText.setText(`${BOOSTER_COUNTS.shuffle - this.boostersUsed.shuffle}×`);
        if (this.swapCountText) this.swapCountText.setText(`${BOOSTER_COUNTS.swap - this.boostersUsed.swap}×`);
        if (this.bombCountText) this.bombCountText.setText(`${BOOSTER_COUNTS.bomb - this.boostersUsed.bomb}×`);

        if (this.movesLeft <= 0) {
            this.gameOver();
        }
    }

    private checkVictory() {
        if (this.levelCleared) return;
        const target = LEVELS[this.currentLevel].target;
        if (this.score < target) return;
        this.levelCleared = true;
        this.saveGameProgress();
        SFX.win();
        this.showLevelClear();
    }

    private saveGameProgress() {
        // Snapshot board (null where empty, {color,col,row} where filled)
        const boardSnapshot: any[][] = [];
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            boardSnapshot[row] = [];
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                const cell = this.board[row][col];
                if (!cell) {
                    boardSnapshot[row][col] = null;
                } else {
                    boardSnapshot[row][col] = {
                        color: cell.getData('color'),
                        col: cell.column,
                        row: cell.row,
                    };
                }
            }
        }

        // Snapshot held blocks
        const heldBlocks: any[] = [];
        for (let i = 0; i < this.holdSlots.length; i++) {
            const block = this.holdSlots[i].block;
            if (block) {
                heldBlocks.push({
                    color: block.getData('color'),
                    boardCol: block.column,
                    boardRow: block.row,
                });
            }
        }

        saveGame({
            level: this.currentLevel,
            score: this.score,
            movesLeft: this.movesLeft,
            totalUndos: this.undoStack.length,
            blocksMatched: this.blocksMatched,
            board: boardSnapshot,
            heldSlots: heldBlocks,
        });
    }

    private showLevelClear() {
        const nextLevel = this.currentLevel + 1 < LEVELS.length;
        const overlay = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.8);
        const isNewBest = setBestScore(this.score);
        const title = this.add.text(360, 520, nextLevel ? 'LEVEL CLEAR!' : 'YOU WIN!', {
            fontSize: '56px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        if (isNewBest) {
            this.add.text(360, 570, 'NEW BEST SCORE!', {
                fontSize: '24px',
                fontFamily: 'Arial Black',
                color: '#00E5FF',
                fontStyle: 'bold',
            }).setOrigin(0.5);
        }
        const score = this.add.text(360, 610, nextLevel
            ? `Score: ${this.score} / ${LEVELS[this.currentLevel].target}`
            : `Final Score: ${this.score}  •  Blocks Matched: ${this.blocksMatched}`, {
            fontSize: '30px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
        }).setOrigin(0.5);
        const btn = this.add.container(360, 740);
        const btnBg = this.add.image(0, 0, 'restart');
        const btnText = this.add.text(0, 0, nextLevel ? 'NEXT LEVEL' : 'PLAY AGAIN', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#333333',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        btn.add([btnBg, btnText]);
        btn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);
        btn.on('pointerdown', () => {
            if (nextLevel) {
                this.currentLevel++;
                this.score = 0;
                this.movesLeft = LEVELS[this.currentLevel].moves;
                this.levelCleared = false;
                this.undoStack = [];
                this.blocksMatched = 0;
                this.scene.restart();
            } else {
                clearSave();
                this.currentLevel = 0;
                this.score = 0;
                this.movesLeft = LEVELS[0].moves;
                this.levelCleared = false;
                this.undoStack = [];
                this.blocksMatched = 0;
                this.scene.restart();
            }
        });

        if (!nextLevel) {
            // Final-level victory — add MENU button under PLAY AGAIN
            const menuBtn = this.add.container(360, 840);
            const menuBg = this.add.image(0, 0, 'play');
            const menuText = this.add.text(0, 0, 'MENU', {
                fontSize: '28px',
                fontFamily: 'Arial Black',
                color: '#333333',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            menuBtn.add([menuBg, menuText]);
            menuBtn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);
            menuBtn.on('pointerdown', () => {
                clearSave();
                this.scene.start('MenuScene');
            });
        }
    }

    private gameOver() {
        SFX.fail();
        setBestScore(this.score);
        const overlay = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.8);
        const title = this.add.text(360, 500, 'GAME OVER', {
            fontSize: '64px',
            fontFamily: 'Arial Black',
            color: '#FF6B6B',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        const score = this.add.text(360, 600, `Final Score: ${this.score}`, {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
        }).setOrigin(0.5);

        const restartBtn = this.add.container(360, 750);
        const restartBg = this.add.image(0, 0, 'restart');
        const restartText = this.add.text(0, 0, 'RESTART', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#333333',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        restartBtn.add([restartBg, restartText]);
        restartBtn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);
        restartBtn.on('pointerdown', () => this.scene.restart());
    }

    // ====== Boosters ======

    private saveUndoState() {
        // Deep clone board state for undo
        const boardState = this.board.map(row => row.map(cell => {
            if (!cell) return null;
            return {
                column: cell.column,
                row: cell.row,
                color: cell.getData('color'),
                isHeld: cell.isHeld,
                holdingSlot: cell.holdingSlot,
            };
        }));

        // Also snapshot held slots
        const heldState: any[] = [];
        for (let i = 0; i < this.holdSlots.length; i++) {
            const block = this.holdSlots[i].block;
            if (block) {
                heldState.push({
                    color: block.getData('color'),
                    boardCol: block.column,
                    boardRow: block.row,
                    slotIndex: i,
                });
            }
        }

        this.undoStack.push({
            boardState,
            movesLeft: this.movesLeft,
            score: this.score,
            level: this.currentLevel,
            slotCount: this.holdSlots.length,
            heldState,
        });
    }

    private undoLastMove() {
        if (this.undoStack.length === 0) return;

        const lastState = this.undoStack.pop();
        if (!lastState) return;

        // Destroy ALL existing blocks (board + held) before rebuilding
        this.board.flat().forEach((cell: any) => {
            if (cell && cell.destroy) cell.destroy();
        });
        this.holdSlots.forEach(slot => {
            if (slot.block && slot.block.destroy) slot.block.destroy();
            slot.block = undefined;
        });

        // Clear board, rebuild from snapshot
        this.board = [];
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            this.board[row] = [];
        }

        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                const cell = lastState.boardState[row][col];
                if (!cell) {
                    this.board[row][col] = null;
                    continue;
                }

                const x = BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const y = BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

                const block = this.addBlock(x, y, cell.color);
                if (cell.color !== OBSTACLE) block.setInteractive({ useHandCursor: true });
                block.column = cell.column;
                block.row = cell.row;
                block.isHeld = cell.isHeld;
                block.holdingSlot = cell.holdingSlot;
                block.setData('color', cell.color);

                this.board[row][col] = block;
            }
        }

        this.movesLeft = lastState.movesLeft;
        this.score = lastState.score;
        this.currentLevel = lastState.level;

        // Restore slot count (e.g. undo after +1 SLOT booster)
        while (this.holdSlots.length > lastState.slotCount) {
            const removed = this.holdSlots.pop();
            if (removed) removed.destroy();
        }
        while (this.holdSlots.length < lastState.slotCount) {
            const slotIndex = this.holdSlots.length;
            const x = HOLD_START_X + slotIndex * HOLD_DX + CELL_SIZE / 2;
            const y = HOLD_Y;
            const slotBg = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x000000, 0.3);
            slotBg.setAngle(0);
            slotBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
            slotBg.slotIndex = slotIndex;
            (slotBg as any).block = undefined;
            this.holdSlots.push(slotBg);
        }

        // Restore held slots from undo snapshot
        for (let i = 0; i < this.holdSlots.length; i++) {
            this.holdSlots[i].block = undefined;
        }
        for (const hd of lastState.heldState) {
            const slotIdx = hd.slotIndex;
            if (slotIdx < this.holdSlots.length) {
                const x = HOLD_START_X + slotIdx * HOLD_DX + CELL_SIZE / 2;
                const y = HOLD_Y;
                const block = this.addBlock(x, y, hd.color);
                if (hd.color !== OBSTACLE) block.setInteractive({ useHandCursor: true });
                block.column = hd.boardCol;
                block.row = hd.boardRow;
                block.isHeld = true;
                block.holdingSlot = slotIdx;
                this.holdSlots[slotIdx].block = block;
            }
        }

        this.updateUI();
    }

    private boostersUsed = { undo: 0, slot: 0, shuffle: 0, swap: 0, bomb: 0 };

    private useBooster(action: string) {
        if (this.boostersUsed[action as keyof typeof this.boostersUsed] >= BOOSTER_COUNTS[action as keyof typeof BOOSTER_COUNTS]) {
            return;  // already used
        }
        // No-op guards — don't consume the booster on a useless press
        if (action === 'undo' && this.undoStack.length === 0) return;
        if (action === 'slot' && this.holdSlots.length >= MAX_HOLD_SLOTS) return;
        if (action === 'swap' && this.board.flat().filter((b: any) => b).length < 2) return;
        if (action === 'bomb' && this.board.flat().filter((b: any) => b && b.getData('color') !== OBSTACLE).length === 0) return;
        this.boostersUsed[action as keyof typeof this.boostersUsed]++;
        switch (action) {
            case 'undo':
                this.undoLastMove();
                break;
            case 'slot':
                this.addExtraSlot();
                break;
            case 'shuffle':
                this.shuffleBoard();
                break;
            case 'swap':
                this.boosterMode = 'swap';
                this.swapFirst = null;
                break;
            case 'bomb':
                this.boosterMode = 'bomb';
                break;
        }
        this.updateUI();
    }

    private addExtraSlot() {
        if (this.holdSlots.length >= MAX_HOLD_SLOTS) return; // Cap at 8 slots

        const slotIndex = this.holdSlots.length;
        const x = HOLD_START_X + slotIndex * HOLD_DX + CELL_SIZE / 2;
        const y = HOLD_Y;

        const slotBg = this.add.rectangle(x, y, CELL_SIZE, CELL_SIZE, 0x000000, 0.3);
        slotBg.setAngle(0);
        slotBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
        slotBg.slotIndex = slotIndex;
        (slotBg as any).block = undefined;

        this.holdSlots.push(slotBg);
        this.updateUI();
    }

    private shuffleBoard() {
        // Collect all current colors (stones are obstacles — never shuffled)
        const colors: number[] = [];
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (this.board[row][col] && this.board[row][col].getData('color') !== OBSTACLE) {
                    colors.push(this.board[row][col].getData('color'));
                }
            }
        }

        // Shuffle colors
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }

        // Apply shuffled colors (stones keep their texture + data)
        let idx = 0;
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (this.board[row][col] && this.board[row][col].getData('color') !== OBSTACLE) {
                    const newColor = colors[idx++];
                    this.board[row][col].setData('color', newColor);
                    this.board[row][col].setTexture(this.colorNames[newColor]);
                }
            }
        }

        // Animate shuffle effect
        this.tweens.add({
            targets: this.board,
            duration: 300,
            ease: 'Power2',
        });
    }

    private handleBoosterTap(pointer: Phaser.Input.Pointer) {
        const boardY = BOARD_OFFSET_Y;
        const boardHeight = BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + CELL_SIZE;
        if (pointer.y < boardY || pointer.y > boardY + boardHeight) return; // tap outside board — keep mode armed
        const col = Math.floor((pointer.x - BOARD_OFFSET_X) / (CELL_SIZE + CELL_GAP));
        const row = Math.floor((pointer.y - boardY) / (CELL_SIZE + CELL_GAP));
        if (row < 0 || row >= BOARD_SIZE.rows || col < 0 || col >= BOARD_SIZE.cols) return;
        const cell = this.board[row][col];
        if (!cell || cell.getData('color') === OBSTACLE) return; // stones untouchable

        if (this.boosterMode === 'bomb') {
            this.boosterMode = null;
            this.bombCell(row, col);
        } else if (this.boosterMode === 'swap') {
            if (!this.swapFirst) {
                this.swapFirst = { row, col, block: cell };
                cell.setTintFill(0xFFFFFF); // highlight first pick
                return;
            }
            if (this.swapFirst.row === row && this.swapFirst.col === col) return; // same cell — keep waiting
            this.swapFirst.block.clearTint();
            this.boosterMode = null;
            this.swapBlocks(this.swapFirst, { row, col, block: cell });
            this.swapFirst = null;
        }
    }

    private swapBlocks(a: { row: number; col: number; block: any }, b: { row: number; col: number; block: any }) {
        // swap colors + textures; positions stay (blocks don't move)
        const aColor = a.block.getData('color');
        const bColor = b.block.getData('color');
        a.block.setData('color', bColor);
        a.block.setTexture(this.colorNames[bColor]);
        b.block.setData('color', aColor);
        b.block.setTexture(this.colorNames[aColor]);
        this.tweens.add({ targets: [a.block, b.block], scale: { from: 1, to: 1 }, duration: 200, ease: 'Power2' });
        SFX.click();
        this.saveUndoState();
        this.updateUI();
    }

    private bombCell(row: number, col: number) {
        const block = this.board[row][col];
        this.board[row][col] = null;
        block.destroy();
        SFX.bomb();
        this.cameras.main.shake(200, 0.006);
        this.spawnPopup('💥', BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2, BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2, '#FF8E53');
        this.movesLeft--;
        // refill the empty cell from the top
        const colorIdx = Math.floor(Math.random() * 7);
        const nb: any = this.addBlock(BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2, -CELL_SIZE, colorIdx);
        nb.setInteractive({ useHandCursor: true });
        nb.column = col;
        nb.row = row;
        nb.isHeld = false;
        nb.holdingSlot = -1;
        nb.setData('color', colorIdx);
        this.tweens.add({
            targets: nb,
            y: BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
            duration: 400,
            ease: 'Cubic.easeOut',
        });
        this.board[row][col] = nb;
        this.updateUI();
    }

    private setupBoosterButtons() {
        // Undo button
        this.undoBtn = this.add.container(100, BOOSTER_Y, [
            this.add.image(0, 0, 'restart'), // Kenney silver button asset
            this.add.text(0, 0, 'UNDO', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#333333',
            }).setOrigin(0.5),
        ]);
        this.undoCountText = this.add.text(132, BOOSTER_Y + 18, '1×', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
        }).setOrigin(0.5);
        this.undoBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.undoBtn.on('pointerdown', () => { SFX.click(); this.useBooster('undo'); });

        // Slot button
        this.slotBtn = this.add.container(360, BOOSTER_Y, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, '+1 SLOT', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#333333',
            }).setOrigin(0.5),
        ]);
        this.slotCountText = this.add.text(392, BOOSTER_Y + 18, '1×', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
        }).setOrigin(0.5);
        this.slotBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.slotBtn.on('pointerdown', () => { SFX.click(); this.useBooster('slot'); });

        // Shuffle button
        this.shuffleBtn = this.add.container(620, BOOSTER_Y, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, 'SHUFFLE', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#333333',
            }).setOrigin(0.5),
        ]);
        this.shuffleCountText = this.add.text(652, BOOSTER_Y + 18, '1×', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
        }).setOrigin(0.5);
        this.shuffleBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.shuffleBtn.on('pointerdown', () => { SFX.click(); this.useBooster('shuffle'); });

        // Swap button (row 2)
        this.swapBtn = this.add.container(100, BOOSTER_Y + 70, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, 'SWAP', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#333333',
            }).setOrigin(0.5),
        ]);
        this.swapCountText = this.add.text(132, BOOSTER_Y + 88, '1×', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
        }).setOrigin(0.5);
        this.swapBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.swapBtn.on('pointerdown', () => { SFX.click(); this.useBooster('swap'); });

        // Bomb button (row 2)
        this.bombBtn = this.add.container(360, BOOSTER_Y + 70, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, 'BOMB', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#333333',
            }).setOrigin(0.5),
        ]);
        this.bombCountText = this.add.text(392, BOOSTER_Y + 88, '1×', {
            fontSize: '14px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
        }).setOrigin(0.5);
        this.bombBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.bombBtn.on('pointerdown', () => { SFX.click(); this.useBooster('bomb'); });
    }
}

import Phaser from 'phaser';
import {
    COLORS, BOARD_SIZE, CELL_SIZE, CELL_GAP, BOARD_OFFSET_X, BOARD_OFFSET_Y,
    LEVELS, HOLD_SLOTS, HOLD_DX, HOLD_START_X, HOLD_Y, HOLD_DROP_TOP,
    HOLD_DROP_BOTTOM, HOLD_INDICATOR_Y, BOOSTER_COUNTS
} from '../config';
import { saveGame, loadGame, hasSave, clearSave } from '../systems/save';

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

    private undoBtn!: Phaser.GameObjects.Container;
    private slotBtn!: Phaser.GameObjects.Container;
    private shuffleBtn!: Phaser.GameObjects.Container;

    private undoStack: { boardState: any[][]; movesLeft: number; score: number; level: number; slotCount: number }[] = [];

    private colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
    private colorValues = [0xFF6B6B, 0xFF8E53, 0xFFC733, 0x4CAF50, 0x2196F3, 0x7C4DFF];

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        if (!this.scene.isActive('UIScene')) {
            this.scene.launch('UIScene');
        }

        const save = loadGame();
        if (save && save.level <= this.currentLevel) {
            // CONTINUE from save — restore board + held blocks
            this.movesLeft = save.movesLeft;
            this.score = save.score;
            this.currentLevel = save.level;
            this.undoStack = [];

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
                    const block = this.add.image(x, y, this.colorNames[cell.color]);
                    block.setInteractive({ useHandCursor: true });
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
                const block = this.add.image(x, y, this.colorNames[hd.color]);
                block.setInteractive({ useHandCursor: true });
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

    private createBoard() {
        this.board = [];
        const startX = BOARD_OFFSET_X;
        const startY = BOARD_OFFSET_Y;

        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            this.board[row] = [];
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                const x = startX + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const y = startY + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;

                const colorIdx = Math.floor(Math.random() * 6);
                const block = this.add.image(x, y, this.colorNames[colorIdx]);
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
        this.holdIndicator.fillRoundedRect(holdStartX - 10, holdY - 40, HOLD_SLOTS * HOLD_DX + 20, 80, 15);
    }

    private setupInputHandlers() {
        // Block click/hold detection
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const boardY = BOARD_OFFSET_Y;
            const boardHeight = BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + CELL_SIZE;

            if (pointer.y >= boardY && pointer.y <= boardY + boardHeight) {
                if (this.levelCleared) return;
                const col = Math.floor((pointer.x - BOARD_OFFSET_X) / (CELL_SIZE + CELL_GAP));
                const row = Math.floor((pointer.y - boardY) / (CELL_SIZE + CELL_GAP));

                if (row >= 0 && row < BOARD_SIZE.rows && col >= 0 && col < BOARD_SIZE.cols) {
                    if (!this.board[row][col].isHeld) {
                        this.selectBlock(this.board[row][col]);
                        this.armHoldTimer();
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
                        HOLD_START_X - 10, holdY - 40, HOLD_SLOTS * HOLD_DX + 20, 80, 15
                    );
                } else {
                    this.holdIndicator.setAlpha(0.2);
                    this.holdIndicator.fillStyle(0x4CAF50, 0.2);
                    this.holdIndicator.clear();
                    this.holdIndicator.fillRoundedRect(
                        HOLD_START_X - 10, holdY - 40, HOLD_SLOTS * HOLD_DX + 20, 80, 15
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

        if (this.isHoldingBlock && pointer.y > HOLD_DROP_TOP && pointer.y < HOLD_DROP_BOTTOM) {
            const col = Math.floor((pointer.x - HOLD_START_X) / HOLD_DX);
            const slotIdx = Math.max(0, Math.min(HOLD_SLOTS - 1, col));

            if (this.holdSlots[slotIdx].block === undefined) {
                this.moveBlockToHold(this.selectedBlock, slotIdx);
            }
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

                    // Calculate score
                    const points = bestMatch.count * 10;
                    this.score += points;
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
                    const colorIdx = Math.floor(Math.random() * 6);
                    const newBlock = this.add.image(
                        BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                        -CELL_SIZE,
                        this.colorNames[colorIdx]
                    );
                    newBlock.setInteractive({ useHandCursor: true });
                    newBlock.column = col;
                    newBlock.row = row;
                    newBlock.isHeld = false;
                    newBlock.holdingSlot = -1;
                    newBlock.setData('color', colorIdx);

                    this.tweens.add({
                        targets: newBlock,
                        y: BOARD_OFFSET_Y + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                        duration: 400,
                        ease: 'Cubic.easeOut',
                    });

                    this.board[row][col] = newBlock;
                }
            }
        }
    }

    private updateUI() {
        this.registry.set('hud', {
            score: this.score,
            moves: this.movesLeft,
            level: this.currentLevel,
            undosLeft: 3 - this.undoStack.length,  // max 3 undos per level
            boostersUsed: this.boostersUsed,
        });

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
            board: boardSnapshot,
            heldSlots: heldBlocks,
        });
    }

    private showLevelClear() {
        const nextLevel = this.currentLevel + 1 < LEVELS.length;
        const overlay = this.add.rectangle(360, 640, 720, 1280, 0x000000, 0.8);
        const title = this.add.text(360, 520, 'LEVEL CLEAR!', {
            fontSize: '56px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        const score = this.add.text(360, 610, `Score: ${this.score} / ${LEVELS[this.currentLevel].target}`, {
            fontSize: '30px',
            fontFamily: 'Arial',
            color: '#FFFFFF',
        }).setOrigin(0.5);
        const btn = this.add.container(360, 740);
        const btnBg = this.add.image(0, 0, 'restart');
        const btnText = this.add.text(0, 0, nextLevel ? 'NEXT LEVEL' : 'YOU WIN!', {
            fontSize: '28px',
            fontFamily: 'Arial Black',
            color: '#FFFFFF',
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
                this.scene.restart();
            } else {
                clearSave();
                this.scene.start('MenuScene');
            }
        });
    }

    private gameOver() {
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
            color: '#FFFFFF',
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

        this.undoStack.push({
            boardState,
            movesLeft: this.movesLeft,
            score: this.score,
            level: this.currentLevel,
            slotCount: this.holdSlots.length,
        });
    }

    private undoLastMove() {
        if (this.undoStack.length === 0) return;
        if (this.boostersUsed.undo >= BOOSTER_COUNTS.undo) return;

        const lastState = this.undoStack.pop();
        if (!lastState) return;

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

                const block = this.add.image(x, y, this.colorNames[cell.color]);
                block.setInteractive({ useHandCursor: true });
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
        this.boostersUsed.undo++;  // count the undo as a booster use
        this.updateUI();
    }

    private boostersUsed = { undo: 0, slot: 0, shuffle: 0 };

    private useBooster(action: string) {
        if (this.boostersUsed[action as keyof typeof this.boostersUsed] >= BOOSTER_COUNTS[action as keyof typeof BOOSTER_COUNTS]) {
            return;  // already used
        }
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
        }
        this.updateUI();
    }

    private addExtraSlot() {
        if (this.holdSlots.length >= 8) return; // Cap at 8 slots

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
        // Collect all current colors
        const colors: number[] = [];
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (this.board[row][col]) {
                    colors.push(this.board[row][col].getData('color'));
                }
            }
        }

        // Shuffle colors
        for (let i = colors.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [colors[i], colors[j]] = [colors[j], colors[i]];
        }

        // Apply shuffled colors
        let idx = 0;
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (this.board[row][col]) {
                    this.board[row][col].setData('color', colors[idx++]);
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

    private setupBoosterButtons() {
        // Undo button
        this.undoBtn = this.add.container(100, 700, [
            this.add.image(0, 0, 'restart'), // reuse restart texture
            this.add.text(0, 0, 'UNDO', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF',
            }).setOrigin(0.5),
        ]);
        this.undoBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.undoBtn.on('pointerdown', () => this.undoLastMove());

        // Slot button
        this.slotBtn = this.add.container(360, 700, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, '+1 SLOT', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF',
            }).setOrigin(0.5),
        ]);
        this.slotBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.slotBtn.on('pointerdown', () => this.addExtraSlot());

        // Shuffle button
        this.shuffleBtn = this.add.container(620, 700, [
            this.add.image(0, 0, 'restart'),
            this.add.text(0, 0, 'SHUFFLE', {
                fontSize: '16px',
                fontFamily: 'Arial Black',
                color: '#FFFFFF',
            }).setOrigin(0.5),
        ]);
        this.shuffleBtn.setInteractive(new Phaser.Geom.Rectangle(-50, -20, 100, 40), Phaser.Geom.Rectangle.Contains);
        this.shuffleBtn.on('pointerdown', () => this.shuffleBoard());
    }
}

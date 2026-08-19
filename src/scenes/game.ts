import Phaser from 'phaser';
import { COLORS, BOARD_SIZE, CELL_SIZE, CELL_GAP, BOARD_OFFSET_X, BOARD_OFFSET_Y, LEVELS } from '../config';

export default class GameScene extends Phaser.Scene {
    private board: any[][] = [];
    private holdSlots: any[] = [];
    private selectedBlock: any = null;
    private isHoldingBlock: boolean = false;
    private holdTimer: Phaser.Time.TimerEvent | null = null;
    private score: number = 0;
    private movesLeft: number = 30;
    private currentLevel: number = 0;
    
    private scoreText: Phaser.GameObjects.Text;
    private movesText: Phaser.GameObjects.Text;
    private levelText: Phaser.GameObjects.Text;
    private holdIndicator: Phaser.GameObjects.Graphics;
    
    private colorNames = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'];
    private colorValues = [0xFF6B6B, 0xFF8E53, 0xFFC733, 0x4CAF50, 0x2196F3, 0x7C4DFF];

    constructor() {
        super({ key: 'GameScene' });
    }

    create() {
        this.createBackground();
        this.createUI();
        this.createBoard();
        this.createHoldSlots();
        this.createHoldIndicator();
        this.setupInputHandlers();
        this.fillBoard();
        this.updateUI();
    }

    private createBackground() {
        this.add.rectangle(0, 0, 720, 1280, 0x1a1a2e).setOrigin(0, 0);
    }

    private createUI() {
        // Score text
        this.scoreText = this.add.text(50, 50, 'Score: 0', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        });

        // Moves text
        this.movesText = this.add.text(550, 50, 'Moves: 30', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        });

        // Level text
        this.levelText = this.add.text(360, 50, 'Level 1', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5);
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
                
                const block = this.add.image(x, y, 'block');
                block.setInteractive({ useHandCursor: true });
                block.column = col;
                block.row = row;
                block.isHeld = false;
                block.holdingSlot = -1;
                block.setData('color', Math.floor(Math.random() * 6));
                
                this.board[row][col] = block;
            }
        }
    }

    private createHoldSlots() {
        this.holdSlots = [];
        const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
        const holdStartX = (720 - 7 * (CELL_SIZE + 10)) / 2;
        
        for (let i = 0; i < 7; i++) {
            const x = holdStartX + i * (CELL_SIZE + 10) + CELL_SIZE / 2;
            
            // Hold slot background
            const slotBg = this.add.rectangle(x, holdY, CELL_SIZE, CELL_SIZE, 0x000000, 0.3);
            slotBg.setAngle(0);
            slotBg.setStrokeStyle(1, 0xFFFFFF, 0.3);
            slotBg.x = x;
            slotBg.y = holdY;
            slotBg.slotIndex = i;
            
            this.holdSlots.push(slotBg);
        }
    }

    private createHoldIndicator() {
        const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 100;
        const holdStartX = (720 - 7 * (CELL_SIZE + 10)) / 2;
        
        this.holdIndicator = this.add.graphics();
        this.holdIndicator.fillStyle(0x4CAF50, 0.2);
        this.holdIndicator.fillRoundedRect(holdStartX - 10, holdY - 40, 7 * (CELL_SIZE + 10) + 20, 80, 15);
    }

    private setupInputHandlers() {
        // Block click/hold detection
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const boardY = BOARD_OFFSET_Y;
            const boardHeight = BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + CELL_SIZE;
            
            if (pointer.y >= boardY && pointer.y <= boardY + boardHeight) {
                const col = Math.floor((pointer.x - BOARD_OFFSET_X) / (CELL_SIZE + CELL_GAP));
                const row = Math.floor((pointer.y - boardY) / (CELL_SIZE + CELL_GAP));
                
                if (row >= 0 && row < BOARD_SIZE.rows && col >= 0 && col < BOARD_SIZE.cols) {
                    if (!this.board[row][col].isHeld) {
                        this.selectBlock(this.board[row][col]);
                    }
                }
            }
        });
        
        // Drag detection
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.selectedBlock && this.isHoldingBlock) {
                // Check if block is in hold zone
                const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
                if (pointer.y > holdY - 50 && pointer.y < holdY + 100) {
                    this.holdIndicator.setAlpha(0.5);
                    this.holdIndicator.fillStyle(0x4CAF50, 0.4);
                    this.holdIndicator.clear();
                    this.holdIndicator.fillRoundedRect(
                        holdStartX - 10, holdY - 40, 7 * (CELL_SIZE + 10) + 20, 80, 15
                    );
                } else {
                    this.holdIndicator.setAlpha(0.2);
                    this.holdIndicator.fillStyle(0x4CAF50, 0.2);
                    this.holdIndicator.clear();
                    this.holdIndicator.fillRoundedRect(
                        holdStartX - 10, holdY - 40, 7 * (CELL_SIZE + 10) + 20, 80, 15
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

    private holdStartX = (720 - 7 * (CELL_SIZE + 10)) / 2;

    private selectBlock(block: any) {
        this.selectedBlock = block;
        
        if (this.holdTimer) {
            this.holdTimer.remove();
            this.holdTimer = null;
        }
    }

    private releaseBlock(pointer: Phaser.Input.Pointer) {
        if (!this.selectedBlock) return;
        
        const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
        
        if (this.isHoldingBlock && pointer.y > holdY - 50 && pointer.y < holdY + 100) {
            // Drop block in hold slot
            const col = Math.floor((pointer.x - BOARD_OFFSET_X) / (CELL_SIZE + 10));
            const slotIdx = Math.max(0, Math.min(6, col));
            
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
        const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
        const holdStartX = this.holdStartX;
        
        const targetX = holdStartX + slotIndex * (CELL_SIZE + 10) + CELL_SIZE / 2;
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
        // Check for 3+ consecutive blocks in hold slots
        let consecutiveCount = 1;
        let startSlot = 0;
        let bestMatch = { count: 0, start: 0 };
        
        for (let i = 1; i < 7; i++) {
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
        
        // Check the last sequence
        if (consecutiveCount > bestMatch.count) {
            bestMatch = { count: consecutiveCount, start: startSlot };
        }
        
        if (bestMatch.count >= 3) {
            // Found a match!
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
                },
            });
        } else {
            // Return blocks to board
            for (let i = 0; i < 7; i++) {
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
        const holdY = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
        
        for (let row = 0; row < BOARD_SIZE.rows; row++) {
            for (let col = 0; col < BOARD_SIZE.cols; col++) {
                if (!this.board[row][col]) {
                    const newBlock = this.add.image(
                        BOARD_OFFSET_X + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2,
                        -CELL_SIZE,
                        'block'
                    );
                    newBlock.setInteractive({ useHandCursor: true });
                    newBlock.column = col;
                    newBlock.row = row;
                    newBlock.isHeld = false;
                    newBlock.holdingSlot = -1;
                    newBlock.setData('color', Math.floor(Math.random() * 6));
                    
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
        this.scoreText.setText(`Score: ${this.score}`);
        this.movesText.setText(`Moves: ${this.movesLeft}`);
        this.levelText.setText(`Level ${this.currentLevel + 1}`);
        
        // Check game over
        if (this.movesLeft <= 0) {
            this.gameOver();
        }
    }

    private gameOver() {
        console.log('Game Over!');
        // Show game over screen
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
        restartBtn.setInteractive({ useHandCursor: true });
        restartBtn.on('pointerdown', () => this.scene.restart());
    }
}

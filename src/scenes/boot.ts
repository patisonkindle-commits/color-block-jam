import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Real Kenney assets (puzzle pack, CC0) loaded by PreloadScene:
        // red/yellow/green/blue/purple squares + ui buttons (play/restart keys).
        // Kenney pack has no orange/cyan square → those stay procedural here.
        // Button textures (play/restart) are real assets too — no procedural fallback needed.
        this.createBlockTexture('orange', 0xFF8E53);
        this.createBlockTexture('cyan', 0x00E5FF);
        this.createStoneTexture();
    }

    create() {
        this.scene.start('PreloadScene');
    }

    private createBlockTexture(key: string, color: number) {
        const graphics = this.add.graphics();

        // Main block
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(0, 0, 70, 70, 12);

        // Highlight
        graphics.fillStyle(0xFFFFFF, 0.3);
        graphics.fillRoundedRect(5, 5, 30, 30, 8);

        // Border
        graphics.lineStyle(2, 0x000000, 0.3);
        graphics.strokeRoundedRect(0, 0, 70, 70, 12);

        graphics.generateTexture(key, 70, 70);
        graphics.destroy();
    }

    private createStoneTexture() {
        const graphics = this.add.graphics();

        // Stone body — gray, no glossy highlight, distinct from block colors
        graphics.fillStyle(0x8A8A8A, 1);
        graphics.fillRoundedRect(0, 0, 70, 70, 10);

        // Dull facet patches (2 diagonal lighter spots) — reads as rock, not a block
        graphics.fillStyle(0xA8A8A8, 0.7);
        graphics.fillRoundedRect(8, 8, 26, 26, 6);
        graphics.fillStyle(0x6E6E6E, 0.7);
        graphics.fillRoundedRect(38, 40, 24, 24, 6);

        // Border
        graphics.lineStyle(2, 0x444444, 0.8);
        graphics.strokeRoundedRect(0, 0, 70, 70, 10);

        graphics.generateTexture('stone', 70, 70);
        graphics.destroy();
    }
}
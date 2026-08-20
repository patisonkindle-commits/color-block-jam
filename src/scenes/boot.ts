import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Real Kenney assets (puzzle pack, CC0) loaded by PreloadScene:
        // red/yellow/green/blue/purple squares + ui buttons (play/restart keys).
        // Kenney pack has no orange square → orange stays procedural here.
        // Button textures (play/restart) are real assets too — no procedural fallback needed.
        this.createBlockTexture('orange', 0xFF8E53);
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
}
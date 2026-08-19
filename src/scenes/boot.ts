import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() {
        super({ key: 'BootScene' });
    }

    preload() {
        // Create placeholder textures
        this.createBlockTexture('red', 0xFF6B6B);
        this.createBlockTexture('orange', 0xFF8E53);
        this.createBlockTexture('yellow', 0xFFC733);
        this.createBlockTexture('green', 0x4CAF50);
        this.createBlockTexture('blue', 0x2196F3);
        this.createBlockTexture('purple', 0x7C4DFF);
        
        this.createButtonTexture('play', 0x4CAF50);
        this.createButtonTexture('settings', 0x607D8B);
        this.createButtonTexture('restart', 0xFF9800);
    }

    create() {
        this.scene.start('MenuScene');
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

    private createButtonTexture(key: string, color: number) {
        const graphics = this.add.graphics();
        
        graphics.fillStyle(color, 0.9);
        graphics.fillRoundedRect(0, 0, 180, 70, 15);
        
        graphics.lineStyle(2, 0xFFFFFF, 0.3);
        graphics.strokeRoundedRect(0, 0, 180, 70, 15);
        
        graphics.generateTexture(key, 180, 70);
        graphics.destroy();
    }
}

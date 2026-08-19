/// <reference types="vite/client" />
import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
    private progressBox!: Phaser.GameObjects.Rectangle;
    private progressBar!: Phaser.GameObjects.Rectangle;
    private barFillWidth: number = 0;
    private loadingText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload() {
        // Progress bar visuals
        this.add.rectangle(0, 0, 720, 1280, 0x1a1a2e).setOrigin(0, 0);
        this.loadingText = this.add.text(360, 560, 'Loading...', {
            fontSize: '32px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.progressBox = this.add.rectangle(360, 640, 400, 40, 0x000000, 0.4);
        this.progressBox.setStrokeStyle(2, 0xFFFFFF, 0.5);
        this.progressBar = this.add.rectangle(
            360 - 200, 640, 0, 34, 0x4CAF50, 0.9
        ).setOrigin(0, 0.5);
        this.barFillWidth = 400;

        this.load.on('progress', (value: number) => {
            this.progressBar.width = Math.max(0, Math.min(this.barFillWidth, value * this.barFillWidth));
        });
        this.load.on('complete', () => {
            this.loadingText.setText('Done!');
        });

        // Try to load real assets if present; graceful skip when dirs are empty
        // (all assets are procedural textures for now — BootScene generates them)
        this.loadExistingAssets();
    }

    create() {
        this.scene.start('MenuScene');
    }

    private loadExistingAssets() {
        // Vite copies e.g. `assets/sprites/x/y.png` to `assets/...` verbatim
        // (publicDir). Probe each via glob-import so build-time entry exists;
        // missing files simply don't match and are skipped silently.
        const images = import.meta.glob('/assets/sprites/**/*.{png,jpg,jpeg,webp}');
        Object.entries(images).forEach(([path]) => {
            const key = path.replace('/assets/', '').replace(/\.[^.]+$/, '')
                .replace(/[\/\\]/g, '-');
            this.load.image(key, path);
        });
    }
}
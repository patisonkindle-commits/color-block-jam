/// <reference types="vite/client" />
import Phaser from 'phaser';

import redUrl from '../../assets/sprites/blocks/red.png';
import yellowUrl from '../../assets/sprites/blocks/yellow.png';
import greenUrl from '../../assets/sprites/blocks/green.png';
import blueUrl from '../../assets/sprites/blocks/blue.png';
import purpleUrl from '../../assets/sprites/blocks/purple.png';
import btnUrl from '../../assets/sprites/ui/btn.png';
import btnAltUrl from '../../assets/sprites/ui/btn_alt.png';

// Kenney puzzle pack (CC0). No orange square in pack — orange stays procedural.
const ASSETS: [string, string][] = [
    ['red', redUrl],
    ['yellow', yellowUrl],
    ['green', greenUrl],
    ['blue', blueUrl],
    ['purple', purpleUrl],
    ['restart', btnUrl],
    ['play', btnAltUrl],
];

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

        ASSETS.forEach(([key, url]) => this.load.image(key, url));
    }

    create() {
        this.scene.start('MenuScene');
    }
}
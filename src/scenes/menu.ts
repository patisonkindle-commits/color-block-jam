import Phaser from 'phaser';

import { hasSave, loadGame } from './systems/save';

export default class MenuScene extends Phaser.Scene {
    private continueBtn!: Phaser.GameObjects.Container;
    private continueText!: Phaser.GameObjects.Text;

    create() {
        this.add.rectangle(0, 0, 720, 1280, 0x1a1a2e).setOrigin(0, 0);
        
        this.add.text(360, 300, 'COLOR\nBLOCK JAM', {
            fontSize: '64px',
            fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#FFFFFF',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);
        
        this.add.text(360, 420, 'Match 3+ blocks to score!', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA',
            align: 'center',
        }).setOrigin(0.5);

        const has = hasSave();
        const save = has ? loadGame() : null;

        // Play button
        const playBtn = this.add.container(360, 600);
        const playBg = this.add.image(0, 0, 'play');
        const playText = this.add.text(0, 0, 'PLAY', {
            fontSize: '32px',
            fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        playBtn.add([playBg, playText]);
        playBtn.setInteractive(new Phaser.Geom.Rectangle(-120, -30, 240, 60), Phaser.Geom.Rectangle.Contains);
        playBtn.on('pointerdown', () => {
            this.scene.start('GameScene');
        });

        // CONTINUE button (only if save exists)
        if (has) {
            const yPos = 720;
            this.continueBtn = this.add.container(360, yPos);
            const cBg = this.add.image(0, 0, 'play');
            this.continueText = this.add.text(0, 0, 'CONTINUE', {
                fontSize: '28px',
                fontFamily: 'Arial Black, Arial, sans-serif',
                color: '#FFD700',
                fontStyle: 'bold',
            }).setOrigin(0.5);
            this.continueBtn.add([cBg, this.continueText]);
            this.continueBtn.setInteractive(new Phaser.Geom.Rectangle(-120, -30, 240, 60), Phaser.Geom.Rectangle.Contains);
            this.continueBtn.on('pointerdown', () => {
                // Load save → set GameScene.currentLevel before GameScene.create reads it
                if (save) {
                    (this.game as any).scene.get('GameScene').currentLevel = save.level;
                }
                this.scene.start('GameScene');
            });
        }
    }
}

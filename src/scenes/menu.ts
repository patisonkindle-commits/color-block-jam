import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MenuScene' });
    }

    create() {
        // Background
        this.add.rectangle(0, 0, 720, 1280, 0x1a1a2e).setOrigin(0, 0);
        
        // Title
        this.add.text(360, 300, 'COLOR\nBLOCK JAM', {
            fontSize: '64px',
            fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#FFFFFF',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4,
        }).setOrigin(0.5);
        
        // Subtitle
        this.add.text(360, 420, 'Match 3+ blocks to score!', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            color: '#AAAAAA',
            align: 'center',
        }).setOrigin(0.5);
        
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
        playBtn.on('pointerdown', () => this.playGame());
        
        // Settings button
        const settingsBtn = this.add.container(360, 720);
        const settingsBg = this.add.image(0, 0, 'settings');
        const settingsText = this.add.text(0, 0, 'SETTINGS', {
            fontSize: '28px',
            fontFamily: 'Arial Black, Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
        }).setOrigin(0.5);
        settingsBtn.add([settingsBg, settingsText]);
        settingsBtn.setInteractive(new Phaser.Geom.Rectangle(-110, -25, 220, 50), Phaser.Geom.Rectangle.Contains);
        settingsBtn.on('pointerdown', () => this.showSettings());
    }

    private playGame() {
        this.scene.start('GameScene');
    }

    private showSettings() {
        console.log('Settings clicked');
    }
}

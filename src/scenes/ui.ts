import Phaser from 'phaser';
import { LEVELS } from '../config';

export default class UIScene extends Phaser.Scene {
    private scoreText!: Phaser.GameObjects.Text;
    private movesText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private undoText!: Phaser.GameObjects.Text;
    private comboText!: Phaser.GameObjects.Text;
    private progressBar!: Phaser.GameObjects.Graphics;
    private progressBg!: Phaser.GameObjects.Graphics;

    constructor() {
        super({ key: 'UIScene' });
    }

    create() {
        // Top bar HUD — rendered above GameScene, no interaction with board drags
        this.scoreText = this.add.text(50, 50, 'Score: 0', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(1000);

        this.movesText = this.add.text(550, 50, 'Moves: 30', {
            fontSize: '28px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFFFFF',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
        }).setScrollFactor(0).setDepth(1000);

        this.levelText = this.add.text(360, 50, 'Level 1', {
            fontSize: '24px',
            fontFamily: 'Arial, sans-serif',
            color: '#FFD700',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        this.undoText = this.add.text(360, 90, 'Undo: 3', {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            color: '#4CAF50',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000);

        // Combo indicator — top-left below score
        this.comboText = this.add.text(50, 95, '', {
            fontSize: '18px',
            fontFamily: 'Arial Black',
            color: '#FFD700',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setScrollFactor(0).setDepth(1000).setVisible(false);

        // Progress bar — under top bar, width = how close to target
        this.progressBg = this.add.graphics().setScrollFactor(0).setDepth(999);
        this.progressBar = this.add.graphics().setScrollFactor(0).setDepth(1000);

        // React to GameScene HUD updates via registry
        const update = (key: string, value: any) => {
            if (!value) return;
            this.scoreText.setText(`Score: ${value.score ?? 0}`);
            this.movesText.setText(`Moves: ${value.moves ?? 0}`);
            this.levelText.setText(`Level ${(value.level ?? 0) + 1}`);

            // Show undo count (max 3 per level, used ones dimmed)
            const undosLeft = value.undosLeft ?? 3;
            if (this.undoText) {
                this.undoText.setText(undosLeft > 0 ? `Undo: ${undosLeft}` : 'Undo: 0');
                this.undoText.setColor(undosLeft > 0 ? '#4CAF50' : '#FF6B6B');
            }

            // Combo indicator: show active combo multiplier
            const combo = value.combo ?? 0;
            const mult = [1, 1.5, 2][combo] ?? 1;
            if (combo > 0) {
                this.comboText.setText(`COMBO ×${mult}`);
                this.comboText.setVisible(true);
                this.comboText.setColor(mult >= 2 ? '#FF8E53' : '#FFD700');
            } else {
                this.comboText.setVisible(false);
            }

            // Progress bar toward target
            const target = value.target ?? LEVELS[0].target;
            const pct = Math.min(1, (value.score ?? 0) / target);
            this.progressBg.clear().fillStyle(0xFFFFFF, 0.2).fillRoundedRect(50, 130, 620, 12, 6);
            this.progressBar.clear().fillStyle(pct >= 1 ? 0x4CAF50 : 0xFFD700).fillRoundedRect(50, 130, 620 * pct, 12, 6);
        };
        this.registry.events.on('changedata-hud', update);
        update('hud', this.registry.get('hud'));
    }

    // Forward booster button callbacks into GameScene via registry
    onBoosterClick(action: string) {
        const gameScene = this.scene.get('GameScene') as Phaser.Scene;
        if (gameScene && (gameScene as any).useBooster) {
            (gameScene as any).useBooster(action);
        }
    }
}
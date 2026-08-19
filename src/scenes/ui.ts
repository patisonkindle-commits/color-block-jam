import Phaser from 'phaser';

export default class UIScene extends Phaser.Scene {
    private scoreText!: Phaser.GameObjects.Text;
    private movesText!: Phaser.GameObjects.Text;
    private levelText!: Phaser.GameObjects.Text;
    private undoText!: Phaser.GameObjects.Text;

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
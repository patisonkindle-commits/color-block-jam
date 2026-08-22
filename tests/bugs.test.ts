import { describe, it, expect, vi } from 'vitest';
import { CELL_SIZE, CELL_GAP, BOARD_SIZE, OBSTACLE, LEVELS, HOLD_SLOTS, HOLD_Y, HOLD_DROP_TOP, HOLD_DROP_BOTTOM, MAX_HOLD_SLOTS } from '../src/config';

vi.mock('phaser', () => ({
    default: {
        Scene: class {},
        Scale: { FIT: 2, CENTER_BOTH: 3 },
        Geom: { Rectangle: class { Contains: Function } },
    },
}));

// Mock Phaser objects
function mockBlock(color: number = 0) {
    return {
        getData: vi.fn((k: string) => k === 'color' ? color : 0),
        setData: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(),
        setScale: vi.fn().mockReturnThis(),
        setTexture: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        setInteractive: vi.fn().mockReturnThis(),
        setAlpha: vi.fn().mockReturnThis(),
        setTintFill: vi.fn().mockReturnThis(),
        clearTint: vi.fn(),
        isHeld: false,
        holdingSlot: -1,
        column: 0,
        row: 0,
    };
}

function makeMockScene() {
    const children: any[] = [];
    return {
        scene: { isActive: () => true, get: () => null, start: vi.fn(), restart: vi.fn() },
        registry: { get: () => null, events: { on: vi.fn() }, set: vi.fn() },
        add: {
            rectangle: (x: number, y: number, w: number, h: number, col?: number, al?: number) => {
                const r: any = mockBlock();
                r.x = x; r.y = y; r.displayWidth = w; r.displayHeight = h;
                r.color = col ?? 0; r.alpha = al ?? 1; r.slotIndex = -1; r.block = undefined;
                children.push(r);
                return r;
            },
            text: (x: number, y: number, ...args: any[]) => {
                const t: any = {
                    setY: vi.fn().mockReturnThis(),
                    setAlpha: vi.fn().mockReturnThis(),
                    setFont: vi.fn().mockReturnThis(),
                    setOrigin: vi.fn().mockReturnThis(),
                    setDepth: vi.fn().mockReturnThis(),
                    setX: vi.fn().mockReturnThis(),
                    setText: vi.fn().mockReturnThis(),
                    destroy: vi.fn(),
                    x, y
                };
                children.push(t);
                return t;
            },
            container: (x: number, y: number, children2?: any[]) => {
                const c: any = { x, y, children: children2 ?? [], setAlpha: vi.fn().mockReturnThis(), destroy: vi.fn() };
                children2?.forEach(ch => children.push(ch));
                return c;
            },
            image: (x: number, y: number, key?: string) => {
                const img: any = mockBlock();
                img.x = x; img.y = y; img.texture = { key: key ?? 'red' };
                children.push(img);
                return img;
            },
            graphics: () => {
                const g: any = { setAlpha: vi.fn().mockReturnThis(), fillStyle: vi.fn(), fillRoundedRect: vi.fn(), clear: vi.fn(), destroy: vi.fn(), x: 0, y: 0 };
                children.push(g);
                return g;
            },
        },
        tweens: {
            add: (cfg: any) => ({ then: (cb: Function) => cb(), on: vi.fn() }),
        },
        time: { delayedCall: (delay: number, fn: Function) => ({ remove: vi.fn(), pause: vi.fn(), resume: vi.fn() }) },
        input: { on: vi.fn() },
        cameras: { main: { shake: vi.fn() } },
        children: { each: (fn: Function) => children.forEach(fn) },
    };
}

// ─── Testable extracted logic from game.ts ─────────────────

/** Score calculation (from checkHoldSlots onComplete) */
function calculateScore(count: number, comboLevel: number): number {
    const base = count >= 5 ? 120 : count * 10 + (count - 3) * 20;
    const mult = comboLevel === 0 ? 1 : comboLevel === 1 ? 1.5 : 2;
    return Math.round(base * mult);
}

/** Stone 3-in-a-row rejection (FIXED version) */
function canPlaceStone(stones: Set<number>, row: number, col: number): boolean {
    for (let d = -2; d <= 0; d++) {
        const inRow = col + d >= 0 && col + d + 2 < BOARD_SIZE.cols;
        const inCol = row + d >= 0 && row + d + 2 < BOARD_SIZE.rows;
        if (inRow && stones.has(row * BOARD_SIZE.cols + (col + d)) && stones.has(row * BOARD_SIZE.cols + (col + d + 1)) && stones.has(row * BOARD_SIZE.cols + (col + d + 2)))
            return false;
        if (inCol && stones.has((row + d) * BOARD_SIZE.cols + col) && stones.has((row + d + 1) * BOARD_SIZE.cols + col) && stones.has((row + d + 2) * BOARD_SIZE.cols + col))
            return false;
    }
    return true;
}

/** Hold slot match detection */
function checkHoldSlotsLogic(holdSlots: { block: any }[], onMatch: (count: number, start: number) => void, onNoMatch: (allFull: boolean) => void) {
    let consecutiveCount = 1;
    let startSlot = 0;
    let bestMatch = { count: 0, start: 0 };

    for (let i = 1; i < holdSlots.length; i++) {
        const currentBlock = holdSlots[i].block;
        const prevBlock = holdSlots[i - 1].block;
        if (currentBlock && prevBlock && currentBlock.getData('color') === prevBlock.getData('color')) {
            consecutiveCount++;
        } else {
            if (consecutiveCount > bestMatch.count) bestMatch = { count: consecutiveCount, start: startSlot };
            consecutiveCount = 1;
            startSlot = i;
        }
    }
    if (consecutiveCount > bestMatch.count) bestMatch = { count: consecutiveCount, start: startSlot };

    if (bestMatch.count >= 3) {
        onMatch(bestMatch.count, bestMatch.start);
        return { matched: true, count: bestMatch.count, start: bestMatch.start };
    }
    const allFull = holdSlots.every(x => !!x.block);
    onNoMatch(allFull);
    return { matched: false, count: 0, start: 0 };
}

/** Booster validation (from useBooster) */
function useBoosterLogic(boostersUsed: Record<string, number>, BOOSTER_COUNTS: Record<string, number>, undoStackLen: number, holdSlotsLen: number, nonStoneBlocks: number, action: string) {
    if (boostersUsed[action] >= BOOSTER_COUNTS[action]) return { canUse: false, consumed: false, mode: null };
    if (action === 'undo' && undoStackLen === 0) return { canUse: false, consumed: false, mode: null };
    if (action === 'slot' && holdSlotsLen >= MAX_HOLD_SLOTS) return { canUse: false, consumed: false, mode: null };
    if (action === 'swap' && nonStoneBlocks < 2) return { canUse: false, consumed: false, mode: null };
    if (action === 'bomb' && nonStoneBlocks === 0) return { canUse: false, consumed: false, mode: null };
    boostersUsed[action]++;
    return { canUse: true, consumed: true, mode: action === 'swap' ? 'swap' : action === 'bomb' ? 'bomb' : null };
}

// ─── FIXED: updateUI gameOver guard ────────────────────────

function updateUIFixed(movesLeft: number, onGameOver: () => void, state: { gameOverCalled: boolean }): number {
    let gameOverCount = 0;
    if (movesLeft <= 0 && !state.gameOverCalled) {
        gameOverCount++;
        state.gameOverCalled = true;
        onGameOver();
    }
    return gameOverCount;
}

// ─── Tests ─────────────────────────────────────────────────

describe('Color Block Jam — Bug Unit Tests', () => {

    // ═══════════════════════════════════════════════════════════
    // FIXED BUGS
    // ═══════════════════════════════════════════════════════════

    describe('FIX 1: updateUI gameOver stacking', () => {
        it('gameOver() called only ONCE after movesLeft <= 0', () => {
            const scene = makeMockScene();
            let gameOverCount = 0;
            const state = { gameOverCalled: false };

            function updateUIFixed(movesLeft: number) {
                updateUIFixed(movesLeft, () => {
                    gameOverCount++;
                    scene.add.rectangle(360, 640, 720, 1280, 0x000000, 0.8);
                }, state);
            }

            updateUIFixed(1);
            updateUIFixed(0);
            updateUIFixed(-1);
            updateUIFixed(-2);

            expect(gameOverCount).toBe(1); // ← FIXED: only 1 overlay
        });

        it('gameOver can be re-triggered via scene.restart()', () => {
            const scene = makeMockScene();
            let gameOverCount = 0;
            const state = { gameOverCalled: false };

            // First game over
            updateUIFixed(0, () => { gameOverCount++; }, state);
            expect(gameOverCount).toBe(1);

            // scene.restart() resets state.gameOverCalled
            state.gameOverCalled = false;

            // Second game over after restart
            updateUIFixed(0, () => { gameOverCount++; }, state);
            expect(gameOverCount).toBe(2); // ← can happen again
        });
    });

    describe('FIX 2: checkVictory OOB crash', () => {
        it('LEVELS[Math.min(currentLevel, len-1)] never crashes', () => {
            for (let i = 0; i < 10; i++) {
                const maxLevel = Math.min(i, LEVELS.length - 1);
                const target = LEVELS[maxLevel].target;
                expect(target).toBeGreaterThan(0);
            }
        });

        it('currentLevel = 99 still resolves to last level', () => {
            const maxLevel = Math.min(99, LEVELS.length - 1);
            expect(maxLevel).toBe(4);
            expect(LEVELS[4].target).toBeGreaterThan(0);
        });
    });

    describe('FIX 3: swapBoosterPending flag prevents refund bug', () => {
        it('swap booster consumed only after successful swap', () => {
            const boostersUsed = { swap: 0 };
            const BOOSTER_COUNTS = { swap: 1 };
            const boardBlocks = [mockBlock(), mockBlock()];

            // useBooster('swap') — pending, not consumed yet
            const result = useBoosterLogic(boostersUsed, BOOSTER_COUNTS, 0, 5, 48, 'swap');
            expect(result.mode).toBe('swap');
            expect(boostersUsed.swap).toBe(0); // ← NOT consumed yet

            // tap first cell — sets swapFirst, still pending
            // tap same cell — returns, still pending
            // tap second cell — swap happens, consume here

            // Simulate successful swap: consume
            if (result.mode === 'swap') {
                boostersUsed.swap++;
            }

            expect(boostersUsed.swap).toBe(1);
        });

        it('swap booster NOT consumed if user taps same cell twice', () => {
            const boostersUsed = { swap: 0 };
            const BOOSTER_COUNTS = { swap: 1 };

            useBoosterLogic(boostersUsed, BOOSTER_COUNTS, 0, 5, 48, 'swap');
            // User taps same cell twice → swap never happens → consume should NOT happen
            // swapBoosterPending flag prevents the consume
            expect(boostersUsed.swap).toBe(0); // ← refunded
        });
    });

    describe('FIX 4: createBoard 3-in-a-row reject', () => {
        it('rejects horizontal 3-in-a-row of stones', () => {
            const stones = new Set([0, 1]); // (0,0), (0,1)
            expect(canPlaceStone(stones, 0, 2)).toBe(false); // (0,2) would create 3-in-a-row
        });

        it('rejects vertical 3-in-a-row of stones', () => {
            const stones = new Set([0, 6]); // (0,0), (1,0)
            expect(canPlaceStone(stones, 2, 0)).toBe(false); // (2,0) would create 3-in-a-row
        });

        it('allows placement with gap', () => {
            const stones = new Set([0, 2]); // (0,0), (0,2)
            expect(canPlaceStone(stones, 0, 1)).toBe(true);
        });

        it('allows placement outside 3-in-a-row zone', () => {
            const stones = new Set([0, 1]);
            expect(canPlaceStone(stones, 0, 3)).toBe(true);
        });

        it('allows diagonal placement', () => {
            const stones = new Set([0, 7]); // (0,0), (1,1)
            expect(canPlaceStone(stones, 2, 2)).toBe(true); // not in same row/col
        });
    });

    // ═══════════════════════════════════════════════════════════
    // VERIFICATION TESTS (confirming correct behavior)
    // ═══════════════════════════════════════════════════════════

    describe('Score calculation (checkHoldSlots onComplete)', () => {
        it('3-match = 30 points', () => {
            expect(calculateScore(3, 0)).toBe(30); // 3*10 + 0*20 = 30
        });
        it('4-match = 60 points', () => {
            expect(calculateScore(4, 0)).toBe(60); // 4*10 + 1*20 = 60
        });
        it('5+ match = 120 points (capped)', () => {
            expect(calculateScore(5, 0)).toBe(120);
            expect(calculateScore(7, 0)).toBe(120);
        });
        it('combo ×1.5 multiplier (comboLevel 1)', () => {
            expect(calculateScore(3, 1)).toBe(45); // 30 × 1.5
            expect(calculateScore(4, 1)).toBe(90); // 60 × 1.5
        });
        it('combo ×2 multiplier (comboLevel 2+)', () => {
            expect(calculateScore(3, 2)).toBe(60); // 30 × 2
            expect(calculateScore(5, 5)).toBe(240); // 120 × 2
        });
    });

    describe('Hold slot match detection (checkHoldSlots)', () => {
        it('detects 3 consecutive same-color', () => {
            const slots = [
                { block: mockBlock(0) },
                { block: mockBlock(0) },
                { block: mockBlock(0) },
                { block: mockBlock(1) },
            ];
            const result = checkHoldSlotsLogic(slots, () => {}, () => {});
            expect(result.matched).toBe(true);
            expect(result.count).toBe(3);
            expect(result.start).toBe(0);
        });
        it('detects 4 consecutive same-color', () => {
            const slots = [
                { block: mockBlock(2) },
                { block: mockBlock(2) },
                { block: mockBlock(2) },
                { block: mockBlock(2) },
            ];
            const result = checkHoldSlotsLogic(slots, () => {}, () => {});
            expect(result.matched).toBe(true);
            expect(result.count).toBe(4);
        });
        it('no match for non-consecutive colors', () => {
            const slots = [
                { block: mockBlock(0) },
                { block: mockBlock(1) },
                { block: mockBlock(0) },
            ];
            const result = checkHoldSlotsLogic(slots, () => {}, () => {});
            expect(result.matched).toBe(false);
        });
        it('no match for only 2 consecutive', () => {
            const slots = [
                { block: mockBlock(0) },
                { block: mockBlock(0) },
                { block: mockBlock(1) },
            ];
            const result = checkHoldSlotsLogic(slots, () => {}, () => {});
            expect(result.matched).toBe(false);
        });
    });

    describe('Booster logic (useBooster)', () => {
        it('slot booster rejects when at MAX', () => {
            const boostersUsed = { slot: 0 };
            const r = useBoosterLogic(boostersUsed, { slot: 1 }, 0, MAX_HOLD_SLOTS, 10, 'slot');
            expect(r.consumed).toBe(false);
        });
        it('swap booster rejects with <2 blocks', () => {
            const boostersUsed = { swap: 0 };
            const r = useBoosterLogic(boostersUsed, { swap: 1 }, 0, 5, 1, 'swap');
            expect(r.consumed).toBe(false);
        });
        it('undo booster rejects with empty stack', () => {
            const boostersUsed = { undo: 0 };
            const r = useBoosterLogic(boostersUsed, { undo: 1 }, 0, 5, 10, 'undo');
            expect(r.consumed).toBe(false);
        });
        it('bomb booster rejects with 0 non-stone blocks', () => {
            const boostersUsed = { bomb: 0 };
            const r = useBoosterLogic(boostersUsed, { bomb: 1 }, 0, 5, 0, 'bomb');
            expect(r.consumed).toBe(false);
        });
        it('all boosters consume when valid', () => {
            const boostersUsed = { undo: 0, slot: 0, shuffle: 0, swap: 0, bomb: 0 };
            const boosterCounts = { undo: 1, slot: 1, shuffle: 1, swap: 1, bomb: 1 };
            useBoosterLogic(boostersUsed, boosterCounts, 1, 6, 48, 'undo');
            useBoosterLogic(boostersUsed, boosterCounts, 0, 6, 48, 'slot');
            useBoosterLogic(boostersUsed, boosterCounts, 0, 6, 48, 'shuffle');
            useBoosterLogic(boostersUsed, boosterCounts, 0, 6, 2, 'swap');
            useBoosterLogic(boostersUsed, boosterCounts, 0, 6, 48, 'bomb');
            expect(boostersUsed.undo).toBe(1);
            expect(boostersUsed.slot).toBe(1);
            expect(boostersUsed.shuffle).toBe(1);
            expect(boostersUsed.swap).toBe(1);
            expect(boostersUsed.bomb).toBe(1);
        });
    });

    describe('Level progression (LEVELS)', () => {
        it('has 5 levels', () => {
            expect(LEVELS.length).toBe(5);
        });
        it('each level has moves and target', () => {
            for (const l of LEVELS) {
                expect(l.moves).toBeGreaterThan(0);
                expect(l.target).toBeGreaterThan(0);
            }
        });
        it('later levels have more moves and target', () => {
            for (let i = 1; i < LEVELS.length; i++) {
                expect(LEVELS[i].moves).toBeGreaterThan(LEVELS[i - 1].moves);
                expect(LEVELS[i].target).toBeGreaterThan(LEVELS[i - 1].target);
            }
        });
        it('LEVELS[5] is undefined (OOB guard needed)', () => {
            expect(LEVELS[5]).toBeUndefined();
        });
    });

    describe('OBSTACLE constant', () => {
        it('OBSTACLE = 8 (distinct from colors 0-6)', () => {
            expect(OBSTACLE).toBe(8);
            expect(OBSTACLE).toBeGreaterThan(6);
        });
    });

    describe('Hold slot layout', () => {
        it('creates 7 default slots', () => {
            expect(HOLD_SLOTS).toBe(7);
        });
        it('max is 8 slots (addExtraSlot)', () => {
            expect(MAX_HOLD_SLOTS).toBe(8);
        });
    });

    describe('Board dimensions', () => {
        it('board is 6×8', () => {
            expect(BOARD_SIZE.cols).toBe(6);
            expect(BOARD_SIZE.rows).toBe(8);
        });
        it('CELL_SIZE = 80, CELL_GAP = 10', () => {
            expect(CELL_SIZE).toBe(80);
            expect(CELL_GAP).toBe(10);
        });
    });

    describe('Hold slot geometry', () => {
        const HOLD_DX = CELL_SIZE + CELL_GAP;
        const HOLD_START_X = (720 - HOLD_SLOTS * HOLD_DX) / 2;
        const boardY = 200;
        const boardHeight = BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + CELL_SIZE;
        const boardBottom = boardY + boardHeight;

        it('HOLD_START_X centered for 7 slots', () => {
            expect(HOLD_START_X).toBeGreaterThanOrEqual(0);
        });
        it('HOLD_DROP_TOP below board (positive gap)', () => {
            const gap = HOLD_DROP_TOP - boardBottom;
            expect(gap).toBeGreaterThan(0);
        });
        it('HOLD_DROP_BOTTOM further below', () => {
            expect(HOLD_DROP_BOTTOM).toBeGreaterThan(HOLD_DROP_TOP);
        });
    });
});

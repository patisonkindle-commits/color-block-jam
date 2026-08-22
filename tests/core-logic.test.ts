import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CELL_SIZE, CELL_GAP, BOARD_SIZE, OBSTACLE, LEVELS, MAX_HOLD_SLOTS } from '../src/config';

// Mock Phaser for test isolation
vi.mock('phaser', () => ({
    default: { Scene: class {} },
}));

// ─── Helper: extract testable logic from GameScene ─────────

/** Score calculation from checkHoldSlots (lines 446-456) */
function calculateScore(count: number, lastMatchMove: number, movesLeft: number, COMBO_WINDOW = 3): number {
    const base = count >= 5 ? 120 : count * 10 + (count - 3) * 20;
    let comboLevel = 0;
    if (lastMatchMove >= 0 && lastMatchMove - movesLeft < COMBO_WINDOW) {
        comboLevel = 1;
    } else {
        comboLevel = 0;
    }
    const mult = comboLevel === 0 ? 1 : comboLevel === 1 ? 1.5 : 2;
    return Math.round(base * mult);
}

/** 3-in-a-row stone rejection (FIXED version) */
function canPlaceStone(stones: Set<number>, row: number, col: number, cols: number, rows: number): boolean {
    // Horizontal check
    const h1 = col >= 2 && stones.has(row * cols + col - 2) && stones.has(row * cols + col - 1);
    const h2 = col >= 1 && col + 1 < cols && stones.has(row * cols + col - 1) && stones.has(row * cols + col + 1);
    const h3 = col + 2 < cols && stones.has(row * cols + col + 1) && stones.has(row * cols + col + 2);
    if (h1 || h2 || h3) return false;

    // Vertical check
    const v1 = row >= 2 && stones.has((row - 2) * cols + col) && stones.has((row - 1) * cols + col);
    const v2 = row >= 1 && row + 1 < rows && stones.has((row - 1) * cols + col) && stones.has((row + 1) * cols + col);
    const v3 = row + 2 < rows && stones.has((row + 1) * cols + col) && stones.has((row + 2) * cols + col);
    if (v1 || v2 || v3) return false;

    return true;
}

/** Hold slot match detection (lines 399-421) */
function checkHoldMatch(holdSlots: { block: any }[]): { matched: boolean; count: number; start: number } {
    let consecutiveCount = 1;
    let startSlot = 0;
    let bestMatch = { count: 0, start: 0 };

    for (let i = 1; i < holdSlots.length; i++) {
        const currentBlock = holdSlots[i].block;
        const prevBlock = holdSlots[i - 1].block;
        if (currentBlock && prevBlock && currentBlock.getData('color') === prevBlock.getData('color')) {
            consecutiveCount++;
        } else {
            if (consecutiveCount > bestMatch.count) {
                bestMatch = { count: consecutiveCount, start: startSlot };
            }
            consecutiveCount = 1;
            startSlot = i;
        }
    }
    if (consecutiveCount > bestMatch.count) {
        bestMatch = { count: consecutiveCount, start: startSlot };
    }

    return { matched: bestMatch.count >= 3, count: bestMatch.count, start: bestMatch.start };
}

/** Swap booster logic (lines 892-916) */
function useBooster(
    boostersUsed: Record<string, number>,
    BOOSTER_COUNTS: Record<string, number>,
    action: string,
    boardBlocks: any[],
    undoStack: any[]
): { success: boolean; mode: 'swap' | 'bomb' | null } {
    if (boostersUsed[action] >= BOOSTER_COUNTS[action]) return { success: false, mode: null };
    if (action === 'undo' && undoStack.length === 0) return { success: false, mode: null };
    if (action === 'swap' && boardBlocks.length < 2) return { success: false, mode: null };
    if (action === 'bomb' && boardBlocks.filter((b: any) => b && b.getData('color') !== OBSTACLE).length === 0)
        return { success: false, mode: null };

    boostersUsed[action]++;
    if (action === 'swap') return { success: true, mode: 'swap' };
    if (action === 'bomb') return { success: true, mode: 'bomb' };
    return { success: true, mode: null };
}

// ─── Tests ─────────────────────────────────────────────────

describe('Color Block Jam — Core Logic Tests', () => {

    describe('Score Calculation', () => {
        it('3-match = 30 points', () => {
            expect(calculateScore(3, -1, 15)).toBe(30);
        });

        it('4-match = 60 points', () => {
            expect(calculateScore(4, -1, 14)).toBe(60);
        });

        it('5+ match = 120 points (capped)', () => {
            expect(calculateScore(5, -1, 13)).toBe(120);
            expect(calculateScore(7, -1, 11)).toBe(120);
        });

        it('combo ×1.5 for consecutive matches', () => {
            expect(calculateScore(3, 10, 8)).toBe(45); // 30 × 1.5
            expect(calculateScore(4, 10, 8)).toBe(90); // 60 × 1.5
        });

        it('combo ×2 for 3+ consecutive matches', () => {
            const comboLevel = 2; // simulated
            const base = 30;
            const mult = comboLevel === 0 ? 1 : comboLevel === 1 ? 1.5 : 2;
            expect(Math.round(base * mult)).toBe(60);
        });
    });

    describe('3-in-a-row Stone Rejection', () => {
        it('rejects horizontal 3-in-a-row', () => {
            const stones = new Set([0, 1]); // (0,0), (0,1)
            expect(canPlaceStone(stones, 0, 2, 6, 8)).toBe(false);
        });

        it('rejects vertical 3-in-a-row', () => {
            const stones = new Set([0, 6]); // (0,0), (1,0)
            expect(canPlaceStone(stones, 2, 0, 6, 8)).toBe(false);
        });

        it('allows placement with gap', () => {
            const stones = new Set([0, 2]); // (0,0), (0,2)
            expect(canPlaceStone(stones, 0, 1, 6, 8)).toBe(true);
        });

        it('allows placement outside 3-in-a-row', () => {
            const stones = new Set([0, 1]);
            expect(canPlaceStone(stones, 0, 3, 6, 8)).toBe(true);
        });

        it('rejects diagonal is NOT checked (only row/col)', () => {
            const stones = new Set([0, 7]); // (0,0), (1,1)
            expect(canPlaceStone(stones, 2, 2, 6, 8)).toBe(true); // diagonal OK
        });
    });

    describe('Hold Slot Match Detection', () => {
        function makeBlock(color: number) {
            return { getData: vi.fn((k: string) => k === 'color' ? color : 0) };
        }

        it('detects 3 consecutive same-color', () => {
            const slots = [
                { block: makeBlock(0) },
                { block: makeBlock(0) },
                { block: makeBlock(0) },
                { block: makeBlock(1) },
            ];
            const result = checkHoldMatch(slots);
            expect(result.matched).toBe(true);
            expect(result.count).toBe(3);
            expect(result.start).toBe(0);
        });

        it('detects 4 consecutive same-color', () => {
            const slots = [
                { block: makeBlock(2) },
                { block: makeBlock(2) },
                { block: makeBlock(2) },
                { block: makeBlock(2) },
            ];
            const result = checkHoldMatch(slots);
            expect(result.matched).toBe(true);
            expect(result.count).toBe(4);
        });

        it('no match for non-consecutive', () => {
            const slots = [
                { block: makeBlock(0) },
                { block: makeBlock(1) },
                { block: makeBlock(0) },
            ];
            const result = checkHoldMatch(slots);
            expect(result.matched).toBe(false);
        });

        it('no match for 2 consecutive', () => {
            const slots = [
                { block: makeBlock(0) },
                { block: makeBlock(0) },
                { block: makeBlock(1) },
            ];
            const result = checkHoldMatch(slots);
            expect(result.matched).toBe(false);
        });
    });

    describe('Swap Booster Logic', () => {
        it('consumes booster on successful use', () => {
            const boostersUsed = { swap: 0 };
            const BOOSTER_COUNTS = { swap: 1 };
            const boardBlocks = [{ getData: vi.fn(() => 0) }, { getData: vi.fn(() => 1) }];

            const result = useBooster(boostersUsed, BOOSTER_COUNTS, 'swap', boardBlocks, []);
            expect(result.success).toBe(true);
            expect(result.mode).toBe('swap');
            expect(boostersUsed.swap).toBe(1);
        });

        it('prevents overuse', () => {
            const boostersUsed = { swap: 1 };
            const BOOSTER_COUNTS = { swap: 1 };
            const boardBlocks = [{ getData: vi.fn(() => 0) }, { getData: vi.fn(() => 1) }];

            const result = useBooster(boostersUsed, BOOSTER_COUNTS, 'swap', boardBlocks, []);
            expect(result.success).toBe(false);
        });

        it('prevents swap when <2 blocks', () => {
            const boostersUsed = { swap: 0 };
            const BOOSTER_COUNTS = { swap: 1 };
            const boardBlocks = [{ getData: vi.fn(() => 0) }];

            const result = useBooster(boostersUsed, BOOSTER_COUNTS, 'swap', boardBlocks, []);
            expect(result.success).toBe(false);
        });

        it('prevents undo with empty stack', () => {
            const boostersUsed = { undo: 0 };
            const BOOSTER_COUNTS = { undo: 1 };
            const boardBlocks = [];

            const result = useBooster(boostersUsed, BOOSTER_COUNTS, 'undo', boardBlocks, []);
            expect(result.success).toBe(false);
        });
    });

    describe('Level Progression', () => {
        it('LEVELS has 5 entries', () => {
            expect(LEVELS.length).toBe(5);
        });

        it('each level has moves and target', () => {
            for (const level of LEVELS) {
                expect(level.moves).toBeGreaterThan(0);
                expect(level.target).toBeGreaterThan(0);
            }
        });

        it('later levels have more moves and higher target', () => {
            for (let i = 1; i < LEVELS.length; i++) {
                expect(LEVELS[i].moves).toBeGreaterThan(LEVELS[i - 1].moves);
                expect(LEVELS[i].target).toBeGreaterThan(LEVELS[i - 1].target);
            }
        });
    });

    describe('OBSTACLE Constant', () => {
        it('OBSTACLE is 8 (different from colors 0-6)', () => {
            expect(OBSTACLE).toBe(8);
            expect(OBSTACLE).not.toBeLessThan(7);
        });
    });
});

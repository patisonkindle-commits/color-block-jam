// Save/Load — synchronous localStorage (works identically in Capacitor WebView).
// Deliberate simplification: no localForage dependency (YAGNI — data is tiny).

export interface SaveData {
    level: number;
    score: number;
    movesLeft: number;
    totalUndos: number;
    blocksMatched?: number;
    board: any[];  // 2D snapshot for restore
    heldSlots: any[];  // [{color, boardCol, boardRow}] for blocks in hold
}

const KEY = 'cbj_save_v1';
const BEST_KEY = 'cbj_best_v1';

export function getBestScore(): number {
    try {
        const raw = localStorage.getItem(BEST_KEY);
        const n = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

/** Record score if it beats the stored best. Returns true when a new best was set. */
export function setBestScore(score: number): boolean {
    if (score <= getBestScore()) return false;
    try {
        localStorage.setItem(BEST_KEY, String(score));
        return true;
    } catch (e) {
        console.warn('best score save failed', e);
        return false;
    }
}

export function saveGame(data: SaveData): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('save failed', e);
    }
}

export function loadGame(): SaveData | null {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as SaveData) : null;
    } catch {
        return null;
    }
}

export function hasSave(): boolean {
    try {
        return !!localStorage.getItem(KEY);
    } catch {
        return false;
    }
}

export function clearSave(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // ignore
    }
}
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
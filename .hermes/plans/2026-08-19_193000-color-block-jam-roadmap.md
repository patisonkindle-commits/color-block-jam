# Color Block Jam — Remaining Roadmap Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ship remaining roadmap features for Color Block Jam: PreloadScene + progress bar, UIScene top-bar overlay, Boosters, Save/Load (localStorage), SFX/BGM, Capacitor AdMob shell, and final-level victory flow.

**Architecture:** Phaser 3 scene split — BootScene keeps texture generation but becomes lightweight; new PreloadScene owns real-asset preload with a progress bar; UIScene runs in parallel (one scene active at a time in Phaser — scenes run concurrently by default so this works) over BootScene. Persistence via small synchronous localStorage wrapper (lazy — avoid localForage dependency since web + Capacitor both have localStorage).

**Tech Stack:** Phaser 3.80, TypeScript strict, vite 5 base `/color-block-jam/`, @capacitor/core + @capacitor-community/admob already in package.json (android platform NOT yet added — needs `npx cap add android`).

---

## Current Context (verified 2026-08-19, commit 45c5dcf + gh-pages 570c9a0)

- **Working:** 7 hold slots (index 0–6 from holdStartX), level system (LEVELS[0] = 20 moves/500 pts → LEVELS[4] = 28/1300), checkVictory() → "LEVEL CLEAR!" overlay → NEXT LEVEL → Level 2 (22 moves, score reset), 0 console errors, bundle live D9DIliIa.
- **Deploy pitfall (learned 2026-08-20):** gh-pages root `index.html` must be overwritten with dist/index.html each deploy — stale root HTML pointed at deleted old bundle, killing live site.
- **DONE (Round 3, 2026-08-20):** SFX (F) — `src/systems/audio.ts` WebAudio synth (click/match/win/fail, zero assets, mute flag `cbj_muted`). Victory stats (C) — final level → "YOU WIN!" + Final Score + Blocks Matched + PLAY AGAIN (restart L1) + MENU buttons; `blocksMatched` tracked & persisted. Deployed (gh-pages 515e970, main 5c98a95), verified live 200.
- **REMAINING:** AdMob (D) — code-only until Android SDK; asset download optional; mute UI toggle.
- **Assets dirs exist but EMPTY:** assets/sprites/{blocks,ui,backgrounds,effects}/, assets/sounds/, assets/fonts/ — all zero files. ASSET_DOWNLOAD_GUIDE.md lists CC0 sources (Kenney, Mixkit) but nothing downloaded yet.
- **Testing:** playwright in `~/.npm/_npx/<hash>/node_modules`, chromium-1223 headless + swiftshader flags (see skill reference). Serve via /tmp/cbj-serve/color-block-jam/ from parent dir to resolve base path. State via `window.__game.scene.getScene('GameScene')`.
- **No real audio assets, no real sprite assets.** Procedural textures (BootScene createBlockTexture) are the current art.
- **GameScene keeps config values hardcoded** (holdY, holdStartX duplicated 5×) — extract to config constants during refactor.
- **Score counter never used for victory unless refilled** — refillBoard() only fills when match clears, which works.

---

## Priority Order (user asked "เริ่มส่วนไหนก่อน" — recommended)

**Order rationale:** B1/B2 are zero-asset infra that make every later feature testable; DB1 gives instant perceived quality with zero new assets; B1+B2+DB1 are a coherent single skill worth doing first (infra + first booster + persistence). Then core progression (A), then chrome (F/E), then platform shell (D last because it needs Android SDK/emulator — least valuable in WSL-only flow).

1. **B1+B2** — Extract duplicated layout constants; top HUD (score/moves/level) into GameScene proper + boosters UX slot. *(infra, unblocks everything)*
2. **A** — Preload/UI scene split: real `UIScene` running parallel with GameScene; BootScene shrinks. *(necessary for boosters + saves + SFX)*
3. **DB1** — Save/load: localStorage wrapper + auto-save on level change + continue button on menu. *(cheap, high value)*
4. **B3** — Undo booster (click "Undo" → rewind last drop; needs a small move-history stack in GameScene).
5. **B4** — Shuffle +1 slot boosters (add 1 hold slot up to 8 max, per-level, consumed on use).
6. **F** — SFX: WebAudio synth beeps (no assets needed — match/win/click/fail tones), BGM via optional looped oscillator pattern. *(avoids empty asset dirs issue)*
7. **C** — Final-level victory: LAST level clear → "YOU WIN!" + stats + back-to-menu (already partially there — btn text "YOU WIN!" — needs distinct flow/stat screen).
8. **D** — AdMob Capacitor plugin wiring (banner on menu, interstitial on level start). Needs `npx cap add android` + Google Mobile Ads config — flag as environment-blocked on WSL without Android SDK.

---

## File Map (target state)

- `src/config.ts` — add `HOLD_SLOTS`, `HOLD_START_X()`, `HOLD_Y()`, `BOOSTER_DEFS`, `STORAGE_KEY`, `SOUNDS` defs.
- `src/scenes/boot.ts` — texture gen only (procedural), no scene.start (PreloadScene takes over).
- `src/scenes/preload.ts` — NEW: progress bar, loads real assets IF present (graceful skip when dirs empty), then `scene.start('MenuScene')`.
- `src/scenes/menu.ts` — Continue button (if save exists), boosters display, settings placeholder.
- `src/scenes/ui.ts` — NEW: top HUD container (score/moves/level), booster buttons, lives in parallel with GameScene.
- `src/scenes/game.ts` — receive `{level, score}` from UIScene via registry; add moveHistory, undo(); remove duplicated layout consts.
- `src/game.ts` — register PreloadScene, UIScene; scene order: Boot → Preload → Menu → (UI + Game).
- `src/systems/save.ts` — NEW: `saveGame()`, `loadGame()`, `hasSave()` localStorage wrapper (small, no localForage).
- `src/systems/audio.ts` — NEW: WebAudio synth SFX manager (click/match/win/fail) + knob for mute.
- `src/systems/admob.ts` — NEW: thin wrapper around @capacitor-community/admob, no-ops on web.

---

## Task Breakdown (bite-sized, TDD where sensible)

### Task 1: Extract layout constants

**Files:** Modify `src/config.ts`, `src/scenes/game.ts`

**Step 1:** Add to config.ts:
```ts
export const HOLD_SLOTS = 7;
export const HOLD_DX = CELL_SIZE + 10; // slot pitch
export const HOLD_START_X = (720 - HOLD_SLOTS * HOLD_DX) / 2;
export const HOLD_Y = BOARD_OFFSET_Y + BOARD_SIZE.rows * (CELL_SIZE + CELL_GAP) + 50;
```

**Step 2:** Replace all 5 hardcoded `holdStartX`/`holdY` occurrences in game.ts with imported constants. Delete `private holdStartX = ...` field.

**Step 3:** Build + verify: `npx vite build` (background=true), serve /tmp/cbj-serve, playwright: drop block into slot 6, assert `heldIdx === 6`, moves decremented.

**Step 4:** Commit `refactor: extract layout consts (HOLD_SLOTS/HOLD_START_X/HOLD_Y)`.

### Task 2: Add UIScene skeleton

**Files:** Create `src/scenes/ui.ts`, modify `src/game.ts`, `src/scenes/game.ts`

**Step 1:** UIScene (key 'UIScene', parallel):
- Reads score/moves/level from `this.registry` (set by GameScene in create()).
- Renders top bar texts (score left, level center, moves right) + booster button row (2 buttons: UNDO, +SLOT — disable greyed when unavailable).
- `updateUI()` called via registry event `set('hud', {...})` listener (Phaser registry supports `events.on('changedata-hud')`).

**Step 2:** GameScene.create() sets `this.registry.set('hud', {score, moves, level})`; updateUI() re-sets it.

**Step 3:** Remove scoreText/movesText/levelText from GameScene (moved to UIScene).

**Step 4:** Verify: playwright — start game, assert UIScene active, texts show "Score: 0", "Moves: 20", "Level 1".

### Task 3: PreloadScene + progress bar

**Files:** Create `src/scenes/preload.ts`; modify `src/scenes/boot.ts`, `src/game.ts`

**Step 1:** PreloadScene:
- `init()`: registry.get('bootComplete') — BootScene sets it in create().
- `preload()`: draw progress bar (container rects), `this.load.on('progress', ...)` updates fill width; attempt loads in try/catch per-asset if files exist (use `this.load.image` only when fetch proves file present — write helper `assetExists(url)` using XMLHttpRequest HEAD; skip silently when empty dirs).
- `create()`: `this.scene.start('MenuScene')`.

**Step 2:** BootScene drops `this.scene.start('MenuScene')` → now only generates textures, sets registry flag, starts PreloadScene.

**Step 3:** game.ts scene array: `[BootScene, PreloadScene, MenuScene, UIScene, GameScene]`.

**Step 4:** Verify: screenshot shows progress bar filling then menu; 0 console errors.

### Task 4: Save/Load (localStorage)

**Files:** Create `src/systems/save.ts`; modify `src/scenes/game.ts`, `src/scenes/menu.ts`

**Step 1:** save.ts:
```ts
const KEY = 'cbj_save_v1';
export function saveGame(s: {level: number; score: number; movesLeft: number; boosts: {undo: number; slot: number}}) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function loadGame() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function hasSave() { return !!localStorage.getItem(KEY); }
```

**Step 2:** GameScene: call `saveGame(...)` in `checkVictory()` (on level clear) and when moves hit 0 (game over, keep save for retry).

**Step 3:** MenuScene: if `hasSave()`, render CONTINUE button between PLAY and SETTINGS; on click `scene.start('GameScene', {continue: true})`; GameScene.create() loads save and restores state.

**Step 4:** Verify: play to level clear → back to menu → CONTINUE visible → click → level 2, score preserved.

### Task 5: Undo booster

**Files:** Modify `src/scenes/game.ts`, `src/scenes/ui.ts`

**Step 1:** GameScene: add `private moveHistory: {block, fromRow, fromCol, toSlot}[] = []`; push in `moveBlockToHold()`; `undo()` pops last: return block to its board cell, restore movesLeft+1, clear slot; disable when empty.

**Step 2:** UIScene UNDO button → `registry.get('undo')` callback or scene event `gameEvents.emit('undo-click')`.

**Step 3:** Verify: drop → undo → block back on board, moves restored.

### Task 6: Shuffle/+1 slot boosters

**Files:** Modify `src/scenes/game.ts`, `src/config.ts`

**Step 1:** config: `BOOSTER_DEFS = { slot: {max: 1, cost: 0}, shuffle: {max: 1, cost: 0} }` (per-level counts).
**Step 2:** GameScene: `addSlot()` — if holdSlots.length < 8, push new slot at end, reposition row (recompute HOLD_START_X with new count), else disabled. `shuffle()` — randomize remaining board colors (tween swap), costs a move.
**Step 3:** Verify: +SLOT → 8 slots clickable; SHUFFLE → board colors changed.

### Task 7: SFX + BGM (WebAudio synth — zero assets)

**Files:** Create `src/systems/audio.ts`; modify `src/scenes/game.ts`, `src/scenes/menu.ts`

**Step 1:** audio.ts: lazy AudioContext; functions `click()`, `match()`, `win()`, `fail()`, `bgmStart()`, `bgmStop()` using oscillator envelopes (no files). Mute toggle in settings (registry flag, persisted to localStorage).
**Step 2:** Hook: click on block select, match on checkHoldSlots success, win on victory, fail on game over. BGM: start on menu, low volume loop.
**Step 3:** Verify: console clean; (audio not assertable headless — smoke-test that AudioContext created without error).

### Task 8: Final-level victory flow

**Files:** Modify `src/scenes/game.ts`

**Step 1:** In `showLevelClear()`: when `!nextLevel`, show stats screen (final score, blocks matched count) + "PLAY AGAIN" (restart level 1) + "MENU" instead of bare "YOU WIN!" → menu. (Current code shows "YOU WIN!" then scene.start MenuScene — keep that, add stats + second button.)

*Note: Task 8 is tiny — the "YOU WIN!" text + return-to-menu already works. Just add stats. Could merge into Task 7.*

### Task 9: AdMob Capacitor shell

**Files:** Create `src/systems/admob.ts`; modify `src/game.ts`; NEW `capacitor.config.ts`

**Step 1:** admob.ts wrapper: `init()`, `showBanner()`, `showInterstitial()` — dynamic `import('@capacitor-community/admob')` guarded by `Capacitor.isNativePlatform()`; no-op on web.
**Step 2:** `capacitor.config.ts` with `appId: 'com.patison.colorblockjam'`, `webDir: 'dist'`.
**Step 3:** PREREQ for real testing: `npx cap add android` — **blocked on WSL without Android SDK**; document in README/plan: needs Windows host Android Studio or `apt install android-sdk`. Mark DONE-as-code, VERIFY-pending-platform.

---

## Risks / Tradeoffs / Open Questions

- **Asset dirs empty** → all new art/audio features must work with procedural fallbacks (synth SFX, generated textures). Real assets later = drop-in via PreloadScene paths. **Open question for user: download Kenney/Mixkit assets now, or stay procedural?**
- **UIScene parallel overlay** — Phaser scenes run concurrently; input overlap between UIScene (buttons) and GameScene (board drags) needs input priority: set UIScene higher `input` priority or put boosters outside board area (they are — top bar vs board y≈200+). Low risk.
- **localStorage vs localForage** — spec named localForage; localStorage is synchronous, works identically on Capacitor (WebView), zero dependency. localForage only matters for >5MB (replay data) — YAGNI now. **Flag as deliberate simplification.**
- **AdMob interstitial on level start** — ad network config (AdUnit IDs) not present; placeholder IDs only. Real IDs come from Google AdMob console — user must supply.
- **Android build blocked in WSL** — capacitor + android SDK is a Windows-side (or Docker) step; WSL can prepare code + config but not produce APK. Already have android-playstore-build skill available when user wants the APK path.
- **Scene restart vs full reload in tests** — skill says scene.restart() skips create(); current game works because create() is idempotent-ish, but after UIScene split verify level transitions via two separate playwright navigations.

## Deliverables / Definition of Done

- All tasks pass `npx tsc --noEmit` + `vite build` (0 errors), playwright smoke test on served dist (0 console errors, key state assertions per task).
- Deploy: commit dist/ + src/ on main, copy to gh-pages, push both; verify bundle 200 + old hash 404. **Never sed dist/index.html base path.**
- Memory: after implementation, update memory skill `phaser-game-dev` with any new pitfalls (UIScene parallel input priority, localStorage in Capacitor WebView).

---

## Notes

- **User workflow memory:** implement → browser playtest → fix → git push (token-inline ~/.github-token then scrub). Follow this per task group, not per micro-task — batch deploy at milestone (B1+B2+A → one push; DB1+B3+B4 → one push; F+C → one push; D → docs-only until Android SDK available).
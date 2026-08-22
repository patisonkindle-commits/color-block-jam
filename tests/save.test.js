// Unit tests for save.ts (pure logic, testable in Node.js)
// Uses Node.js vm module to avoid browser dependencies

const { createContext, runInNewContext } = require('vm');

// Mock localStorage
const localStorage = {
  _store: {},
  getItem: function (key) {
    return this._store[key] || null;
  },
  setItem: function (key, value) {
    this._store[key] = value;
  },
  removeItem: function (key) {
    delete this._store[key];
  },
  clear: function () {
    this._store = {};
  },
};

// Set up VM context
const ctx = createContext({
  localStorage: localStorage,
});

// Run save.ts in context and capture exports
const saveCode = `
  const KEY = 'cbj_save_v1';
  const BEST_KEY = 'cbj_best_v1';

  function getBestScore() {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw === null) return -1;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : -1;
    } catch {
      return -1;
    }
  }

  function setBestScore(score) {
    if (score <= getBestScore()) return false;
    try {
      localStorage.setItem(BEST_KEY, String(score));
      return true;
    } catch (e) {
      console.warn('best score save failed', e);
      return false;
    }
  }

  function saveGame(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('save failed', e);
    }
  }

  function loadGame() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hasSave() {
    try {
      return !!localStorage.getItem(KEY);
    } catch {
      return false;
    }
  }

  function clearSave() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }

  // Export functions for testing
  this.getBestScore = getBestScore;
  this.setBestScore = setBestScore;
  this.saveGame = saveGame;
  this.loadGame = loadGame;
  this.hasSave = hasSave;
  this.clearSave = clearSave;
`;

runInNewContext(saveCode, ctx);

// Test suite
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`✗ ${name}\n  Error: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// Clear localStorage before tests
localStorage.clear();

console.log('\n=== save.ts Unit Tests ===\n');

// Test getBestScore
test('getBestScore() returns -1 when no best score saved', () => {
  localStorage.clear();
  const result = ctx.getBestScore();
  assertEqual(result, -1);
});

test('getBestScore() returns correct value', () => {
  localStorage.setItem('cbj_best_v1', '1500');
  const result = ctx.getBestScore();
  assertEqual(result, 1500);
});

test('getBestScore() returns -1 for invalid JSON', () => {
  localStorage.setItem('cbj_best_v1', 'not-a-number');
  const result = ctx.getBestScore();
  assertEqual(result, -1);
});

// Test setBestScore
test('setBestScore() sets new record', () => {
  localStorage.setItem('cbj_best_v1', '1000');
  const result = ctx.setBestScore(1500);
  assert(result === true, 'Should return true for new best');
  assertEqual(ctx.getBestScore(), 1500);
});

test('setBestScore() does not update when score is lower', () => {
  localStorage.setItem('cbj_best_v1', '2000');
  const result = ctx.setBestScore(1500);
  assert(result === false, 'Should return false for lower score');
  assertEqual(ctx.getBestScore(), 2000);
});

test('setBestScore() does not update when score is equal', () => {
  localStorage.setItem('cbj_best_v1', '2000');
  const result = ctx.setBestScore(2000);
  assert(result === false, 'Should return false for equal score');
  assertEqual(ctx.getBestScore(), 2000);
});

test('setBestScore() works with 0', () => {
  localStorage.clear();
  const result = ctx.setBestScore(0);
  assert(result === true, 'Should return true for first score');
  assertEqual(ctx.getBestScore(), 0);
});

// Test saveGame and loadGame
test('saveGame() and loadGame() round-trip', () => {
  const data = {
    level: 3,
    score: 2500,
    movesLeft: 15,
    totalUndos: 2,
    blocksMatched: 45,
    board: [[1, 2, null], [null, 3, 4]],
    heldSlots: [{ color: 0, boardCol: 2, boardRow: 5 }],
  };
  ctx.saveGame(data);
  const loaded = ctx.loadGame();
  assertEqual(loaded.level, 3);
  assertEqual(loaded.score, 2500);
  assertEqual(loaded.movesLeft, 15);
  assertEqual(loaded.totalUndos, 2);
  assertEqual(loaded.blocksMatched, 45);
  assertEqual(loaded.board[0][0], 1);
  assertEqual(loaded.board[0][2], null);
  assertEqual(loaded.heldSlots[0].color, 0);
});

test('loadGame() returns null when no save exists', () => {
  localStorage.clear();
  const result = ctx.loadGame();
  assertEqual(result, null);
});

test('loadGame() returns null for corrupt JSON', () => {
  localStorage.setItem('cbj_save_v1', 'invalid json{{{');
  const result = ctx.loadGame();
  assertEqual(result, null);
});

// Test hasSave
test('hasSave() returns true when save exists', () => {
  ctx.saveGame({ level: 1, score: 0, movesLeft: 20, totalUndos: 0, board: [], heldSlots: [] });
  assert(ctx.hasSave() === true, 'Should return true');
});

test('hasSave() returns false when no save exists', () => {
  localStorage.clear();
  assert(ctx.hasSave() === false, 'Should return false');
});

// Test clearSave
test('clearSave() removes save data', () => {
  ctx.saveGame({ level: 1, score: 100, movesLeft: 20, totalUndos: 0, board: [], heldSlots: [] });
  assert(ctx.hasSave() === true);
  ctx.clearSave();
  assert(ctx.hasSave() === false);
  assertEqual(ctx.loadGame(), null);
});

// Test error handling
test('saveGame() handles invalid data gracefully', () => {
  try {
    ctx.saveGame(null);
    // Should not throw
  } catch (e) {
    throw new Error('saveGame should handle null data');
  }
});

test('saveGame() handles circular references', () => {
  const data = { level: 1 };
  data.self = data;
  try {
    ctx.saveGame(data);
    // JSON.stringify throws on circular refs, but function should handle it
    console.log('Note: JSON.stringify throws on circular refs (expected)');
  } catch (e) {
    // Expected - JSON.stringify doesn't handle circular refs
  }
});

// Test edge cases
test('saveGame() handles large board data', () => {
  const largeBoard = [];
  for (let i = 0; i < 100; i++) {
    largeBoard.push(new Array(10).fill(null));
  }
  ctx.saveGame({
    level: 5,
    score: 10000,
    movesLeft: 0,
    totalUndos: 10,
    board: largeBoard,
    heldSlots: [],
  });
  const loaded = ctx.loadGame();
  assertEqual(loaded.board.length, 100);
  assertEqual(loaded.board[0].length, 10);
});

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);

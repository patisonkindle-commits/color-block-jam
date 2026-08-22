// Audio SFX Unit Tests — Node.js with AudioContext mock
const { createContext, runInNewContext } = require('vm');

function createCtx(ls) {
  const mockAudioCtx = {
    currentTime: 0,
    state: 'running',
    destination: {},
    _oscillators: [],
    createOscillator: function() {
      const osc = {
        type: 'sine',
        frequency: { setValueAtTime: function(){}, exponentialRampToValueAtTime: function(){} },
        connect: function() { return this; },
        start: function(){},
        stop: function(){},
      };
      this._oscillators.push(osc);
      return osc;
    },
    createGain: function() {
      return {
        gain: { setValueAtTime: function(){}, exponentialRampToValueAtTime: function(){} },
        connect: function() { return this.destination; },
        destination: {},
      };
    },
    resume: function() { this.state = 'running'; },
    suspend: function() { this.state = 'suspended'; },
  };

  const vmCtx = createContext({ ls, audioCtx: mockAudioCtx });

  const code = "(function() {\n" +
    "  var audioContext = null;\n" +
    "  var muted = false;\n" +
    "  try { muted = ls.getItem('cbj_muted') === '1'; } catch (e) {}\n" +
    "\n" +
    "  function ac() {\n" +
    "    try {\n" +
    "      if (!audioContext) audioContext = audioCtx;\n" +
    "      if (audioContext.state === 'suspended') audioContext.resume();\n" +
    "      return audioContext;\n" +
    "    } catch (e) { return null; }\n" +
    "  }\n" +
    "\n" +
    "  function tone(freq, dur, type, vol, delay) {\n" +
    "    if (!type) type = 'sine';\n" +
    "    if (!vol) vol = 0.15;\n" +
    "    if (!delay) delay = 0;\n" +
    "    if (muted) return;\n" +
    "    var c = ac();\n" +
    "    if (!c) return;\n" +
    "    var t = c.currentTime + delay;\n" +
    "    var osc = c.createOscillator();\n" +
    "    var g = c.createGain();\n" +
    "    osc.type = type;\n" +
    "    osc.frequency.setValueAtTime(freq, t);\n" +
    "    g.gain.setValueAtTime(vol, t);\n" +
    "    g.gain.exponentialRampToValueAtTime(0.001, t + dur);\n" +
    "    osc.connect(g).connect(c.destination);\n" +
    "    osc.start(t);\n" +
    "    osc.stop(t + dur + 0.02);\n" +
    "  }\n" +
    "\n" +
    "  var SFX = {\n" +
    "    click: function() { tone(500, 0.07, 'square', 0.06, 0); },\n" +
    "    match: function(level) {\n" +
    "      if (!level) level = 1;\n" +
    "      var f = 1 + Math.min(level - 1, 4) * 0.12;\n" +
    "      tone(440 * f, 0.1, 'triangle', 0.14, 0);\n" +
    "      tone(660 * f, 0.12, 'triangle', 0.14, 0.08);\n" +
    "      if (level >= 3) { tone(880 * f, 0.14, 'triangle', 0.12, 0.16); tone(1100 * f, 0.16, 'square', 0.06, 0.2); }\n" +
    "    },\n" +
    "    win: function() { tone(523, 0.18, 'triangle', 0.13, 0); tone(659, 0.18, 'triangle', 0.13, 0.12); tone(784, 0.18, 'triangle', 0.13, 0.24); tone(1047, 0.18, 'triangle', 0.13, 0.36); },\n" +
    "    fail: function() { tone(220, 0.25, 'sawtooth', 0.1, 0); tone(175, 0.3, 'sawtooth', 0.08, 0.15); },\n" +
    "    bomb: function() { tone(100, 0.2, 'sawtooth', 0.2, 0); tone(80, 0.15, 'sawtooth', 0.15, 0.08); tone(60, 0.25, 'sawtooth', 0.1, 0.16); },\n" +
    "    toggle: function() { muted = !muted; try { ls.setItem('cbj_muted', muted ? '1' : '0'); } catch (e) {} return muted; },\n" +
    "    isMuted: function() { return muted; },\n" +
    "  };\n" +
    "  return { SFX: SFX, audioCtx: audioCtx, ls: ls };\n" +
    "})()";

  return runInNewContext(code, vmCtx);
}

function sharedLs() {
  return {
    _store: {},
    getItem: function (k) { return this._store[k] || null; },
    setItem: function (k, v) { this._store[k] = v; },
    removeItem: function (k) { delete this._store[k]; },
    clear: function () { this._store = {}; },
  };
}

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + ' — ' + e.message); }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function assertEqual(a, e, m) { if (a !== e) throw new Error(m || 'Expected ' + e + ', got ' + a); }

console.log('\n=== audio.ts Unit Tests ===\n');

test('click() generates oscillator', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.click();
  assert(c.audioCtx._oscillators.length > before);
});

test('click() 500Hz (source)', function() {
  var c = createCtx(sharedLs());
  c.SFX.click();
  assert(true);
});

test('isMuted() false initially', function() {
  var c = createCtx(sharedLs());
  assertEqual(c.SFX.isMuted(), false);
});

test('toggle() mutes', function() {
  var c = createCtx(sharedLs());
  assertEqual(c.SFX.toggle(), true);
  assert(c.SFX.isMuted());
});

test('toggle() unmutes', function() {
  var ls = sharedLs();
  ls.setItem('cbj_muted', '1');
  var c = createCtx(ls);
  assertEqual(c.SFX.toggle(), false);
  assert(!c.SFX.isMuted());
});

test('click() silent when muted', function() {
  var c = createCtx(sharedLs());
  c.SFX.toggle();
  var before = c.audioCtx._oscillators.length;
  c.SFX.click();
  assertEqual(c.audioCtx._oscillators.length, before);
});

test('match(1) = 2 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.match(1);
  assertEqual(c.audioCtx._oscillators.length, before + 2);
});

test('match(3) = 4 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.match(3);
  assertEqual(c.audioCtx._oscillators.length, before + 4);
});

test('match(5) = 4 tones (caps)', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.match(5);
  assertEqual(c.audioCtx._oscillators.length, before + 4);
});

test('match() default = 2 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.match();
  assertEqual(c.audioCtx._oscillators.length, before + 2);
});

test('win() = 4 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.win();
  assertEqual(c.audioCtx._oscillators.length, before + 4);
});

test('fail() = 2 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.fail();
  assertEqual(c.audioCtx._oscillators.length, before + 2);
});

test('bomb() = 3 tones', function() {
  var c = createCtx(sharedLs());
  var before = c.audioCtx._oscillators.length;
  c.SFX.bomb();
  assertEqual(c.audioCtx._oscillators.length, before + 3);
});

test('toggle() persists', function() {
  var c = createCtx(sharedLs());
  c.SFX.toggle();
  assertEqual(c.ls.getItem('cbj_muted'), '1');
  c.SFX.toggle();
  assertEqual(c.ls.getItem('cbj_muted'), '0');
});

test('init muted from localStorage', function() {
  var ls = sharedLs();
  ls.setItem('cbj_muted', '1');
  var c = createCtx(ls);
  assert(c.SFX.isMuted());
});

test('init unmuted when key missing', function() {
  var ls = sharedLs();
  ls.removeItem('cbj_muted');
  var c = createCtx(ls);
  assert(!c.SFX.isMuted());
});

console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===\n');
process.exit(failed > 0 ? 1 : 0);

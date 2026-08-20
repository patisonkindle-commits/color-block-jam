// WebAudio synth SFX — zero asset files needed (assets/sounds/ is empty)
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('cbj_muted') === '1'; } catch { /* SSR-safe */ }

function ac(): AudioContext | null {
    try {
        if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (ctx.state === 'suspended') ctx.resume();
        return ctx;
    } catch { return null; }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0) {
    if (muted) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
}

export const SFX = {
    click: () => tone(500, 0.07, 'square', 0.06),
    match: () => { tone(440, 0.1, 'triangle', 0.14); tone(660, 0.12, 'triangle', 0.14, 0.08); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.13, i * 0.12)); },
    fail: () => { tone(220, 0.25, 'sawtooth', 0.1); tone(175, 0.3, 'sawtooth', 0.08, 0.15); },
    toggle: () => { muted = !muted; try { localStorage.setItem('cbj_muted', muted ? '1' : '0'); } catch { /* ignore */ } return muted; },
    isMuted: () => muted,
};

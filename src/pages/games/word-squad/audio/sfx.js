// src/pages/games/word-squad/audio/sfx.js
// Every sound is synthesised with WebAudio — no audio files to download.
// The context is created on the first tap (browsers block audio before that).

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
const last = {}; // name → time, to throttle rapid sounds

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio on this device — the game still works */ }
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.55, ctx.currentTime, 0.02);
}
export const isMuted = () => muted;

export function suspendAudio() { try { ctx?.suspend(); } catch { /* ignore */ } }
export function resumeAudio() { try { if (ctx && !muted) ctx.resume(); } catch { /* ignore */ } }

export function closeAudio() {
  try { ctx?.close(); } catch { /* ignore */ }
  ctx = null; master = null; noiseBuf = null;
}

function ready(name, gapMs) {
  if (!ctx || muted || ctx.state !== 'running') return false;
  const now = performance.now();
  if (gapMs && last[name] && now - last[name] < gapMs) return false;
  last[name] = now;
  return true;
}

function tone({ type = 'sine', from, to = from, dur = 0.12, vol = 0.3, at = 0, attack = 0.005 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  if (to !== from) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, freq = 1200, q = 0.8, type = 'lowpass', at = 0, sweepTo }) {
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  pew(weapon) {
    if (!ready('pew', weapon === 'minigun' ? 70 : 95)) return;
    if (weapon === 'rockets') { noise({ dur: 0.25, vol: 0.12, freq: 600, sweepTo: 200 }); return; }
    const base = { blaster: 880, double: 760, minigun: 1100 }[weapon] || 880;
    tone({ type: 'square', from: base, to: base * 0.45, dur: 0.07, vol: 0.05 });
  },
  laserHum() {
    if (!ready('laser', 140)) return;
    tone({ type: 'sawtooth', from: 520, to: 560, dur: 0.15, vol: 0.035 });
  },
  pop() {
    if (!ready('pop', 35)) return;
    tone({ type: 'sine', from: 700 + Math.random() * 300, to: 180, dur: 0.11, vol: 0.18 });
    noise({ dur: 0.06, vol: 0.06, freq: 3000, type: 'highpass' });
  },
  boom(big = false) {
    if (!ready('boom', 60)) return;
    noise({ dur: big ? 0.9 : 0.45, vol: big ? 0.55 : 0.32, freq: big ? 900 : 1400, sweepTo: 80 });
    tone({ type: 'sine', from: big ? 120 : 160, to: 40, dur: big ? 0.8 : 0.35, vol: big ? 0.45 : 0.25 });
  },
  combo(n) {
    if (!ready('combo', 60)) return;
    const f = 440 * Math.pow(2, Math.min(24, n) / 12);
    tone({ type: 'triangle', from: f, to: f * 1.02, dur: 0.12, vol: 0.12 });
  },
  gateRight() {
    if (!ready('gate')) return;
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.16, vol: 0.2, at: i * 0.07 }));
  },
  gateWrong() {
    if (!ready('gate')) return;
    tone({ type: 'sawtooth', from: 330, to: 140, dur: 0.45, vol: 0.16 });
    tone({ type: 'square', from: 220, to: 110, dur: 0.45, vol: 0.06, at: 0.05 });
  },
  hurt() {
    if (!ready('hurt', 120)) return;
    tone({ type: 'square', from: 300, to: 120, dur: 0.12, vol: 0.08 });
  },
  reward() {
    if (!ready('reward', 100)) return;
    [784, 988, 1175].forEach((f, i) => tone({ type: 'sine', from: f, dur: 0.12, vol: 0.14, at: i * 0.05 }));
  },
  warn() {
    if (!ready('warn', 300)) return;
    tone({ type: 'square', from: 660, dur: 0.1, vol: 0.06 });
    tone({ type: 'square', from: 660, dur: 0.1, vol: 0.06, at: 0.18 });
  },
  roar() {
    if (!ready('roar', 800)) return;
    tone({ type: 'sawtooth', from: 110, to: 70, dur: 1.0, vol: 0.22, attack: 0.08 });
    tone({ type: 'sawtooth', from: 165, to: 90, dur: 0.9, vol: 0.12, attack: 0.08 });
    noise({ dur: 0.9, vol: 0.2, freq: 500, sweepTo: 150 });
  },
  victory() {
    if (!ready('victory')) return;
    const notes = [523, 659, 784, 659, 784, 1047, 988, 1047];
    notes.forEach((f, i) => tone({ type: 'triangle', from: f, dur: i === notes.length - 1 ? 0.6 : 0.16, vol: 0.2, at: i * 0.13 }));
    notes.forEach((f, i) => tone({ type: 'sine', from: f / 2, dur: 0.18, vol: 0.1, at: i * 0.13 }));
  },
  lose() {
    if (!ready('lose')) return;
    [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.18, at: i * 0.22 }));
  },
  whistle() {
    if (!ready('whistle', 300)) return;
    tone({ type: 'sine', from: 1600, to: 500, dur: 0.9, vol: 0.06 });
  },
  spit() {
    if (!ready('spit', 90)) return;
    noise({ dur: 0.18, vol: 0.14, freq: 700, sweepTo: 300, type: 'bandpass', q: 3 });
    tone({ type: 'sine', from: 320, to: 180, dur: 0.15, vol: 0.08 });
  },
  coin() {
    if (!ready('coin', 40)) return;
    tone({ type: 'square', from: 988, dur: 0.06, vol: 0.06 });
    tone({ type: 'square', from: 1319, dur: 0.12, vol: 0.06, at: 0.06 });
  },
  bonk() {
    if (!ready('bonk', 150)) return;
    tone({ type: 'sine', from: 260, to: 90, dur: 0.22, vol: 0.3 });
    noise({ dur: 0.12, vol: 0.15, freq: 800 });
  },
  whoosh() {
    if (!ready('whoosh', 120)) return;
    noise({ dur: 0.35, vol: 0.18, freq: 400, sweepTo: 2400, type: 'bandpass', q: 2 });
  },
  windup() {
    if (!ready('windup', 300)) return;
    tone({ type: 'sawtooth', from: 120, to: 360, dur: 0.9, vol: 0.07, attack: 0.3 });
  },
  shatter() {
    if (!ready('shatter', 200)) return;
    noise({ dur: 0.5, vol: 0.35, freq: 3500, type: 'highpass' });
    [1568, 2093, 2637].forEach((f, i) => tone({ type: 'triangle', from: f, to: f * 0.8, dur: 0.25, vol: 0.08, at: i * 0.04 }));
  },
  ping() {
    if (!ready('ping', 120)) return;
    tone({ type: 'sine', from: 1760, dur: 0.18, vol: 0.12 });
  },
  letter(ok) {
    if (!ready('letter', 60)) return;
    if (ok) tone({ type: 'triangle', from: 660, to: 990, dur: 0.15, vol: 0.18 });
    else tone({ type: 'square', from: 200, to: 150, dur: 0.18, vol: 0.08 });
  },
  powerup() {
    if (!ready('powerup', 200)) return;
    [523, 784, 1047, 1568].forEach((f, i) => tone({ type: 'sine', from: f, dur: 0.12, vol: 0.14, at: i * 0.05 }));
  },
  star() {
    if (!ready('star', 45)) return;
    tone({ type: 'sine', from: 1400 + Math.random() * 500, dur: 0.08, vol: 0.08 });
  },
};

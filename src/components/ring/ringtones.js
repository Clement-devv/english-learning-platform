// src/components/ring/ringtones.js
// Web Audio API ringtone definitions for the ring feature.
// Each entry's make() returns { stop } — call stop() to silence it immediately.
//
// All tones work entirely in-browser (no audio files required) via the
// Web Audio API, so they play even when no microphone permission is granted.

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Schedule a single sine-wave note on the given AudioContext.
 * Applies a fast attack and exponential decay so it sounds like a chime.
 */
function note(ctx, freq, startTime, duration, volume = 0.28) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

/**
 * Create a looping ringtone.
 * patternFn(ctx, currentTime) — schedules audio events for one repetition.
 * repeatMs — how long (ms) to wait before calling patternFn again.
 * Returns { stop }.
 */
function loop(patternFn, repeatMs) {
  let stopped = false;
  let ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return { stop: () => {} }; // Web Audio not supported — fail silently
  }

  function tick() {
    if (stopped || !ctx) return;
    patternFn(ctx, ctx.currentTime);
    setTimeout(tick, repeatMs);
  }

  // Chrome suspends new AudioContexts until a user gesture has occurred on the
  // page (autoplay policy). Calling resume() — which only needs a *prior* gesture,
  // not an immediate one — unblocks the context so the ringtone plays on the first
  // incoming call even though the event arrives via a socket (not a click).
  ctx.resume().then(() => {
    if (!stopped) tick();
  }).catch(() => {
    // Very old browsers where resume() isn't a Promise — try directly anyway
    if (!stopped) tick();
  });

  return {
    stop() {
      stopped = true;
      try { ctx?.close(); } catch { /* ignore */ }
    },
  };
}

// ── Ringtone catalogue ────────────────────────────────────────────────────────

export const RINGTONES = [
  {
    id:    "chime",
    label: "Triple Chime",
    emoji: "🎵",
    make:  () => loop((ctx, t) => {
      note(ctx, 523, t,        0.18);       // C5
      note(ctx, 659, t + 0.2,  0.18);       // E5
      note(ctx, 784, t + 0.4,  0.18);       // G5
    }, 1800),
  },
  {
    id:    "pulse",
    label: "Pulse",
    emoji: "📳",
    make:  () => loop((ctx, t) => {
      note(ctx, 880, t,        0.07, 0.22); // three quick hi-beeps
      note(ctx, 880, t + 0.12, 0.07, 0.22);
      note(ctx, 880, t + 0.24, 0.07, 0.22);
    }, 1300),
  },
  {
    id:    "bell",
    label: "Bell",
    emoji: "🔔",
    make:  () => loop((ctx, t) => {
      note(ctx, 440, t, 0.9, 0.22);         // single resonant low bell
    }, 2800),
  },
  {
    id:    "classic",
    label: "Classic",
    emoji: "☎️",
    // Traditional landline ring: 480 Hz + 425 Hz simultaneously
    make:  () => loop((ctx, t) => {
      [480, 425].forEach(freq => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.setValueAtTime(0.15, t + 0.9);
        gain.gain.linearRampToValueAtTime(0, t + 1.05);
        osc.start(t);
        osc.stop(t + 1.1);
      });
    }, 2200),
  },
  {
    id:    "marimba",
    label: "Marimba",
    emoji: "🎶",
    make:  () => loop((ctx, t) => {
      note(ctx, 784, t,        0.22, 0.26); // G5
      note(ctx, 659, t + 0.2,  0.18, 0.22); // E5
      note(ctx, 523, t + 0.37, 0.18, 0.20); // C5
      note(ctx, 659, t + 0.52, 0.25, 0.24); // E5
    }, 2100),
  },
];

export const DEFAULT_RINGTONE_ID  = "chime";
export const CUSTOM_RINGTONE_ID   = "custom";

/** Returns the ringtone entry for the given id, or the first one as fallback. */
export const getRingtoneById = (id) =>
  RINGTONES.find(r => r.id === id) ?? RINGTONES[0];

// ── Custom (user-uploaded) tone ───────────────────────────────────────────────

/**
 * Play a raw ArrayBuffer as a looping ringtone via the Web Audio API.
 * Decodes the audio data, then loops it natively using BufferSourceNode.loop.
 * Returns { stop } — call stop() to silence it immediately.
 *
 * NOTE: decodeAudioData detaches the buffer in some older browsers.
 * We always pass arrayBuffer.slice(0) to preserve the caller's copy.
 */
export function makeCustomRingtone(arrayBuffer) {
  if (!arrayBuffer) return { stop: () => {} };

  let stopped    = false;
  let sourceNode = null;
  let ctx;

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return { stop: () => {} };
  }

  // Resume the context first (handles Chrome's autoplay policy), then decode.
  // decodeAudioData is async — use .slice(0) so the original buffer isn't detached.
  const startPlayback = () => {
    if (stopped) return;
    ctx.decodeAudioData(arrayBuffer.slice(0), (decoded) => {
      if (stopped) return;
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.loop   = true;        // browser handles the loop natively — no timer tricks needed
      src.connect(ctx.destination);
      src.start();
      sourceNode = src;
    }, () => {
      // Decode failed (unsupported format, corrupted file, etc.) — fail silently
    });
  };

  ctx.resume().then(startPlayback).catch(startPlayback);

  return {
    stop() {
      stopped = true;
      try { sourceNode?.stop(); } catch { /* already stopped */ }
      try { ctx?.close();       } catch { /* ignore */         }
    },
  };
}

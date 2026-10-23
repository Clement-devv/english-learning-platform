// src/pages/games/word-squad/engine.js
// Runs one chapter: the simulation (logic/world.js) in fixed steps, the PixiJS
// renderer, input (drag, arrows / A-D), pause, adaptive quality, and callbacks
// to the React page for the question strip and the end screen.
// Loaded with import() so PixiJS stays out of the main bundle.
import { createWorld } from './logic/world.js';
import { screenDxToWorld, LOGICAL_H, PORTRAIT_W } from './logic/projection.js';
import { laneIndex } from './logic/squad.js';
import { rewardLabel } from './logic/rewards.js';
import { createRenderer } from './render/renderer.js';
import { createFx } from './render/fx.js';
import { unlockAudio, suspendAudio, resumeAudio } from './audio/sfx.js';

const STEP = 1 / 60;

export function detectDevice() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 600;
  return coarse || small ? 'phone' : 'desktop';
}

/**
 * @param host     element the canvas goes into
 * @param chapter  0 | 1 | 2
 * @param session  { seed, gates, answer } — from the demo now, the server later
 * @param on       { question(gate|null), lane(i), result(ev), stars(n), end(summary, liveStars), quality(level, fps) }
 */
export async function startGame({ host, chapter, session, on = {} }) {
  const device = detectDevice();
  const reducedMotion = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const R = await createRenderer({ host, device, reducedMotion });
  const fx = createFx(R, { reducedMotion, onStars: (n) => on.stars?.(n) });
  const world = createWorld({ chapter, seed: session.seed, gates: session.gates, answer: session.answer, device });

  // ── Input ──────────────────────────────────────────────────────────────────
  const keys = { left: false, right: false };
  let drag = null;
  let targetX = null;
  const cssToLogical = () => {
    const scale = Math.min(host.clientHeight / LOGICAL_H, host.clientWidth / PORTRAIT_W) || 1;
    return 1 / scale;
  };
  const onDown = (e) => {
    unlockAudio();
    drag = { id: e.pointerId, x: e.clientX, from: world.squad.targetX };
    host.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    targetX = drag.from + screenDxToWorld((e.clientX - drag.x) * cssToLogical()) * 1.25;
  };
  const onUp = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  const onKey = (down) => (e) => {
    const k = e.key.toLowerCase();
    if (k === 'arrowleft' || k === 'a') { keys.left = down; targetX = null; e.preventDefault(); }
    if (k === 'arrowright' || k === 'd') { keys.right = down; targetX = null; e.preventDefault(); }
    if (down) unlockAudio();
  };
  const keyDown = onKey(true), keyUp = onKey(false);
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);
  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);

  if (import.meta.env.DEV) window.__wordSquad = { world }; // for poking at the game in dev tools

  const ro = new ResizeObserver(() => R.resize());
  ro.observe(host);

  // ── Loop ───────────────────────────────────────────────────────────────────
  let paused = false;
  let ended = false;
  let raf = 0;
  let lastT = performance.now();
  let acc = 0;
  let simT = 0;
  let lastGate = undefined;
  let lastLane = -1;
  let lastWeapon = null;
  let lastPhase = null;
  // adaptive quality: average FPS over 2 s; below 45 step the quality down
  let quality = 0;
  let fpsFrames = 0, fpsTime = 0, warm = 2.5;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const real = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;
    if (paused) return;

    const scale = fx.timeScale(real);
    acc += real * scale;
    const steer = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    while (acc >= STEP) {
      acc -= STEP;
      simT += STEP;
      world.step(STEP, steer ? { steer } : targetX !== null ? { targetX } : {});
      if (steer) targetX = null;
      const events = world.events.splice(0);
      if (events.length) {
        fx.handle(events, world);
        for (const ev of events) {
          if (ev.type === 'gateResult') on.result?.(ev);
          if (ev.type === 'won' || ev.type === 'lost') ended = true;
        }
      }
    }

    const sim = real * scale;
    fx.update(sim, world);
    R.draw(world, simT, sim, fx.view);
    R.render();

    // question strip
    const g = world.activeGate();
    if (g !== lastGate || (g && world.squad.weapon !== lastWeapon)) {
      lastGate = g;
      lastWeapon = world.squad.weapon;
      lastLane = -1;
      on.question?.(g ? { index: g.index, prompt: g.prompt, choices: g.choices, reward: rewardLabel(g.reward, world.squad.weapon), boss: g.boss } : null);
    }
    if (g) { const lane = laneIndex(world.squad.x, g.n); if (lane !== lastLane) { lastLane = lane; on.lane?.(lane); } }
    if (world.phase !== lastPhase) { lastPhase = world.phase; on.phase?.(world.phase); }

    if (warm > 0) warm -= real;
    else {
      fpsFrames++; fpsTime += real;
      if (fpsTime >= 2) {
        const fps = fpsFrames / fpsTime;
        fpsFrames = 0; fpsTime = 0;
        if (fps < 45 && quality < 2) {
          quality++;
          R.setQuality(quality);
          fx.setQuality(quality);
          on.quality?.(quality, Math.round(fps));
        }
      }
    }

    if (ended) {
      ended = false;
      // let the victory / defeat effects play for a moment before the end screen
      setTimeout(() => on.end?.(world.summary(), fx.stars), world.phase === 'won' ? 1600 : 1200);
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    world,
    setPaused(p) {
      if (paused === p) return;
      paused = p;
      lastT = performance.now();
      if (p) suspendAudio(); else resumeAudio();
    },
    get paused() { return paused; },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      fx.destroy();
      R.destroy();
    },
  };
}

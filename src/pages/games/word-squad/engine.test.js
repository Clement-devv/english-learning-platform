import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ world: null, renderer: null }));
vi.mock('./logic/world.js', () => ({ createWorld: () => mock.world }));
vi.mock('./render/renderer.js', () => ({ createRenderer: async () => mock.renderer }));
vi.mock('./render/fx.js', () => ({ createFx: () => ({ timeScale: () => 1, update: vi.fn(), handle: vi.fn(), destroy: vi.fn(), setQuality: vi.fn(), view: {}, stars: 0 }) }));
vi.mock('./audio/sfx.js', () => ({ unlockAudio: vi.fn(), suspendAudio: vi.fn(), resumeAudio: vi.fn() }));
import { startGame } from './engine';

let frames, time, counter, game;
beforeEach(() => {
  frames = new Map(); time = 1000; counter = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => time);
  vi.stubGlobal('requestAnimationFrame', fn => { frames.set(++counter, fn); return counter; });
  vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  mock.world = { squad: { x: 0, targetX: 0, weapon: 'blaster' }, events: [], phase: 'run', step: vi.fn(), activeGate: () => null, summary: () => ({ won: true }) };
  mock.renderer = { resize: vi.fn(), draw: vi.fn(), render: vi.fn(), destroy: vi.fn(), setQuality: vi.fn() };
});
afterEach(() => { game?.destroy(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function tick(count = 1) {
  for (let i = 0; i < count; i++) {
    time += 20;
    const pending = [...frames.values()]; frames.clear();
    for (const frame of pending) frame(time);
  }
}
const start = async on => { game = await startGame({ host: document.createElement('div'), chapter: 0, session: {}, on }); return game; };

it('stops scheduling while paused and clears held steering on resume', async () => {
  await start();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
  tick();
  expect(mock.world.step.mock.calls.at(-1)[1]).toEqual({ steer: 1 });
  game.setPaused(true);
  expect(frames.size).toBe(0);
  game.setPaused(false); tick();
  expect(mock.world.step.mock.calls.at(-1)[1]).toEqual({});
  expect(frames.size).toBe(1);
});
it('delivers one result and stops rendering after the ending effects', async () => {
  const end = vi.fn(); await start({ end });
  mock.world.phase = 'won'; mock.world.events.push({ type: 'won' });
  tick(100);
  expect(end).toHaveBeenCalledTimes(1);
  expect(frames.size).toBe(0);
});
it('quitting during ending effects cancels the result and cleanup is idempotent', async () => {
  const end = vi.fn(); await start({ end });
  mock.world.phase = 'won'; mock.world.events.push({ type: 'won' }); tick();
  game.destroy(); game.destroy(); tick(100);
  expect(end).not.toHaveBeenCalled();
  expect(mock.renderer.destroy).toHaveBeenCalledTimes(1);
  expect(window.__wordSquad).toBeUndefined();
});

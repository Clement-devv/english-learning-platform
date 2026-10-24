// Tests for the flying bomber bosses (mini and big) that come before each chapter's boss.
import { describe, it, expect } from 'vitest';
import { createWorld } from './world.js';
import { buildChapterPlan } from './chapters.js';
import { FLYERS, CHAPTERS } from './config.js';

const MID = 20;
function bareWorld(opts = {}) {
  const w = createWorld({ chapter: 0, seed: 4, gates: [], answer: async () => ({ correct: true }), revive: false, ...opts });
  w.plan.events.length = 0;
  w.squad.count = MID;
  w.stats.answered = 5; // past the protected start
  return w;
}
function withFlyer(level, opts) {
  const w = bareWorld(opts);
  w.plan.events.push({ type: 'flyer', level, at: 0 });
  for (let i = 0; i < 60 * 8 && w.flyer?.state !== 'fight'; i++) w.step(1 / 60, { targetX: 0 });
  return w;
}

describe('flying bombers', () => {
  it('every chapter has a mini bomber, then a big one, both before the boss', () => {
    CHAPTERS.forEach((_, ch) => {
      const plan = buildChapterPlan(ch);
      const flyers = plan.events.filter((e) => e.type === 'flyer');
      expect(flyers.map((f) => f.level)).toEqual(['mini', 'big']);
      expect(flyers[0].at).toBeLessThan(flyers[1].at);
      expect(flyers[1].at).toBeLessThan(plan.bossAt);
    });
  });

  it('flies in, hovers within reach and drops bombs aimed at the squad', () => {
    const w = withFlyer('mini');
    expect(w.flyer.state).toBe('fight');
    expect(w.flyer.z - w.dist).toBeCloseTo(FLYERS.holdZ);
    for (let i = 0; i < 60 * 3 && !w.bombs.length; i++) w.step(1 / 60, { targetX: 0 });
    expect(w.bombs.length).toBe(FLYERS.mini.bombs);
    expect(Math.abs(w.bombs[0].x - w.squad.x)).toBeLessThan(0.2);
  });

  it('a bomb costs soldiers if the squad stays under it, and nothing if it steps aside', () => {
    const stay = withFlyer('mini');
    stay.flyer.hp = 1e9;
    for (let i = 0; i < 60 * 3 && !stay.bombs.length; i++) stay.step(1 / 60, { targetX: 0 });
    for (let i = 0; i < 60 * 2 && stay.bombs.length; i++) stay.step(1 / 60, { targetX: stay.bombs[0]?.x ?? 0 });
    expect(stay.squad.count).toBeLessThan(MID);
    expect(stay.events.some((e) => e.type === 'bombLand' && e.hit)).toBe(true);

    const move = withFlyer('mini');
    move.flyer.hp = 1e9;
    for (let i = 0; i < 60 * 3 && !move.bombs.length; i++) move.step(1 / 60, { targetX: 0 });
    const bx = move.bombs[0].x;
    for (let i = 0; i < 60 * 2 && move.bombs.length; i++) move.step(1 / 60, { targetX: bx > 0 ? -1.1 : 1.1 });
    expect(move.events.some((e) => e.type === 'bombLand' && e.hit)).toBe(false);
  });

  it('shooting it down gives its reward and coins', () => {
    const w = withFlyer('mini');
    const before = w.squad.count;
    w.flyer.hp = 1;
    for (let i = 0; i < 60 * 3 && w.flyer && w.flyer.state === 'fight'; i++) w.step(1 / 60, { targetX: w.flyer.x });
    expect(w.stats.flyersBeaten).toBe(1);
    expect(w.squad.count).toBeGreaterThanOrEqual(before + FLYERS.mini.reward.amount - 3);
    expect(w.stats.coins).toBeGreaterThanOrEqual(FLYERS.mini.coins);
  });

  it('the big one calls helpers at half health, and both fly away if not beaten in time', () => {
    const w = withFlyer('big');
    w.flyer.hp = w.flyer.maxHp * 0.49;
    w.step(1 / 60, { targetX: 0 });
    expect(w.events.some((e) => e.type === 'flyerHelpers')).toBe(true);
    w.flyer.hp = 1e9;
    w.flyer.time = FLYERS.leaveAfter;
    w.step(1 / 60, { targetX: 0 });
    expect(w.flyer.state).toBe('leave');
    for (let i = 0; i < 60 * 8 && w.flyer; i++) w.step(1 / 60, { targetX: 0 });
    expect(w.flyer).toBeNull();
  });
});

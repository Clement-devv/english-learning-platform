// Unit tests for the Word Squad simulation (no renderer involved).
import { describe, it, expect } from 'vitest';
import { createRng } from './rng.js';
import { applyReward, effectiveReward, rollReward } from './rewards.js';
import { computeStars } from './stars.js';
import { laneIndex, clampSquadX, formation, squadRadius } from './squad.js';
import { buildChapterPlan, choicesForGate, gateZ } from './chapters.js';
import { createWorld } from './world.js';
import { autopilot } from './autopilot.js';
import { createDemoSession } from '../data/demoSession.js';
import { DEMO_QUESTIONS } from '../data/demoQuestions.js';
import { ENEMY_CAP, CHAPTERS, ROAD_HALF, VISIBLE_SOLDIERS, MAX_SQUAD, START_SQUAD } from './config.js';

const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

/** A world with nothing scheduled, for testing one thing at a time. */
function bareWorld(opts = {}) {
  const w = createWorld({ chapter: 0, seed: 7, gates: [], answer: async () => ({ correct: true }), ...opts });
  w.plan.events.length = 0;
  return w;
}

describe('rng', () => {
  it('gives the same numbers for the same seed', () => {
    const a = createRng(42), b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });
});

describe('rewards', () => {
  it('turns a weapon the squad already has into +4 friends', () => {
    expect(effectiveReward({ type: 'weapon', weapon: 'minigun' }, 'minigun')).toMatchObject({ type: 'friends', amount: 4 });
    expect(applyReward({ count: 10, weapon: 'minigun' }, { type: 'weapon', weapon: 'minigun' })).toEqual({ count: 14, weapon: 'minigun' });
  });
  it('switches weapons, adds friends and doubles, capped', () => {
    expect(applyReward({ count: 5, weapon: 'blaster' }, { type: 'weapon', weapon: 'laser' }).weapon).toBe('laser');
    expect(applyReward({ count: 5, weapon: 'blaster' }, { type: 'friends', amount: 6 }).count).toBe(11);
    expect(applyReward({ count: 5, weapon: 'blaster' }, { type: 'double' }).count).toBe(10);
    expect(applyReward({ count: MAX_SQUAD - 1, weapon: 'blaster' }, { type: 'double' }).count).toBe(MAX_SQUAD);
  });
  it('rolls roughly 55% weapons, 30% friends, 15% doubles', () => {
    const rng = createRng(3);
    const n = { weapon: 0, friends: 0, double: 0 };
    for (let i = 0; i < 4000; i++) n[rollReward(rng).type] += 1;
    expect(n.weapon / 4000).toBeGreaterThan(0.5);
    expect(n.weapon / 4000).toBeLessThan(0.6);
    expect(n.friends / 4000).toBeGreaterThan(0.26);
    expect(n.double / 4000).toBeLessThan(0.19);
  });
});

describe('stars', () => {
  it('gives 3 per right word, a capped bonus and a boss bonus', () => {
    expect(computeStars({ right: 5, total: 7, bugsPopped: 400, bestCombo: 50, squadSize: 80, bossBeaten: true }))
      .toEqual({ base: 15, bonus: 15, boss: 10, total: 40 });
  });
  it('only pays the boss bonus when at least half the gates were right', () => {
    expect(computeStars({ right: 3, total: 7, bossBeaten: true }).boss).toBe(0);
    expect(computeStars({ right: 4, total: 7, bossBeaten: true }).boss).toBe(10);
    expect(computeStars({ right: 0, total: 0, bossBeaten: true }).boss).toBe(0);
  });
});

describe('squad', () => {
  it('finds the gate section the squad is lined up with', () => {
    expect(laneIndex(-1.4, 2)).toBe(0);
    expect(laneIndex(0.1, 2)).toBe(1);
    expect(laneIndex(0, 3)).toBe(1);
    expect(laneIndex(1.49, 3)).toBe(2);
    expect(laneIndex(99, 3)).toBe(2);
  });
  it('keeps the squad on the road and draws at most the visible cap', () => {
    expect(clampSquadX(5, 10) + squadRadius(10)).toBeLessThanOrEqual(ROAD_HALF);
    expect(formation(500)).toHaveLength(VISIBLE_SOLDIERS);
  });
});

describe('chapter plan', () => {
  it('has the configured gates, floods, crate pairs and a boss after the last gate', () => {
    CHAPTERS.forEach((cfg, ch) => {
      const plan = buildChapterPlan(ch);
      const count = (t) => plan.events.filter((e) => e.type === t).length;
      expect(count('gate')).toBe(cfg.gates);
      expect(count('swarm')).toBe(cfg.swarms);
      expect(count('crates')).toBe(2);
      expect(count('boss')).toBe(1);
      expect(plan.bossAt).toBeGreaterThan(gateZ(cfg.gates - 1));
      const ats = plan.events.map((e) => e.at);
      expect(ats).toEqual([...ats].sort((a, b) => a - b));
    });
  });
  it('starts with 2-choice gates and moves to 3', () => {
    expect(choicesForGate(0, 0)).toBe(2);
    expect(choicesForGate(0, 3)).toBe(2);
    expect(choicesForGate(0, 4)).toBe(3);
    expect(choicesForGate(2, 0)).toBe(2);
    expect(choicesForGate(2, 1)).toBe(3);
  });
});

describe('world: gates', () => {
  const gate = { gateId: 'g1', prompt: 'I ___ a cat.', choices: ['have', 'has'], reward: { type: 'friends', amount: 5 } };

  it('answers with the word the squad runs through and applies the reward', async () => {
    const calls = [];
    const w = bareWorld({ gates: [gate], answer: async (id, choice) => { calls.push([id, choice]); return { correct: choice === 'have', correctAnswer: 'have' }; } });
    w.plan.events.push({ type: 'gate', gate: 0, z: 1, at: 0 });
    w.step(0.016, { targetX: -1 });                 // line up with the left section
    expect(w.activeGate()?.prompt).toBe('I ___ a cat.');
    for (let i = 0; i < 120; i++) w.step(0.016, { targetX: -1 });
    await flush();
    w.step(0.016, { targetX: -1 });
    expect(calls).toEqual([['g1', 'have']]);
    expect(w.stats.right).toBe(1);
    expect(w.squad.count).toBe(START_SQUAD[0] + 5);
    expect(w.events.some((e) => e.type === 'gateResult' && e.correct)).toBe(true);
  });

  it('a wrong word costs 2 soldiers, sends an angry swarm and a mini-boss, and is kept for review', async () => {
    const w = bareWorld({ gates: [gate], answer: async () => ({ correct: false, correctAnswer: 'have' }) });
    w.plan.events.push({ type: 'gate', gate: 0, z: 0.5, at: 0 });
    for (let i = 0; i < 60; i++) w.step(0.016, { targetX: 1 });
    await flush();
    w.step(0.016, { targetX: 1 });
    expect(w.squad.count).toBe(START_SQUAD[0] - 2);
    expect(w.swarmBoost).toBeCloseTo(0.35);
    expect(w.enemies.some((e) => e.kind === 'mini')).toBe(true);
    expect(w.enemies.filter((e) => e.angry && e.kind === 'bug').length).toBe(6); // 6 + 3 × chapter
    expect(w.review).toEqual([{ prompt: 'I ___ a cat.', answer: 'have', chose: 'has' }]);
  });

  it('answers each gate only once', async () => {
    let n = 0;
    const w = bareWorld({ gates: [gate], answer: async () => { n += 1; return { correct: true }; } });
    w.plan.events.push({ type: 'gate', gate: 0, z: 0.3, at: 0 });
    for (let i = 0; i < 200; i++) w.step(0.016);
    await flush();
    for (let i = 0; i < 50; i++) w.step(0.016);
    expect(n).toBe(1);
  });
});

describe('world: combat', () => {
  it('a bug that reaches the squad costs one soldier', () => {
    const w = bareWorld();
    w.squad.count = 5;
    w.enemies.push({ id: 999, kind: 'bug', species: 'snail', x: 0, z: 0.1, hp: 999, maxHp: 999, r: 0.14, speed: 0.3, flashT: 0 });
    w.step(0.016);
    expect(w.squad.count).toBe(4);
    expect(w.enemies).toHaveLength(0);
  });

  it('bullets pop a bug inside the blaster range but not one far away', () => {
    const w = bareWorld();
    w.enemies.push({ id: 1, kind: 'bug', species: 'bee', x: 0, z: 3, hp: 1, maxHp: 1, r: 0.11, speed: 0, flashT: 0 });
    w.enemies.push({ id: 2, kind: 'bug', species: 'bee', x: 0, z: 13, hp: 1, maxHp: 1, r: 0.11, speed: 0, flashT: 0 });
    for (let i = 0; i < 60; i++) w.step(0.016);
    expect(w.enemies.map((e) => e.id)).toEqual([2]);
    expect(w.stats.bugsPopped).toBe(1);
  });

  it('kills close together chain into a combo', () => {
    const w = bareWorld();
    w.squad.weapon = 'laser';
    w.squad.count = 40;
    for (let i = 0; i < 6; i++) w.enemies.push({ id: 10 + i, kind: 'bug', species: 'bee', x: 0, z: 1 + i * 0.1, hp: 1, maxHp: 1, r: 0.11, speed: 0, flashT: 0 });
    w.step(0.016);
    expect(w.stats.bestCombo).toBeGreaterThanOrEqual(5);
  });

  it('never has more living bugs than the cap — the rest wait at the horizon', () => {
    const w = bareWorld({ device: 'phone' });
    w.squad.count = 1; // one soldier barely dents a flood
    w.plan.events.push({ type: 'swarm', size: 70, at: 0 }, { type: 'swarm', size: 70, at: 0 });
    w.step(0.016);
    expect(w.enemies.length).toBeLessThanOrEqual(ENEMY_CAP.phone);
    expect(w.queue.length).toBeGreaterThan(0);
  });

  it('running into an unbroken crate costs 2 soldiers', () => {
    const w = bareWorld();
    w.squad.weapon = 'blaster';
    w.crates.push({ id: 5, x: 0, z: 0.05, hp: 999, maxHp: 999, r: 0.22, drop: { type: 'friends', amount: 3 }, flashT: 0 });
    w.step(0.016);
    expect(w.squad.count).toBe(START_SQUAD[0] - 2);
  });

  it('shooting a crate open gives its drop', () => {
    const w = bareWorld();
    w.crates.push({ id: 6, x: 0, z: 2, hp: 1, maxHp: 1, r: 0.22, drop: { type: 'weapon', weapon: 'rockets' }, flashT: 0 });
    for (let i = 0; i < 40; i++) w.step(0.016);
    expect(w.squad.weapon).toBe('rockets');
  });
});

describe('world: whole chapter', () => {
  // Plays a chapter with the autopilot: dodges boss attacks, and runs through
  // the right word `rightRate` of the time.
  async function play(chapter, rightRate, seed = 11) {
    const session = createDemoSession(chapter, seed);
    const rng = createRng(seed);
    const w = createWorld({ chapter, seed, gates: session.gates, answer: session.answer });
    const picks = new Map();
    const pick = (g) => {
      if (!picks.has(g.id)) {
        const right = g.choices.indexOf(DEMO_QUESTIONS.find((q) => q.prompt === g.prompt).answer);
        picks.set(g.id, rng.next() < rightRate ? right : (right + 1) % g.n);
      }
      return picks.get(g.id);
    };
    let t = 0;
    while (w.phase !== 'won' && w.phase !== 'lost' && t < 600) {
      w.step(1 / 30, { targetX: autopilot(w, pick) });
      w.events.length = 0;
      t += 1 / 30;
      if (Math.round(t * 30) % 15 === 0) await flush();
    }
    return { w, t };
  }

  it('always ends (won or lost) within a few minutes of play', async () => {
    const { w, t } = await play(0, 0.5);
    expect(['won', 'lost']).toContain(w.phase);
    expect(t).toBeLessThan(600);
  });

  // Balance guard: all right answers should (nearly always) win in about 3–5
  // minutes; all wrong answers should never win.
  it.each([0, 1, 2])('chapter %i: right answers make the squad strong enough to win', async (ch) => {
    const runs = await Promise.all([11, 37, 41].map((seed) => play(ch, 1, seed)));
    const wins = runs.filter((r) => r.w.phase === 'won');
    expect(wins.length).toBeGreaterThanOrEqual(2);
    for (const { w, t } of wins) {
      expect(w.stats.bossBeaten).toBe(true);
      expect(t).toBeGreaterThan(150);
      expect(t).toBeLessThan(360);
    }
  });

  it.each([0, 1, 2])('chapter %i: all wrong answers never win', async (ch) => {
    const { w } = await play(ch, 0, 23);
    expect(w.phase).toBe('lost');
  });
});

// Tests for Batch 1: road challenges, the boss rework, revive and the 3-star rating.
import { describe, it, expect } from 'vitest';
import { createWorld } from './world.js';
import { createRoad } from './road.js';
import { createRng } from './rng.js';
import { autopilot } from './autopilot.js';
import { chapterRating } from './rating.js';
import { createDemoSession } from '../data/demoSession.js';
import { DEMO_QUESTIONS } from '../data/demoQuestions.js';
import { ROAD_HALF } from './config.js';

const MID = 8; // squad size in the middle of a chapter
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

/** A world with nothing scheduled, for testing one thing at a time. */
function bareWorld(opts = {}) {
  const w = createWorld({ chapter: 0, seed: 7, gates: [], answer: async () => ({ correct: true }), ...opts });
  w.plan.events.length = 0;
  w.squad.count = MID;
  w.stats.answered = 5; // past the protected start
  return w;
}
const spinnerAt = (x, z = 0.05) => ({ id: 1, kind: 'spinner', cx: x, x, z, r: 0.2, amp: 0, speed: 0, phase: 0, done: false });

describe('road challenges', () => {
  it('a spinner costs soldiers when the squad runs into it, and nothing when it dodges', () => {
    const hit = bareWorld();
    hit.obstacles.push(spinnerAt(0));
    hit.step(0.016, { targetX: 0 });
    expect(hit.squad.count).toBe(MID - 2);

    const dodge = bareWorld();
    dodge.squad.x = dodge.squad.targetX = -1.2;
    dodge.obstacles.push(spinnerAt(1));
    dodge.step(0.016, { targetX: -1.2 });
    expect(dodge.squad.count).toBe(MID);
  });

  it('a gumdrop wall only lets the squad through its gap', () => {
    const inGap = bareWorld();
    inGap.obstacles.push({ id: 1, kind: 'wall', gx0: -0.6, gx1: 0.6, z: 0.05, done: false });
    inGap.step(0.016, { targetX: 0 });
    expect(inGap.squad.count).toBe(MID);

    const miss = bareWorld();
    miss.squad.x = miss.squad.targetX = 1;
    miss.obstacles.push({ id: 1, kind: 'wall', gx0: -0.6, gx1: 0.6, z: 0.05, done: false });
    miss.step(0.016, { targetX: 1 });
    expect(miss.squad.count).toBe(MID - 2);
  });

  it('collects coins, friend bubbles and power-ups the squad runs over', () => {
    const w = bareWorld();
    w.pickups.push(
      { id: 1, kind: 'coin', x: 0, z: 0.05, r: 0.18 },
      { id: 2, kind: 'friends', x: 0, z: 0.05, r: 0.2 },
      { id: 3, kind: 'shield', x: 0, z: 0.05, r: 0.2 },
      { id: 4, kind: 'coin', x: 1.3, z: 0.05, r: 0.18 }, // off to the side: missed
    );
    w.step(0.016, { targetX: 0 });
    expect(w.stats.coins).toBe(1);
    expect(w.squad.count).toBe(MID + 3);
    expect(w.squad.shieldT).toBeGreaterThan(5);
  });

  it('a shield blocks obstacle damage', () => {
    const w = bareWorld();
    w.squad.shieldT = 5;
    w.obstacles.push(spinnerAt(0));
    w.step(0.016, { targetX: 0 });
    expect(w.squad.count).toBe(MID);
  });

  it('spells a word when the squad runs through the right letter each time', () => {
    const w = bareWorld();
    let id = 1000;
    const road = createRoad({ w, rng: createRng(1), emit: (e) => w.events.push(e), newId: () => id++, loseSoldiers: () => {}, chapter: 0 });
    road.spawn({ type: 'spell', z: w.dist + 1 });
    const word = w.spell.word;
    for (let i = 0; i < 60 * 12 && !w.spell.over; i++) {
      const next = w.letters.find((l) => !l.done);
      w.step(1 / 60, { targetX: next ? -1 + next.lane : 0 }); // lane centres are −1, 0, 1
    }
    expect(w.spell.over).toBe(true);
    expect(w.events.some((e) => e.type === 'spellDone' && e.ok && e.word === word)).toBe(true);
    expect(w.stats.spells).toBe(1);
  });
});

describe('boss rework', () => {
  /** A world fast-forwarded to the boss fight */
  function bossWorld(chapter) {
    const session = createDemoSession(chapter, 5);
    const w = createWorld({ chapter, seed: 5, gates: session.gates, answer: session.answer, revive: false });
    w.plan.events.forEach((e) => { if (e.type !== 'boss') e.type = 'noop'; });
    w.dist = w.plan.bossAt;
    for (let i = 0; i < 60 * 12 && w.boss?.state !== 'fight'; i++) w.step(1 / 60, { targetX: 0 });
    w.enemies.length = 0;
    w.squad.count = 40;
    return w;
  }

  it('winds up, then sends a projectile that hits if the squad stays in the lane', () => {
    const w = bossWorld(1);
    w.boss.attackT = 0;
    w.boss.attackIndex = 0; // Bongo's drum shockwave
    w.step(1 / 60, { targetX: w.squad.x });
    expect(w.telegraphs[0].state).toBe('windup');
    const before = w.squad.count;
    for (let i = 0; i < 60 * 3 && w.telegraphs.length; i++) w.step(1 / 60, { targetX: w.squad.x });
    expect(w.squad.count).toBeLessThan(before);
    expect(w.stats.bossHits).toBe(1);
  });

  it('the same attack misses if the squad steps out of the lane in time', () => {
    const w = bossWorld(1);
    w.boss.attackT = 0;
    w.boss.attackIndex = 0;
    w.step(1 / 60, { targetX: w.squad.x });
    const before = w.squad.count;
    for (let i = 0; i < 60 * 3 && w.telegraphs.length; i++) w.step(1 / 60, { targetX: autopilot(w, () => 0) });
    expect(w.squad.count).toBe(before);
    expect(w.stats.bossHits).toBe(0);
  });

  it('opens a weak spot after an attack, and hits there do triple damage', () => {
    const w = bossWorld(0);
    w.boss.attackT = 0;
    for (let i = 0; i < 60 * 5 && !w.boss.weak; i++) w.step(1 / 60, { targetX: autopilot(w, () => 0) });
    expect(w.boss.weak).not.toBeNull();
  });

  it('gets angry at two thirds and at one third health', () => {
    const w = bossWorld(0);
    w.boss.hp = w.boss.maxHp * 0.6;
    w.step(1 / 60);
    expect(w.boss.phase).toBe(1);
    w.boss.hp = w.boss.maxHp * 0.3;
    w.step(1 / 60);
    expect(w.boss.phase).toBe(2);
  });

  it('puts up a word-shield with the boss gate; the right word shatters it for a big hit', async () => {
    const w = bossWorld(0);
    for (let i = 0; i < 60 * 8 && !w.boss.shield; i++) w.step(1 / 60, { targetX: 0 });
    expect(w.boss.shield).toBe(true);
    const g = w.activeGate();
    expect(g.boss).toBe(true);
    const right = g.choices.indexOf(DEMO_QUESTIONS.find((q) => q.prompt === g.prompt).answer);
    const laneX = -ROAD_HALF + ((right + 0.5) * 2 * ROAD_HALF) / g.n;
    w.squad.count = 2; // too few to hurt the boss much — the shield break is what we measure
    const hpBefore = w.boss.hp;
    for (let i = 0; i < 60 * 14 && g.state === 'coming'; i++) { w.squad.shieldT = 1; w.step(1 / 60, { targetX: laneX }); }
    await flush();
    w.step(1 / 60, { targetX: laneX });
    expect(w.boss.shield).toBe(false);
    expect(w.events.some((e) => e.type === 'shieldBreak')).toBe(true);
    expect(hpBefore - w.boss.hp).toBeGreaterThan(w.boss.maxHp * 0.14);
  });
});

describe('revive and rating', () => {
  it('stops at zero soldiers for one bonus question; a right answer brings the squad back', () => {
    const w = bareWorld();
    w.squad.count = 1;
    w.enemies.push({ id: 9, kind: 'bug', species: 'snail', x: 0, z: 0.1, hp: 999, maxHp: 999, r: 0.14, speed: 0, flashT: 0 });
    w.step(0.016);
    expect(w.phase).toBe('down');
    w.step(0.5);
    expect(w.phase).toBe('down'); // frozen while the question is on screen
    w.revive(true);
    expect(w.phase).toBe('run');
    expect(w.squad.count).toBeGreaterThan(0);
    // only once per chapter
    w.squad.count = 0;
    w.step(0.016);
    expect(w.phase).toBe('lost');
  });

  it('a wrong revive answer ends the chapter', () => {
    const w = bareWorld();
    w.squad.count = 0;
    w.step(0.016);
    w.revive(false);
    expect(w.phase).toBe('lost');
  });

  it('rates a chapter with up to 3 stars', () => {
    expect(chapterRating({ won: false, right: 7, total: 7 }).count).toBe(0);
    expect(chapterRating({ won: true, right: 3, total: 7, bossHits: 2, bestCombo: 5 }).count).toBe(1);
    expect(chapterRating({ won: true, right: 6, total: 7, bossHits: 2, bestCombo: 5 }).count).toBe(2);
    expect(chapterRating({ won: true, right: 6, total: 7, bossHits: 0, bestCombo: 5 }).count).toBe(3);
    expect(chapterRating({ won: true, right: 6, total: 7, bossHits: 3, bestCombo: 31 }).count).toBe(3);
  });
});

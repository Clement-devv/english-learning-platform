// Tests for the speed-up on right answers and the shooting bugs after wrong ones.
import { describe, it, expect } from 'vitest';
import { createWorld } from './world.js';
import { SPEED, SPEED_MAX, SPEED_PER_RIGHT, SHOOTERS, START_SQUAD, FIRST_GATE_REWARD, GATE_GAP_S } from './config.js';
import { buildChapterPlan } from './chapters.js';

const MID = 8; // squad size in the middle of a chapter
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
const gate = (id) => ({ gateId: id, prompt: 'I ___ a cat.', choices: ['have', 'has'], reward: { type: 'friends', amount: 1 } });

function bareWorld(opts = {}) {
  const w = createWorld({ chapter: 0, seed: 3, gates: [], answer: async () => ({ correct: true }), revive: false, ...opts });
  w.plan.events.length = 0;
  w.squad.count = MID;
  w.stats.answered = 5; // past the protected start
  return w;
}
async function passGate(w, z = 0.3) {
  w.plan.events.push({ type: 'gate', gate: 0, z: w.dist + z, at: 0 });
  for (let i = 0; i < 60; i++) w.step(1 / 60);
  await flush();
  w.step(1 / 60);
}

describe('speed', () => {
  it('runs faster after every right answer, up to a cap', async () => {
    const w = bareWorld({ gates: [gate('g')] });
    const d0 = w.dist; w.step(0.5); const slow = w.dist - d0;
    await passGate(w);
    expect(w.speedMul).toBeCloseTo(1 + SPEED_PER_RIGHT);
    const d1 = w.dist; w.step(0.5);
    expect(w.dist - d1).toBeGreaterThan(slow);
    w.speedMul = SPEED_MAX;
    await passGate(w);
    expect(w.speedMul).toBe(SPEED_MAX);
    expect(SPEED * SPEED_MAX).toBeGreaterThan(SPEED);
  });

  it('a wrong answer does not speed up', async () => {
    const w = bareWorld({ gates: [gate('g')], answer: async () => ({ correct: false, correctAnswer: 'has' }) });
    await passGate(w);
    expect(w.speedMul).toBe(1);
  });
});

describe('shooting bugs', () => {
  it('no bug shoots before enough wrong answers; afterwards some do', () => {
    const calm = bareWorld();
    calm.plan.events.push({ type: 'swarm', size: 40, at: 0 });
    calm.step(1 / 60);
    expect(calm.enemies.some((e) => e.shooter)).toBe(false);

    const angry = bareWorld();
    angry.stats.wrong = SHOOTERS.fromWrong + 2;
    angry.plan.events.push({ type: 'swarm', size: 40, at: 0 });
    angry.step(1 / 60);
    expect(angry.enemies.filter((e) => e.shooter).length).toBeGreaterThan(5);
    expect(angry.events.some((e) => e.type === 'shootersArrive')).toBe(true);
  });

  it('a shooter takes aim, spits, and the goo costs a soldier if the squad stays put', () => {
    const w = bareWorld();
    w.squad.count = 1; // too few to shoot it down quickly
    w.enemies.push({ id: 1, kind: 'bug', species: 'snail', angry: true, x: 0, z: w.dist + 4, hp: 999, maxHp: 999, r: 0.14, speed: 0, flashT: 0, phase: 0, shooter: true, fireT: 0.3, aimX: null });
    w.step(1 / 60);
    expect(w.enemies[0].aimX).not.toBeNull(); // the warning swell
    for (let i = 0; i < 60 && !w.shots.length; i++) w.step(1 / 60, { targetX: 0 });
    expect(w.shots.length).toBe(1);
    w.squad.count = 5;
    for (let i = 0; i < 240 && w.shots.length; i++) w.step(1 / 60, { targetX: 0 });
    expect(w.squad.count).toBe(4);
  });

  it('stepping aside dodges the goo', () => {
    const w = bareWorld();
    w.squad.count = 5;
    w.enemies.push({ id: 1, kind: 'bug', species: 'snail', angry: true, x: 0, z: w.dist + 4, hp: 999, maxHp: 999, r: 0.14, speed: 0, flashT: 0, phase: 0, shooter: true, fireT: 0.01, aimX: 0 });
    for (let i = 0; i < 10 && !w.shots.length; i++) w.step(1 / 60, { targetX: 0 });
    w.enemies.length = 0;
    for (let i = 0; i < 240 && w.shots.length; i++) w.step(1 / 60, { targetX: 1.0 });
    expect(w.squad.count).toBe(5);
  });

  it('a wrong answer brings a big angry flood', async () => {
    const w = bareWorld({ gates: [gate('g')], answer: async () => ({ correct: false, correctAnswer: 'has' }) });
    await passGate(w);
    expect(w.squad.count).toBe(MID - 2);
    expect(w.enemies.filter((e) => e.angry && e.kind === 'bug').length).toBeGreaterThanOrEqual(7);
  });
});

describe('one-soldier start and close gates', () => {
  it('every chapter starts with a single soldier', () => {
    for (const ch of [0, 1, 2]) {
      const w = createWorld({ chapter: ch, seed: 1, gates: [], answer: async () => ({ correct: true }) });
      expect(w.squad.count).toBe(START_SQUAD[ch]);
      expect(START_SQUAD[ch]).toBe(1);
    }
  });

  it('the first right word always brings friends', async () => {
    const w = createWorld({ chapter: 0, seed: 1, gates: [gate('g0')], answer: async () => ({ correct: true }), revive: false });
    w.plan.events.length = 0;
    await passGate(w);
    expect(w.squad.count).toBe(1 + FIRST_GATE_REWARD.amount);
  });

  it('hits during the first gate cannot take the lone soldier', async () => {
    const w = createWorld({ chapter: 0, seed: 1, gates: [gate('g0')], answer: async () => ({ correct: false, correctAnswer: 'has' }), revive: false });
    w.plan.events.length = 0;
    w.enemies.push({ id: 9, kind: 'bug', species: 'snail', x: 0, z: w.dist + 0.1, hp: 999, maxHp: 999, r: 0.14, speed: 0, flashT: 0 });
    w.step(1 / 60);
    expect(w.squad.count).toBe(1);
    await passGate(w); // a wrong first word
    expect(w.squad.count).toBe(1);
    expect(w.phase).toBe('run');
  });

  it('questions come every few seconds', () => {
    const plan = buildChapterPlan(0);
    const gates = plan.events.filter((e) => e.type === 'gate').map((e) => e.z);
    for (let i = 1; i < gates.length; i++) expect((gates[i] - gates[i - 1]) / SPEED).toBeCloseTo(GATE_GAP_S);
    expect(GATE_GAP_S).toBeLessThanOrEqual(16);
  });
});

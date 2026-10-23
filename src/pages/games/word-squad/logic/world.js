// src/pages/games/word-squad/logic/world.js
// The Word Squad simulation: squad, bugs, bullets, crates, Word Gates and the
// boss. Plain data in, plain data out — no rendering, no timers, no DOM — so it
// runs the same in tests. The renderer reads the state after each step() and
// drains world.events for effects and sounds.
//
//   const world = createWorld({ chapter, seed, gates, answer });
//   world.step(dt, { steer, targetX });
//
// `gates` are [{ gateId, prompt, choices, reward }] (the last one is used during
// the boss fight). `answer(gateId, choice)` returns a Promise of
// { correct, correctAnswer } — the demo answers locally, the real game asks the server.
import {
  SPEED, VIEW_DIST, STEER_SPEED, START_SQUAD, ENEMY_CAP, COMBO_WINDOW, WEAPONS,
  MAX_SHOOTERS, AIM_ASSIST, BASE_POWER, SPECIES, CHAPTER_HP, SWARM_BOOST_PER_WRONG, SWARM_BOOST_MAX, MINI_BOSS, CRATE,
  BOSS_HOLD_Z, BOSS_RADIUS, TELEGRAPH_S, WRONG_IN_BOSS_HP, ROAD_HALF, MAX_SQUAD,
} from './config.js';
import { createRng } from './rng.js';
import { buildChapterPlan, choicesForGate } from './chapters.js';
import { formation, squadRadius, clampSquadX, laneIndex } from './squad.js';
import { applyReward, rollReward, effectiveReward } from './rewards.js';

const TRICKLE_EVERY = [1.5, 1.25, 1.05];
const SPECIES_MIX = [
  ['beetle', 'beetle', 'bee', 'bee', 'beetle'],
  ['beetle', 'bee', 'bee', 'snail', 'spiderbot'],
  ['beetle', 'bee', 'snail', 'spiderbot', 'spiderbot'],
];

/** Remove items failing `keep` without allocating a new array. */
function compact(list, keep) {
  let j = 0;
  for (let i = 0; i < list.length; i++) if (keep(list[i])) list[j++] = list[i];
  list.length = j;
}

export function createWorld({ chapter = 0, seed = 1, gates = [], answer, device = 'desktop' } = {}) {
  const rng = createRng(seed);
  const plan = buildChapterPlan(chapter);
  const hpScale = CHAPTER_HP[chapter] ?? CHAPTER_HP[CHAPTER_HP.length - 1];
  const enemyCap = ENEMY_CAP[device] || ENEMY_CAP.desktop;
  let nextId = 1;
  let planIndex = 0;

  const w = {
    chapter, plan, t: 0, dist: 0, phase: 'run', // run | boss | finish | won | lost
    squad: { x: 0, targetX: 0, count: START_SQUAD[chapter] ?? START_SQUAD[START_SQUAD.length - 1], weapon: 'blaster' },
    enemies: [], crates: [], bullets: [], gates: [], telegraphs: [],
    beam: null, boss: null, archZ: null,
    queue: [], swarmBoost: 0,
    stats: { bugsPopped: 0, combo: 0, bestCombo: 0, lastKillT: -9, right: 0, wrong: 0, answered: 0, bossBeaten: false },
    review: [], results: [],
    events: [],
  };

  let fireT = 0;
  let trickleT = 2;
  let beamHitT = 0;
  let pending = [];      // answers that came back, applied on the next step
  let bossGateAt = null; // time the boss-fight gate appears
  let sweepT = 0;        // after the boss: pop the leftover bugs one by one

  const emit = (ev) => w.events.push(ev);
  const loseSoldiers = (n, cause) => {
    if (n <= 0 || w.phase === 'won' || w.phase === 'lost') return;
    w.squad.count = Math.max(0, w.squad.count - n);
    emit({ type: 'squadHit', amount: n, cause });
  };

  // ── Spawning ───────────────────────────────────────────────────────────────
  function makeBug(species, x, rz, angry = false) {
    const sp = SPECIES[species];
    const hp = sp.hp * hpScale * (angry ? 1.5 : 1);
    return {
      id: nextId++, kind: 'bug', species, angry, x, z: w.dist + rz,
      hp, maxHp: hp, r: sp.radius, speed: sp.speed * (angry ? 1.2 : 1) * (0.9 + rng.next() * 0.2),
      flashT: 0, phase: rng.next() * 6.28,
    };
  }
  function spawnBug(species, x, rz, angry) {
    const bug = makeBug(species, x, rz, angry);
    if (w.enemies.length < enemyCap) w.enemies.push(bug);
    else w.queue.push(bug); // waits at the horizon until there is room
  }
  function spawnSwarm(size, { angry = false, rz = VIEW_DIST } = {}) {
    const n = Math.round(size);
    const mix = SPECIES_MIX[chapter] || SPECIES_MIX[2];
    let made = 0;
    for (let row = 0; made < n; row++) {
      // Packed rows, 9 then 8 across (the 8-rows sit in the gaps)
      const cols = row % 2 ? 8 : 9;
      const span = 2 * (ROAD_HALF - 0.2);
      const step = span / 8;
      for (let c = 0; c < cols && made < n; c++, made++) {
        const x = -span / 2 + c * step + (row % 2 ? step / 2 : 0);
        spawnBug(rng.pick(mix), x, rz + row * 0.32, angry);
      }
    }
    emit({ type: 'swarm', size: n, angry });
  }
  function spawnCrates() {
    for (const side of [-1, 1]) {
      const hp = Math.round(CRATE.hp * (1 + chapter * 0.6));
      const drop = rng.chance(0.5)
        ? { type: 'weapon', weapon: rng.pick(['double', 'minigun', 'laser', 'rockets']) }
        : { type: 'friends', amount: rng.int(3, 6) };
      w.crates.push({ id: nextId++, x: side * CRATE.laneX, z: w.dist + VIEW_DIST, hp, maxHp: hp, r: CRATE.radius, drop, flashT: 0 });
    }
  }
  function spawnGate(index, data, z, boss = false) {
    if (!data) return;
    const n = Math.min(data.choices.length, boss ? 3 : choicesForGate(chapter, index));
    w.gates.push({
      id: nextId++, index, gateId: data.gateId, prompt: data.prompt,
      choices: data.choices.slice(0, n), n, reward: data.reward || rollReward(rng),
      z, state: 'coming', boss, choice: null, correct: null, correctAnswer: null,
    });
  }
  function spawnMiniBoss() {
    const hp = Math.round(MINI_BOSS.hp * hpScale);
    w.enemies.push({
      id: nextId++, kind: 'mini', species: 'spiderbot', angry: true, x: (rng.next() - 0.5) * 1.6,
      z: w.dist + 9, hp, maxHp: hp, r: MINI_BOSS.radius, speed: MINI_BOSS.speed, flashT: 0, phase: 0,
    });
    emit({ type: 'miniBoss' });
  }
  function spawnBoss() {
    const b = plan.boss;
    w.boss = {
      kind: b.kind, name: b.name, hp: b.hp, maxHp: b.hp, x: 0, z: w.dist + VIEW_DIST,
      state: 'enter', attackT: 2.2, attackIndex: 0, flashT: 0, dyingT: 0,
    };
    w.phase = 'boss';
    emit({ type: 'bossSpawn', kind: b.kind, name: b.name });
  }

  function runPlan() {
    while (planIndex < plan.events.length && plan.events[planIndex].at <= w.dist) {
      const ev = plan.events[planIndex++];
      if (ev.type === 'gate') spawnGate(ev.gate, gates[ev.gate], ev.z);
      else if (ev.type === 'swarm') spawnSwarm(ev.size * (1 + w.swarmBoost));
      else if (ev.type === 'crates') spawnCrates();
      else if (ev.type === 'boss') spawnBoss();
    }
  }

  // ── Damage ─────────────────────────────────────────────────────────────────
  function kill(e, { counted = true } = {}) {
    e.hp = 0;
    e.dead = true;
    if (!counted) { // the leftovers popped after the boss: a show, not a score
      emit({ type: 'pop', x: e.x, z: e.z, species: e.species, angry: e.angry, big: e.kind === 'mini' });
      return;
    }
    const s = w.stats;
    s.bugsPopped += 1;
    s.combo = w.t - s.lastKillT <= COMBO_WINDOW ? s.combo + 1 : 1;
    s.lastKillT = w.t;
    if (s.combo > s.bestCombo) s.bestCombo = s.combo;
    emit({ type: 'pop', x: e.x, z: e.z, species: e.species, angry: e.angry, big: e.kind === 'mini' });
    if (s.combo >= 3) emit({ type: 'combo', count: s.combo });
  }
  function damage(target, amount, kind) {
    if (target.dead || amount <= 0) return;
    target.hp -= amount;
    target.flashT = 0.06;
    if (target === w.boss) {
      if (w.boss.hp <= 0 && w.boss.state === 'fight') defeatBoss();
      return;
    }
    if (target.drop !== undefined) { // crate
      if (target.hp <= 0) openCrate(target);
      return;
    }
    if (target.hp <= 0) kill(target);
    else if (kind !== 'beam') emit({ type: 'hit', x: target.x, z: target.z });
  }
  function openCrate(c) {
    c.dead = true;
    const before = w.squad.weapon;
    w.squad = { ...w.squad, ...applyReward(w.squad, c.drop) };
    emit({ type: 'crateOpen', x: c.x, z: c.z, reward: effectiveReward(c.drop, before) });
  }
  function explode(x, z, radius, dmg) {
    emit({ type: 'explode', x, z, radius });
    for (const e of w.enemies) {
      if (!e.dead && Math.hypot(e.x - x, e.z - z) < radius + e.r) damage(e, dmg, 'splash');
    }
    for (const c of w.crates) if (!c.dead && Math.hypot(c.x - x, c.z - z) < radius + c.r) damage(c, dmg, 'splash');
    if (w.boss && w.boss.state === 'fight' && Math.abs(w.boss.x - x) < BOSS_RADIUS + radius && z >= w.boss.z - 0.5) damage(w.boss, dmg, 'splash');
  }

  // ── Targets ────────────────────────────────────────────────────────────────
  function nearestTarget(range) {
    let best = null;
    let bestRz = range;
    const sx = w.squad.x;
    for (const e of w.enemies) {
      const rz = e.z - w.dist;
      if (e.dead || rz < 0.1 || rz > range) continue;
      const score = rz + Math.abs(e.x - sx) * 1.5;
      if (score < bestRz) { bestRz = score; best = e; }
    }
    for (const c of w.crates) {
      const rz = c.z - w.dist;
      if (c.dead || rz < 0.1 || rz > range) continue;
      const score = rz + Math.abs(c.x - sx) * 1.5;
      if (score < bestRz) { bestRz = score; best = c; }
    }
    if (!best && w.boss && w.boss.state === 'fight') best = w.boss;
    return best;
  }
  /** Up to k different targets ahead, nearest first, so a volley spreads out instead of overkilling one bug. */
  function nearestTargets(range, k) {
    const sx = w.squad.x;
    const found = [];
    const consider = (t) => {
      const rz = t.z - w.dist;
      if (t.dead || rz < 0.1 || rz > range) return;
      found.push({ t, score: rz + Math.abs(t.x - sx) * 1.5 });
    };
    for (const e of w.enemies) consider(e);
    for (const c of w.crates) consider(c);
    found.sort((a, b) => a.score - b.score);
    const list = found.slice(0, k).map((f) => f.t);
    if (!list.length && w.boss && w.boss.state === 'fight') list.push(w.boss);
    return list;
  }
  /** Firepower: a small squad still fights like a few extra soldiers, so one mistake isn't the end. */
  const power = (count) => (count > 0 ? count + BASE_POWER : 0);

  // ── Shooting ───────────────────────────────────────────────────────────────
  function shoot(dt) {
    const wp = WEAPONS[w.squad.weapon];
    const count = w.squad.count;
    if (count <= 0) { w.beam = null; return; }

    if (wp.beam) {
      const target = nearestTarget(wp.range);
      const goalX = target ? target.x : w.squad.x;
      const bx = w.beam ? w.beam.x + (goalX - w.beam.x) * Math.min(1, dt * 6) : w.squad.x;
      w.beam = { x: Math.max(w.squad.x - 0.6, Math.min(w.squad.x + 0.6, bx)), range: wp.range };
      const dmg = wp.dps * power(count) * dt;
      const half = wp.width / 2;
      for (const e of w.enemies) {
        const rz = e.z - w.dist;
        if (!e.dead && rz > 0 && rz < wp.range && Math.abs(e.x - w.beam.x) < half + e.r) damage(e, dmg, 'beam');
      }
      for (const c of w.crates) {
        const rz = c.z - w.dist;
        if (!c.dead && rz > 0 && rz < wp.range && Math.abs(c.x - w.beam.x) < half + c.r) damage(c, dmg, 'beam');
      }
      if (w.boss && w.boss.state === 'fight' && Math.abs(w.boss.x - w.beam.x) < BOSS_RADIUS) damage(w.boss, dmg, 'beam');
      beamHitT -= dt;
      if (beamHitT <= 0 && target) { beamHitT = 0.12; emit({ type: 'hit', x: target.x, z: target.z, beam: true }); }
      return;
    }

    w.beam = null;
    fireT -= dt;
    if (fireT > 0) return;
    fireT += 1 / wp.rate;
    if (fireT < 0) fireT = 0;
    const spots = formation(Math.min(count, MAX_SHOOTERS));
    const per = (wp.dps * power(count)) / (wp.rate * spots.length * wp.streams);
    const targets = nearestTargets(wp.range, spots.length * wp.streams);
    let shot = 0;
    for (const p of spots) {
      for (let s = 0; s < wp.streams; s++) {
        const x = w.squad.x + p.dx + (wp.streams > 1 ? (s - 0.5) * 0.09 : 0);
        const z = w.dist + p.dz + 0.12;
        let vx = (rng.next() - 0.5) * wp.spread * wp.speed;
        const target = targets.length ? targets[shot++ % targets.length] : null;
        if (target) {
          const trz = Math.max(0.6, target.z - z);
          // Light aim-assist: bend part of the way toward the nearest bug ahead
          vx += Math.max(-1.6, Math.min(1.6, ((target.x - x) / trz) * wp.speed)) * AIM_ASSIST;
        }
        w.bullets.push({
          id: nextId++, weapon: w.squad.weapon, x, z, vx, vz: wp.speed, dmg: per,
          life: wp.range / wp.speed, splash: wp.splash || 0,
        });
      }
    }
    emit({ type: 'shoot', weapon: w.squad.weapon });
  }

  function moveBullets(dt) {
    for (const b of w.bullets) {
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.dead = true;
        // A rocket that reaches the end of its range only bursts if something is close
        if (b.splash && w.enemies.some((e) => !e.dead && Math.hypot(e.x - b.x, e.z - b.z) < b.splash + e.r)) explode(b.x, b.z, b.splash, b.dmg);
        continue;
      }
      let hit = null;
      for (const e of w.enemies) {
        if (!e.dead && Math.abs(e.x - b.x) < e.r + 0.05 && Math.abs(e.z - b.z) < e.r + 0.15) { hit = e; break; }
      }
      if (!hit) {
        for (const c of w.crates) {
          if (!c.dead && Math.abs(c.x - b.x) < c.r + 0.05 && Math.abs(c.z - b.z) < c.r + 0.15) { hit = c; break; }
        }
      }
      if (!hit && w.boss && w.boss.state === 'fight' && Math.abs(w.boss.x - b.x) < BOSS_RADIUS && b.z >= w.boss.z - 0.3) hit = w.boss;
      if (hit) {
        b.dead = true;
        if (b.splash) explode(b.x, b.z, b.splash, b.dmg);
        else damage(hit, b.dmg, 'bullet');
      }
    }
    compact(w.bullets, (b) => !b.dead);
  }

  // ── Enemies, crates ────────────────────────────────────────────────────────
  function moveEnemies(dt) {
    const sx = w.squad.x;
    const reach = squadRadius(w.squad.count);
    for (const e of w.enemies) {
      if (e.dead) continue;
      e.flashT = Math.max(0, e.flashT - dt);
      e.z -= e.speed * dt;
      const rz = e.z - w.dist;
      if (rz < 6) {
        const dx = sx - e.x;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), (e.kind === 'mini' ? 0.25 : 0.38) * dt);
      }
      if (rz < 0.22 && rz > -0.4 && Math.abs(e.x - sx) < reach + e.r) {
        e.dead = true;
        emit({ type: 'pop', x: e.x, z: e.z, species: e.species, angry: e.angry, big: e.kind === 'mini', bump: true });
        loseSoldiers(e.kind === 'mini' ? MINI_BOSS.hitSoldiers : 1, 'bug');
      } else if (rz < -0.6) {
        e.dead = true;
      }
    }
    compact(w.enemies, (e) => !e.dead);
    while (w.queue.length && w.enemies.length < enemyCap) {
      const bug = w.queue.shift();
      bug.z = Math.max(bug.z, w.dist + VIEW_DIST);
      w.enemies.push(bug);
    }
  }
  function moveCrates(dt) {
    const reach = squadRadius(w.squad.count) * 0.8;
    for (const c of w.crates) {
      if (c.dead) continue;
      c.flashT = Math.max(0, c.flashT - dt);
      const rz = c.z - w.dist;
      if (rz < 0.15 && rz > -0.3 && Math.abs(c.x - w.squad.x) < reach + c.r) {
        c.dead = true;
        emit({ type: 'crateSmash', x: c.x, z: c.z });
        loseSoldiers(CRATE.hitSoldiers, 'crate');
      } else if (rz < -0.6) c.dead = true;
    }
    compact(w.crates, (c) => !c.dead);
  }
  function trickle(dt) {
    trickleT -= dt;
    if (trickleT > 0 || w.phase === 'finish' || (w.boss && w.boss.state !== 'enter' && w.boss.state !== 'fight')) return;
    const every = TRICKLE_EVERY[chapter] ?? 1.05;
    trickleT = w.phase === 'boss' ? every * 2 : every * (0.7 + rng.next() * 0.6);
    const mix = SPECIES_MIX[chapter] || SPECIES_MIX[2];
    const n = rng.chance(0.35) ? 2 : 1;
    for (let i = 0; i < n; i++) spawnBug(rng.pick(mix), (rng.next() - 0.5) * 2 * (ROAD_HALF - 0.25), VIEW_DIST - rng.next(), false);
  }

  // ── Word Gates ─────────────────────────────────────────────────────────────
  function updateGates() {
    for (const g of w.gates) {
      if (g.state !== 'coming') continue;
      if (g.z - w.dist > 0) continue;
      const i = laneIndex(w.squad.x, g.n);
      g.state = 'waiting';
      g.choice = i;
      const chose = g.choices[i];
      emit({ type: 'gatePass', gate: g.index, choice: i });
      Promise.resolve()
        .then(() => answer(g.gateId, chose))
        .then((res) => pending.push({ g, chose, correct: !!res?.correct, correctAnswer: res?.correctAnswer ?? null }))
        .catch(() => pending.push({ g, chose, error: true }));
    }
    compact(w.gates, (g) => g.z - w.dist > -1.5);
  }
  function applyResults() {
    if (!pending.length) return;
    const list = pending;
    pending = [];
    for (const r of list) {
      const { g } = r;
      g.state = 'done';
      if (r.error) { emit({ type: 'answerError', gate: g.index }); continue; }
      g.correct = r.correct;
      g.correctAnswer = r.correctAnswer;
      w.stats.answered += 1;
      w.results.push({ prompt: g.prompt, chose: r.chose, answer: r.correctAnswer, correct: r.correct });
      if (r.correct) {
        w.stats.right += 1;
        const before = w.squad.weapon;
        w.squad = { ...w.squad, ...applyReward(w.squad, g.reward) };
        emit({ type: 'gateResult', gate: g.index, correct: true, reward: effectiveReward(g.reward, before), boss: g.boss });
      } else {
        w.stats.wrong += 1;
        w.review.push({ prompt: g.prompt, answer: r.correctAnswer, chose: r.chose });
        emit({ type: 'gateResult', gate: g.index, correct: false, correctAnswer: r.correctAnswer, boss: g.boss });
        loseSoldiers(2, 'wrong');
        if (w.boss && w.boss.state !== 'dead') {
          w.boss.hp = Math.round(w.boss.hp * (1 + WRONG_IN_BOSS_HP));
          w.boss.maxHp = Math.round(w.boss.maxHp * (1 + WRONG_IN_BOSS_HP));
          for (let i = 0; i < 10; i++) spawnBug('bee', w.boss.x + (rng.next() - 0.5) * 1.6, w.boss.z - w.dist - 0.3 - rng.next() * 0.6, true);
          emit({ type: 'bossStronger' });
        } else {
          w.swarmBoost = Math.min(SWARM_BOOST_MAX, w.swarmBoost + SWARM_BOOST_PER_WRONG);
          spawnSwarm(6 + 3 * chapter, { angry: true, rz: 10 });
          spawnMiniBoss();
        }
      }
    }
  }

  // ── Boss ───────────────────────────────────────────────────────────────────
  const ATTACKS = { queen: ['summon', 'sting'], bongo: ['drum', 'gumball'], rex: ['goo', 'stomp'] };

  function startAttack(b) {
    const list = ATTACKS[b.kind];
    const kind = list[b.attackIndex++ % list.length];
    const sx = w.squad.x;
    const lane = (width) => ({ x0: Math.max(-ROAD_HALF, sx - width / 2), x1: Math.min(ROAD_HALF, sx + width / 2) });
    const base = { id: nextId++, kind, t: TELEGRAPH_S, dur: TELEGRAPH_S };
    if (kind === 'summon') w.telegraphs.push({ ...base, shape: 'lane', x0: b.x - 0.7, x1: b.x + 0.7, harmless: true });
    else if (kind === 'sting') w.telegraphs.push({ ...base, shape: 'lane', ...lane(0.8) });
    else if (kind === 'drum') w.telegraphs.push({ ...base, shape: 'lane', ...lane(1.0) });
    else if (kind === 'goo') w.telegraphs.push({ ...base, shape: 'lane', ...lane(1.3) });
    else if (kind === 'gumball') {
      const spots = [sx, sx + (rng.next() < 0.5 ? -0.9 : 0.9), (rng.next() - 0.5) * 2.2];
      for (const cx of spots) {
        w.telegraphs.push({ ...base, id: nextId++, shape: 'circle', cx: Math.max(-1.2, Math.min(1.2, cx)), rz: 0.15 + rng.next() * 0.4, r: 0.38 });
      }
    } else if (kind === 'stomp') {
      // A wave across the whole road with one safe gap
      const gapLane = rng.int(0, 2);
      const gx0 = -ROAD_HALF + gapLane * (2 * ROAD_HALF / 3);
      w.telegraphs.push({ ...base, shape: 'wave', gx0, gx1: gx0 + (2 * ROAD_HALF) / 3 });
    }
    emit({ type: 'bossTelegraph', kind });
  }
  function resolveAttack(tg) {
    const b = w.boss;
    const sx = w.squad.x;
    const reach = squadRadius(w.squad.count) * 0.6;
    let hit = false;
    if (tg.shape === 'lane' && !tg.harmless) hit = sx + reach > tg.x0 && sx - reach < tg.x1;
    else if (tg.shape === 'circle') hit = Math.abs(sx - tg.cx) < tg.r + reach * 0.5 && tg.rz < 0.6;
    else if (tg.shape === 'wave') hit = !(sx > tg.gx0 + 0.05 && sx < tg.gx1 - 0.05);
    if (tg.kind === 'summon') {
      for (let i = 0; i < 8 + chapter * 2; i++) spawnBug('bee', b.x + (rng.next() - 0.5) * 1.4, b.z - w.dist - 0.4 - rng.next() * 0.8, false);
    }
    if (tg.kind === 'gumball') {
      for (let i = 0; i < 3; i++) spawnBug('beetle', tg.cx + (i - 1) * 0.18, tg.rz + 0.9, false);
    }
    emit({ type: 'bossAttack', kind: tg.kind, shape: tg.shape, hit, x0: tg.x0, x1: tg.x1, cx: tg.cx, rz: tg.rz, gx0: tg.gx0, gx1: tg.gx1 });
    if (hit) loseSoldiers(plan.boss.hitSoldiers, 'boss');
  }
  function defeatBoss() {
    const b = w.boss;
    b.hp = 0;
    b.state = 'dying';
    b.dyingT = 1.8;
    w.telegraphs.length = 0;
    w.stats.bossBeaten = true;
    emit({ type: 'bossDefeated', kind: b.kind, x: b.x, z: b.z });
  }
  function updateBoss(dt) {
    const b = w.boss;
    if (!b) return;
    b.flashT = Math.max(0, b.flashT - dt);
    if (b.state === 'enter') {
      const goal = w.dist + BOSS_HOLD_Z;
      b.z = Math.max(goal, b.z - 1.3 * dt);
      if (b.z <= goal + 1e-6) {
        b.state = 'fight';
        bossGateAt = w.t + 5;
        emit({ type: 'bossReady', kind: b.kind });
      }
      return;
    }
    if (b.state === 'fight') {
      b.z = w.dist + BOSS_HOLD_Z;
      b.x = Math.sin(w.t * 0.45) * 0.55;
      if (bossGateAt !== null && w.t >= bossGateAt) {
        bossGateAt = null;
        const data = gates[plan.gates];
        if (data) spawnGate(plan.gates, data, w.dist + 8.4, true);
      }
      b.attackT -= dt;
      if (b.attackT <= 0) {
        b.attackT = plan.boss.attackEvery;
        startAttack(b);
      }
      for (const tg of w.telegraphs) {
        tg.t -= dt;
        if (tg.t <= 0) { tg.done = true; resolveAttack(tg); }
      }
      compact(w.telegraphs, (tg) => !tg.done);
      return;
    }
    if (b.state === 'dying') {
      b.z = w.dist + BOSS_HOLD_Z;
      b.dyingT -= dt;
      sweepT -= dt;
      if (sweepT <= 0 && w.enemies.length) {
        sweepT = 0.05;
        const e = w.enemies[0];
        if (e) kill(e, { counted: false });
        compact(w.enemies, (x) => !x.dead);
      }
      if (b.dyingT <= 0) {
        b.state = 'dead';
        for (const e of w.enemies) kill(e, { counted: false });
        w.enemies.length = 0;
        w.queue.length = 0;
        w.phase = 'finish';
        w.archZ = w.dist + 5;
        emit({ type: 'finishArch', z: w.archZ });
      }
    }
  }

  // ── Step ───────────────────────────────────────────────────────────────────
  w.step = (dt, input = {}) => {
    if (w.phase === 'won' || w.phase === 'lost') return;
    dt = Math.min(dt, 0.05);
    w.t += dt;
    w.dist += SPEED * dt;

    const sq = w.squad;
    if (typeof input.targetX === 'number') sq.targetX = input.targetX;
    else if (input.steer) sq.targetX += input.steer * STEER_SPEED * dt;
    sq.targetX = clampSquadX(sq.targetX, sq.count);
    sq.x += (sq.targetX - sq.x) * Math.min(1, dt * 12);
    sq.x = clampSquadX(sq.x, sq.count);

    runPlan();
    trickle(dt);
    moveEnemies(dt);
    moveCrates(dt);
    shoot(dt);
    moveBullets(dt);
    updateGates();
    applyResults();
    updateBoss(dt);

    if (w.phase === 'finish' && w.dist >= w.archZ) {
      w.phase = 'won';
      emit({ type: 'won' });
    } else if (sq.count <= 0 && w.phase !== 'won') {
      w.phase = 'lost';
      w.beam = null;
      emit({ type: 'lost' });
    }
  };

  /** The gate whose question is on screen: the nearest one not passed yet. */
  w.activeGate = () => w.gates.find((g) => g.state === 'coming') || null;

  w.summary = () => ({
    chapter,
    right: w.stats.right,
    total: w.stats.answered,
    bugsPopped: w.stats.bugsPopped,
    bestCombo: w.stats.bestCombo,
    squadSize: w.squad.count,
    bossBeaten: w.stats.bossBeaten,
    review: w.review.slice(),
    results: w.results.slice(),
    won: w.phase === 'won',
  });

  w.maxSquad = MAX_SQUAD;
  return w;
}

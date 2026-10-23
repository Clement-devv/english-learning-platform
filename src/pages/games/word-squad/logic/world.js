// src/pages/games/word-squad/logic/world.js
// The Word Squad simulation: squad, bugs, bullets, crates, Word Gates, the
// road challenges (road.js) and the boss (boss.js). Plain data in, plain data out — no rendering, no timers, no DOM — so it
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
  BOSS_RADIUS, ROAD_HALF, MAX_SQUAD, HOMING, TARGET_CONE, PICKUP, REVIVE_SQUAD,
  SPEED_PER_RIGHT, SPEED_MAX, WRONG_SWARM, SHOOTERS, FIRST_GATE_REWARD, STARTER_SAFE_GATES, BUILD_UP_GATES,
} from './config.js';
import { createRng } from './rng.js';
import { buildChapterPlan, choicesForGate } from './chapters.js';
import { formation, squadRadius, clampSquadX, laneIndex, dodgeReach } from './squad.js';
import { applyReward, rollReward, effectiveReward } from './rewards.js';
import { createRoad } from './road.js';
import { createBoss } from './boss.js';

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

export function createWorld({ chapter = 0, seed = 1, gates = [], answer, device = 'desktop', revive = true } = {}) {
  const rng = createRng(seed);
  const plan = buildChapterPlan(chapter);
  const hpScale = CHAPTER_HP[chapter] ?? CHAPTER_HP[CHAPTER_HP.length - 1];
  const enemyCap = ENEMY_CAP[device] || ENEMY_CAP.desktop;
  let nextId = 1;
  let planIndex = 0;

  const w = {
    chapter, plan, t: 0, dist: 0, phase: 'run', // run | boss | finish | down (waiting for the revive question) | won | lost
    squad: { x: 0, targetX: 0, count: START_SQUAD[chapter] ?? START_SQUAD[START_SQUAD.length - 1], weapon: 'blaster', shieldT: 0, frenzyT: 0 },
    enemies: [], crates: [], bullets: [], gates: [], telegraphs: [],
    beam: null, boss: null, archZ: null,
    queue: [], swarmBoost: 0,
    speedMul: 1,     // grows with every right answer
    shots: [],       // goo spat by shooting bugs
    shootersSeen: false,
    stats: { bugsPopped: 0, combo: 0, bestCombo: 0, lastKillT: -9, right: 0, wrong: 0, answered: 0, bossBeaten: false, coins: 0, spells: 0, bossHits: 0 },
    reviveUsed: false, revived: null, downFrom: null,
    review: [], results: [],
    events: [],
  };

  let fireT = 0;
  let trickleT = 2;
  let beamHitT = 0;
  let pending = [];      // answers that came back, applied on the next step
  let weakHitT = 0;

  const emit = (ev) => w.events.push(ev);
  const newId = () => nextId++;
  const loseSoldiers = (n, cause) => {
    if (n <= 0 || w.phase === 'won' || w.phase === 'lost' || w.phase === 'down') return;
    if (w.squad.shieldT > 0 && cause !== 'wrong') { emit({ type: 'shielded', cause }); return; }
    // The squad starts as one soldier: until the first gates are passed, a hit can't take the last one
    if (w.stats.answered <= STARTER_SAFE_GATES) n = Math.min(n, w.squad.count - 1);
    if (n <= 0) { emit({ type: 'shielded', cause }); return; }
    w.squad.count = Math.max(0, w.squad.count - n);
    emit({ type: 'squadHit', amount: n, cause });
  };

  // ── Spawning ───────────────────────────────────────────────────────────────
  const shooterChance = () => (w.stats.wrong < SHOOTERS.fromWrong ? 0
    : Math.min(SHOOTERS.maxChance, SHOOTERS.chancePerWrong * (w.stats.wrong - SHOOTERS.fromWrong + 1)));
  const nextShot = () => SHOOTERS.every[0] + rng.next() * (SHOOTERS.every[1] - SHOOTERS.every[0]);
  function makeBug(species, x, rz, angry = false) {
    const sp = SPECIES[species];
    const hp = sp.hp * hpScale * (angry ? 1.5 : 1);
    const shooter = rng.chance(shooterChance());
    if (shooter && !w.shootersSeen) { w.shootersSeen = true; emit({ type: 'shootersArrive' }); }
    return {
      id: nextId++, kind: 'bug', species, angry: angry || shooter, x, z: w.dist + rz,
      hp, maxHp: hp, r: sp.radius, speed: sp.speed * (angry ? 1.2 : 1) * (0.9 + rng.next() * 0.2),
      flashT: 0, phase: rng.next() * 6.28,
      shooter, fireT: shooter ? 0.7 + rng.next() * 1.1 : 0, aimX: null, // first spit soon after coming in range
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
  /** Early gates build the squad: friends first, weapons once there is a squad to carry them */
  function gateReward(index, data, boss) {
    if (boss) return data.reward || rollReward(rng);
    if (index === 0) return FIRST_GATE_REWARD;
    const r = data.reward || rollReward(rng);
    if (index < BUILD_UP_GATES && r.type === 'weapon') return { type: 'friends', amount: 6 };
    return r;
  }
  function spawnGate(index, data, z, boss = false) {
    if (!data) return;
    const n = Math.min(data.choices.length, boss ? 3 : choicesForGate(chapter, index));
    w.gates.push({
      id: nextId++, index, gateId: data.gateId, prompt: data.prompt,
      choices: data.choices.slice(0, n), n, reward: gateReward(index, data, boss),
      z, state: 'coming', boss, choice: null, correct: null, correctAnswer: null,
    });
  }
  function spawnMiniBoss() {
    const hp = Math.round(MINI_BOSS.hp * hpScale);
    w.enemies.push({
      id: nextId++, kind: 'mini', species: 'spiderbot', angry: true, x: (rng.next() - 0.5) * 1.6,
      z: w.dist + 9, hp, maxHp: hp, r: MINI_BOSS.radius, speed: MINI_BOSS.speed, flashT: 0, phase: 0,
      shooter: true, fireT: 2, aimX: null,
    });
    emit({ type: 'miniBoss' });
  }

  function runPlan() {
    while (planIndex < plan.events.length && plan.events[planIndex].at <= w.dist) {
      const ev = plan.events[planIndex++];
      if (ev.type === 'gate') spawnGate(ev.gate, gates[ev.gate], ev.z);
      else if (ev.type === 'swarm') spawnSwarm(ev.size * (1 + w.swarmBoost));
      else if (ev.type === 'crates') spawnCrates();
      else if (ev.type === 'boss') boss.spawn();
      else road.spawn(ev);
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
  function damage(target, amount, kind, hitX = target.x) {
    if (target.dead || amount <= 0) return;
    if (target === w.boss) {
      const { m, weak } = boss.damageMult(hitX);
      target.hp -= amount * m;
      target.flashT = 0.06;
      if (weak && weakHitT <= 0) { weakHitT = 0.15; emit({ type: 'weakHit', x: hitX, z: target.z }); }
      return; // boss.update() handles a defeat
    }
    target.hp -= amount;
    target.flashT = 0.06;
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
    if (w.boss && w.boss.state === 'fight' && Math.abs(w.boss.x - x) < BOSS_RADIUS + radius && z >= w.boss.z - 0.5) damage(w.boss, dmg, 'splash', x);
  }

  // ── Targets ────────────────────────────────────────────────────────────────
  function nearestTarget(range) {
    let best = null;
    let bestRz = range;
    const sx = w.squad.x;
    for (const e of w.enemies) {
      const rz = e.z - w.dist;
      if (e.dead || rz < 0.1 || rz > range || Math.abs(e.x - sx) > TARGET_CONE) continue;
      const score = rz + Math.abs(e.x - sx) * 1.5;
      if (score < bestRz) { bestRz = score; best = e; }
    }
    for (const c of w.crates) {
      const rz = c.z - w.dist;
      if (c.dead || rz < 0.1 || rz > range || Math.abs(c.x - sx) > TARGET_CONE) continue;
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
      // Only things roughly in front get aimed at — line up with a swarm to shoot it
      if (t.dead || rz < 0.1 || rz > range || Math.abs(t.x - sx) > TARGET_CONE) return;
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
  const power = (count) => (count > 0 ? (count + BASE_POWER) * (w.squad.frenzyT > 0 ? PICKUP.frenzyBoost : 1) : 0);

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
      if (w.boss && w.boss.state === 'fight' && Math.abs(w.boss.x - w.beam.x) < BOSS_RADIUS) damage(w.boss, dmg, 'beam', w.beam.x);
      beamHitT -= dt;
      if (beamHitT <= 0 && target) { beamHitT = 0.12; emit({ type: 'hit', x: target.x, z: target.z, beam: true }); }
      return;
    }

    w.beam = null;
    fireT -= dt;
    if (fireT > 0) return;
    fireT += 1 / (wp.rate * (w.squad.frenzyT > 0 ? 1.5 : 1)); // frenzy: faster fire (and more damage via power())
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
        else damage(hit, b.dmg, 'bullet', b.x);
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
      if (rz < 5) {
        const dx = sx - e.x;
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), (e.kind === 'mini' ? 0.22 : HOMING) * dt);
      }
      if (e.shooter && rz > SHOOTERS.range[0] && rz < SHOOTERS.range[1]) {
        e.fireT -= dt;
        if (e.fireT <= SHOOTERS.aim && e.aimX === null) e.aimX = sx; // swell and take aim (fair warning)
        if (e.fireT <= 0) spit(e);
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
  /** A shooting bug spits a goo ball at where the squad was when it took aim */
  function spit(e) {
    const rz = e.z - w.dist;
    const closing = SHOOTERS.shotSpeed + SPEED * w.speedMul;
    const tHit = rz / closing;
    const spread = e.kind === 'mini' ? [-0.45, 0, 0.45] : [0];
    for (const off of spread) {
      w.shots.push({ id: nextId++, x: e.x, z: e.z - 0.1, vx: ((e.aimX ?? w.squad.x) + off - e.x) / Math.max(0.4, tHit), big: e.kind === 'mini' });
    }
    e.aimX = null;
    e.fireT = nextShot();
    emit({ type: 'enemyShot', x: e.x, z: e.z, big: e.kind === 'mini' });
  }
  function moveShots(dt) {
    const sx = w.squad.x;
    const reach = dodgeReach(w.squad.count) + 0.1;
    for (const p of w.shots) {
      p.x += p.vx * dt;
      p.z -= SHOOTERS.shotSpeed * dt;
      const rz = p.z - w.dist;
      if (rz < 0.2 && rz > -0.3 && Math.abs(p.x - sx) < reach) {
        p.dead = true;
        emit({ type: 'spitHit', x: p.x, z: p.z });
        loseSoldiers(SHOOTERS.hitSoldiers, 'spit');
      } else if (rz < -0.5) {
        p.dead = true;
        emit({ type: 'dodge', kind: 'spit' });
      }
    }
    compact(w.shots, (p) => !p.dead);
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
        if (w.speedMul < SPEED_MAX) {
          w.speedMul = Math.min(SPEED_MAX, w.speedMul + SPEED_PER_RIGHT);
          emit({ type: 'speedUp', speed: w.speedMul });
        }
        if (g.boss) boss.gateResult(true);
      } else {
        w.stats.wrong += 1;
        w.review.push({ prompt: g.prompt, answer: r.correctAnswer, chose: r.chose });
        emit({ type: 'gateResult', gate: g.index, correct: false, correctAnswer: r.correctAnswer, boss: g.boss });
        loseSoldiers(2, 'wrong');
        if (!boss.gateResult(false)) {
          w.swarmBoost = Math.min(SWARM_BOOST_MAX, w.swarmBoost + SWARM_BOOST_PER_WRONG);
          const flood = Math.min(WRONG_SWARM.base + WRONG_SWARM.perChapter * chapter, Math.max(WRONG_SWARM.min, w.squad.count * WRONG_SWARM.perSoldier));
          spawnSwarm(flood, { angry: true, rz: 10 });
          spawnMiniBoss();
        }
      }
    }
  }

  // ── Road challenges and the boss ────────────────────────────────────────
  const road = createRoad({ w, rng, emit, newId, loseSoldiers, chapter });
  const boss = createBoss({
    w, rng, emit, newId, loseSoldiers, spawnBug, kill, plan, chapter,
    spawnBossGate: (z) => {
      const data = gates[plan.gates];
      if (!data) return false;
      spawnGate(plan.gates, data, z, true);
      return true;
    },
  });

  // ── Revive ─────────────────────────────────────────────────────────────────
  /** After the bonus question: ok → back in the fight with a few soldiers; otherwise the chapter is lost. */
  w.revive = (ok) => {
    if (w.phase !== 'down') return;
    w.revived = !!ok;
    if (!ok) { w.phase = 'lost'; emit({ type: 'lost' }); return; }
    w.phase = w.downFrom || 'run';
    w.squad.count = REVIVE_SQUAD;
    w.squad.shieldT = 3;
    // clear the bugs right in front so the comeback isn't an instant defeat
    for (const e of w.enemies) if (!e.dead && e.z - w.dist < 4) kill(e, { counted: false });
    w.telegraphs = [];
    w.shots.length = 0;
    emit({ type: 'revived', count: REVIVE_SQUAD });
  };

  // ── Step ───────────────────────────────────────────────────────────────────
  w.step = (dt, input = {}) => {
    if (w.phase === 'won' || w.phase === 'lost' || w.phase === 'down') return;
    dt = Math.min(dt, 0.05);
    weakHitT -= dt;
    w.t += dt;
    w.dist += SPEED * w.speedMul * dt;

    const sq = w.squad;
    if (typeof input.targetX === 'number') sq.targetX = input.targetX;
    else if (input.steer) sq.targetX += input.steer * STEER_SPEED * dt;
    sq.targetX = clampSquadX(sq.targetX, sq.count);
    sq.x += (sq.targetX - sq.x) * Math.min(1, dt * 12);
    sq.x = clampSquadX(sq.x, sq.count);

    runPlan();
    trickle(dt);
    road.update(dt);
    moveEnemies(dt);
    moveShots(dt);
    moveCrates(dt);
    shoot(dt);
    moveBullets(dt);
    updateGates();
    applyResults();
    boss.update(dt);

    if (w.phase === 'finish' && w.dist >= w.archZ) {
      w.phase = 'won';
      emit({ type: 'won' });
    } else if (sq.count <= 0 && w.phase !== 'won') {
      w.beam = null;
      if (revive && !w.reviveUsed) {
        // One bonus question per chapter can bring the squad back
        w.reviveUsed = true;
        w.downFrom = w.phase;
        w.phase = 'down';
        emit({ type: 'down' });
      } else {
        w.phase = 'lost';
        emit({ type: 'lost' });
      }
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
    bossHits: w.stats.bossHits,
    topSpeed: Math.round(w.speedMul * 100) / 100,
    coins: w.stats.coins,
    spells: w.stats.spells,
    revived: w.revived,
    review: w.review.slice(),
    results: w.results.slice(),
    won: w.phase === 'won',
  });

  w.maxSquad = MAX_SQUAD;
  return w;
}

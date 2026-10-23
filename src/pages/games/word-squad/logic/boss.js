// src/pages/games/word-squad/logic/boss.js
// The boss fight. Every attack has three beats the child can read:
//   1. wind-up  — the boss rears back and the danger zone glows (TELEGRAPH_S)
//   2. launch   — a real projectile travels down the road (darts, a drum
//                 shockwave, goo, a stomp wave) or arcs through the air
//                 (gumballs), so there is still time to dodge
//   3. opening  — a glowing weak spot appears for a moment: line up with it
//                 for triple damage (dodge, then punish)
// At ⅔ and ⅓ health the boss gets angry (faster, double attacks). During the
// fight a word-shield goes up with the boss gate: the right word shatters it
// for a big hit, the wrong word heals the boss.
import {
  ROAD_HALF, BOSS_HOLD_Z, TELEGRAPH_S, VIEW_DIST, BOSS_SHOT_SPEED, GUMBALL_FLIGHT,
  WEAK_SPOT, BOSS_SHIELD, ENRAGE_AT, WRONG_IN_BOSS_HP,
} from './config.js';
import { dodgeReach } from './squad.js';

const ATTACKS = { queen: ['summon', 'sting'], bongo: ['drum', 'gumball'], rex: ['goo', 'stomp'] };
const LANE_WIDTH = { sting: 0.8, drum: 1.0, goo: 1.3 };

export function createBoss({ w, rng, emit, newId, loseSoldiers, spawnBug, kill, plan, chapter, spawnBossGate }) {
  let gateAt = null;
  let sweepT = 0;

  function spawn() {
    const b = plan.boss;
    w.boss = {
      kind: b.kind, name: b.name, hp: b.hp, maxHp: b.hp, x: 0, z: w.dist + VIEW_DIST,
      state: 'enter', attackT: 2.2, attackIndex: 0, every: b.attackEvery, flashT: 0, dyingT: 0,
      phase: 0, shield: false, weak: null, windup: null, lunge: 0,
    };
    w.phase = 'boss';
    emit({ type: 'bossSpawn', kind: b.kind, name: b.name });
  }

  // ── Attacks ────────────────────────────────────────────────────────────────
  function laneAt(x, width) {
    const x0 = Math.max(-ROAD_HALF, Math.min(ROAD_HALF - width, x - width / 2));
    return { x0, x1: x0 + width };
  }
  function startAttack(b) {
    const list = ATTACKS[b.kind];
    const kind = list[b.attackIndex++ % list.length];
    const sx = w.squad.x;
    const group = newId();
    const base = { kind, group, state: 'windup', t: TELEGRAPH_S, dur: TELEGRAPH_S };
    const add = (o) => w.telegraphs.push({ id: newId(), ...base, ...o });

    if (kind === 'summon') add({ shape: 'lane', ...laneAt(b.x, 1.4), harmless: true });
    else if (LANE_WIDTH[kind]) {
      const width = LANE_WIDTH[kind];
      add({ shape: 'lane', ...laneAt(sx, width) });
      // Angry: a second lane on the other side — find the gap between them
      if (b.phase >= 1) {
        const other = sx > 0 ? sx - width - 0.95 : sx + width + 0.95;
        if (Math.abs(other) < ROAD_HALF) add({ shape: 'lane', ...laneAt(other, width) });
      }
    } else if (kind === 'gumball') {
      const n = 3 + b.phase;
      const spots = [sx];
      while (spots.length < n) spots.push((rng.next() - 0.5) * 2.4);
      for (const cx of spots) add({ shape: 'circle', cx: Math.max(-1.2, Math.min(1.2, cx)), rz: 0.15 + rng.next() * 0.4, r: 0.38 });
    } else if (kind === 'stomp') {
      // A wave across the whole road with one safe gap (narrower when angry)
      const width = b.phase >= 2 ? 0.8 : 1.0;
      const gx0 = -ROAD_HALF + rng.next() * (2 * ROAD_HALF - width);
      add({ shape: 'wave', gx0, gx1: gx0 + width });
    }
    b.windup = { kind, t: TELEGRAPH_S };
    emit({ type: 'bossTelegraph', kind, phase: b.phase });
  }

  function launch(tg) {
    const b = w.boss;
    tg.state = 'flying';
    if (tg.kind === 'summon') {
      for (let i = 0; i < 8 + chapter * 2 + b.phase * 3; i++) spawnBug('bee', b.x + (rng.next() - 0.5) * 1.4, b.z - w.dist - 0.4 - rng.next() * 0.8, b.phase >= 2);
      tg.done = true;
      openWeakSpot(b);
    } else if (tg.shape === 'circle') {
      tg.ft = 0;
      tg.flight = GUMBALL_FLIGHT;
      tg.fromX = b.x;
      tg.fromRz = b.z - w.dist;
    } else {
      tg.prz = b.z - w.dist - 0.4; // the projectile's distance ahead of the squad
    }
    b.lunge = 1;
    emit({ type: 'bossLaunch', kind: tg.kind, shape: tg.shape });
  }

  function hits(tg) {
    const sx = w.squad.x;
    const reach = dodgeReach(w.squad.count);
    if (tg.shape === 'lane') return !tg.harmless && sx + reach > tg.x0 && sx - reach < tg.x1;
    if (tg.shape === 'circle') return Math.abs(sx - tg.cx) < tg.r + reach;
    if (tg.shape === 'wave') return !(sx - reach > tg.gx0 && sx + reach < tg.gx1);
    return false;
  }
  function resolve(tg) {
    const hit = hits(tg);
    tg.done = true;
    if (tg.kind === 'gumball') for (let i = 0; i < 3; i++) spawnBug('beetle', tg.cx + (i - 1) * 0.18, tg.rz + 0.9, false);
    emit({ type: 'bossAttack', kind: tg.kind, shape: tg.shape, hit, x0: tg.x0, x1: tg.x1, cx: tg.cx, rz: tg.rz, gx0: tg.gx0, gx1: tg.gx1 });
    if (hit) {
      w.stats.bossHits += 1;
      loseSoldiers(plan.boss.hitSoldiers + (w.boss?.phase >= 2 ? 1 : 0), 'boss');
    } else emit({ type: 'dodge', kind: tg.kind });
    // The last piece of this attack has landed: the boss is open
    if (!w.telegraphs.some((o) => o.group === tg.group && !o.done)) openWeakSpot(w.boss);
  }
  function openWeakSpot(b) {
    if (!b || b.state !== 'fight') return;
    b.weak = { t: WEAK_SPOT.secs, x: Math.max(-1.1, Math.min(1.1, b.x + (rng.next() - 0.5) * 0.9)) };
    emit({ type: 'weakOpen', x: b.weak.x });
  }

  function updateAttacks(dt) {
    for (const tg of w.telegraphs) {
      if (tg.done) continue;
      if (tg.state === 'windup') {
        tg.t -= dt;
        if (tg.t <= 0) launch(tg);
      } else if (tg.shape === 'circle') {
        tg.ft += dt;
        if (tg.ft >= tg.flight) resolve(tg);
      } else {
        tg.prz -= BOSS_SHOT_SPEED * dt;
        if (tg.prz <= 0.25) resolve(tg);
      }
    }
    w.telegraphs = w.telegraphs.filter((tg) => !tg.done);
  }

  // ── Damage from the squad ──────────────────────────────────────────────────
  /** Multiplier for a hit at world x: the shield softens, the weak spot triples. */
  function damageMult(x) {
    const b = w.boss;
    if (!b) return { m: 1, weak: false };
    let m = b.shield ? BOSS_SHIELD.damage : 1;
    const weak = !!(b.weak && Math.abs(x - b.weak.x) < WEAK_SPOT.width);
    if (weak) m *= WEAK_SPOT.mult;
    return { m, weak };
  }

  /** The boss gate was answered (only called while a boss is around). */
  function gateResult(correct) {
    const b = w.boss;
    if (!b || b.state === 'dead' || b.state === 'dying') return false;
    const hadShield = b.shield;
    b.shield = false;
    if (correct) {
      if (hadShield) {
        b.hp -= b.maxHp * BOSS_SHIELD.breakHit;
        b.flashT = 0.3;
        emit({ type: 'shieldBreak', x: b.x, z: b.z });
        if (b.hp <= 0) defeat();
      }
      return true;
    }
    b.hp = Math.round(b.hp * (1 + WRONG_IN_BOSS_HP));
    b.maxHp = Math.round(b.maxHp * (1 + WRONG_IN_BOSS_HP));
    for (let i = 0; i < 10; i++) spawnBug('bee', b.x + (rng.next() - 0.5) * 1.6, b.z - w.dist - 0.3 - rng.next() * 0.6, true);
    emit({ type: 'bossStronger' });
    if (hadShield) emit({ type: 'shieldDown' });
    return true;
  }

  function defeat() {
    const b = w.boss;
    b.hp = 0;
    b.state = 'dying';
    b.dyingT = 1.8;
    b.weak = null;
    b.shield = false;
    w.telegraphs = [];
    w.stats.bossBeaten = true;
    emit({ type: 'bossDefeated', kind: b.kind, x: b.x, z: b.z });
  }

  // ── Per step ───────────────────────────────────────────────────────────────
  function update(dt) {
    const b = w.boss;
    if (!b) return;
    b.flashT = Math.max(0, b.flashT - dt);
    b.lunge = Math.max(0, b.lunge - dt * 3);
    if (b.state === 'enter') {
      const goal = w.dist + BOSS_HOLD_Z;
      b.z = Math.max(goal, b.z - 1.3 * dt);
      if (b.z <= goal + 1e-6) {
        b.state = 'fight';
        gateAt = w.t + 5;
        emit({ type: 'bossReady', kind: b.kind });
      }
      return;
    }
    if (b.state === 'fight') {
      b.z = w.dist + BOSS_HOLD_Z;
      if (b.hp <= 0) { defeat(); return; }
      // Sway; stand still while winding up so the danger zone stays put
      if (!b.windup) b.x += (Math.sin(w.t * 0.45) * 0.55 - b.x) * Math.min(1, dt * 2);
      if (gateAt !== null && w.t >= gateAt) {
        gateAt = null;
        if (spawnBossGate(w.dist + 8.4)) { b.shield = true; emit({ type: 'bossShield' }); }
      }
      // Angry phases
      const f = b.hp / b.maxHp;
      const phase = f < ENRAGE_AT[1] ? 2 : f < ENRAGE_AT[0] ? 1 : 0;
      if (phase > b.phase) {
        b.phase = phase;
        b.every *= 0.85;
        emit({ type: 'bossEnrage', phase });
      }
      if (b.weak) { b.weak.t -= dt; if (b.weak.t <= 0) b.weak = null; }
      if (b.windup) { b.windup.t -= dt; if (b.windup.t <= 0) b.windup = null; }
      b.attackT -= dt;
      if (b.attackT <= 0 && !w.telegraphs.length) {
        b.attackT = b.every;
        startAttack(b);
      }
      updateAttacks(dt);
      return;
    }
    if (b.state === 'dying') {
      b.z = w.dist + BOSS_HOLD_Z;
      b.dyingT -= dt;
      sweepT -= dt;
      if (sweepT <= 0 && w.enemies.length) {
        sweepT = 0.05;
        const e = w.enemies.find((x) => !x.dead);
        if (e) kill(e, { counted: false });
      }
      if (b.dyingT <= 0) {
        b.state = 'dead';
        for (const e of w.enemies) if (!e.dead) kill(e, { counted: false });
        w.enemies.length = 0;
        w.queue.length = 0;
        w.phase = 'finish';
        w.archZ = w.dist + 5;
        emit({ type: 'finishArch', z: w.archZ });
      }
    }
  }

  return { spawn, update, damageMult, gateResult, defeat };
}

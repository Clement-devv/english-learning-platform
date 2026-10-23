// src/pages/games/word-squad/logic/road.js
// Things to do between Word Gates, so the child makes a choice every few
// seconds: candy spinners and gumdrop walls to dodge, coin trails and friend
// bubbles to grab, power-up orbs (shield, frenzy), and letter bubbles to
// collect in order to spell a word.
//
// Everything sits at a fixed spot on the road (absolute z); the squad runs
// into it. Part of the world — see createRoad(ctx) in world.js.
import { ROAD_HALF, OBSTACLES, PICKUP, SPELL, MAX_SQUAD } from './config.js';
import { squadRadius, laneIndex, laneCenter } from './squad.js';

const LETTERS = 'ABCDEFGHIJKLMNOPRSTUVWY';

export function createRoad({ w, rng, emit, newId, loseSoldiers, chapter }) {
  w.obstacles = [];
  w.pickups = [];
  w.letters = [];
  w.spell = null;
  const ch = Math.max(0, Math.min(2, chapter));

  // ── Spawning ───────────────────────────────────────────────────────────────
  function spinner(cx, z, phase = rng.next() * 6.28) {
    const o = OBSTACLES.spinner;
    w.obstacles.push({ id: newId(), kind: 'spinner', cx, x: cx, z, r: o.r, amp: o.amp * (cx === 0 ? 1 : 0.55), speed: o.speed[ch], phase, done: false });
  }
  function wall(z) {
    const gap = OBSTACLES.wall.gap[ch];
    const center = (rng.next() - 0.5) * 2 * (ROAD_HALF - gap / 2 - 0.1);
    w.obstacles.push({ id: newId(), kind: 'wall', gx0: center - gap / 2, gx1: center + gap / 2, z, done: false });
  }
  function obstacles(pattern, z) {
    if (pattern === 'wall') wall(z);
    else if (ch === 0) spinner(0, z);
    else if (ch === 1) { spinner(-0.7, z, 0); spinner(0.7, z + 0.9, Math.PI); }
    else { spinner(0, z); spinner(-0.9, z + 1, 1.5); spinner(0.9, z + 1, 4.6); }
    emit({ type: 'obstacles', pattern });
  }
  function pickups(z) {
    // A trail of coins that bends from one lane to another, then a friend bubble
    const from = laneCenter(rng.int(0, 2), 3);
    const to = laneCenter(rng.int(0, 2), 3);
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      w.pickups.push({ id: newId(), kind: 'coin', x: from + (to - from) * t, z: z + i * 0.45, r: PICKUP.r });
    }
    w.pickups.push({ id: newId(), kind: 'friends', x: to, z: z + 2.6, r: PICKUP.r * 1.3 });
    // From chapter 2 a spinner guards the bubble — a little risk for the reward
    if (ch >= 1) spinner(to + (to > 0 ? -0.55 : 0.55), z + 2.7);
  }
  function powerup(z) {
    const kind = rng.chance(0.5) ? 'shield' : 'frenzy';
    w.pickups.push({ id: newId(), kind, x: laneCenter(rng.int(0, 2), 3), z, r: PICKUP.r * 1.3 });
  }
  function pickWord() {
    // A word the child just met at a gate (lesson vocabulary), or a simple one
    const fromGates = w.results.filter((r) => r.correct && /^[a-z]{3,5}$/i.test(r.answer || '')).map((r) => r.answer.toUpperCase());
    const used = new Set(w.spellsDone || []);
    const fresh = fromGates.filter((x) => !used.has(x));
    if (fresh.length) return fresh[fresh.length - 1];
    const pool = SPELL.words.filter((x) => !used.has(x));
    return rng.pick(pool.length ? pool : SPELL.words);
  }
  function spell(z) {
    if (w.spell && !w.spell.over) return;
    const word = pickWord();
    w.spell = { id: newId(), word, got: 0, missed: false, over: false };
    for (let i = 0; i < word.length; i++) {
      const lane = rng.int(0, 2);
      let decoyLane = rng.int(0, 1);
      if (decoyLane >= lane) decoyLane += 1;
      let decoy = rng.pick(LETTERS);
      while (decoy === word[i]) decoy = rng.pick(LETTERS);
      w.letters.push({ id: newId(), index: i, letter: word[i], lane, decoy, decoyLane, z: z + i * SPELL.spacing, done: false });
    }
    emit({ type: 'spellStart', word });
  }

  function spawn(ev) {
    if (ev.type === 'obstacles') obstacles(ev.pattern, ev.z);
    else if (ev.type === 'pickups') pickups(ev.z);
    else if (ev.type === 'powerup') powerup(ev.z);
    else if (ev.type === 'spell') spell(ev.z);
  }

  // ── Collecting & bumping ───────────────────────────────────────────────────
  function collect(p) {
    p.dead = true;
    const sq = w.squad;
    if (p.kind === 'coin') { w.stats.coins += 1; emit({ type: 'coin', x: p.x, z: p.z }); return; }
    if (p.kind === 'friends') {
      sq.count = Math.min(MAX_SQUAD, sq.count + PICKUP.friends);
      emit({ type: 'pickup', kind: 'friends', amount: PICKUP.friends, x: p.x, z: p.z });
      return;
    }
    if (p.kind === 'shield') sq.shieldT = PICKUP.shieldS;
    if (p.kind === 'frenzy') sq.frenzyT = PICKUP.frenzyS;
    emit({ type: 'pickup', kind: p.kind, secs: p.kind === 'shield' ? PICKUP.shieldS : PICKUP.frenzyS, x: p.x, z: p.z });
  }

  function update(dt) {
    const sq = w.squad;
    const sx = sq.x;
    const reach = squadRadius(sq.count) * 0.75;
    sq.shieldT = Math.max(0, (sq.shieldT || 0) - dt);
    sq.frenzyT = Math.max(0, (sq.frenzyT || 0) - dt);

    for (const o of w.obstacles) {
      if (o.kind === 'spinner') o.x = o.cx + Math.sin(w.t * o.speed + o.phase) * o.amp;
      const rz = o.z - w.dist;
      if (!o.done && rz < 0.12 && rz > -0.15) {
        let hit = false;
        if (o.kind === 'spinner') hit = Math.abs(o.x - sx) < reach + o.r;
        else { const r = Math.min(reach, 0.3); hit = sx - r < o.gx0 || sx + r > o.gx1; } // the middle of the squad must fit the gap
        if (hit) {
          o.done = true;
          emit({ type: 'bump', kind: o.kind, x: o.kind === 'spinner' ? o.x : sx, z: o.z });
          loseSoldiers(OBSTACLES[o.kind].hitSoldiers, 'obstacle');
        } else if (rz < -0.05) {
          o.done = true;
          emit({ type: 'dodge', kind: o.kind });
        }
      }
      if (rz < -1) o.dead = true;
    }
    w.obstacles = w.obstacles.filter((o) => !o.dead);

    for (const p of w.pickups) {
      const rz = p.z - w.dist;
      if (rz < 0.15 && rz > -0.2 && Math.abs(p.x - sx) < reach + p.r) collect(p);
      else if (rz < -0.6) p.dead = true;
    }
    w.pickups = w.pickups.filter((p) => !p.dead);

    const sp = w.spell;
    for (const l of w.letters) {
      if (l.done || l.z - w.dist > 0) continue;
      l.done = true;
      const lane = laneIndex(sx, 3);
      const ok = lane === l.lane && sp && !sp.over;
      if (sp && !sp.over) {
        if (ok) sp.got += 1; else sp.missed = true;
        emit({ type: 'letter', index: l.index, letter: l.letter, ok, picked: lane === l.decoyLane ? l.decoy : null, x: laneCenter(lane, 3), z: l.z });
        if (l.index === sp.word.length - 1) {
          sp.over = true;
          const done = !sp.missed;
          if (done) {
            (w.spellsDone ||= []).push(sp.word);
            w.stats.spells += 1;
            w.stats.coins += SPELL.coins;
            sq.count = Math.min(MAX_SQUAD, sq.count + SPELL.friends);
          }
          emit({ type: 'spellDone', word: sp.word, ok: done, friends: done ? SPELL.friends : 0 });
        }
      }
    }
    w.letters = w.letters.filter((l) => l.z - w.dist > -1);
  }

  return { spawn, update };
}

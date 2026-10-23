// src/pages/games/word-squad/logic/autopilot.js
// A simple player for tests and balance checks. In order of priority it:
// steps out of boss attacks and obstacles, follows the letters it is spelling,
// lines up with the chosen word of the coming gate, and hits the boss's weak spot.
import { ROAD_HALF, SPEED, SHOOTERS } from './config.js';
import { laneCenter, squadRadius, dodgeReach } from './squad.js';

/**
 * @param world      the world from createWorld()
 * @param pickChoice (gate) => index of the word to run through
 * @param opts       { dodge = true } — false plays like a child who ignores obstacles
 * @returns targetX for world.step()
 */
export function autopilot(world, pickChoice, { dodge = true } = {}) {
  const w = world;
  const edge = ROAD_HALF - 0.2;
  const g = w.activeGate();
  let x = w.squad.targetX;

  const nextLetter = (w.letters || []).find((l) => !l.done && l.z - w.dist < 4);
  if (g && g.z - w.dist < 6) x = laneCenter(Math.max(0, pickChoice(g)), g.n);
  else if (nextLetter) x = laneCenter(nextLetter.lane, 3);
  else if (g) x = laneCenter(Math.max(0, pickChoice(g)), g.n);
  else if (w.boss?.weak) x = w.boss.weak.x;
  else {
    // Line up with the bugs that are closest — the squad only shoots what is in front
    let sum = 0, wsum = 0;
    for (const e of w.enemies) {
      const rz = e.z - w.dist;
      if (e.dead || rz < 0.3 || rz > 6) continue;
      const k = 1 / (rz * rz);
      sum += e.x * k; wsum += k;
    }
    if (wsum > 0) x = sum / wsum;
  }
  if (!dodge) return Math.max(-edge, Math.min(edge, x));

  const pad = squadRadius(w.squad.count) * 0.6 + 0.15;   // obstacles touch the whole squad
  const bossPad = dodgeReach(w.squad.count) + 0.12;       // boss attacks only the middle
  const danger = [];
  for (const tg of w.telegraphs || []) {
    if (tg.shape === 'wave') { danger.push([-9, tg.gx0 + bossPad], [tg.gx1 - bossPad, 9]); continue; }
    if (tg.shape === 'lane' && !tg.harmless) danger.push([tg.x0 - bossPad, tg.x1 + bossPad]);
    if (tg.shape === 'circle') danger.push([tg.cx - tg.r - bossPad, tg.cx + tg.r + bossPad]);
  }
  for (const o of w.obstacles || []) {
    const rz = o.z - w.dist;
    if (o.done || rz < -0.2 || rz > 2.2) continue;
    if (o.kind === 'wall') { const p = Math.min(pad, 0.42); danger.push([-9, o.gx0 + p], [o.gx1 - p, 9]); }
    else {
      // where the spinner will be when we reach it
      const tAt = rz / (SPEED * (w.speedMul || 1));
      const ox = o.cx + Math.sin((w.t + tAt) * o.speed + o.phase) * o.amp;
      danger.push([ox - o.r - pad, ox + o.r + pad]);
    }
  }
  // Goo spat by shooting bugs: where will it cross our row?
  for (const p of w.shots || []) {
    const rz = p.z - w.dist;
    if (rz < -0.2 || rz > 2) continue;
    const tHit = Math.max(0, rz) / (SHOOTERS.shotSpeed + SPEED * (w.speedMul || 1));
    const px = p.x + p.vx * tHit;
    danger.push([px - bossPad - 0.05, px + bossPad + 0.05]);
  }
  // Move to the closest safe x near where we want to be
  const safe = (v) => danger.every(([a, b]) => v <= a || v >= b);
  if (!safe(x)) {
    let best = null;
    for (let d = 0; d <= 3; d += 0.05) {
      for (const v of [x - d, x + d]) if (v >= -edge && v <= edge && safe(v) && best === null) best = v;
      if (best !== null) break;
    }
    if (best !== null) x = best;
  }
  return Math.max(-edge, Math.min(edge, x));
}

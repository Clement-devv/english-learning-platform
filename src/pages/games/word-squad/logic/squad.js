// src/pages/games/word-squad/logic/squad.js
// Where each drawn soldier stands inside the squad (a sunflower spiral, flattened
// in depth so the whole squad stays on screen), and how wide the squad is.
import { VISIBLE_SOLDIERS, FORMATION_STEP, ROAD_HALF } from './config.js';

const GOLDEN = 2.39996323;

export function formation(count) {
  const n = Math.max(0, Math.min(VISIBLE_SOLDIERS, count));
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = FORMATION_STEP * Math.sqrt(i + 0.5);
    const a = i * GOLDEN;
    out.push({ dx: r * Math.cos(a), dz: r * Math.sin(a) * 0.55 });
  }
  return out;
}

/** Half-width of the squad on the road */
export const squadRadius = (count) =>
  FORMATION_STEP * Math.sqrt(Math.max(1, Math.min(VISIBLE_SOLDIERS, count))) + 0.08;

/** Keep the whole squad on the road */
export const clampSquadX = (x, count) => {
  const lim = ROAD_HALF - squadRadius(count) - 0.02;
  return Math.max(-lim, Math.min(lim, x));
};

/** Which gate section (0 … n−1) the squad is lined up with */
export function laneIndex(x, n, roadHalf = ROAD_HALF) {
  const t = (x + roadHalf) / (2 * roadHalf);
  return Math.max(0, Math.min(n - 1, Math.floor(t * n)));
}

/** Centre x of gate section i of n */
export const laneCenter = (i, n, roadHalf = ROAD_HALF) => -roadHalf + ((i + 0.5) * 2 * roadHalf) / n;

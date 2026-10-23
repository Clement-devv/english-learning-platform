// src/pages/games/word-squad/logic/autopilot.js
// A simple player for tests and balance checks: lines up with the chosen word
// of the coming gate, but steps out of any boss attack that is about to land.
import { ROAD_HALF } from './config.js';
import { laneCenter, squadRadius } from './squad.js';

/**
 * @param world      the world from createWorld()
 * @param pickChoice (gate) => index of the word to run through
 * @returns targetX for world.step()
 */
export function autopilot(world, pickChoice) {
  const g = world.activeGate();
  let x = g ? laneCenter(Math.max(0, pickChoice(g)), g.n) : world.squad.targetX;
  const pad = squadRadius(world.squad.count) * 0.6 + 0.15;
  const edge = ROAD_HALF - 0.2;

  for (const tg of world.telegraphs) {
    if (tg.shape === 'wave') return (tg.gx0 + tg.gx1) / 2;
    let lo, hi;
    if (tg.shape === 'lane' && !tg.harmless) { lo = tg.x0 - pad; hi = tg.x1 + pad; }
    else if (tg.shape === 'circle') { lo = tg.cx - tg.r - pad; hi = tg.cx + tg.r + pad; }
    else continue;
    if (x > lo && x < hi) {
      const goLeft = lo > -edge && (hi > edge || x - lo < hi - x);
      x = goLeft ? lo : hi;
    }
  }
  return Math.max(-edge, Math.min(edge, x));
}

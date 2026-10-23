// src/pages/games/word-squad/logic/chapters.js
// Lays out one chapter: where the Word Gates, enemy floods, crate pairs and the
// boss come. Each event has `at` = the squad distance at which it appears at
// the horizon (or right away when that is already passed).
import {
  SPEED, VIEW_DIST, CHAPTERS, SWARM_SIZES, FIRST_GATE_S, GATE_GAP_S, BOSSES,
} from './config.js';

export const gateZ = (i) => (FIRST_GATE_S + i * GATE_GAP_S) * SPEED;

/** Early gates have 2 choices, later ones 3. */
export const choicesForGate = (chapter, i) => ((chapter === 0 && i < 4) || i === 0 ? 2 : 3);

export function buildChapterPlan(chapter) {
  const cfg = CHAPTERS[chapter] || CHAPTERS[CHAPTERS.length - 1];
  const G = cfg.gates;
  const gap = GATE_GAP_S * SPEED;
  const events = [];

  for (let i = 0; i < G; i++) {
    const z = gateZ(i);
    events.push({ type: 'gate', gate: i, z, at: Math.max(0, z - VIEW_DIST) });
  }

  // Floods come between gates, spread through the chapter and growing
  for (let k = 0; k < cfg.swarms; k++) {
    const after = Math.min(G - 2, Math.floor(((k + 1) * G) / (cfg.swarms + 1)));
    const z = gateZ(after) + gap * 0.5;
    events.push({ type: 'swarm', size: SWARM_SIZES[k], z, at: z - VIEW_DIST });
  }

  // Two crate pairs on the side lanes
  for (const after of [0, Math.max(1, G - 3)]) {
    const z = gateZ(after) + gap * 0.75;
    events.push({ type: 'crates', z, at: z - VIEW_DIST });
  }

  const bossAt = gateZ(G - 1) + 4;
  events.push({ type: 'boss', at: bossAt });
  events.sort((a, b) => a.at - b.at);

  return { chapter, gates: G, events, boss: BOSSES[chapter] || BOSSES[BOSSES.length - 1], bossAt };
}

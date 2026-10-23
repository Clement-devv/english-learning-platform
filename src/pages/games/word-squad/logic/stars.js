// src/pages/games/word-squad/logic/stars.js
// Stars for one chapter. Phase 1 shows this on the end screen; from Phase 2 the
// server computes the stars it actually pays with the same formula.

export const STAR_RULES = { perRight: 3, bonusCap: 15, bossBonus: 10 };

export function computeStars({ right = 0, total = 0, bugsPopped = 0, bestCombo = 0, squadSize = 0, bossBeaten = false, coins = 0, spells = 0 }) {
  const base = Math.max(0, right) * STAR_RULES.perRight;
  const perf = Math.floor(bugsPopped / 40) + Math.floor(bestCombo / 5) + Math.floor(squadSize / 10)
    + Math.floor(coins / 3) + spells * 2;
  const bonus = Math.min(STAR_RULES.bonusCap, Math.max(0, perf));
  // The boss bonus only counts when at least half the gates were answered right
  const boss = bossBeaten && total > 0 && right * 2 >= total ? STAR_RULES.bossBonus : 0;
  return { base, bonus, boss, total: base + bonus + boss };
}

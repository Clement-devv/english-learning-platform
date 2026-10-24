// server/utils/wordSquadRules.js
// The Word Squad rules the server is the judge of: how many gates a chapter
// has, how many choices each gate shows, the stars a finished chapter is worth
// and its 3-star rating. The game client has the same numbers in
// src/pages/games/word-squad/logic/ (config.js, chapters.js, stars.js,
// rating.js); a client test checks the two agree.

export const CHAPTER_GATES = [10, 11, 12];          // + 1 gate during the boss fight
export const CHAPTER_COUNT = CHAPTER_GATES.length;
export const MIN_ANSWER_GAP_MS = 4000;              // gates come every ~10–16 s; faster answers aren't real play
export const SESSION_TTL_MS = 20 * 60 * 1000;       // a chapter takes ~3 minutes
export const STAR_RULES = { perRight: 3, bonusCap: 15, bossBonus: 10 };
export const RATING_RULES = { smart: 0.8, combo: 30 };

/** Early gates have 2 choices, later ones 3 (the boss gate always 3). */
export const choicesForGate = (chapter, i) => ((chapter === 0 && i < 4) || i === 0 ? 2 : 3);

/** Seeded random generator (mulberry32) — same as the client's rng.js */
export function createRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
  };
}

export function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const WEAPONS = ['double', 'minigun', 'laser', 'rockets'];
/** What a right answer at this gate gives (shown on the gate's badge). */
export function rollReward(rng) {
  const r = rng.next() * 100;
  if (r < 55) return { type: 'weapon', weapon: rng.pick(WEAPONS) };
  if (r < 85) return { type: 'friends', amount: rng.int(4, 10) };
  return { type: 'double' };
}

/**
 * Stars for a finished chapter. `right` and `total` come from the server's own
 * answer checks; the other numbers are what the game reported, and together
 * they can add at most STAR_RULES.bonusCap.
 */
export function computeStars({ right = 0, total = 0, bugsPopped = 0, bestCombo = 0, squadSize = 0, bossBeaten = false, coins = 0, spells = 0 }) {
  const n = (v, max) => Math.max(0, Math.min(max, Number(v) || 0));
  const base = Math.max(0, right) * STAR_RULES.perRight;
  const perf = Math.floor(n(bugsPopped, 5000) / 40) + Math.floor(n(bestCombo, 500) / 5) + Math.floor(n(squadSize, 150) / 10)
    + Math.floor(n(coins, 500) / 3) + n(spells, 10) * 2;
  const bonus = Math.min(STAR_RULES.bonusCap, Math.max(0, Math.floor(perf)));
  // The boss bonus only counts when at least half the gates were answered right
  const boss = bossBeaten && total > 0 && right * 2 >= total ? STAR_RULES.bossBonus : 0;
  return { base, bonus, boss, total: base + bonus + boss };
}

/** 3-star rating: cleared · ≥80% words right · no boss hits or a ×30 combo */
export function chapterRating({ won, right = 0, total = 0, bossHits = 0, bestCombo = 0 }) {
  const cleared = !!won;
  const smart = cleared && total > 0 && right / total >= RATING_RULES.smart;
  const hero = cleared && (Number(bossHits) === 0 || Number(bestCombo) >= RATING_RULES.combo);
  return { cleared, smart, hero, count: (cleared ? 1 : 0) + (smart ? 1 : 0) + (hero ? 1 : 0) };
}

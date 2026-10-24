// The server judges stars, ratings and gates per chapter (server/utils/wordSquadRules.js).
// These checks keep its numbers the same as the game's.
import { describe, it, expect } from 'vitest';
import * as server from '../../../../../server/utils/wordSquadRules.js';
import { computeStars, STAR_RULES } from './stars.js';
import { chapterRating, RATING_RULES } from './rating.js';
import { CHAPTERS } from './config.js';
import { choicesForGate } from './chapters.js';
import { createRng } from './rng.js';

describe('server rules match the game', () => {
  it('has the same gates per chapter and choices per gate', () => {
    expect(server.CHAPTER_GATES).toEqual(CHAPTERS.map((c) => c.gates));
    for (let ch = 0; ch < 3; ch++) for (let i = 0; i < 12; i++) expect(server.choicesForGate(ch, i)).toBe(choicesForGate(ch, i));
  });

  it('computes the same stars and ratings', () => {
    expect(server.STAR_RULES).toEqual(STAR_RULES);
    expect(server.RATING_RULES).toEqual(RATING_RULES);
    const cases = [
      { right: 7, total: 9, bugsPopped: 300, bestCombo: 22, squadSize: 40, bossBeaten: true, coins: 30, spells: 2 },
      { right: 2, total: 9, bugsPopped: 50, bestCombo: 4, squadSize: 3, bossBeaten: true },
      { right: 0, total: 0 },
    ];
    for (const c of cases) expect(server.computeStars(c)).toEqual(computeStars(c));
    const r = { won: true, right: 8, total: 10, bossHits: 0, bestCombo: 3 };
    expect(server.chapterRating(r)).toEqual(chapterRating(r));
  });

  it('uses the same seeded random numbers', () => {
    const a = server.createRng(99), b = createRng(99);
    for (let i = 0; i < 5; i++) expect(a.next()).toBe(b.next());
  });
});

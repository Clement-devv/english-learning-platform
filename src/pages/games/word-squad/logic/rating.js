// src/pages/games/word-squad/logic/rating.js
// The 3-star rating for a chapter — the reason to play a chapter again.
//   ★ Cleared  — beat the boss and reach the finish
//   ★ Word whiz — at least 80% of the words right
//   ★ Hero      — dodged every boss attack, or chained a ×30 combo
// Stars 2 and 3 only count on a cleared chapter.

export const RATING_RULES = { smart: 0.8, combo: 30 };

export function chapterRating(s) {
  const cleared = !!s.won;
  const smart = cleared && s.total > 0 && s.right / s.total >= RATING_RULES.smart;
  const hero = cleared && ((s.bossHits ?? 0) === 0 || (s.bestCombo ?? 0) >= RATING_RULES.combo);
  return { cleared, smart, hero, count: (cleared ? 1 : 0) + (smart ? 1 : 0) + (hero ? 1 : 0) };
}

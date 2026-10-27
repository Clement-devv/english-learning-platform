// src/pages/games/word-squad/data/serverSession.js
// A play session from the server (Phase 2). Same shape as the demo session —
//   { sessionId, seed, gates, revive, answer(gateId, choice) }
// — plus finish(summary) and countsForStars. The server keeps the answers and
// the stars; the game only ever learns whether a choice was right.
import api from '../../../../api';

const BASE = '/games/word-squad';

// `link` (a managed student playing from a game link): { base, headers } —
// the same routes under /games/link/<token>/word-squad, with the access header.
const where = (link) => ({ base: link?.base || BASE, cfg: link ? { headers: link.headers } : undefined });

/** The student's assigned games, their progress, and the star total */
export async function listAssignments(link) {
  const { base, cfg } = where(link);
  const { data } = await api.get(`${base}/assignments`, cfg);
  return data.data; // { assignments: [...], stars }
}

export async function createServerSession(assignmentId, chapter, link) {
  const { base, cfg } = where(link);
  const { data } = await api.post(`${base}/sessions`, { assignmentId, chapter }, cfg);
  const s = data.data;
  const url = `${base}/sessions/${s.sessionId}`;
  return {
    ...s,
    server: true,
    /** → { correct, correctAnswer }. A failed request rejects; the game then gives no reward and no penalty. */
    answer: async (gateId, choice) => (await api.post(`${url}/answer`, { gateId, choice }, cfg)).data.data,
    /** Send the end-of-chapter numbers; the server answers with the stars it paid. */
    finish: async (summary) => (await api.post(`${url}/finish`, {
      won: !!summary.won,
      bossBeaten: !!summary.bossBeaten,
      bugsPopped: summary.bugsPopped,
      bestCombo: summary.bestCombo,
      squadSize: summary.squadSize,
      coins: summary.coins,
      spells: summary.spells,
      bossHits: summary.bossHits,
    }, cfg)).data.data,
  };
}

/** A readable message from an API error */
export const apiMessage = (err, fallback) => err?.response?.data?.message || fallback;

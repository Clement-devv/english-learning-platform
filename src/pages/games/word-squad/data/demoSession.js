// src/pages/games/word-squad/data/demoSession.js
// A play session answered in the browser, shaped like the Phase 2 API:
//   { sessionId, seed, gates: [{ gateId, prompt, choices, reward }] } — no answers
//   answer(gateId, choice) → Promise<{ correct, correctAnswer }>
// so swapping in the server later only changes where these come from.
import { createRng } from '../logic/rng.js';
import { rollReward } from '../logic/rewards.js';
import { CHAPTERS } from '../logic/config.js';
import { DEMO_QUESTIONS } from './demoQuestions.js';

function shuffle(rng, list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param questions  defaults to the built-in demo set; a teacher's test play passes their own set
 */
export function createDemoSession(chapter, seed = Date.now() % 1e9, questions = DEMO_QUESTIONS) {
  const rng = createRng(seed ^ 0x5eed);
  const count = (CHAPTERS[chapter]?.gates ?? 8) + 1; // + the gate during the boss fight
  const pool = shuffle(rng, questions.filter((q) => q.prompt && q.answer && (q.distractors || []).some(Boolean)));
  const answers = new Map();

  const gates = [];
  for (let i = 0; i < count; i++) {
    const q = pool[i % pool.length];
    const gateId = `demo-${chapter}-${i}`;
    answers.set(gateId, q.answer);
    gates.push({
      gateId,
      prompt: q.prompt,
      choices: shuffle(rng, [q.answer, ...q.distractors.filter((x) => x && x !== q.answer).slice(0, 2)]),
      reward: rollReward(rng),
    });
  }
  // When a gate shows only 2 choices it uses the first two — make sure the
  // right answer is one of them.
  for (const g of gates) {
    const right = answers.get(g.gateId);
    const at = g.choices.indexOf(right);
    if (at > 1) {
      const k = rng.int(0, 1);
      [g.choices[at], g.choices[k]] = [g.choices[k], g.choices[at]];
    }
  }

  // One spare question for the revive ("answer to bring your squad back")
  const rq = pool[count % pool.length];
  const revive = { gateId: `demo-${chapter}-revive`, prompt: rq.prompt, choices: shuffle(rng, [rq.answer, ...rq.distractors.filter((x) => x && x !== rq.answer).slice(0, 2)]) };
  answers.set(revive.gateId, rq.answer);

  const answered = new Set();
  return {
    sessionId: `demo-${seed}`,
    seed,
    gates,
    revive,
    answer: async (gateId, choice) => {
      if (!answers.has(gateId) || answered.has(gateId)) return { correct: false, correctAnswer: answers.get(gateId) ?? null };
      answered.add(gateId);
      const correctAnswer = answers.get(gateId);
      return { correct: choice === correctAnswer, correctAnswer };
    },
  };
}

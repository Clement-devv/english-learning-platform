// server/utils/questionRules.js
// Checks for Word Squad questions — used by the server when a set is saved or
// published, and imported by the teacher's editor in the browser so the teacher
// sees exactly the same messages before saving. Also reads CSV imports.
//
// A question: { type, prompt, answer, distractors: [1–3], explanation? }
// CSV columns: type,prompt,answer,distractor1,distractor2,distractor3

export const LIMITS = { prompt: 120, word: 24, minDistractors: 1, maxDistractors: 3, toPublish: 8, maxQuestions: 200 };
export const TYPES = ['gap', 'choice', 'spelling', 'meaning'];
export const LEVELS = ['A1', 'A2', 'B1'];

const clean = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Tidy one question from the editor or a CSV row (trims, drops empty wrong answers) */
export function normalizeQuestion(q = {}) {
  return {
    type: TYPES.includes(q.type) ? q.type : 'gap',
    prompt: clean(q.prompt),
    answer: clean(q.answer),
    distractors: (Array.isArray(q.distractors) ? q.distractors : []).map(clean).filter(Boolean),
    explanation: clean(q.explanation).slice(0, 300),
  };
}

/** Problems with one question, as short messages a teacher understands ([] = fine) */
export function questionErrors(raw) {
  const q = normalizeQuestion(raw);
  const errs = [];
  if (!q.prompt) errs.push('Write the sentence.');
  else if (q.prompt.length > LIMITS.prompt) errs.push(`The sentence is too long (max ${LIMITS.prompt} letters).`);
  if (q.type === 'gap' && q.prompt) {
    const blanks = (q.prompt.match(/_{3,}/g) || []).length;
    if (blanks !== 1) errs.push('A gap sentence needs exactly one blank: ___');
  }
  if (!q.answer) errs.push('Write the right word.');
  else if (q.answer.length > LIMITS.word) errs.push(`The right word is too long (max ${LIMITS.word} letters).`);
  if (q.distractors.length < LIMITS.minDistractors) errs.push('Add at least one wrong word.');
  if (q.distractors.length > LIMITS.maxDistractors) errs.push(`Use at most ${LIMITS.maxDistractors} wrong words.`);
  if (q.distractors.some((d) => d.length > LIMITS.word)) errs.push(`A wrong word is too long (max ${LIMITS.word} letters).`);
  const lower = q.distractors.map((d) => d.toLowerCase());
  if (q.answer && lower.includes(q.answer.toLowerCase())) errs.push('The right word is also in the wrong words.');
  if (new Set(lower).size !== lower.length) errs.push('Two wrong words are the same.');
  return errs;
}

/** Problems that stop a set from being published */
export function publishErrors(set) {
  const qs = set?.questions || [];
  const errs = [];
  if (!clean(set?.title)) errs.push('Give the set a title.');
  if (qs.length < LIMITS.toPublish) errs.push(`Add at least ${LIMITS.toPublish} questions to publish (now ${qs.length}).`);
  const bad = qs.map((q, i) => (questionErrors(q).length ? i + 1 : 0)).filter(Boolean);
  if (bad.length) errs.push(`Fix question${bad.length > 1 ? 's' : ''} ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}.`);
  return errs;
}

/** Split one CSV line, honouring "quoted, values" and "" escapes */
function splitCsvLine(line) {
  const out = [];
  let cur = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Read CSV text (type,prompt,answer,distractor1,distractor2,distractor3).
 * A header row is skipped. Returns { questions, errors: [{ line, message }] }.
 */
export function parseQuestionsCsv(text) {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/);
  const questions = [];
  const errors = [];
  lines.forEach((line, idx) => {
    if (!line.trim()) return;
    const cells = splitCsvLine(line);
    if (idx === 0 && /^type$/i.test(cells[0]) && /prompt/i.test(cells[1] || '')) return; // header
    const [type, prompt, answer, ...wrong] = cells;
    const q = normalizeQuestion({ type: (type || 'gap').toLowerCase(), prompt, answer, distractors: wrong });
    const errs = questionErrors(q);
    if (errs.length) errors.push({ line: idx + 1, message: errs[0] });
    else questions.push(q);
  });
  return { questions, errors };
}

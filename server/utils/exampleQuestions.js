// server/utils/exampleQuestions.js
// The example Word Squad set (A1, children around age 10). Teachers add a copy
// from their Word Squad tab to see what a good set looks like, test play it,
// change it or give it out; the demo center seed uses it too. It mixes grammar
// and vocabulary, and uses 1, 2 or 3 wrong words to show each is allowed.
// Same shape as a QuestionSet question (checked by questionRules.js).

export const EXAMPLE_SET_TITLE = 'Example: My Day at School (A1)';

export const EXAMPLE_QUESTIONS = [
  // be / have / present simple
  { type: 'gap', prompt: 'I ___ ten years old.', answer: 'am', distractors: ['is', 'are'] },
  { type: 'gap', prompt: 'My sister ___ long hair.', answer: 'has', distractors: ['have', 'is', 'having'] },
  { type: 'gap', prompt: 'I ___ up at six o\'clock every morning.', answer: 'get', distractors: ['gets', 'getting'] },
  { type: 'gap', prompt: 'Nam ___ his teeth after breakfast.', answer: 'brushes', distractors: ['brush', 'brushing'] },
  { type: 'gap', prompt: 'We ___ English on Monday and Friday.', answer: 'have', distractors: ['has'] },
  // present continuous
  { type: 'gap', prompt: 'Look! The children ___ playing in the yard.', answer: 'are', distractors: ['is', 'am'] },
  // prepositions
  { type: 'gap', prompt: 'School starts ___ seven thirty.', answer: 'at', distractors: ['in', 'on'] },
  { type: 'gap', prompt: 'My pencil case is ___ my bag.', answer: 'in', distractors: ['at', 'of'] },
  { type: 'gap', prompt: 'We have art ___ Wednesday.', answer: 'on', distractors: ['in', 'at'] },
  // there is / are, plurals, how many
  { type: 'gap', prompt: 'There ___ thirty students in my class.', answer: 'are', distractors: ['is', 'be'] },
  { type: 'gap', prompt: 'I have two new ___.', answer: 'books', distractors: ['book', 'bookes'] },
  { type: 'gap', prompt: 'How ___ pens do you have?', answer: 'many', distractors: ['much'] },
  // school vocabulary
  { type: 'gap', prompt: 'I write in my ___ with a pencil.', answer: 'notebook', distractors: ['ruler', 'chair', 'window'] },
  { type: 'gap', prompt: 'We play football in the ___.', answer: 'playground', distractors: ['library', 'kitchen'] },
  { type: 'gap', prompt: 'The teacher writes on the ___.', answer: 'board', distractors: ['floor', 'door'] },
  { type: 'gap', prompt: 'I am thirsty. Can I have some ___, please?', answer: 'water', distractors: ['bread', 'rice'] },
  // can, comparatives, past simple
  { type: 'gap', prompt: 'Can you ___ English?', answer: 'speak', distractors: ['speaks', 'speaking'] },
  { type: 'gap', prompt: 'Mai is ___ than her brother.', answer: 'taller', distractors: ['tall', 'tallest'] },
  { type: 'gap', prompt: 'Yesterday we ___ a fun game in class.', answer: 'played', distractors: ['play', 'plays'] },
  { type: 'gap', prompt: 'I ___ home at five o\'clock and do my homework.', answer: 'go', distractors: ['goes', 'going', 'to go'] },
];

/** The example as a CSV, for teachers to see the import format */
export function exampleCsv() {
  const cell = (v) => (/[",;\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = EXAMPLE_QUESTIONS.map((q) => [q.type, q.prompt, q.answer, ...q.distractors, '', '', ''].slice(0, 6).map(cell).join(','));
  return ['type,prompt,answer,distractor1,distractor2,distractor3', ...rows].join('\n') + '\n';
}

// The example Word Squad set teachers can add (and the demo seed uses) must
// always pass the same checks as a teacher's own set.
import { describe, it, expect } from "vitest";
import { EXAMPLE_SET_TITLE, EXAMPLE_QUESTIONS, exampleCsv } from "../utils/exampleQuestions.js";
import { questionErrors, publishErrors, parseQuestionsCsv, normalizeQuestion } from "../utils/questionRules.js";

describe("Word Squad example set", () => {
  it("has 20 questions that each pass the editor's checks", () => {
    expect(EXAMPLE_QUESTIONS).toHaveLength(20);
    for (const q of EXAMPLE_QUESTIONS) expect(questionErrors(q), q.prompt).toEqual([]);
  });

  it("can be published as it is", () => {
    expect(publishErrors({ title: EXAMPLE_SET_TITLE, questions: EXAMPLE_QUESTIONS })).toEqual([]);
  });

  it("has no repeated sentences and shows 1, 2 and 3 wrong words", () => {
    expect(new Set(EXAMPLE_QUESTIONS.map((q) => q.prompt)).size).toBe(20);
    expect(new Set(EXAMPLE_QUESTIONS.map((q) => q.distractors.length))).toEqual(new Set([1, 2, 3]));
  });

  it("downloads as a CSV that imports back to the same questions", () => {
    const { questions, errors } = parseQuestionsCsv(exampleCsv());
    expect(errors).toEqual([]);
    expect(questions.map((q) => normalizeQuestion(q))).toEqual(EXAMPLE_QUESTIONS.map((q) => normalizeQuestion(q)));
  });
});

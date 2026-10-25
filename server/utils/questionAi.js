// server/utils/questionAi.js
// Asks Claude to write Word Squad questions from book pages. The pages go to the
// model as they are (PDF documents and photos) — no OCR or PDF rendering on our
// server. Same model the quiz generator uses. Output is checked with the same
// rules as the teacher's editor; invalid and duplicate questions are dropped.
import Anthropic from "@anthropic-ai/sdk";
import { normalizeQuestion, questionErrors } from "./questionRules.js";

export const QUESTION_MODEL = "claude-sonnet-4-6";
export const AI_TIMEOUT_MS = 90 * 1000;

export function buildPrompt({ level = "A1", focus = "both", wantedCount = 15 }) {
  const focusText = { grammar: "grammar (verb forms, articles, prepositions, pronouns…)", vocabulary: "vocabulary (words and phrases taught on these pages)", both: "a mix of grammar and vocabulary" }[focus] || "a mix of grammar and vocabulary";
  return `You write questions for "Word Squad", an English game for Vietnamese children around 10 years old, at CEFR level ${level}.

The attached pages are from the book the class is using. Write exactly ${wantedCount} gap-fill questions about ${focusText}.

Rules:
- Use ONLY words, sentences and topics that appear on these pages. Do not add outside material.
- Each question is one short sentence (max 120 characters) with exactly one blank written as ___ .
- "answer" is the one word or short phrase (max 24 characters) that fits the blank. Only that answer can be right.
- "distractors" are 2 wrong choices (max 24 characters each): plausible for a learner, but clearly wrong. Never repeat the answer.
- Simple, friendly, child-appropriate sentences. Nothing scary, violent or unsuitable.
- No numbering, explanations or text outside the JSON.

Return ONLY a JSON array like:
[{"prompt": "She ___ to school by bus.", "answer": "goes", "distractors": ["go", "going"]}]`;
}

/** The pages as Claude content blocks */
export function pageBlocks(files) {
  return files.map((f) => (f.mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") } }
    : { type: "image", source: { type: "base64", media_type: f.mime, data: f.buffer.toString("base64") } }));
}

/** Pull a JSON array out of the model's reply, check every question, drop duplicates */
export function readQuestions(text, wantedCount) {
  let list = [];
  try {
    const cleaned = String(text || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const start = cleaned.indexOf("["), end = cleaned.lastIndexOf("]");
    if (start !== -1 && end > start) list = JSON.parse(cleaned.slice(start, end + 1));
  } catch { list = []; }
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const q = normalizeQuestion({ type: "gap", prompt: raw?.prompt, answer: raw?.answer, distractors: Array.isArray(raw?.distractors) ? raw.distractors.slice(0, 3) : [] });
    const key = q.prompt.toLowerCase();
    if (!questionErrors(q).length && !seen.has(key)) { seen.add(key); out.push(q); }
    if (out.length >= wantedCount) break;
  }
  return out;
}

/**
 * Make questions from the pages. Retries once if the call fails or times out.
 * @param files   [{ mime, buffer }]
 * @param client  an Anthropic client (tests pass a fake)
 * @returns { questions, usage: { input_tokens, output_tokens } }
 */
export async function generateQuestions({ files, level, focus, wantedCount }, client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })) {
  const usage = { input_tokens: 0, output_tokens: 0 };
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await client.messages.create({
        model: QUESTION_MODEL,
        max_tokens: 4096,
        messages: [{ role: "user", content: [...pageBlocks(files), { type: "text", text: buildPrompt({ level, focus, wantedCount }) }] }],
      }, { timeout: AI_TIMEOUT_MS });
      usage.input_tokens += res.usage?.input_tokens || 0;
      usage.output_tokens += res.usage?.output_tokens || 0;
      const text = (res.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
      return { questions: readQuestions(text, wantedCount), usage };
    } catch (err) {
      lastErr = err;
    }
  }
  throw Object.assign(lastErr || new Error("AI request failed"), { usage });
}

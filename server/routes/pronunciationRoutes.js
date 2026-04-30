import express from "express";
import multer from "multer";
import OpenAI from "openai";
import os from "os";
import fs from "fs";
import { verifyToken } from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { pronunciationCacheSchema } from "../schemas/pronunciationCacheSchema.js";
import { pronunciationCreditSchema } from "../schemas/pronunciationCreditSchema.js";
import Center from "../models/master/Center.js";
import { callGemini, extractJSONArray } from "../utils/geminiHelper.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const getPronunciationCredit = (db) =>
  db.models.PronunciationCredit || db.model("PronunciationCredit", pronunciationCreditSchema);

// ── OpenAI client — lazy so missing key doesn't crash the server ──────────────
let _openai = null;
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ── Multer — audio uploads to temp dir ───────────────────────────────────────
const audioUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const ext = file.mimetype.includes("ogg") ? ".ogg"
        : file.mimetype.includes("mp4") ? ".mp4"
        : ".webm";
      cb(null, `pron_${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ── Server-side word alignment ────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function normalizeWord(w) { return w.toLowerCase().replace(/[^a-z']/g, ""); }

function alignWords(expectedText, spokenText) {
  const exp = expectedText.split(/\s+/).map(normalizeWord).filter(Boolean);
  const spk = spokenText.split(/\s+/).map(normalizeWord).filter(Boolean);
  return exp.map((e, i) => {
    const s = spk[i] || "";
    if (!s) return { expected: e, spoken: "", status: "missed" };
    if (e === s) return { expected: e, spoken: s, status: "correct" };
    const threshold = e.length <= 4 ? 1 : 2;
    if (levenshtein(e, s) <= threshold) return { expected: e, spoken: s, status: "close" };
    return { expected: e, spoken: s, status: "wrong" };
  });
}

// ── Batch IPA + tips via GPT-3.5 ─────────────────────────────────────────────
async function fetchIPA(words) {
  const openai = getOpenAI();
  if (!openai) return {};
  const targets = words.filter(w => w.status !== "correct").map(w => w.expected);
  if (targets.length === 0) return {};
  const prompt = `For each English word below, provide the IPA transcription and a one-sentence pronunciation tip for a learner.
Return ONLY valid JSON — no markdown fences, no explanation.
Words: ${targets.join(", ")}
Format: {"word": {"ipa": "/ɪpə/", "tip": "one-line tip"}}`;
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 600,
    });
    const raw = resp.choices[0].message.content.trim().replace(/^```json?\n?/, "").replace(/\n?```$/, "");
    return JSON.parse(raw);
  } catch (err) {
    logger.error("IPA fetch error:", err.message);
    return {};
  }
}

const router = express.Router();
router.use(tenantMiddleware);

const getPronunciationCache = (db) =>
  db.models.PronunciationCache || db.model("PronunciationCache", pronunciationCacheSchema);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh cache once per day

// Focus areas rotated per difficulty so each generation covers different ground
const FOCUS_AREAS = {
  beginner: [
    "short vowel sounds (a, e, i, o, u)",
    "basic consonant sounds",
    "natural sentence rhythm and stress",
    "simple question intonation",
    "common everyday vocabulary pronunciation",
  ],
  intermediate: [
    "TH sounds — both voiced (the, this) and unvoiced (think, three)",
    "schwa vowel sound — the most common English vowel",
    "word stress in multi-syllable words",
    "connected speech and linking words together",
    "silent letters (know, lamb, island)",
  ],
  advanced: [
    "R and L sound distinction",
    "S and SH sound distinction",
    "W and V sound distinction",
    "complex consonant clusters at word boundaries",
    "sentence-level stress and rhythm patterns",
  ],
};

// ── Call Gemini 1.5 Flash to generate sentences ───────────────────────────────
async function generateWithGemini(difficulty) {
  const focuses = [...FOCUS_AREAS[difficulty]]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const prompt = `You are an English pronunciation coach. Generate exactly 10 pronunciation practice sentences for a ${difficulty}-level English learner.

Distribute the sentences across these 3 focus areas: ${focuses.join(" | ")}.

Rules:
- Use natural, conversational language
- Vocabulary must suit ${difficulty} level
- Each sentence must clearly practice the focus area
- Do NOT include explanations, numbering, or markdown
- Return ONLY a valid JSON array, nothing else

Format: [{"text": "The sentence here.", "focus": "Focus area label"}]`;

  const raw = await callGemini(prompt, { temperature: 0.85, maxOutputTokens: 900 });
  let parsed;
  try {
    parsed = extractJSONArray(raw);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON`);
  }

  if (!Array.isArray(parsed)) throw new Error("Gemini response was not an array");

  return parsed
    .filter(s => typeof s.text === "string" && typeof s.focus === "string")
    .map(s => ({ text: s.text.trim(), focus: s.focus.trim() }))
    .slice(0, 10);
}

// ── GET /api/pronunciation/credits  (student checks own balance) ─────────────
router.get("/credits", verifyToken, async (req, res) => {
  try {
    const record = await getPronunciationCredit(req.db).findOne({ studentId: req.user.id });
    res.json({ success: true, credits: record?.credits ?? 0, totalUsed: record?.totalUsed ?? 0 });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/pronunciation/credits/student/:id  (admin/teacher checks student) ─
router.get("/credits/student/:id", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) return forbidden(res, "Teachers and admins only");
    const record = await getPronunciationCredit(req.db).findOne({ studentId: req.params.id });
    res.json({ success: true, credits: record?.credits ?? 0, totalUsed: record?.totalUsed ?? 0 });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/pronunciation/center-credits  (admin sees center budget) ─────────
router.get("/center-credits", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admins only");
    const center = await Center.findOne({ slug: req.center.slug })
      .select("pronunciationCredits centerName").lean();
    res.json({
      success:        true,
      balance:        center?.pronunciationCredits?.balance        ?? 0,
      totalAllocated: center?.pronunciationCredits?.totalAllocated ?? 0,
      used:           (center?.pronunciationCredits?.totalAllocated ?? 0) - (center?.pronunciationCredits?.balance ?? 0),
      log:            (center?.pronunciationCredits?.log || []).slice(-10).reverse(),
    });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── POST /api/pronunciation/credits/grant  (admin/teacher grants to student) ──
router.post("/credits/grant", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) return forbidden(res, "Teachers and admins only");

    const { studentId, amount, note } = req.body;
    if (!studentId || !amount || amount < 1 || amount > 10000) {
      return badRequest(res, "studentId and amount (1–10000) are required");
    }

    // Check & deduct from center's pronunciation budget
    const deducted = await Center.findOneAndUpdate(
      { slug: req.center.slug, "pronunciationCredits.balance": { $gte: amount } },
      { $inc: { "pronunciationCredits.balance": -amount } },
      { new: true }
    );
    if (!deducted) {
      const center = await Center.findOne({ slug: req.center.slug }).select("pronunciationCredits").lean();
      const available = center?.pronunciationCredits?.balance ?? 0;
      return res.status(402).json({
        success: false,
        message: `Insufficient pronunciation credit budget. Available: ${available}, requested: ${amount}. Ask your super admin to top up.`,
        available,
      });
    }

    const record = await getPronunciationCredit(req.db).findOneAndUpdate(
      { studentId },
      {
        $inc:  { credits: amount },
        $push: { log: { type: "grant", amount, note: note || `Granted by ${req.user.role}` } },
      },
      { upsert: true, new: true }
    );

    res.json({
      success:       true,
      credits:       record.credits,
      centerBalance: deducted.pronunciationCredits.balance,
      message:       `${amount} pronunciation credits granted`,
    });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/pronunciation/sentences?difficulty=beginner ──────────────────────
// Returns cached AI sentences or generates a fresh batch.
// Frontend falls back to local bank if this returns { success: false }.
router.get("/sentences", verifyToken, async (req, res) => {
  const { difficulty = "beginner" } = req.query;

  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    return badRequest(res, "Invalid difficulty");
  }

  // ── 1. Try cache ────────────────────────────────────────────────────────────
  try {
    const cached = await getPronunciationCache(req.db).findOne({ difficulty });
    const age    = cached ? Date.now() - new Date(cached.generatedAt).getTime() : Infinity;

    if (cached && age < CACHE_TTL_MS && cached.sentences.length > 0) {
      return res.json({ success: true, sentences: cached.sentences, source: "cache" });
    }
  } catch (dbErr) {
    logger.error("PronunciationCache read error:", dbErr.message);
  }

  // ── 2. Generate with Gemini ─────────────────────────────────────────────────
  try {
    const sentences = await generateWithGemini(difficulty);

    if (sentences.length === 0) throw new Error("Gemini returned 0 valid sentences");

    await getPronunciationCache(req.db).findOneAndUpdate(
      { difficulty },
      { sentences, generatedAt: new Date() },
      { upsert: true, new: true }
    );

    logger.info(`✅ Pronunciation cache refreshed — ${difficulty} (${sentences.length} sentences)`);
    return res.json({ success: true, sentences, source: "generated" });

  } catch (genErr) {
    logger.error("Gemini generation failed:", genErr.message);
    // ── 3. Fallback — tell frontend to use local bank ───────────────────────
    return res.json({ success: false, sentences: [], reason: genErr.message });
  }
});

// ── POST /api/pronunciation/analyze ──────────────────────────────────────────
// Accepts multipart/form-data: audio (file) + targetText (string)
// Returns: { success, transcript, percentage, words: [{expected,spoken,status,ipa,tip}] }
router.post("/analyze", verifyToken, audioUpload.single("audio"), async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) return badRequest(res, "No audio file uploaded");

  const { targetText } = req.body;
  if (!targetText?.trim()) {
    fs.unlink(filePath, () => {});
    return badRequest(res, "targetText is required");
  }

  const openai = getOpenAI();
  if (!openai) {
    fs.unlink(filePath, () => {});
    return res.status(503).json({ success: false, reason: "OpenAI API key not configured on this server." });
  }

  // Check student has credits
  const creditRecord = await getPronunciationCredit(req.db).findOne({ studentId: req.user.id });
  if (!creditRecord || creditRecord.credits < 1) {
    fs.unlink(filePath, () => {});
    return res.status(402).json({ success: false, reason: "no_credits", message: "No pronunciation credits remaining. Ask your admin to top up." });
  }

  try {
    // 1. Whisper transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-1",
      prompt: targetText,
      language: "en",
    });
    const transcript = transcription.text.trim();

    // 2. Word-level alignment
    const words = alignWords(targetText, transcript);
    const expLen = targetText.split(/\s+/).filter(Boolean).length;
    const rawScore = words.reduce(
      (sum, w) => sum + (w.status === "correct" ? 1 : w.status === "close" ? 0.5 : 0), 0
    );
    const percentage = Math.round((rawScore / expLen) * 100);

    // 3. IPA + tips for flagged words (runs in parallel with no extra latency concern)
    const ipaMap = await fetchIPA(words);

    // 4. Enrich word list
    const enriched = words.map(w => ({
      ...w,
      ipa: ipaMap[w.expected]?.ipa  || null,
      tip: ipaMap[w.expected]?.tip  || null,
    }));

    // Deduct 1 credit atomically
    const updated = await getPronunciationCredit(req.db).findOneAndUpdate(
      { studentId: req.user.id, credits: { $gte: 1 } },
      {
        $inc:  { credits: -1, totalUsed: 1 },
        $push: { log: { type: "spend", amount: 1, note: "Pronunciation analysis" } },
      },
      { new: true }
    );

    logger.info(`Pronunciation analysis: ${percentage}% — "${transcript.slice(0, 60)}"`);
    return res.json({ success: true, transcript, percentage, words: enriched, creditsRemaining: updated?.credits ?? 0 });

  } catch (err) {
    logger.error("Pronunciation analysis error:", err.message);
    return serverError(res, "Analysis failed — please try again");
  } finally {
    fs.unlink(filePath, () => {});
  }
});

export default router;

import express             from "express";
import Anthropic           from "@anthropic-ai/sdk";
import { verifyToken }     from "../middleware/authMiddleware.js";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { chatCreditSchema }         from "../schemas/chatCreditSchema.js";
import { conversationMessageSchema } from "../schemas/conversationMessageSchema.js";
import { studentSchema }            from "../schemas/studentSchema.js";
import Center                       from "../models/master/Center.js";
import logger from "../utils/logger.js";
import { ok, created, badRequest, unauthorized, forbidden, notFound, conflict, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getChatCredit          = (db) => db.models.ChatCredit          || db.model("ChatCredit",          chatCreditSchema);
const getConversationMessage = (db) => db.models.ConversationMessage || db.model("ConversationMessage", conversationMessageSchema);
const getStudent             = (db) => db.models.Student             || db.model("Student",             studentSchema);

// Only send last 20 messages as context — controls cost while keeping conversation coherent
const CONTEXT_WINDOW = 20;

function getSystemPrompt(studentName, level) {
  return `You are an English conversation coach chatting with ${studentName || "a student"}, a ${level || "beginner"}-level English learner.

Your job:
- Have warm, natural conversations on any topic the student chooses
- Keep your replies short (2–4 sentences) so it feels like a real chat, not a lecture
- When the student makes a grammar or spelling mistake, gently correct it INLINE — weave the correction naturally into your reply. Example: if they say "I goed to school", you reply "Oh nice! (By the way, we say 'I went to school' 😊) What did you study?"
- Adapt your vocabulary to their level — simpler words for beginners, richer language for advanced
- Be warm, encouraging and never make them feel bad about mistakes
- Occasionally ask a follow-up question to keep the conversation going
- NEVER refuse to chat — always respond helpfully`;
}

// ── GET /api/chat/credits ─────────────────────────────────────────────────────
router.get("/credits", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const record = await getChatCredit(req.db).findOne({ studentId: req.user.id });
    res.json({
      success: true,
      credits:   record?.credits   ?? 0,
      totalUsed: record?.totalUsed ?? 0,
    });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/chat/history ─────────────────────────────────────────────────────
router.get("/history", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const messages = await getConversationMessage(req.db)
      .find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── DELETE /api/chat/history ──────────────────────────────────────────────────
router.delete("/history", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");
    await getConversationMessage(req.db).deleteMany({ studentId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── POST /api/chat/message ────────────────────────────────────────────────────
router.post("/message", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "student") return forbidden(res, "Students only");

    const { text, level = "beginner" } = req.body;

    if (!text?.trim()) return badRequest(res, "Message text is required");
    if (text.trim().length > 1000) return badRequest(res, "Message too long (max 1000 chars)");

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ message: "Chat is not configured on this server" });
    }

    // ── 1. Check credits ────────────────────────────────────────────────────
    const ChatCredit    = getChatCredit(req.db);
    const creditRecord  = await ChatCredit.findOne({ studentId: req.user.id });
    const currentCredits = creditRecord?.credits ?? 0;

    if (currentCredits < 1) {
      return res.status(402).json({
        message: "You have no chat credits left. Ask your teacher to top up your credits.",
        credits: 0,
      });
    }

    // ── 2. Load recent history for context ─────────────────────────────────
    const ConversationMessage = getConversationMessage(req.db);
    const history = await ConversationMessage
      .find({ studentId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(CONTEXT_WINDOW)
      .lean();

    const contextMessages = history.reverse().map(m => ({
      role:    m.role,
      content: m.content,
    }));

    // ── 3. Call Claude ──────────────────────────────────────────────────────
    const student = await getStudent(req.db).findById(req.user.id).select("firstName").lean();
    const client  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system:     getSystemPrompt(student?.firstName, level),
      messages:   [...contextMessages, { role: "user", content: text.trim() }],
    });

    const reply = response.content[0]?.text;
    if (!reply) throw new Error("Claude returned an empty response");

    // ── 4. Deduct 1 credit (atomic update) ─────────────────────────────────
    await ChatCredit.findOneAndUpdate(
      { studentId: req.user.id, credits: { $gte: 1 } },
      {
        $inc: { credits: -1, totalUsed: 1 },
        $push: { log: { type: "spend", amount: 1, note: "Chat message" } },
      }
    );

    // ── 5. Save both messages ───────────────────────────────────────────────
    await ConversationMessage.insertMany([
      { studentId: req.user.id, role: "user",      content: text.trim() },
      { studentId: req.user.id, role: "assistant", content: reply       },
    ]);

    // ── 6. Return response ──────────────────────────────────────────────────
    const updated = await ChatCredit.findOne({ studentId: req.user.id });
    res.json({
      success:          true,
      reply,
      creditsRemaining: updated?.credits ?? 0,
    });
  } catch (err) {
    logger.error("Chat message error:", { error: err?.message });
    serverError(res, err.message);
  }
});

// ── GET /api/chat/center-credits  (admin sees their center's budget) ──────────
router.get("/center-credits", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") return forbidden(res, "Admins only");
    const center = await Center.findOne({ slug: req.center.slug })
      .select("chatCredits centerName").lean();
    res.json({
      success:        true,
      balance:        center?.chatCredits?.balance        ?? 0,
      totalAllocated: center?.chatCredits?.totalAllocated ?? 0,
      used:           (center?.chatCredits?.totalAllocated ?? 0) - (center?.chatCredits?.balance ?? 0),
      log:            (center?.chatCredits?.log || []).slice(-10).reverse(),
    });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── POST /api/chat/credits/grant  (teacher or admin grants credits) ───────────
router.post("/credits/grant", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return forbidden(res, "Teachers and admins only");
    }

    const { studentId, amount, note } = req.body;
    if (!studentId || !amount || amount < 1 || amount > 10000) {
      return badRequest(res, "studentId and amount (1–10000) are required");
    }

    const student = await getStudent(req.db).findById(studentId);
    if (!student) return notFound(res, "Student not found");

    // ── Check & deduct from center's budget ──────────────────────────────────
    const deducted = await Center.findOneAndUpdate(
      { slug: req.center.slug, "chatCredits.balance": { $gte: amount } },
      { $inc: { "chatCredits.balance": -amount } },
      { new: true }
    );
    if (!deducted) {
      const center = await Center.findOne({ slug: req.center.slug }).select("chatCredits").lean();
      const available = center?.chatCredits?.balance ?? 0;
      return res.status(402).json({
        message: `Insufficient center credit budget. Available: ${available}, requested: ${amount}. Ask your super admin to top up.`,
        available,
      });
    }

    // ── Grant to student ─────────────────────────────────────────────────────
    const record = await getChatCredit(req.db).findOneAndUpdate(
      { studentId },
      {
        $inc:  { credits: amount },
        $push: { log: { type: "grant", amount, note: note || `Granted by ${req.user.role}` } },
      },
      { upsert: true, new: true }
    );

    res.json({
      success:          true,
      credits:          record.credits,
      centerBalance:    deducted.chatCredits.balance,
      message:          `${amount} credits granted to ${student.firstName}`,
    });
  } catch (err) {
    serverError(res, err.message);
  }
});

// ── GET /api/chat/credits/student/:id  (teacher checks a student's balance) ───
router.get("/credits/student/:id", verifyToken, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return forbidden(res, "Teachers and admins only");
    }
    const record = await getChatCredit(req.db).findOne({ studentId: req.params.id });
    res.json({ success: true, credits: record?.credits ?? 0, totalUsed: record?.totalUsed ?? 0 });
  } catch (err) {
    serverError(res, err.message);
  }
});

export default router;

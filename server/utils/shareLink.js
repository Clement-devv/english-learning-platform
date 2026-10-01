// server/utils/shareLink.js
// Share links for managed students (no login) — used by homework and quizzes.
//
// How it works:
//   • A 256-bit random token in the URL is the real key. Only its sha256 hash
//     (lookup) and an AES-GCM copy (so the owning teacher can copy the link
//     again) are stored — never the raw token.
//   • The student confirms their name + teacher's name; 5 wrong tries lock the
//     link for 15 minutes.
//   • A correct check issues a short-lived access token (X-Share-Access header),
//     signed with a purpose-specific key and bound to the link kind, document
//     and current link hash — deleting/replacing the link kills open sessions.
//   • Links expire at the end of the due date in the center's timezone.
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { getCenterSecret } from "./jwtUtils.js";
import { encrypt, decrypt } from "./fieldEncryption.js";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS          = 15 * 60 * 1000;
const ACCESS_TTL_MS              = 2 * 60 * 60 * 1000;
export const ACCESS_HEADER       = "x-share-access";
export const LINK_KINDS          = ["homework", "quiz", "attendance"];

// ── Schema shape (embed as `shareLink` in any schema) ────────────────────────
export const shareLinkSchemaDef = {
  tokenHash:      { type: String, select: false },
  tokenEnc:       { type: String, select: false },
  createdAt:      Date,
  failedAttempts: { type: Number, select: false },
  lockedUntil:    { type: Date, select: false },
};
export const SHARE_LINK_SECRET_FIELDS = "+shareLink.tokenHash +shareLink.failedAttempts +shareLink.lockedUntil";

// ── Tokens ────────────────────────────────────────────────────────────────────
// 32 random bytes → 43-char base64url. Unguessable; this is the real key.
export const createLinkToken   = () => crypto.randomBytes(32).toString("base64url");
export const hashLinkToken     = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
export const isWellFormedToken = (token) => typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

/** Issue (or replace) the share link on a document. Returns the raw token. */
export function issueShareLink(doc) {
  const token = createLinkToken();
  doc.shareLink = {
    tokenHash: hashLinkToken(token), tokenEnc: encrypt(token),
    createdAt: new Date(), failedAttempts: 0, lockedUntil: null,
  };
  return token;
}

/** Plain object for the owner (teacher/admin): secrets removed, raw token + expiry added.
 *  `expiresAt` overrides the default (end of the due date). */
export function withShareInfo(docOrObj, center, { expiresAt } = {}) {
  const obj = typeof docOrObj.toObject === "function" ? docOrObj.toObject() : { ...docOrObj };
  let shareToken = null;
  try { shareToken = obj.shareLink?.tokenEnc ? decrypt(obj.shareLink.tokenEnc) : null; } catch { shareToken = null; }
  obj.shareLink = shareToken
    ? { createdAt: obj.shareLink.createdAt, expiresAt: expiresAt ? expiresAt(obj) : linkExpiresAt(obj.dueDate, center?.timezone) }
    : undefined;
  return { ...obj, shareToken };
}

// ── Expiry: end of the due date in the center's timezone ─────────────────────
// dueDate is stored as midnight UTC of the chosen day ("2026-04-05T00:00:00Z").
function tzOffsetMs(date, timeZone) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone, hourCycle: "h23",
        year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
      }).formatToParts(date).map(p => [p.type, p.value])
    );
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000; // formatToParts drops milliseconds
  } catch {
    return 0; // unknown timezone → treat as UTC
  }
}

export function linkExpiresAt(dueDate, timeZone = "UTC") {
  const d = new Date(dueDate);
  const endOfDayUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999);
  return new Date(endOfDayUtc - tzOffsetMs(new Date(endOfDayUtc), timeZone));
}

// ── Name check ────────────────────────────────────────────────────────────────
// Forgiving on purpose (kids + Vietnamese names): ignores accents, case, spacing,
// punctuation, name order and honorifics. It's a confirmation step, not a password.
const HONORIFICS = new Set(["teacher", "mr", "mrs", "ms", "miss", "sir", "madam", "dr", "co", "thay", "giao", "vien"]);

export function normalizeName(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/).filter(Boolean);
}

const sortedKey = (words) => [...words].sort().join(" ");

/** true if `input` matches the person's first name, or their full name in any word order. */
export function nameMatches(input, { firstName, lastName, displayName } = {}, { stripHonorifics = false } = {}) {
  const clean = (s) => {
    const words = normalizeName(s);
    return stripHonorifics ? words.filter(w => !HONORIFICS.has(w)) : words;
  };
  const words = clean(input);
  if (words.length === 0) return false;

  const first = clean(firstName);
  const full  = [...first, ...clean(lastName)];
  const candidates = [first, full, clean(displayName)].filter(c => c.length);
  const key = sortedKey(words);
  return candidates.some(c => sortedKey(c) === key);
}

/**
 * Run the name check against a document loaded with SHARE_LINK_SECRET_FIELDS and
 * populated studentId / teacherId. Handles lockout bookkeeping on `Model`.
 * Returns { ok: true } or { ok: false, status, message }.
 */
export async function checkUnlock(Model, doc, studentName, teacherName) {
  const lockedUntil = doc.shareLink.lockedUntil;
  if (lockedUntil && lockedUntil > new Date()) {
    const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
    return { ok: false, status: 429, message: `Too many wrong attempts. Please try again in ${mins} minute(s).` };
  }

  const studentOk = nameMatches(studentName, doc.studentId);
  const teacherOk = nameMatches(teacherName, doc.teacherId, { stripHonorifics: true });

  if (!studentOk || !teacherOk) {
    const attempts = (doc.shareLink.failedAttempts || 0) + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;
    await Model.updateOne({ _id: doc._id }, {
      $set: locked
        ? { "shareLink.failedAttempts": 0, "shareLink.lockedUntil": new Date(Date.now() + LOCKOUT_MS) }
        : { "shareLink.failedAttempts": attempts },
    });
    return {
      ok: false, status: 400,
      message: locked
        ? "Too many wrong attempts. Please try again in 15 minutes."
        : "The names don't match. Please check the spelling and try again.",
    };
  }

  if (doc.shareLink.failedAttempts || doc.shareLink.lockedUntil) {
    await Model.updateOne({ _id: doc._id }, { $set: { "shareLink.failedAttempts": 0, "shareLink.lockedUntil": null } });
  }
  return { ok: true };
}

/**
 * Find the document behind a link token. `Model` must have studentId/teacherId
 * refs (Student/Teacher models registered on the same connection).
 * Returns { status: "invalid" } | { status: "expired", doc } | { status: "ok", doc, tokenHash, expiresAt }.
 * `graceUntil(doc)` may return a Date that keeps an expired link usable (e.g. a quiz already in progress).
 * `expiresAt(doc)` overrides the default expiry (end of the due date).
 */
export async function resolveShareLink(Model, token, center, { select = "", graceUntil, expiresAt: expiryFor } = {}) {
  if (!isWellFormedToken(token)) return { status: "invalid" };
  const tokenHash = hashLinkToken(token);
  const doc = await Model.findOne({ "shareLink.tokenHash": tokenHash })
    .select(`${SHARE_LINK_SECRET_FIELDS} ${select}`.trim())
    .populate("studentId", "firstName lastName")
    .populate("teacherId", "firstName lastName displayName");
  if (!doc || !doc.studentId || !doc.teacherId) return { status: "invalid" };

  const expiresAt = expiryFor ? expiryFor(doc) : linkExpiresAt(doc.dueDate, center?.timezone);
  const grace = graceUntil?.(doc);
  if (Date.now() > expiresAt.getTime() && !(grace && Date.now() <= grace.getTime())) {
    return { status: "expired", doc };
  }
  return { status: "ok", doc, tokenHash, expiresAt };
}

// ── Access token (after a correct name check) ────────────────────────────────
// Signed with a key derived for this purpose only, so it can never be used as a
// login token. Bound to link kind + document + current link hash.
const accessSecret = (slug) =>
  crypto.createHmac("sha256", getCenterSecret(slug)).update("share-link-access").digest("hex");

export function signLinkAccess(slug, kind, docId, tokenHash, expiresAt) {
  const ttl = Math.max(60_000, Math.min(ACCESS_TTL_MS, new Date(expiresAt).getTime() - Date.now()));
  return jwt.sign(
    { typ: "share-link", k: kind, id: String(docId), th: tokenHash.slice(0, 32) },
    accessSecret(slug),
    { expiresIn: Math.floor(ttl / 1000), algorithm: "HS256" },
  );
}

/** Returns the payload if the access token is valid for this kind + document + link, else null. */
export function verifyLinkAccess(slug, kind, accessToken, docId, tokenHash) {
  if (!accessToken) return null;
  try {
    const p = jwt.verify(accessToken, accessSecret(slug), { algorithms: ["HS256"] });
    if (p.typ !== "share-link" || p.k !== kind || p.id !== String(docId) || p.th !== tokenHash.slice(0, 32)) return null;
    return p;
  } catch {
    return null;
  }
}

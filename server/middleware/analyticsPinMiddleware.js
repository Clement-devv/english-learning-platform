// server/middleware/analyticsPinMiddleware.js
// Gates financial/analytics data behind the admin's optional 4-digit PIN.
// The client unlocks via POST /admin/analytics-pin/verify and then sends the
// short-lived unlock token in the `x-analytics-unlock` header.
import jwt from "jsonwebtoken";
import { createHmac } from "crypto";
import { getCenterSecret } from "../utils/jwtUtils.js";
import { JWT_STANDARD_CLAIMS, JWT_VERIFY_OPTIONS } from "../config/config.js";
import { adminSchema } from "../schemas/adminSchema.js";

export const ANALYTICS_UNLOCK_HEADER = "x-analytics-unlock";
export const ANALYTICS_UNLOCK_TTL    = 8 * 60 * 60; // seconds

const getAdmin = (db) => db.models.Admin || db.model("Admin", adminSchema);

// Unlock tokens use a key derived from the center secret so they can never be
// accepted by verifyToken as a login token (and vice versa).
const unlockSecret = (slug) => createHmac("sha256", getCenterSecret(slug)).update("analytics-unlock").digest("hex");

const pinVersion = (admin) => admin.analyticsPinSetAt ? admin.analyticsPinSetAt.getTime() : 0;

export function signAnalyticsUnlock(req, admin) {
  return jwt.sign(
    { type: "analytics-unlock", id: req.user.id, centerId: req.center.slug, pv: pinVersion(admin), ...JWT_STANDARD_CLAIMS },
    unlockSecret(req.center.slug),
    { algorithm: "HS256", expiresIn: ANALYTICS_UNLOCK_TTL },
  );
}

/**
 * Resolve the PIN state for the current admin request.
 * Returns { pinSet, unlocked }. Admins without a PIN are always unlocked;
 * super-admin impersonation sessions have no admin record and bypass the PIN.
 */
export async function getAnalyticsAccess(req) {
  if (req.user?.isImpersonation) return { pinSet: false, unlocked: true };

  const admin = await getAdmin(req.db).findById(req.user.id).select("+analyticsPinHash analyticsPinSetAt").lean();
  if (!admin?.analyticsPinHash) return { pinSet: false, unlocked: true };

  const token = req.headers[ANALYTICS_UNLOCK_HEADER];
  if (!token) return { pinSet: true, unlocked: false };
  try {
    const decoded = jwt.verify(token, unlockSecret(req.center.slug), JWT_VERIFY_OPTIONS);
    const unlocked =
      decoded.type === "analytics-unlock" &&
      decoded.id === req.user.id &&
      decoded.centerId === req.center.slug &&
      decoded.pv === pinVersion(admin);
    return { pinSet: true, unlocked };
  } catch {
    return { pinSet: true, unlocked: false };
  }
}

// Route guard: rejects with 403 ANALYTICS_LOCKED until the PIN is entered.
export const requireAnalyticsUnlock = async (req, res, next) => {
  try {
    const { unlocked } = await getAnalyticsAccess(req);
    if (!unlocked) {
      return res.status(403).json({ success: false, code: "ANALYTICS_LOCKED", message: "Enter your analytics PIN to view this data" });
    }
    next();
  } catch {
    res.status(500).json({ success: false, message: "Error checking analytics PIN" });
  }
};

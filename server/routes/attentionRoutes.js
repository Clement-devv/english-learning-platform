// server/routes/attentionRoutes.js — mounted at /admin/attention
//
// GET /  — how many items wait for the admin, for the dashboard welcome banner:
//   loggedClasses  classes teachers logged that still need approval (Logged classes tab)
//   parentChecks   parent checks waiting for a reply or disputed (Parent checks → Waiting)
//   disputes       open class disputes (Disputes tab)
// Counts only — each tab loads its own list.
import express from "express";
import { tenantMiddleware } from "../middleware/tenantMiddleware.js";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { bookingSchema } from "../schemas/bookingSchema.js";
import { PARENT_CHECK_BASE, PARENT_CHECK_WAITING, PARENT_CHECK_DISPUTED } from "../utils/parentCheckFilters.js";
import logger from "../utils/logger.js";
import { ok, serverError } from "../utils/apiResponse.js";

const router = express.Router();
router.use(tenantMiddleware);

const getBooking = (db) => db.models.Booking || db.model("Booking", bookingSchema);

router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const Booking = getBooking(req.db);
    const [loggedClasses, parentChecks, disputes] = await Promise.all([
      // Same "pending" as the Logged classes tab (routes/offlineClassRoutes.js)
      Booking.countDocuments({ loggedByTeacher: true, "offline.approval.status": { $in: ["pending", "processing"] } }),
      Booking.countDocuments({ ...PARENT_CHECK_BASE, $or: [PARENT_CHECK_WAITING, PARENT_CHECK_DISPUTED] }),
      // Same as the Disputes tab (routes/disputeRoutes.js)
      Booking.countDocuments({ disputeRaised: true, disputeStatus: "pending" }),
    ]);
    ok(res, { data: { loggedClasses, parentChecks, disputes } });
  } catch (err) {
    logger.error("Attention counts error:", { error: err?.message });
    serverError(res, "Error loading dashboard counts");
  }
});

export default router;

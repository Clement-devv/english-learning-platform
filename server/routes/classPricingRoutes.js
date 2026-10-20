// server/routes/classPricingRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware }         from "../middleware/tenantMiddleware.js";
import { classPricingSchema }       from "../schemas/classPricingSchema.js";
import logger from "../utils/logger.js";
import { badRequest, serverError } from '../utils/apiResponse.js';

const router = express.Router();
router.use(tenantMiddleware);

const getPricing = (db) =>
  db.models.ClassPricing || db.model("ClassPricing", classPricingSchema);

// ─── GET current pricing ─────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const pricing = await getPricing(req.db).findOne().lean();
    // The default teacher fee for group classes is staff-only
    if (pricing && req.user.role === "student") delete pricing.defaultGroupFee;
    res.json(pricing || null);
  } catch (err) {
    logger.error(err);
    serverError(res, "Error fetching pricing");
  }
});

// ─── PUT update / create pricing ─────────────────────────────────────────────
router.put("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { pricePerClass, currency, currencySymbol, notes, pricePerPoint, defaultGroupFee } = req.body;
    const money = (v) => (v === undefined || v === null || v === "" ? undefined : Number(v));
    const ppp = money(pricePerPoint), fee = money(defaultGroupFee);
    if ((ppp !== undefined && !(ppp >= 0)) || (fee !== undefined && !(fee >= 0)))
      return badRequest(res, "Group point price and teacher fee must be 0 or more");
    if (pricePerClass === undefined || pricePerClass === null || pricePerClass < 0)
      return badRequest(res, "pricePerClass must be a non-negative number");

    const ClassPricing = getPricing(req.db);
    const pricing = await ClassPricing.findOneAndUpdate(
      {},
      { pricePerClass, currency: currency || "USD", currencySymbol: currencySymbol || "$", notes: notes || "",
        ...(ppp !== undefined && { pricePerPoint: ppp }), ...(fee !== undefined && { defaultGroupFee: fee }) },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ message: "Pricing saved", pricing });
  } catch (err) {
    logger.error(err);
    serverError(res, "Error saving pricing");
  }
});

export default router;

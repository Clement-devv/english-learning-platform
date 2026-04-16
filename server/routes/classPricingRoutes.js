// server/routes/classPricingRoutes.js
import express from "express";
import { verifyToken, verifyAdmin } from "../middleware/authMiddleware.js";
import { tenantMiddleware }         from "../middleware/tenantMiddleware.js";
import { classPricingSchema }       from "../schemas/classPricingSchema.js";
import logger from "../utils/logger.js";

const router = express.Router();
router.use(tenantMiddleware);

const getPricing = (db) =>
  db.models.ClassPricing || db.model("ClassPricing", classPricingSchema);

// ─── GET current pricing ─────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const pricing = await getPricing(req.db).findOne().lean();
    res.json(pricing || null);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Error fetching pricing" });
  }
});

// ─── PUT update / create pricing ─────────────────────────────────────────────
router.put("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { pricePerClass, currency, currencySymbol, notes } = req.body;
    if (pricePerClass === undefined || pricePerClass === null || pricePerClass < 0)
      return res.status(400).json({ message: "pricePerClass must be a non-negative number" });

    const ClassPricing = getPricing(req.db);
    const pricing = await ClassPricing.findOneAndUpdate(
      {},
      { pricePerClass, currency: currency || "USD", currencySymbol: currencySymbol || "$", notes: notes || "" },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ message: "Pricing saved", pricing });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: "Error saving pricing" });
  }
});

export default router;

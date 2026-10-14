// server/schemas/classPricingSchema.js
import mongoose from "mongoose";
const { Schema } = mongoose;

// One pricing document per center (singleton — always upsert by centerId).
export const classPricingSchema = new Schema(
  {
    pricePerClass:  { type: Number, required: true, min: 0 },
    currency:       { type: String, default: "USD", trim: true },
    currencySymbol: { type: String, default: "$",   trim: true },
    notes:          { type: String, default: "" },
    // Group classes: price of one group point (shown when selling points) and the
    // teacher fee a teacher-created group class gets (the admin can change it per class)
    pricePerPoint:   { type: Number, min: 0, default: 0 },
    defaultGroupFee: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true }
);

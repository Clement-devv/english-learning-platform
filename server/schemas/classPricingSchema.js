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
  },
  { timestamps: true }
);

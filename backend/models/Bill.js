/**
 * Bill model — each bill belongs to a user (userId).
 * items: line items from the calculator; total and date are required for billing.
 */
const mongoose = require("mongoose");

const billItemSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    image: { type: String, default: "" },
    qtyDisplay: mongoose.Schema.Types.Mixed,
    price: { type: Number, default: 0 },
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    items: {
      type: [billItemSchema],
      default: [],
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    // Extra fields preserved for the existing UI (rate, format, paid, due)
    rate: { type: Number },
    format: { type: String },
    paid: { type: Number },
    due: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bill", billSchema);

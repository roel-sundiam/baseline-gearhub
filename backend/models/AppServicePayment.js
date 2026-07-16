const mongoose = require("mongoose");

const appServicePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    type: { type: String, enum: ["payment", "waiver", "billing"], default: "payment" },
    paymentMethod: {
      type: String,
      enum: ["GCash", "QRPh"],
    },
    paymentScreenshot: { type: String, default: null },
    note: { type: String },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    // Dedupe key for auto-accrued billing entries (e.g. "finance_report:2026-07").
    billingKey: { type: String, default: null },
  },
  { timestamps: true }
);

appServicePaymentSchema.index(
  { clubId: 1, billingKey: 1 },
  { unique: true, partialFilterExpression: { billingKey: { $type: "string" } } }
);

module.exports = mongoose.model("AppServicePayment", appServicePaymentSchema);

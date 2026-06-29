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
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppServicePayment", appServicePaymentSchema);

const mongoose = require("mongoose");

const appServicePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: ["GCash", "Cash", "Bank Transfer"],
      required: true,
    },
    note: { type: String },
    paidBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppServicePayment", appServicePaymentSchema);

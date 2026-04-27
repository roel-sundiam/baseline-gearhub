const mongoose = require("mongoose");

const coinTransactionSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["debit", "credit"], required: true },
    amount: { type: Number, required: true },
    action: {
      type: String,
      enum: ["reservation", "tournament-join", "page-view", "coin-request-approved"],
      required: true,
    },
    page: { type: String },
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    balanceAfter: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoinTransaction", coinTransactionSchema);

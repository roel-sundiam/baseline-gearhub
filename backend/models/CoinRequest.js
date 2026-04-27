const mongoose = require("mongoose");

const coinRequestSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    coinsRequested: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, enum: ["GCash", "Cash", "Bank Transfer"], required: true },
    note: { type: String },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    rejectedNote: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CoinRequest", coinRequestSchema);

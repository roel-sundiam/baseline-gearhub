const mongoose = require("mongoose");

const creditSchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["grant", "redemption"], required: true },
    // Positive for grant, negative for redemption. Balance is always derived by summing.
    amount: { type: Number, required: true },
    reason: { type: String, trim: true },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },
    grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

creditSchema.index({ clubId: 1, playerId: 1, createdAt: -1 });

module.exports = mongoose.model("Credit", creditSchema);

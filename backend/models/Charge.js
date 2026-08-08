const mongoose = require("mongoose");

const chargeSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Reservation",
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    openPlaySessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OpenPlaySession",
    },
    gameJoinId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GameJoin",
    },
    hostedPlayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "HostedPlay",
    },
    amount: { type: Number, required: true },
    breakdown: {
      withoutLightFee: { type: Number, default: 0 },
      lightFee: { type: Number, default: 0 },
      ballBoyFee: { type: Number, default: 0 },
      guestFee: { type: Number, default: 0 },
      rentalFee: { type: Number, default: 0 },
      convenienceFee: { type: Number, default: 0 },
      convenienceFeeMode: { type: String, default: null },
      extraFees: [{ name: { type: String }, amount: { type: Number, default: 0 } }],
      extraFeeTotal: { type: Number, default: 0 },
      coachingFee: { type: Number, default: 0 },
      gameFee: { type: Number, default: 0 },
      hostedPlayFee: { type: Number, default: 0 },
    },
    chargeType: { type: String, enum: ["reservation", "session", "open_play_session", "per_game", "hosted_play"], default: "reservation" },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    approvalStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    paymentMethod: { type: String, enum: ["GCash", "Cash", "Bank Transfer", "GoTyme", "Credit"] },
    paidAt: { type: Date },
    adminNote: { type: String },
    paymentScreenshot: { type: String, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    // Peso amount of this charge covered by the member's credit ledger (backend/models/Credit.js).
    // charge.amount is never mutated down — remaining owed is always amount - creditApplied.
    creditApplied: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Supports the non-reservation revenue/analytics match shape ({clubId, chargeType, status:"paid"})
// and the incomeDate (paidAt ?? createdAt) grouping/filtering used by clubRevenue.js.
chargeSchema.index({ clubId: 1, chargeType: 1, status: 1 });
chargeSchema.index({ clubId: 1, paidAt: 1 });

module.exports = mongoose.model("Charge", chargeSchema);

const mongoose = require("mongoose");

const chargeSchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    guestName: { type: String },
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
    amount: { type: Number, required: true },
    breakdown: {
      withoutLightFee: { type: Number, default: 0 },
      lightFee: { type: Number, default: 0 },
      ballBoyFee: { type: Number, default: 0 },
      guestFee: { type: Number, default: 0 },
      rentalFee: { type: Number, default: 0 },
      convenienceFee: { type: Number, default: 0 },
      extraFees: [{ name: { type: String }, amount: { type: Number, default: 0 } }],
      extraFeeTotal: { type: Number, default: 0 },
    },
    chargeType: { type: String, enum: ["reservation", "session", "open_play_session"], default: "reservation" },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    approvalStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    paymentMethod: { type: String, enum: ["GCash", "Cash", "Bank Transfer", "GoTyme"] },
    paidAt: { type: Date },
    adminNote: { type: String },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Charge", chargeSchema);

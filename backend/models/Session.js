const mongoose = require("mongoose");

const playerEntrySchema = new mongoose.Schema(
  {
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: { type: String, required: true },
    gamesWithoutLight: { type: Number, required: true, min: 0, default: 0 },
    gamesWithLight: { type: Number, required: true, min: 0, default: 0 },
    ballBoyUsed: { type: Boolean, default: false },
    charges: {
      withoutLightFee: { type: Number, required: true },
      lightFee: { type: Number, required: true },
      ballBoyFee: { type: Number, required: true },
      total: { type: Number, required: true },
    },
    status: { type: String, enum: ["unpaid", "paid"], default: "unpaid" },
    approvalStatus: { type: String, enum: ["none", "pending", "approved", "rejected"], default: "none" },
    paymentMethod: { type: String, enum: ["GCash", "Cash", "Bank Transfer"] },
    paidAt: { type: Date },
  },
  { _id: false },
);

const trainingEntrySchema = new mongoose.Schema(
  {
    trainerCoach: { type: String, required: true, trim: true },
    withoutLights: { type: Number, required: true, min: 0, default: 0 },
    withLights: { type: Number, required: true, min: 0, default: 0 },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    totalFee: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const courtSessionSchema = new mongoose.Schema(
  {
    courtLabel: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    withLights: { type: Boolean, required: true },
    fee: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String },
    ballBoyUsed: { type: Boolean, default: false },
    ratesUsed: {
      withoutLightRate: { type: Number, required: true },
      lightRate: { type: Number, required: true },
      training2WithoutLightRate: { type: Number, required: true },
      training2LightRate: { type: Number, required: true },
      ballBoyRate: { type: Number, required: true },
    },
    players: [playerEntrySchema],
    trainings: [trainingEntrySchema],
    courtSessions: [courtSessionSchema],
    totalAmount: { type: Number, required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Session", sessionSchema);

const mongoose = require("mongoose");

const hostedPlaySchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sport: { type: String, enum: ["tennis", "pickleball"], required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    court: { type: String, trim: true },
    address: { type: String, trim: true },
    feePerPlayer: { type: Number, default: 0, min: 0 },
    maxPlayers: { type: Number, required: true, min: 2 },
    currentPlayers: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["open", "full", "closed", "cancelled"],
      default: "open",
    },
    description: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HostedPlay", hostedPlaySchema);

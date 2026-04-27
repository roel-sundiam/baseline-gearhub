const mongoose = require("mongoose");
const { Schema } = mongoose;

const MatchSchema = new Schema(
  {
    round: { type: Number, required: true },
    roundName: { type: String, default: "" },
    position: { type: Number, required: true },
    slot1Players: [{ type: Schema.Types.ObjectId, ref: "User" }],
    slot2Players: [{ type: Schema.Types.ObjectId, ref: "User" }],
    scheduledDate: { type: Date, default: null },
    timeSlot: { type: String, default: "" },
    score: { type: String, default: "" },
    winner: { type: Number, default: null }, // 1 or 2
    status: {
      type: String,
      enum: ["upcoming", "ongoing", "completed"],
      default: "upcoming",
    },
  },
  { _id: true },
);

const TournamentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["singles", "doubles"], required: true },
    status: {
      type: String,
      enum: ["draft", "active", "completed"],
      default: "draft",
    },
    // Singles: individual player IDs. Doubles: all enrolled player IDs (teams holds pairings)
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // Doubles only: [[player1Id, player2Id], ...]
    teams: { type: [[{ type: Schema.Types.ObjectId, ref: "User" }]], default: [] },
    matches: [MatchSchema],
    published: { type: Boolean, default: false },
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Tournament", TournamentSchema);

const mongoose = require("mongoose");

const openPlaySessionPlayerSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "OpenPlaySession", required: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    guestName: { type: String, trim: true },
    guestEmail: { type: String, trim: true, lowercase: true },
    guestPhone: { type: String, trim: true },
    ratingSnapshot: { type: Number, default: 3.5 },
    checkedIn: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("OpenPlaySessionPlayer", openPlaySessionPlayerSchema);

const mongoose = require("mongoose");

// Audit trail for Reclub Participant Import — one row per imported participant
// (not per batch), so a debugging/audit query can trace exactly what raw text
// produced which HostedPlayParticipant.
const reclubImportRecordSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    importMethod: { type: String, enum: ["paste", "screenshot"], required: true },
    rawName: { type: String, required: true, trim: true },
    finalName: { type: String, required: true, trim: true },
    matchedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    participantId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", required: true },
    isGuest: { type: Boolean, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ReclubImportRecord", reclubImportRecordSchema);

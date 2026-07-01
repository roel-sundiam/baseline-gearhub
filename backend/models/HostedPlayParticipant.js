const mongoose = require("mongoose");

const hostedPlayParticipantSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    memberName: { type: String, trim: true },
    chargeId: { type: mongoose.Schema.Types.ObjectId, ref: "Charge" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HostedPlayParticipant", hostedPlayParticipantSchema);

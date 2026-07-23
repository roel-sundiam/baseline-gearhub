const mongoose = require("mongoose");

// A permanent doubles team for the fixed_doubles_rotation format. Partners
// never change once confirmed — this is the registration unit the round-robin
// schedule is built from, layered on top of the normal HostedPlayParticipant
// records (which still carry payment/check-in state per player).
const hostedPlayPairSchema = new mongoose.Schema(
  {
    hostedPlayId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlay", required: true, index: true },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true },
    pairLabel: { type: String, trim: true, default: "" },

    participantAId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", required: true },
    // Null until a partner is confirmed (self-service invite still pending).
    participantBId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },

    // Self-service invite (Method 1): who A invited, before B has joined/accepted.
    invitedMemberId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    inviteStatus: { type: String, enum: ["none", "pending", "accepted", "declined"], default: "none" },
    invitedAt: { type: Date, default: null },
    inviteRespondedAt: { type: Date, default: null },

    status: { type: String, enum: ["pending_partner", "confirmed", "withdrawn"], default: "pending_partner" },
    source: { type: String, enum: ["player_invite", "organizer_assigned"], required: true },
  },
  { timestamps: true },
);

hostedPlayPairSchema.index({ hostedPlayId: 1, status: 1 });

module.exports = mongoose.model("HostedPlayPair", hostedPlayPairSchema);

const mongoose = require("mongoose");

const hostedPlaySchema = new mongoose.Schema(
  {
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    title: { type: String, required: true, trim: true },
    sport: { type: String, enum: ["tennis", "pickleball", "badminton", "squash", "table_tennis", "padel"], required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    venue: { type: String, required: true, trim: true },
    court: { type: String, trim: true },
    address: { type: String, trim: true },
    feePerPlayer: { type: Number, default: 0, min: 0 },
    // Billing model, snapshotted from Club.hostedPlayFeeSplitMode at creation and
    // fixed for the life of the session. split_total ignores feePerPlayer and bills
    // members sessionFee / (members still joined) once, when the session completes.
    feeSplitMode: { type: String, enum: ["per_player", "split_total"], default: "per_player" },
    sessionFee: { type: Number, default: 0, min: 0 },
    // Guest pricing/capacity. guestFeePerPlayer null = guests pay feePerPlayer.
    // maxGuests counts within maxPlayers; null = no guest-specific limit, 0 = no guests.
    guestFeePerPlayer: { type: Number, default: null, min: 0 },
    maxGuests: { type: Number, default: null, min: 0 },
    maxPlayers: { type: Number, required: true, min: 2 },
    currentPlayers: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["open", "full", "closed", "cancelled", "completed"],
      default: "open",
    },
    description: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // ── Queue Management ──
    queueManagementEnabled: { type: Boolean, default: false },
    numberOfCourts: { type: Number, default: 1, min: 1 },
    // Unused by fixed_doubles_rotation — that format always plays 2v2 fixed pairs.
    playersPerCourt: { type: Number, default: 4, min: 1 }, // future-proof; V1 keeps 4
    queueMode: {
      type: String,
      enum: ["fcfs", "winner_stays", "king_of_court", "skill_rotation", "fixed_doubles_rotation"],
      default: "fcfs",
    },
    queueStatus: {
      type: String,
      enum: ["not_started", "running", "paused", "ended"],
      default: "not_started",
    },
    queueStartedAt: { type: Date },
    queueEndedAt: { type: Date },
    summary: {
      totalParticipants: { type: Number },
      totalCheckedIn: { type: Number },
      totalGamesPlayed: { type: Number },
    },

    // ── Fixed Doubles Rotation — round-robin schedule config, only meaningful
    // when queueMode === "fixed_doubles_rotation" ──
    fixedDoubles: {
      pairCount: { type: Number, default: null, min: 2 },
      // Auto-computed at schedule generation time from the session's start/end
      // window and actual confirmed pair count — never organizer-entered.
      matchDurationMinutes: { type: Number, default: null, min: 1 },
      restBetweenMatchesMinutes: { type: Number, default: 0, min: 0 },
      scheduleGeneratedAt: { type: Date, default: null },
      // Bumped every (re)generate — lets stale fixture reads/pollers detect a
      // schedule change without a separate "version" field on every fixture read.
      scheduleGenerationBatch: { type: Number, default: 0 },
      // Bumped on any pair edit/swap/withdraw — drives a "schedule out of date"
      // banner in the admin UI once a schedule already exists.
      pairsUpdatedAt: { type: Date, default: null },
    },

    // ── QR Self-Check-In ──
    qrToken: { type: String, sparse: true },
    qrTokenGeneratedAt: { type: Date },

    // ── Umpire Live Scoring — anonymous, per-court token access (no member login) ──
    // One token per court so a link only ever grants scoring access to that
    // single physical court, never the whole session.
    courtUmpireTokens: {
      type: [
        {
          courtNumber: { type: Number, required: true },
          token: { type: String, required: true },
          generatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      _id: false,
    },
    // In-progress score per active court, distinct from the final HostedPlayMatch
    // record created at finish time. Cleared for a court once its game finishes,
    // so the next game there always starts at 0-0 with no server chosen yet.
    // Side-out scoring: servingTeam/serverNumber track who's serving so the
    // umpire only ever has to say who won each rally — the point-vs-side-out
    // and server-1-vs-server-2 branching is derived from this state, not tapped
    // directly. previousState is a single-level undo snapshot (null = none).
    liveScores: {
      type: [
        {
          courtNumber: { type: Number, required: true },
          team1Score: { type: Number, default: 0, min: 0 },
          team2Score: { type: Number, default: 0, min: 0 },
          servingTeam: { type: Number, enum: [1, 2, null], default: null },
          serverNumber: { type: Number, enum: [1, 2, null], default: null },
          // The specific player currently serving. null while servingTeam is set
          // means a side-out just handed the serve to a 2-player team and nobody
          // has confirmed who's serving yet — a real, valid mid-game state.
          servingPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
          // Persistent per-team court position: whichever player is currently on
          // the right side. Only changes when that team's server wins a point
          // (the pair swaps sides) — frozen otherwise, including through side-outs
          // and receiving. Once known, it's what lets a team's later side-outs
          // resolve their server automatically instead of asking every time.
          team1RightPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
          team2RightPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: "HostedPlayParticipant", default: null },
          previousState: {
            type: new mongoose.Schema(
              {
                team1Score: Number,
                team2Score: Number,
                servingTeam: { type: Number, enum: [1, 2, null] },
                serverNumber: { type: Number, enum: [1, 2, null] },
                servingPlayerId: { type: mongoose.Schema.Types.ObjectId, default: null },
                team1RightPlayerId: { type: mongoose.Schema.Types.ObjectId, default: null },
                team2RightPlayerId: { type: mongoose.Schema.Types.ObjectId, default: null },
              },
              { _id: false },
            ),
            default: null,
          },
          updatedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      _id: false,
    },

    // Minutes after startTime after which an unchecked-in confirmed player may be
    // bumped to free their spot for a waitlister. 0 = disabled (no auto-release).
    checkInCutoffMinutes: { type: Number, default: 0, min: 0 },

    // Optional skill band — only players whose self-declared tier falls within
    // [minSkillLevel, maxSkillLevel] may join. null = no restriction on that end.
    minSkillLevel: {
      type: String,
      enum: [
        "beginner",
        "novice",
        "lower_intermediate",
        "intermediate",
        "upper_intermediate",
        "advanced",
        "expert_elite",
        "professional",
        null,
      ],
      default: null,
    },
    maxSkillLevel: {
      type: String,
      enum: [
        "beginner",
        "novice",
        "lower_intermediate",
        "intermediate",
        "upper_intermediate",
        "advanced",
        "expert_elite",
        "professional",
        null,
      ],
      default: null,
    },

    // Optional pickleball scoring config (only meaningful when sport === "pickleball").
    // null scoreTarget = no configured target; score entry stays free-form.
    scoreTarget: { type: Number, enum: [11, 15, 21, null], default: null },
    winByTwo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("HostedPlay", hostedPlaySchema);

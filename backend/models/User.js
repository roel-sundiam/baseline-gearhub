const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["player", "admin", "superadmin"],
      default: "player",
    },
    status: {
      type: String,
      enum: ["pending", "active", "rejected", "deactivated"],
      default: "pending",
    },
    contactNumber: { type: String, trim: true },
    gender: { type: String, enum: ["Male", "Female"] },
    // Self-declared skill tier, used to gate level-banded Hosted Play sessions.
    skillLevel: {
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
      ],
      default: "novice",
    },
    // Self-reported / admin-entered DUPR doubles rating (2.000-8.000 scale).
    // No DUPR API integration exists yet - not verified against a real DUPR account.
    duprRating: { type: Number, min: 2.0, max: 8.0, default: null },
    // Self-reported / admin-entered DUPR player ID (free text). Reserved for a
    // future account-linking phase once a DUPR API partnership exists.
    duprId: { type: String, trim: true, default: null },
    // Verified DUPR account link (Partner API). While duprLink.verified is true,
    // this is the source of truth and mirrors into duprRating/duprId on every
    // sync so existing display paths need no changes.
    duprLink: {
      duprPlayerId: { type: String, trim: true, default: null },
      email: { type: String, trim: true, default: null },
      fullName: { type: String, trim: true, default: null },
      verified: { type: Boolean, default: false },
      linkedAt: { type: Date, default: null },
      doubles: { type: Number, default: null },
      singles: { type: Number, default: null },
      lastSyncedAt: { type: Date, default: null },
      // DUPR entitlement codes (e.g. "BASIC_L1") from the SSO postMessage payload's
      // `subscriptions[].entitlements` map - flattened across resource categories.
      // There is no separate DUPR API to check/refresh this later (confirmed against
      // the real OpenAPI spec - the only "subscription" endpoint is for a partner to
      // GRANT a promo subscription, not to read one) - only ever set/refreshed at
      // SSO link time.
      entitlements: { type: [String], default: [] },
      // Per-user DUPR SSO credentials (login-external-app iframe). Real credentials,
      // not profile data - select: false so they're never returned unless a query
      // explicitly opts in with .select('+duprLink.ssoUserToken') etc.
      ssoUserToken: { type: String, default: null, select: false },
      ssoRefreshToken: { type: String, default: null, select: false },
      ssoTokenExpiresAt: { type: Date, default: null },
      ssoRefreshExpiresAt: { type: Date, default: null },
    },
    profileImage: { type: String, default: null },
    clubId: { type: mongoose.Schema.Types.ObjectId, ref: "Club" },
    termsAcceptedAt: { type: Date, default: null },
    termsAcceptedVersion: { type: Number, default: null },
    announcementAcceptedVersion: { type: Number, default: null },
  },
  { timestamps: true },
);

// Partial index (not sparse) — duprPlayerId defaults to null, so sparse alone
// would only exclude documents where the field is entirely absent, not
// present-and-null, letting a second new user collide on the null slot.
userSchema.index(
  { "duprLink.duprPlayerId": 1 },
  { unique: true, partialFilterExpression: { "duprLink.duprPlayerId": { $type: "string" } } },
);

module.exports = mongoose.model("User", userSchema);

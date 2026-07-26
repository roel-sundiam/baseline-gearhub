const express = require("express");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Club = require("../models/Club");
const { isDuprConfigured } = require("../utils/dupr");

const router = express.Router();

function serializeLink(user) {
  if (!user.duprLink?.verified) return null;
  return {
    duprPlayerId: user.duprLink.duprPlayerId,
    fullName: user.duprLink.fullName,
    doubles: user.duprLink.doubles,
    singles: user.duprLink.singles,
    linkedAt: user.duprLink.linkedAt,
    lastSyncedAt: user.duprLink.lastSyncedAt,
  };
}

// GET /api/dupr/status — drives all conditional DUPR UI (Linked Accounts card, etc.)
router.get("/status", auth, async (req, res) => {
  try {
    const [user, club] = await Promise.all([
      User.findById(req.user.userId).select("duprLink"),
      req.user.clubId ? Club.findById(req.user.clubId).select("duprEnabled") : null,
    ]);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({
      configured: isDuprConfigured(),
      clubEnabled: !!club?.duprEnabled,
      // NOTE: SSO iframe clientKey is exposed separately via GET /sso-config,
      // never the partner clientSecret.
      myLink: serializeLink(user),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/dupr/sso-config — public-ish iframe params (auth required to reduce scraping,
// but this is not itself a secret; the clientSecret is never sent to the frontend).
router.get("/sso-config", auth, (req, res) => {
  if (!isDuprConfigured()) return res.status(409).json({ error: "DUPR is not configured on this platform" });
  // UNCONFIRMED which of our two DUPR-issued values ("Client ID" vs "Client Key") DUPR's
  // :clientKey path segment expects - GitBook only says "distinct from the Access Token
  // and Secret" and to Base64-encode it. Using DUPR_CLIENT_KEY (not the secret) as the
  // best-guess candidate; verify against a real UAT iframe load before shipping this UI.
  const encodedClientKey = Buffer.from(process.env.DUPR_CLIENT_KEY).toString("base64");
  const isUat = /uat/i.test(process.env.DUPR_BASE_URL || "");
  const iframeBase = isUat ? "https://uat.dupr.gg" : "https://dashboard.dupr.com";
  res.json({ iframeUrl: `${iframeBase}/login-external-app/${encodedClientKey}` });
});

// POST /api/dupr/link/sso-callback — receives the postMessage payload the frontend
// captured from the DUPR SSO iframe after a successful login.
// KNOWN GAP: no confirmed DUPR endpoint to independently verify userToken server-side
// before trusting it (see docs/DUPR_INTEGRATION_PLAN.md Security Considerations) - for
// now this trusts the payload the frontend forwards, same as the frontend's own
// origin-checked postMessage listener. Revisit once DUPR confirms a verification call.
// Ratings come back as "NR" (Not Rated) when absent, or a numeric string otherwise -
// confirmed live against UAT 2026-07-27 (real payload had stats.doubles === "NR").
function parseDuprRating(value) {
  if (value == null || value === "NR") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

router.post("/link/sso-callback", auth, async (req, res) => {
  try {
    if (!isDuprConfigured()) return res.status(409).json({ error: "DUPR is not configured on this platform" });
    const { userToken, refreshToken, duprId, stats } = req.body;
    if (!userToken || !refreshToken || !duprId) {
      return res.status(400).json({ error: "userToken, refreshToken, and duprId are required" });
    }

    const existing = await User.findOne({ "duprLink.duprPlayerId": duprId, _id: { $ne: req.user.userId } });
    if (existing) return res.status(409).json({ error: "This DUPR account is already linked to another user" });

    const doubles = parseDuprRating(stats?.doubles);
    const singles = parseDuprRating(stats?.singles);
    const now = new Date();
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        duprLink: {
          duprPlayerId: duprId,
          // The SSO postMessage payload has no fullName/email field (confirmed live
          // 2026-07-27) - only duprId/id/stats/subscriptions. Leave null; CourtGo's own
          // User.name is the display name we already have.
          fullName: null,
          email: null,
          verified: true,
          linkedAt: now,
          doubles,
          singles,
          lastSyncedAt: now,
          ssoUserToken: userToken,
          ssoRefreshToken: refreshToken,
          // Token lifetimes per DUPR's docs (UAT 7d/30d, prod 30d/90d) - not returned by
          // the postMessage payload itself, so approximate from the configured environment.
          ssoTokenExpiresAt: new Date(now.getTime() + (/uat/i.test(process.env.DUPR_BASE_URL || "") ? 7 : 30) * 86400000),
          ssoRefreshExpiresAt: new Date(now.getTime() + (/uat/i.test(process.env.DUPR_BASE_URL || "") ? 30 : 90) * 86400000),
        },
        // Mirror per the precedence rule so existing display paths need no rework.
        ...(doubles != null ? { duprRating: doubles } : {}),
        duprId,
      },
      { new: true, runValidators: true },
    ).select("duprLink");

    res.json({ myLink: serializeLink(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "This DUPR account is already linked to another user" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/dupr/link — unlink self; keep the last-synced rating as a fallback value.
router.delete("/link", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.userId, {
      duprLink: {
        duprPlayerId: null,
        email: null,
        fullName: null,
        verified: false,
        linkedAt: null,
        doubles: null,
        singles: null,
        lastSyncedAt: null,
        ssoUserToken: null,
        ssoRefreshToken: null,
        ssoTokenExpiresAt: null,
        ssoRefreshExpiresAt: null,
      },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

const express = require("express");
const auth = require("../middleware/auth");
const admin = require("../middleware/admin");
const superadmin = require("../middleware/superadmin");
const User = require("../models/User");
const Club = require("../models/Club");
const HostedPlayMatch = require("../models/HostedPlayMatch");
const DuprMatchSubmission = require("../models/DuprMatchSubmission");
const dupr = require("../utils/dupr");
const { isDuprConfigured } = dupr;
const duprSync = require("../utils/duprSync");
const { sendPushToUser } = require("../utils/push");

const router = express.Router();

function serializeLink(user) {
  if (!user.duprLink?.verified) return null;
  return {
    duprPlayerId: user.duprLink.duprPlayerId,
    fullName: user.duprLink.fullName,
    doubles: user.duprLink.doubles,
    singles: user.duprLink.singles,
    entitlements: user.duprLink.entitlements || [],
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
  // CONFIRMED live 2026-07-27: base64(DUPR_CLIENT_KEY) is correct - DUPR's real UAT
  // login page rendered on the first try with no clientKey-rejection error.
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

// Flattens the SSO postMessage's subscriptions[].entitlements map into a deduped list
// of entitlement codes (e.g. ["BASIC_L1"]), counting only active subscriptions. This is
// the ONLY source of entitlement data - confirmed against the real OpenAPI spec that
// there is no separate API to check/refresh it later (the one "subscription" endpoint
// that exists is for a partner to GRANT a promo subscription, not to read one).
function extractEntitlements(subscriptions) {
  if (!Array.isArray(subscriptions)) return [];
  const codes = new Set();
  for (const sub of subscriptions) {
    if (sub?.status !== "active" || !sub.entitlements) continue;
    for (const list of Object.values(sub.entitlements)) {
      if (Array.isArray(list)) list.forEach((c) => codes.add(c));
    }
  }
  return [...codes];
}

router.post("/link/sso-callback", auth, async (req, res) => {
  try {
    if (!isDuprConfigured()) return res.status(409).json({ error: "DUPR is not configured on this platform" });
    const { userToken, refreshToken, duprId, stats, subscriptions } = req.body;
    if (!userToken || !refreshToken || !duprId) {
      return res.status(400).json({ error: "userToken, refreshToken, and duprId are required" });
    }

    const existing = await User.findOne({ "duprLink.duprPlayerId": duprId, _id: { $ne: req.user.userId } });
    if (existing) return res.status(409).json({ error: "This DUPR account is already linked to another user" });

    const doubles = parseDuprRating(stats?.doubles);
    const singles = parseDuprRating(stats?.singles);
    const entitlements = extractEntitlements(subscriptions);
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
          entitlements,
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

    // Fire-and-forget: subscribing triggers an immediate RATING_SEED webhook event with
    // this player's current rating, which populates duprLink.doubles/singles without
    // waiting for a match - but only if a webhook URL has actually been registered (see
    // POST /webhook/register). Never fails the link response if this errors.
    dupr.subscribeToRatingUpdates([duprId]).catch(() => {});

    res.json({ myLink: serializeLink(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: "This DUPR account is already linked to another user" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/dupr/link — unlink self; keep the last-synced rating as a fallback value.
// Must $unset the whole subdocument rather than $set it to null-valued fields: the
// sparse unique index on duprLink.duprPlayerId only excludes documents where that path
// is entirely ABSENT, not merely null - confirmed live 2026-07-27 (a second user's
// $set-to-null unlink hit an E11000 duplicate key error the first unlink didn't,
// because the field was then explicitly present-and-null on two documents at once).
router.delete("/link", auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.user.userId, { $unset: { duprLink: "" } }).select("duprLink");
    if (user?.duprLink?.duprPlayerId) {
      dupr.unsubscribeFromRatingUpdates([user.duprLink.duprPlayerId]).catch(() => {});
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/dupr/submissions?sessionId= — submission statuses for a session's queue board
router.get("/submissions", auth, admin, async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });
    const matchIds = await HostedPlayMatch.find({ sessionId, clubId: req.user.clubId }).distinct("_id");
    const submissions = await DuprMatchSubmission.find({
      clubId: req.user.clubId,
      sourceMatchId: { $in: matchIds },
    }).lean();
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dupr/submissions/:id/resubmit — manual retry of a failed/rejected submission
router.post("/submissions/:id/resubmit", auth, admin, async (req, res) => {
  try {
    const { result, error } = await duprSync.resubmitById(req.params.id, req.user.clubId);
    if (error) return res.status(error === "disputed" ? 409 : 404).json({ error });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dupr/submissions/:id/dispute — freeze retries pending manual review
router.post("/submissions/:id/dispute", auth, admin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: "reason is required" });
    const { submission, error } = await duprSync.markDisputed(req.params.id, req.user.clubId, reason, req.user.userId);
    if (error) return res.status(404).json({ error });
    res.json(submission.toObject());
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dupr/submissions/:id/resolve — corrected scores (optional) -> unfreeze + resubmit
router.post("/submissions/:id/resolve", auth, admin, async (req, res) => {
  try {
    const { team1Score, team2Score } = req.body;
    const { result, error } = await duprSync.resolveDispute(req.params.id, req.user.clubId, { team1Score, team2Score });
    if (error) return res.status(404).json({ error });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dupr/webhook/register — one-time (superadmin) action to register this
// platform's webhook URL with DUPR. Real constraint confirmed against the spec: each
// client can have only ONE active webhook registration, ever - calling this again
// replaces the existing one. NOT testable from a local dev environment: DUPR's
// registration call synchronously POSTs a handshake test to the given URL and requires
// a 200 back, which means webhookUrl must be a real, publicly reachable HTTPS endpoint
// (this repo's APP_URL is a LAN address in dev) - only run this against a real deploy.
router.post("/webhook/register", auth, superadmin, async (req, res) => {
  try {
    const webhookUrl = req.body.webhookUrl || `${process.env.APP_URL || "https://courtgo.club"}/api/dupr/webhook`;
    const result = await dupr.registerWebhook(webhookUrl);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/dupr/webhook — DUPR event receiver. No auth (DUPR posts here directly, not
// a CourtGo user) and no signature verification (confirmed 2026-07-27: DUPR's spec has
// no HMAC/signature scheme at all - authenticity rests on the URL being known only to
// DUPR and us, plus checking the envelope's clientId). Always answers fast; per-user
// work happens best-effort and never blocks the 200.
router.post("/webhook", async (req, res) => {
  res.status(200).json({ ok: true }); // ack immediately - required for the registration handshake too

  try {
    const { clientId, event, message } = req.body || {};
    console.log(`[dupr webhook] received event=${event} clientId=${clientId} duprId=${message?.duprId}`);
    // CONFIRMED live 2026-07-27: the envelope's clientId field is actually the Client
    // KEY string (e.g. "test-ck-..."), not the numeric DUPR_CLIENT_ID - despite the auth
    // token's own JWT payload using "clientId" for the numeric value. A real production
    // webhook was silently discarded here before this fix, since it was compared against
    // the wrong env var and could never match.
    if (String(clientId) !== String(process.env.DUPR_CLIENT_KEY)) {
      console.log(`[dupr webhook] ignored: clientId mismatch (expected ${process.env.DUPR_CLIENT_KEY})`);
      return;
    }
    if (event !== "RATING" && event !== "RATING_SEED") {
      console.log(`[dupr webhook] ignored: not a rating event (likely the REGISTRATION handshake ping)`);
      return; // e.g. the REGISTRATION handshake ping
    }
    if (!message?.duprId) return;

    const user = await User.findOne({ "duprLink.duprPlayerId": message.duprId }).select("duprLink");
    if (!user?.duprLink?.verified) {
      console.log(`[dupr webhook] ignored: no verified CourtGo user linked to duprId=${message.duprId}`);
      return;
    }

    const doubles = parseDuprRating(message.rating?.doubles);
    const singles = parseDuprRating(message.rating?.singles);
    await User.updateOne(
      { _id: user._id },
      {
        "duprLink.doubles": doubles,
        "duprLink.singles": singles,
        "duprLink.lastSyncedAt": new Date(),
        ...(doubles != null ? { duprRating: doubles } : {}),
      },
    );
    console.log(`[dupr webhook] updated user=${user._id} doubles=${doubles} singles=${singles}`);
    sendPushToUser(user._id, { title: "DUPR rating updated", body: "Your DUPR rating was just refreshed." }).catch(() => {});
  } catch (err) {
    console.error("dupr webhook handling error:", err);
  }
});

// POST /api/dupr/tasks/process — retry/poll sweep trigger. No JWT; gated by a shared
// secret header, meant to be hit by an external cron (or a Netlify scheduled function)
// on this serverless deploy, which has no long-running process to run its own timer.
router.post("/tasks/process", async (req, res) => {
  if (!process.env.DUPR_CRON_SECRET || req.headers["x-cron-secret"] !== process.env.DUPR_CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const results = await duprSync.processPendingSubmissions(Number(req.query.limit) || 20);
    res.json({ processed: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

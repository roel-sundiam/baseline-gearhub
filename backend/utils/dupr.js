// Survives warm serverless invocations; cleared on cold start.
let tokenCache = { token: null, expiresAt: 0 };

function isDuprConfigured() {
  return !!(process.env.DUPR_CLIENT_KEY && process.env.DUPR_CLIENT_SECRET && process.env.DUPR_BASE_URL);
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.token;

  // Partner auth: base64(clientKey:clientSecret) in x-authorization, not a JSON body.
  const authHeader = Buffer.from(`${process.env.DUPR_CLIENT_KEY}:${process.env.DUPR_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${process.env.DUPR_BASE_URL}/auth/v1.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-authorization": authHeader },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(`DUPR auth failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== "SUCCESS" || !data.result?.token) throw new Error("DUPR auth failed: unexpected response shape");
  tokenCache = {
    token: data.result.token,
    // expiry is an absolute ISO timestamp, not a relative expiresIn.
    expiresAt: new Date(data.result.expiry).getTime(),
  };
  return tokenCache.token;
}

// Never throws into route handlers; always resolves to { ok, status, data, error }.
async function duprFetch(path, opts = {}) {
  if (!isDuprConfigured()) return { ok: false, status: 0, data: null, error: "DUPR not configured" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const token = await getAccessToken();
    const res = await fetch(`${process.env.DUPR_BASE_URL}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opts.headers || {}),
      },
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data?.message || `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

// --- Match ops, confirmed 2026-07-27 against DUPR's real OpenAPI spec
// (uat.mydupr.com/api/v3/api-docs) - the GitBook's paraphrase of these endpoints
// (paths, casing, payload shape) was wrong; this is verified against the raw spec, not
// a summarized doc. Payload shape (ExternalMatchRequest): teamA/teamB are FLAT objects
// { player1, player2, game1..game5 } (DUPR IDs + up to 5 game scores directly on the
// team, not a nested games array/list). clubId is an integer, not a string. identifier
// must be globally unique forever - even a deleted match's identifier can't be reused.
// Response: { status, result: { identifier, matchCode, hashedMatchCode } }.
async function submitMatch(payload) {
  return duprFetch("/match/v1.0/create", { method: "POST", body: JSON.stringify(payload) });
}

async function submitMatchesInBulk(payloads) {
  return duprFetch("/match/v1.0/batch", { method: "POST", body: JSON.stringify(payloads) });
}

// payload must include matchId (DUPR's internal numeric id - Number(matchCode) from the
// create response) plus the same required fields as create. matchCompletionType is
// immutable on update; changing it is rejected - delete+recreate to change outcome type.
async function updateMatch(payload) {
  return duprFetch("/match/v1.0/update", { method: "POST", body: JSON.stringify(payload) });
}

// Both matchCode (from the create response) and the original identifier must match.
async function deleteMatch(matchCode, identifier) {
  return duprFetch("/match/v1.0/delete", { method: "DELETE", body: JSON.stringify({ matchCode, identifier }) });
}

// Club role check for match submission gating - confirmed via the real spec to use the
// PARTNER bearer token (same auth as everything else here), keyed by the submitter's own
// DUPR ID, NOT the admin's per-user SSO token as originally assumed in the design doc.
// Response: { membership: [{ clubId, clubName, role }] }, role one of DIRECTOR/ORGANIZER/PLAYER.
async function getUserClubMemberships(duprPlayerId) {
  return duprFetch(`/user/v1.0/${encodeURIComponent(duprPlayerId)}/clubs`);
}

// --- Webhook ops, confirmed 2026-07-27 against the real OpenAPI spec AND a live,
// unauthenticated call to GET /v1.0/webhook/schema/RATING (see docs/DUPR_INTEGRATION_PLAN.md).
// CONFIRMED: there is genuinely no signature/HMAC scheme anywhere in the spec (searched
// the whole raw JSON for "signature"/"hmac"/"secret" - nothing). Authenticity rests on
// the webhook URL being known only to us and DUPR, plus checking the envelope's clientId
// matches ours. DUPR_WEBHOOK_SECRET/verifyWebhookSignature from the original design were
// never a real DUPR concept - dropped rather than kept as dead code.

// One webhook URL per client, ever - registering a new one replaces any existing
// registration. DUPR sends a synchronous POST handshake (event: "REGISTRATION") to
// webhookUrl during this call and requires a 200 back before the registration succeeds.
async function registerWebhook(webhookUrl, topics = ["RATING"]) {
  return duprFetch("/v1.0/webhook", { method: "POST", body: JSON.stringify({ webhookUrl, topics }) });
}

// Subscribing fires an immediate RATING_SEED webhook event per duprId with their current
// rating snapshot (null rating/metrics if they've never played a rated match) - this is
// what lets us populate duprLink.doubles/singles right after linking, without waiting for
// a match. Requires a webhook already registered via registerWebhook.
async function subscribeToRatingUpdates(duprIds) {
  return duprFetch("/user/v1.0/subscribe/webhook-event", {
    method: "POST",
    body: JSON.stringify({ duprIds, topic: "RATING" }),
  });
}

async function unsubscribeFromRatingUpdates(duprIds) {
  return duprFetch("/user/v1.0/subscribe/webhook-event", {
    method: "DELETE",
    body: JSON.stringify({ duprIds, topic: "RATING" }),
  });
}

module.exports = {
  isDuprConfigured,
  duprFetch,
  submitMatch,
  submitMatchesInBulk,
  updateMatch,
  deleteMatch,
  getUserClubMemberships,
  registerWebhook,
  subscribeToRatingUpdates,
  unsubscribeFromRatingUpdates,
};

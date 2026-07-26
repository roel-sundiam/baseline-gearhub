const crypto = require("crypto");

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

// NOT CONFIRMED: DUPR's webhook docs (integration-checklist/ratings-and-webhooks) don't
// document any signature scheme - envelope is just { clientId, event, message } over HTTPS.
// Ask tech@mydupr.com before relying on this; DUPR_WEBHOOK_SECRET may not be a real DUPR concept.
function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.DUPR_WEBHOOK_SECRET || !signature) return false;
  const expected = crypto.createHmac("sha256", process.env.DUPR_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  isDuprConfigured,
  duprFetch,
  submitMatch,
  submitMatchesInBulk,
  updateMatch,
  deleteMatch,
  getUserClubMemberships,
  verifyWebhookSignature,
};

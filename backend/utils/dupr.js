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

// --- Match ops, confirmed against DUPR's GitBook (integration-checklist/match-upload-and-management).
// Payload shape: { identifier, matchDate: 'yyyy-MM-dd', location, format: 'SINGLES'|'DOUBLES',
// matchType: 'SIDEOUT'|'RALLY', teamA/teamB: [{ duprId, games: [...] }], event, bracket,
// clubId, matchSource: 'CLUB', extras }. Response: { status, result: { matchCode, hashedMatchCode } }.
async function submitMatch(payload) {
  return duprFetch("/Match/saveMatch", { method: "POST", body: JSON.stringify(payload) });
}

async function submitMatchesInBulk(payloads) {
  // Up to 100 matches per request per the docs.
  return duprFetch("/Match/saveMatchInBulk", { method: "POST", body: JSON.stringify(payloads) });
}

async function updateMatch(payload) {
  return duprFetch("/Match/updateMatch", { method: "PUT", body: JSON.stringify(payload) });
}

async function deleteMatch(matchCode) {
  return duprFetch(`/Match/deleteMatch?matchId=${encodeURIComponent(matchCode)}`, { method: "DELETE" });
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
  verifyWebhookSignature,
};

const crypto = require("crypto");

// Survives warm serverless invocations; cleared on cold start.
let tokenCache = { token: null, expiresAt: 0 };

function isDuprConfigured() {
  return !!(process.env.DUPR_CLIENT_KEY && process.env.DUPR_CLIENT_SECRET && process.env.DUPR_BASE_URL);
}

async function getAccessToken() {
  if (tokenCache.token && tokenCache.expiresAt > Date.now() + 5000) return tokenCache.token;

  const res = await fetch(`${process.env.DUPR_BASE_URL}/auth/v1.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: process.env.DUPR_CLIENT_ID,
      key: process.env.DUPR_CLIENT_KEY,
      secret: process.env.DUPR_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`DUPR auth failed: ${res.status}`);
  const data = await res.json();
  tokenCache = {
    token: data.accessToken || data.token,
    expiresAt: Date.now() + (data.expiresIn ? data.expiresIn * 1000 : 55 * 60 * 1000),
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

// --- Stub ops, thin wrappers over duprFetch. Payload/response shapes are not
// yet confirmed against DUPR's docs (Phase B/C work) - signatures may change.
async function lookupPlayerByEmail(email) {
  return duprFetch(`/player/v1.0/search?email=${encodeURIComponent(email)}`);
}

async function getPlayerRating(duprPlayerId) {
  return duprFetch(`/player/v1.0/${encodeURIComponent(duprPlayerId)}`);
}

async function submitMatch(payload) {
  return duprFetch("/match/v1.0/create", { method: "POST", body: JSON.stringify(payload) });
}

async function updateMatch(duprMatchId, payload) {
  return duprFetch(`/match/v1.0/${encodeURIComponent(duprMatchId)}`, { method: "PUT", body: JSON.stringify(payload) });
}

async function deleteMatch(duprMatchId) {
  return duprFetch(`/match/v1.0/${encodeURIComponent(duprMatchId)}`, { method: "DELETE" });
}

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
  lookupPlayerByEmail,
  getPlayerRating,
  submitMatch,
  updateMatch,
  deleteMatch,
  verifyWebhookSignature,
};

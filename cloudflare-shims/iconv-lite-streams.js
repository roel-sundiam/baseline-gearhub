// Stub for iconv-lite/lib/streams — not needed in Cloudflare Workers.
// Body-parser only uses this for non-UTF-8 charset streaming; JSON payloads
// always use UTF-8 so this code path is never hit at runtime.
module.exports = { InconvStream: null };

module.exports = {
  '/api': {
    // ── Local backend (Netlify Functions mode) — DEFAULT ──────────────
    target: 'http://localhost:3000',
    secure: false,

    // ── Render backend — comment out above and uncomment below ─────────
    // target: 'https://baseline-gearhub.onrender.com',
    // secure: true,

    changeOrigin: true,
    logLevel: 'info',
  },
};

/**
 * CourtGo — Hosted Play marketing-video screenshot capture.
 * Spins up throwaway QA sessions via the REST API, drives the real UI with
 * Playwright to reach each feature's best-looking state, screenshots it at
 * 1280x800 (matching the existing frontend/public/features/hp-*.png set),
 * then deletes the QA sessions it created.
 *
 * Requires: backend on :3000 + frontend dev server on :4200, both already
 * running against local Mongo, with the SheServes Tennis Club seed data.
 *
 * Usage: node capture-hp-features.js
 */
const path = require('path');
const { chromium } = require('playwright');
const BACKEND_NM = path.join(__dirname, '..', 'backend', 'node_modules');
const mongoose = require(path.join(BACKEND_NM, 'mongoose'));
require(path.join(BACKEND_NM, 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });
const HostedPlay = require(path.join(__dirname, '..', 'backend', 'models', 'HostedPlay.js'));
const HostedPlayParticipant = require(path.join(__dirname, '..', 'backend', 'models', 'HostedPlayParticipant.js'));
const Charge = require(path.join(__dirname, '..', 'backend', 'models', 'Charge.js'));

const APP = 'http://localhost:4200';
const BASE = 'http://localhost:3000/api';
const OUT = path.join(__dirname, 'public', 'features');
const VENUE = 'QA Video Court'; // scopes cleanup so real club data is never touched
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function req(token, method, p, body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}
async function login(username, password) {
  const { status, json } = await req(null, 'POST', '/auth/login', { username, password });
  if (status !== 200) throw new Error(`login failed for ${username}: ${status} ${JSON.stringify(json)}`);
  return json;
}
async function createSession(adminToken, overrides) {
  const body = {
    sport: 'pickleball', date: tomorrow, startTime: '18:00', endTime: '20:00',
    venue: VENUE, feePerPlayer: 0, maxPlayers: 10, numberOfCourts: 1, playersPerCourt: 4,
    queueMode: 'fcfs', ...overrides,
  };
  const { status, json } = await req(adminToken, 'POST', '/hosted-play/sessions', body);
  if (status !== 201) throw new Error('create session failed: ' + JSON.stringify(json));
  return json;
}

const PLAYERS = [
  'aina-david', 'akela-malonzo', 'alyssa-faye-juco', 'alyssa-mika-dianelo',
  'amanda-calderon', 'amylou-mendiola', 'andrea-marie-henson', 'angelica-ferraris',
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const clubAdmin = await login('she-serves', 'BaselineGearhub');
  const players = [];
  for (const u of PLAYERS) players.push(await login(u, 'SheServes'));
  const [demo, filler1, filler2, filler3, filler4, filler5, filler6, filler7] = players;

  const createdSessionIds = [];

  // ── 1. Waitlist: demo player waitlisted on one session, offered a spot on another ──
  console.log('Setting up: waitlist scenario...');
  const wFree = await createSession(clubAdmin.token, { title: 'Sunset Doubles', maxPlayers: 2, feePerPlayer: 0 });
  createdSessionIds.push(wFree._id);
  await req(filler1.token, 'POST', `/hosted-play/player/sessions/${wFree._id}/join`, {});
  await req(filler2.token, 'POST', `/hosted-play/player/sessions/${wFree._id}/join`, {});
  await req(demo.token, 'POST', `/hosted-play/player/sessions/${wFree._id}/join`, {}); // -> waitlisted #1

  const wPaid = await createSession(clubAdmin.token, { title: 'Championship Mixer', maxPlayers: 2, feePerPlayer: 150 });
  createdSessionIds.push(wPaid._id);
  for (const f of [filler3, filler4]) {
    await req(f.token, 'POST', `/hosted-play/player/sessions/${wPaid._id}/join`, { paymentMethod: 'GCash', paymentScreenshot: 'https://example.com/p.png' });
    const pend = await req(clubAdmin.token, 'GET', '/charges/pending-approval?status=pending');
    const charge = pend.json.find((c) => String(c.hostedPlayId) === String(wPaid._id) && String(c.playerId?._id) === String(f.user.id));
    await req(clubAdmin.token, 'PATCH', `/charges/${charge._id}/approve`, {});
  }
  await req(demo.token, 'POST', `/hosted-play/player/sessions/${wPaid._id}/join`, {}); // -> waitlisted
  await req(filler3.token, 'DELETE', `/hosted-play/player/sessions/${wPaid._id}/join`, {}); // frees a spot -> demo offered

  // ── 2. Winner-based rotation: winner_stays session, ready to tap a winning team ──
  console.log('Setting up: winner-tap scoring...');
  const wsSession = await createSession(clubAdmin.token, { title: 'Friday Night Doubles', queueMode: 'winner_stays', numberOfCourts: 1, playersPerCourt: 4 });
  createdSessionIds.push(wsSession._id);
  const six = [demo, filler1, filler2, filler3, filler4, filler5];
  for (const p of six) await req(p.token, 'POST', `/hosted-play/player/sessions/${wsSession._id}/join`, {});
  const { json: wsRoster } = await req(clubAdmin.token, 'GET', `/hosted-play/sessions/${wsSession._id}/participants`);
  for (const p of wsRoster) await req(clubAdmin.token, 'PATCH', `/hosted-play/sessions/${wsSession._id}/participants/${p._id}/check-in`, { checkedIn: true });
  await req(clubAdmin.token, 'POST', `/hosted-play/sessions/${wsSession._id}/queue/start`, {});

  // ── 3. Leaderboard: a session that's played a few rounds and ended ──
  console.log('Setting up: leaderboard / final standings...');
  const lbSession = await createSession(clubAdmin.token, { title: 'Saturday Showdown', queueMode: 'king_of_court', numberOfCourts: 1, playersPerCourt: 4 });
  createdSessionIds.push(lbSession._id);
  const sixB = [demo, filler1, filler2, filler3, filler4, filler5];
  for (const p of sixB) await req(p.token, 'POST', `/hosted-play/player/sessions/${lbSession._id}/join`, {});
  const { json: lbRoster } = await req(clubAdmin.token, 'GET', `/hosted-play/sessions/${lbSession._id}/participants`);
  for (const p of lbRoster) await req(clubAdmin.token, 'PATCH', `/hosted-play/sessions/${lbSession._id}/participants/${p._id}/check-in`, { checkedIn: true });
  let { json: lbBoard } = await req(clubAdmin.token, 'POST', `/hosted-play/sessions/${lbSession._id}/queue/start`, {});
  const winnerIds = [lbBoard.courts[0].players[0]._id, lbBoard.courts[0].players[1]._id];
  for (let i = 0; i < 3; i++) {
    ({ json: lbBoard } = await req(clubAdmin.token, 'POST', `/hosted-play/sessions/${lbSession._id}/courts/1/finish`, { winnerIds }));
  }
  await req(clubAdmin.token, 'POST', `/hosted-play/sessions/${lbSession._id}/queue/end`, {});

  // ── 4. Skill-level gating: demo player set to Advanced, a banded session ──
  console.log('Setting up: skill-level gating...');
  await req(demo.token, 'PUT', `/users/${demo.user.id}/profile`, { skillLevel: 'advanced' });
  const skillSession = await createSession(clubAdmin.token, { title: 'Advanced Ladder Night', minSkillLevel: 'advanced' });
  createdSessionIds.push(skillSession._id);

  // ── Browser capture ──────────────────────────────────────────────────────
  console.log('\nLaunching browser for screenshots...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  async function loginUi(username, password) {
    await page.goto(`${APP}/player-login`, { waitUntil: 'networkidle' });
    await page.fill('#username', username);
    await page.fill('#password', password);
    await Promise.all([
      page.waitForURL(/\/(player|admin)\//, { timeout: 15000 }),
      page.click('button:has-text("Sign In")'),
    ]);
  }

  // Skill-level gating + waitlist both live on the player hosted-play page.
  await loginUi('aina-david', 'SheServes');
  await page.goto(`${APP}/player/hosted-play`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.level-chip', { timeout: 15000 });
  await page.click('.level-chip:has-text("Advanced")');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, 'hp-skill-gate.png') });
  console.log('captured hp-skill-gate.png');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.session-card', { timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 'hp-waitlist.png') });
  console.log('captured hp-waitlist.png');

  // Winner-tap scoring — admin queue board.
  await page.context().clearCookies();
  await loginUi('she-serves', 'BaselineGearhub');
  await page.goto(`${APP}/admin/hosted-play/${wsSession._id}/queue`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.court-card', { timeout: 15000 });
  await page.click('.finish-btn:has-text("Finish")');
  await page.waitForSelector('.winner-hint', { timeout: 10000 });
  await page.click('.team-block.team-a');
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, 'hp-winner-tap.png') });
  console.log('captured hp-winner-tap.png');

  // Leaderboard — TV display final standings.
  await page.goto(`${APP}/admin/hosted-play/${lbSession._id}/queue`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const [tvPage] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 10000 }),
    page.click('button:has-text("TV Display")'),
  ]);
  await tvPage.setViewportSize({ width: 1280, height: 800 });
  await tvPage.waitForLoadState('networkidle');
  await tvPage.waitForTimeout(800);
  await tvPage.screenshot({ path: path.join(OUT, 'hp-tv-standings.png') });
  console.log('captured hp-tv-standings.png');

  await browser.close();

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log('\nCleaning up QA video sessions...');
  const ids = createdSessionIds;
  const pRes = await HostedPlayParticipant.deleteMany({ hostedPlayId: { $in: ids } });
  const cRes = await Charge.deleteMany({ hostedPlayId: { $in: ids } });
  const sRes = await HostedPlay.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${sRes.deletedCount} sessions, ${pRes.deletedCount} participants, ${cRes.deletedCount} charges`);

  await mongoose.disconnect();
  console.log('\nDone. New screenshots in frontend/public/features/:');
  console.log('  hp-skill-gate.png, hp-waitlist.png, hp-winner-tap.png, hp-tv-standings.png');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

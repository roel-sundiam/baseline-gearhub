/**
 * Recaptures two Hosted Play marketing-video screenshots that went stale
 * after the create-session wizard and TV display got redesigned:
 *   - hp-create-form.png  (now a 3-step wizard w/ rotation format + skill range)
 *   - hp-tv-display.png   (now team-split courts on the redesigned TV board)
 * Same conventions as capture-hp-features.js: throwaway QA session via the
 * API, drive the real UI, screenshot at 1280x800, then clean up.
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
const VENUE = 'QA Video Court';
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

const PLAYERS = ['aina-david', 'akela-malonzo', 'alyssa-faye-juco', 'alyssa-mika-dianelo'];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const clubAdmin = await login('she-serves', 'BaselineGearhub');
  const players = [];
  for (const u of PLAYERS) players.push(await login(u, 'SheServes'));

  // ── Live FCFS session for the TV display recapture ──────────────────────
  console.log('Setting up: live queue session for TV display...');
  const { status, json: liveSession } = await req(clubAdmin.token, 'POST', '/hosted-play/sessions', {
    title: 'Tuesday Open Play', sport: 'pickleball', date: tomorrow, startTime: '18:00', endTime: '20:00',
    venue: VENUE, feePerPlayer: 0, maxPlayers: 8, numberOfCourts: 1, playersPerCourt: 4, queueMode: 'fcfs',
  });
  if (status !== 201) throw new Error('create session failed: ' + JSON.stringify(liveSession));
  for (const p of players) await req(p.token, 'POST', `/hosted-play/player/sessions/${liveSession._id}/join`, {});
  const { json: roster } = await req(clubAdmin.token, 'GET', `/hosted-play/sessions/${liveSession._id}/participants`);
  for (const p of roster) await req(clubAdmin.token, 'PATCH', `/hosted-play/sessions/${liveSession._id}/participants/${p._id}/check-in`, { checkedIn: true });
  await req(clubAdmin.token, 'POST', `/hosted-play/sessions/${liveSession._id}/queue/start`, {});

  // ── Browser capture ──────────────────────────────────────────────────────
  console.log('\nLaunching browser for screenshots...');
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  await page.goto(`${APP}/player-login`, { waitUntil: 'networkidle' });
  await page.fill('#username', 'she-serves');
  await page.fill('#password', 'BaselineGearhub');
  await Promise.all([
    page.waitForURL(/\/(player|admin)\//, { timeout: 15000 }),
    page.click('button:has-text("Sign In")'),
  ]);

  // 1) Create-session wizard — Step 3 "Play settings" (rotation format + skill range).
  await page.goto(`${APP}/admin/hosted-play`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.session-card', { timeout: 15000 });
  await page.click('button:has-text("Create Session")');
  await page.waitForSelector('.session-modal', { timeout: 10000 });

  await page.fill('.session-modal input[placeholder="Friday Night Doubles"]', 'Friday Night Doubles');
  await page.fill('.session-modal input[type="date"]', tomorrow);
  const times = await page.locator('.session-modal input[type="time"]');
  await times.nth(0).fill('18:00');
  await times.nth(1).fill('20:00');
  await page.click('.session-modal button:has-text("Next")');

  await page.waitForTimeout(300);
  if (await page.locator('.session-modal select').first().count()) {
    // Venue may render as a <select> (club has courts configured) or a text input.
    const venueIsSelect = await page.locator('.session-modal label:has-text("Venue Name") select').count();
    if (venueIsSelect) {
      await page.selectOption('.session-modal label:has-text("Venue Name") select', { index: 1 });
    } else {
      await page.fill('.session-modal label:has-text("Venue Name") input', 'Baseline Courts');
    }
  }
  await page.locator('.session-modal label:has-text("Maximum Players") input').fill('8');
  await page.click('.session-modal button:has-text("Next")');

  await page.waitForTimeout(300);
  await page.selectOption('.session-modal label:has-text("Rotation Format") select', 'winner_stays');
  await page.selectOption('.session-modal label:has-text("Min Skill Level") select', 'advanced');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'hp-create-form.png') });
  console.log('captured hp-create-form.png (Step 3: Play settings)');
  await page.click('.session-modal button:has-text("Cancel")');

  // 2) TV Display — redesigned team-split live board.
  await page.goto(`${APP}/admin/hosted-play/${liveSession._id}/queue`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.court-card', { timeout: 15000 });
  const [tvPage] = await Promise.all([
    ctx.waitForEvent('page', { timeout: 10000 }),
    page.click('button:has-text("TV Display")'),
  ]);
  await tvPage.setViewportSize({ width: 1280, height: 800 });
  await tvPage.waitForLoadState('networkidle');
  await tvPage.waitForTimeout(800);
  await tvPage.screenshot({ path: path.join(OUT, 'hp-tv-display.png') });
  console.log('captured hp-tv-display.png');

  await browser.close();

  // ── Cleanup ──────────────────────────────────────────────────────────────
  console.log('\nCleaning up QA video session...');
  const ids = [liveSession._id];
  const pRes = await HostedPlayParticipant.deleteMany({ hostedPlayId: { $in: ids } });
  const cRes = await Charge.deleteMany({ hostedPlayId: { $in: ids } });
  const sRes = await HostedPlay.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${sRes.deletedCount} session, ${pRes.deletedCount} participants, ${cRes.deletedCount} charges`);

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

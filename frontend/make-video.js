/**
 * CourtGo — Animated Feature Video (v2)
 * Uses pure CSS keyframe animations (no JS timers) so Playwright captures every frame.
 */
const { chromium }     = require('playwright');
const ffmpegPath       = require('ffmpeg-static');
const fetch            = require('node-fetch');
const { execFileSync } = require('child_process');
const path             = require('path');
const fs               = require('fs');

const PUB      = path.join(__dirname, 'public');
const VID_DIR  = path.join(PUB, 'video');
const AUD_DIR  = path.join(VID_DIR, 'audio');
const HTML_OUT = path.join(PUB, 'presentation.html');
[VID_DIR, AUD_DIR].forEach(d => fs.existsSync(d) || fs.mkdirSync(d, { recursive: true }));

// ── Slide definitions ──────────────────────────────────────────────────────
// duration: ms each slide stays on screen
// narration: kept short (<200 chars) so TTS finishes within the slide window
const SLIDES = [
  {
    type: 'title', duration: 5000,
    narration: 'Welcome to CourtGo. The modern platform for managing and booking racket sports courts.',
  },
  {
    type: 'feature', reverse: false, duration: 6000,
    tag: 'Home Base', title: 'Your personal\ndashboard',
    desc: 'See upcoming bookings, quick shortcuts, and club updates the moment you open the app.',
    bullets: ['Upcoming booking with one-tap access','Quick action shortcuts','Club hours at a glance','Club notifications'],
    img: 'http://localhost:4200/features/dashboard.png',
    narration: 'Your dashboard puts everything front and centre — upcoming bookings, quick shortcuts, and club announcements, all in one view.',
  },
  {
    type: 'feature', reverse: true, duration: 6000,
    tag: 'Court Booking', title: 'Reserve courts\nin seconds',
    desc: 'Pick a date, select your court, add a partner, toggle lights, and include guests.',
    bullets: ['Real-time court availability','Select court by name','Invite members to your session','Light rental & guest options'],
    img: 'http://localhost:4200/features/reserve.png',
    narration: 'Booking a court takes seconds. Pick a date, choose your court, invite a partner, and add light rental — all from one clean form.',
  },
  {
    type: 'feature', reverse: false, duration: 6000,
    tag: 'Reservations', title: 'All bookings\nin one place',
    desc: 'Admins see every confirmed booking — player name, court, time, and status — in real time.',
    bullets: ['Table and calendar view toggle','Filter by court or date','Confirmed and past bookings','Edit or cancel instantly'],
    img: 'http://localhost:4200/features/reservations.png',
    narration: 'Club admins see every booking in real time. Switch between table and calendar view, filter by date or court, and manage it all from one screen.',
  },
  {
    type: 'feature', reverse: true, duration: 6000,
    tag: 'Open Play', title: 'Join community\nsessions',
    desc: 'Drop into open play sessions, compete with fellow members, and build your rating.',
    bullets: ['Browse sessions by sport','View your session history','CRI leaderboard & rankings','Skill-balanced sessions'],
    img: 'http://localhost:4200/features/open-play.png',
    narration: 'Open play sessions let members drop in and compete. Friday Open Play — doubles, sixteen spots — just tap Join.',
  },
  {
    type: 'feature', reverse: false, duration: 6000,
    tag: 'Payment Process', title: 'Seamless\npayment approvals',
    desc: 'Players submit GCash or cash payments. Admins approve with a full audit trail.',
    bullets: ['104 payments approved','GCash and cash support','Per-booking charge breakdown','Instant notifications'],
    img: 'http://localhost:4200/features/payment-approvals.png',
    narration: 'Payments are simple. Players submit via G-Cash or cash, and admins approve in one tap. Over one hundred and four payments have been processed.',
  },
  {
    type: 'feature', reverse: true, duration: 6000,
    tag: 'Member Management', title: 'Grow and manage\nyour roster',
    desc: 'Full member control panel — approve registrations, manage 39+ active members.',
    bullets: ['41 total · 39 active · 2 pending','Approve or reject registrations','Member profiles & contact info','Search and filter roster'],
    img: 'http://localhost:4200/features/admin-users.png',
    narration: 'Manage your full roster from anywhere. Thirty-nine active members, instant approval for new registrations, and full profiles for everyone.',
  },
  {
    type: 'feature', reverse: false, duration: 5500,
    tag: 'Guest Access', title: 'Book without\nan account',
    desc: 'Guests can browse all clubs and book courts instantly — no sign-up required.',
    bullets: ['Search any club by location','No login required','Multiple clubs & sports','Easy upgrade to membership'],
    img: 'http://localhost:4200/features/book.png',
    narration: 'No account? No problem. Guests can search any club and book a court in seconds — no registration needed.',
  },
  {
    type: 'cta', duration: 5500,
    narration: 'CourtGo. The modern way to manage and book courts. Register for free today.',
  },
];

// ── 1. Generate TTS audio ──────────────────────────────────────────────────
async function generateAudio() {
  console.log('\n1/4  Generating voice narration...');
  for (let i = 0; i < SLIDES.length; i++) {
    const outPath = path.join(AUD_DIR, `slide-${i}.mp3`);
    if (fs.existsSync(outPath)) { console.log(`     slide-${i}.mp3 (cached)`); continue; }
    const text = SLIDES[i].narration;
    const url  = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob&ttsspeed=0.9`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) throw new Error(`TTS failed for slide ${i}: ${res.status}`);
    const buf = await res.buffer();
    fs.writeFileSync(outPath, buf);
    console.log(`     slide-${i}.mp3  (${(buf.length/1024).toFixed(0)} KB)`);
    await new Promise(r => setTimeout(r, 350));
  }
}

// ── 2. Build pure-CSS animated HTML ───────────────────────────────────────
function buildHTML() {
  console.log('\n2/4  Building CSS-animated presentation...');

  // Cumulative start times (seconds)
  const starts = [];
  let acc = 0;
  for (const s of SLIDES) { starts.push(acc); acc += s.duration / 1000; }
  const totalSec = acc;

  // Per-slide CSS (absolute animation-delay)
  let dynCss = '';
  for (let i = 0; i < SLIDES.length; i++) {
    const st  = starts[i].toFixed(3);
    const dur = (SLIDES[i].duration / 1000).toFixed(3);
    const kf  = i === SLIDES.length - 1 ? 'showLast' : 'showSlide';
    dynCss += `#s${i}{animation:${kf} ${dur}s ${st}s both}\n`;
    dynCss += `#d${i}{animation:dotOn ${dur}s ${st}s both}\n`;

    if (SLIDES[i].type === 'title') {
      [['.t-logo', 0.10],['.t-badge', 0.40],['.t-h1', 0.70],['.t-sub', 1.00]].forEach(([sel, off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .8s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    } else if (SLIDES[i].type === 'feature') {
      const pDir = SLIDES[i].reverse ? 'sInL' : 'sInR';
      dynCss += `#s${i} .phone-col{animation:${pDir} .8s ${(starts[i]+0.15).toFixed(3)}s both}\n`;
      [['.f-tag',0.35],['.f-title',0.55],['.f-desc',0.75]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .6s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
      [0.95,1.10,1.25,1.40].forEach((off, j) => {
        dynCss += `#s${i} .f-bullets li:nth-child(${j+1}){animation:fUp .5s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    } else if (SLIDES[i].type === 'cta') {
      [['.cta-logo',0.20],['.cta-h2',0.50],['.cta-sub',0.75],['.cta-btn',1.00],['.cta-url',1.25]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .8s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    }
  }

  // Build slide HTML
  const slidesHtml = SLIDES.map((s, i) => {
    if (s.type === 'title') return `
  <div class="slide title-slide" id="s${i}">
    <div class="ti">
      <img src="http://localhost:4200/CourtGo.png" class="t-logo"/>
      <div class="t-badge"><span class="tdot"></span>Full Feature Walkthrough</div>
      <h1 class="t-h1">The modern way to<br><span class="ac">MANAGE &amp; BOOK</span><br>COURTS.</h1>
      <p class="t-sub">Real-time reservations · Club management · Open play · Payments</p>
    </div>
  </div>`;

    if (s.type === 'cta') return `
  <div class="slide cta-slide" id="s${i}">
    <img src="http://localhost:4200/CourtGo.png" class="cta-logo"/>
    <h2 class="cta-h2">Ready to <span class="ac">get started?</span></h2>
    <p class="cta-sub">Join your club today — free for players, affordable for clubs.</p>
    <div class="cta-btn">Register for Free</div>
    <p class="cta-url">courtgo.app</p>
  </div>`;

    const bullets = s.bullets.map(b =>
      `<li><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7cff4e" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${b}</li>`
    ).join('');
    const phoneHtml = `
      <div class="phone-col">
        <div class="phone-glow"></div>
        <div class="phone-frame"><div class="pnotch"></div><img src="${s.img}"/></div>
      </div>`;
    const textHtml = `
      <div class="text-col">
        <div class="f-tag">${s.tag}</div>
        <h2 class="f-title">${s.title.replace('\n','<br>')}</h2>
        <p class="f-desc">${s.desc}</p>
        <ul class="f-bullets">${bullets}</ul>
      </div>`;
    return `
  <div class="slide feature-slide${s.reverse?' rev':''}" id="s${i}">
    ${s.reverse ? textHtml+phoneHtml : phoneHtml+textHtml}
  </div>`;
  }).join('');

  const dotsHtml = SLIDES.map((_,i) => `<div class="dot" id="d${i}"></div>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{width:1280px;height:720px;overflow:hidden;background:#0a1610;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
/* Background */
.bg{position:fixed;inset:0;z-index:0;pointer-events:none}
.orb{position:absolute;border-radius:50%;filter:blur(40px)}
.o1{width:560px;height:560px;top:-160px;left:-130px;background:radial-gradient(circle,rgba(124,255,78,.18) 0%,transparent 70%);animation:fOrb 13s ease-in-out infinite alternate}
.o2{width:380px;height:380px;bottom:-100px;right:-80px;background:radial-gradient(circle,rgba(124,255,78,.12) 0%,transparent 70%);animation:fOrb 10s ease-in-out infinite alternate;animation-delay:-5s}
@keyframes fOrb{from{transform:translateY(0) scale(1)}to{transform:translateY(-40px) scale(1.05)}}
.grid{position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(124,255,78,.022) 0,rgba(124,255,78,.022) 1px,transparent 1px,transparent 80px),repeating-linear-gradient(90deg,rgba(124,255,78,.022) 0,rgba(124,255,78,.022) 1px,transparent 1px,transparent 80px)}
/* Watermark */
.wm{position:fixed;top:22px;left:36px;z-index:200}.wm img{height:26px;display:block}
/* Progress dots */
.progress{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:200}
.dot{width:7px;height:7px;border-radius:4px;background:rgba(255,255,255,.18)}
/* Slides — ALL start invisible, CSS animations reveal them */
.slide{position:absolute;inset:0;opacity:0;display:flex;align-items:center;z-index:1}
/* Title */
.title-slide{justify-content:center}
.ti{display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
.t-logo{height:50px}.t-badge{display:inline-flex;align-items:center;gap:8px;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.65);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:.3rem .85rem;border-radius:100px}
.tdot{width:7px;height:7px;border-radius:50%;background:#7cff4e;box-shadow:0 0 8px #7cff4e;flex-shrink:0}
.t-h1{font-size:3.8rem;font-weight:800;letter-spacing:-.04em;line-height:1.07}.ac{color:#7cff4e}
.t-sub{font-size:1rem;color:rgba(255,255,255,.4)}
/* Feature */
.feature-slide{padding:0 68px;gap:68px}.feature-slide.rev{flex-direction:row-reverse}
.phone-col{flex:0 0 auto;position:relative}
.phone-glow{position:absolute;width:290px;height:290px;border-radius:50%;background:radial-gradient(ellipse,rgba(124,255,78,.3) 0%,rgba(124,255,78,.07) 42%,transparent 68%);top:50%;left:50%;transform:translate(-50%,-50%);filter:blur(10px);pointer-events:none;z-index:0}
.phone-frame{width:232px;height:502px;border-radius:38px;border:1.5px solid rgba(255,255,255,.14);overflow:hidden;position:relative;z-index:1;box-shadow:0 28px 70px rgba(0,0,0,.65),0 0 0 1px rgba(124,255,78,.07);background:#0f1e14}
.phone-frame img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.pnotch{position:absolute;top:10px;left:50%;transform:translateX(-50%);width:68px;height:21px;background:#0a1610;border-radius:100px;z-index:10}
.text-col{flex:1;min-width:0}
.f-tag{display:inline-flex;align-items:center;font-size:.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7cff4e;background:rgba(124,255,78,.08);border:1px solid rgba(124,255,78,.2);padding:.26rem .7rem;border-radius:100px;margin-bottom:13px}
.f-title{font-size:2.8rem;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:#fff;margin-bottom:13px}
.f-desc{font-size:.97rem;color:rgba(255,255,255,.48);line-height:1.7;margin-bottom:18px;max-width:440px}
.f-bullets{list-style:none;display:flex;flex-direction:column;gap:10px}
.f-bullets li{display:flex;align-items:center;gap:10px;font-size:.9rem;color:rgba(255,255,255,.75);font-weight:500}
/* CTA */
.cta-slide{flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px}
.cta-logo{height:42px}.cta-h2{font-size:3.1rem;font-weight:800;letter-spacing:-.03em}
.cta-sub{font-size:1rem;color:rgba(255,255,255,.45)}
.cta-btn{display:inline-block;padding:.9rem 2.6rem;background:#7cff4e;color:#081209;font-weight:700;font-size:1rem;border-radius:12px;box-shadow:0 0 28px rgba(124,255,78,.5)}
.cta-url{font-size:.82rem;color:rgba(255,255,255,.28);letter-spacing:.06em}
/* ── CSS Keyframes ── */
@keyframes showSlide{0%{opacity:0}6%{opacity:1}88%{opacity:1}100%{opacity:0}}
@keyframes showLast{0%{opacity:0}6%{opacity:1}100%{opacity:1}}
@keyframes fUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes sInR{from{opacity:0;transform:translateX(65px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes sInL{from{opacity:0;transform:translateX(-65px) scale(.92)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes dotOn{0%{background:rgba(255,255,255,.18);width:7px}6%{background:#7cff4e;width:22px;border-radius:4px}88%{background:#7cff4e;width:22px}100%{background:rgba(255,255,255,.18);width:7px}}
/* ── Per-slide dynamic CSS ── */
${dynCss}
</style>
</head>
<body>
<div class="bg"><div class="orb o1"></div><div class="orb o2"></div><div class="grid"></div></div>
<div class="wm"><img src="http://localhost:4200/CourtGo.png"/></div>
<div class="progress">${dotsHtml}</div>
${slidesHtml}
</body></html>`;

  fs.writeFileSync(HTML_OUT, html);
  console.log(`     presentation.html written  (total: ${totalSec.toFixed(1)}s)`);
  return totalSec;
}

// ── 3. Record video ───────────────────────────────────────────────────────
async function recordVideo(totalSec) {
  const ms = Math.ceil(totalSec * 1000) + 2000;
  console.log(`\n3/4  Recording video (~${Math.ceil(ms/1000)}s)...`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--disable-dev-shm-usage'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: VID_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();

  // Disable animation slowdown / reduced motion
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });

  await page.goto('http://localhost:4200/presentation.html', { waitUntil: 'load' });

  // Wait for all images to load before recording starts
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.images)
        .filter(img => !img.complete)
        .map(img => new Promise(r => { img.onload = img.onerror = r; }))
    );
  });

  console.log('     Images loaded — recording in progress...');
  await new Promise(r => setTimeout(r, ms));

  await ctx.close();
  await browser.close();

  const files = fs.readdirSync(VID_DIR).filter(f => f.endsWith('.webm') && f !== 'raw.webm');
  if (!files.length) throw new Error('No .webm output found');
  const webm = path.join(VID_DIR, 'raw.webm');
  if (fs.existsSync(webm)) fs.unlinkSync(webm);
  fs.renameSync(path.join(VID_DIR, files.sort().at(-1)), webm);
  console.log('     raw.webm saved');
  return webm;
}

// ── 4. Combine audio + video ──────────────────────────────────────────────
function combineAV(webmPath) {
  console.log('\n4/4  Combining audio + video...');

  const concatFile = path.join(AUD_DIR, 'concat.txt');
  const lines = SLIDES.map((_,i) => `file '${path.join(AUD_DIR,`slide-${i}.mp3`).replace(/\\/g,'/')}'`);
  fs.writeFileSync(concatFile, lines.join('\n'));

  const narMp3  = path.join(AUD_DIR, 'narration.mp3');
  const outMp4  = path.join(VID_DIR, 'courtgo-features.mp4');

  execFileSync(ffmpegPath, ['-y','-f','concat','-safe','0','-i',concatFile,'-c:a','libmp3lame',narMp3]);

  execFileSync(ffmpegPath, [
    '-y',
    '-i', webmPath,
    '-i', narMp3,
    '-c:v','libx264','-preset','fast','-crf','18',
    '-c:a','aac','-b:a','128k',
    '-shortest',
    outMp4,
  ]);

  const mb = (fs.statSync(outMp4).size/1024/1024).toFixed(1);
  console.log(`\n✅  public/video/courtgo-features.mp4  (${mb} MB)`);
  console.log(`    Preview: http://localhost:4200/video/courtgo-features.mp4`);
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  // Clear cached audio so new narrations are generated fresh
  if (fs.existsSync(AUD_DIR)) fs.readdirSync(AUD_DIR).filter(f=>f.endsWith('.mp3')).forEach(f=>fs.unlinkSync(path.join(AUD_DIR,f)));

  await generateAudio();
  const totalSec = buildHTML();
  const webm = await recordVideo(totalSec);
  combineAV(webm);
})().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });

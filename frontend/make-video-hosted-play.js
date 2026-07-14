/**
 * CourtGo — Hosted Play Marketing Video
 * Desktop screenshots (1280×800) shown in browser-window frames.
 * Pipeline: TTS → CSS-animated HTML → Playwright record → ffmpeg mux → hosted-play.mp4
 */
const { chromium }     = require('playwright');
const ffmpegPath       = require('ffmpeg-static');
const fetch            = require('node-fetch');
const { execFileSync, spawnSync } = require('child_process');
const path             = require('path');
const fs               = require('fs');

const PUB      = path.join(__dirname, 'public');
const VID_DIR  = path.join(PUB, 'video');
const AUD_DIR  = path.join(VID_DIR, 'audio-hp');
const HTML_OUT = path.join(PUB, 'presentation-hp.html');
[VID_DIR, AUD_DIR].forEach(d => fs.existsSync(d) || fs.mkdirSync(d, { recursive: true }));

// ── Slide definitions ──────────────────────────────────────────────────────
const SLIDES = [
  {
    type: 'title', duration: 5000,
    narration: 'Hosted Play by CourtGo. The smart way to organise, manage, and run club sessions — for tennis and pickleball.',
  },
  {
    type: 'feature', reverse: false, duration: 6500,
    tag: 'Find a Session', title: 'Browse open\nsessions instantly',
    desc: 'Players see every available club session — sport, date, venue, fee, and how many spots are left.',
    bullets: ['9 sessions at a glance', '"Joined" badge confirms your spot', 'Live capacity bar per session', 'Stats: sessions · mine · open spots'],
    img: 'http://localhost:4200/features/hp-session-list.png',
    narration: 'Players browse every open session at a glance — sport, venue, fee, and spots left. One click to join.',
  },
  {
    type: 'feature', reverse: true, duration: 6500,
    tag: 'Skill Matching', title: 'Play at your level.\nEvery time.',
    desc: 'Players set a skill tier once. Hosts can require a minimum level, so every match stays fair and fun.',
    bullets: ['8 tiers — Beginner to Professional', 'Sessions can require "Advanced+"', 'Level badge shown on every session card', 'Open sessions still welcome all levels'],
    img: 'http://localhost:4200/features/hp-skill-gate.png',
    narration: "Players set their skill level once. Hosts can require a minimum tier for a session, so everyone plays at a level that's actually fun.",
  },
  {
    type: 'feature', reverse: false, duration: 6500,
    tag: 'Session Setup', title: 'A 3-step wizard.\nBuilt for hosts.',
    desc: 'Basics, then venue and capacity, then play settings — rotation format and skill range included.',
    bullets: ['Step 1-2: schedule, venue, fee, capacity', 'Rotation format: FCFS, Winner Stays, or King of the Court', 'Optional Min/Max skill-level range', 'Queue management configured right in the wizard'],
    img: 'http://localhost:4200/features/hp-create-form.png',
    narration: 'A simple 3-step wizard walks hosts through the basics, the venue, and play settings — including the rotation format and an optional skill-level range.',
  },
  {
    type: 'feature', reverse: true, duration: 6500,
    tag: 'Digital Payment', title: 'Pay in the app.\nNo cash at the door.',
    desc: 'Players submit GCash or bank payments in-app. Admins approve with one click — full audit trail included.',
    bullets: ['Session fee + convenience fee shown', 'GCash QR displayed instantly', 'Upload proof of payment', 'Status updates in real time'],
    img: 'http://localhost:4200/features/hp-payment-modal.png',
    narration: 'No cash at the door. Players pay via G-Cash right in the app, upload a screenshot, and wait for admin approval.',
  },
  {
    type: 'feature', reverse: false, duration: 6500,
    tag: 'Smart Waitlist', title: 'Session full?\nNever miss a spot.',
    desc: 'When a session fills up, players join the waitlist instead of getting turned away — and get first claim when a spot opens.',
    bullets: ['Full session → automatic waitlist', 'A spot opens → instant notification', 'Free sessions auto-confirm the next player', 'Paid sessions offer the spot to claim first'],
    img: 'http://localhost:4200/features/hp-waitlist.png',
    narration: "Session's full? Players join the waitlist instead of getting turned away. When a spot opens, free sessions auto-confirm the next player, and paid sessions offer it to them to claim first.",
  },
  {
    type: 'split', duration: 7000,
    tag: 'QR Self Check-In', title: 'Scan. Check in.\nHead to the courts.',
    imgLeft: 'http://localhost:4200/features/hp-admin-qr.png',
    labelLeft: 'Admin: Show QR Code',
    imgRight: 'http://localhost:4200/features/hp-qr-checkin.png',
    labelRight: 'Player: Already Checked In',
    narration: 'When the session starts, the admin shows the QR code. Players scan it, check in instantly, and the app sends them straight to the courts.',
  },
  {
    type: 'feature', reverse: true, duration: 7000,
    tag: 'Live Queue Board', title: 'Full court control.\nZero clipboards.',
    desc: 'See every court live — who\'s playing, who\'s waiting, and how many games played. Finish a court to auto-rotate.',
    bullets: ['Court 1: 4 players · 1 game played', 'Waiting queue with reorder controls', 'Check-In roster on the right panel', 'Finish court → next players auto-fill'],
    img: 'http://localhost:4200/features/hp-admin-courts.png',
    narration: 'The live queue board shows every court in real time. Tap Finish and the app automatically rotates the next players in.',
  },
  {
    type: 'feature', reverse: false, duration: 7000,
    tag: 'Competitive Play', title: 'Winners stay.\nChallengers rotate in.',
    desc: 'Switch on Winner Stays or King of the Court. Tap the winning team, and the app handles who plays next.',
    bullets: ['Tap the winning team to finish a game', 'Winners stay on court, fresh challengers rotate in', 'King of the Court adds a streak cap', 'Win-loss record tracked automatically'],
    img: 'http://localhost:4200/features/hp-winner-tap.png',
    narration: 'Switch on Winner Stays or King of the Court. Just tap the winning team to finish a game — the app keeps winners on court and rotates in fresh challengers automatically.',
  },
  {
    type: 'feature', reverse: true, duration: 6500,
    tag: 'Big-Screen Display', title: 'Put it on\nthe big screen.',
    desc: 'Pop the live queue onto any TV or monitor at the venue — courts and the waiting list, always current.',
    bullets: ['Full-bleed layout built for TVs', 'Auto-refreshes — zero taps needed', 'Team A vs Team B, court by court', 'One tap from the admin queue page'],
    img: 'http://localhost:4200/features/hp-tv-display.png',
    narration: 'Pop the queue onto any TV at the venue. Players see who\'s playing and who\'s next automatically — no admin required.',
  },
  {
    type: 'feature', reverse: false, duration: 6500,
    tag: 'Final Standings', title: 'Bragging rights,\nbuilt in.',
    desc: 'When a session wraps up, final standings appear automatically — ranked by wins, with medal styling for the top three.',
    bullets: ['Ranked by wins, then fewest losses', 'Medal styling for the top 3', '"You finished #N of M" on the player board', 'Shown automatically on the TV display too'],
    img: 'http://localhost:4200/features/hp-tv-standings.png',
    narration: 'When the session wraps up, final standings appear automatically — ranked by wins, with medal styling for the top three, right on the player app and the big screen.',
  },
  {
    type: 'feature', reverse: true, duration: 6500,
    tag: 'Player Live View', title: 'Always know\nwhere you stand.',
    desc: 'Players see their status, which court they\'re on, and who\'s next in queue — updated live.',
    bullets: ['"Playing on Court 1" — 1 played', '4 Playing · 3 Waiting · 1 Game', 'Courts panel with teammates', 'Waiting queue shows your position'],
    img: 'http://localhost:4200/features/hp-player-live.png',
    narration: 'Players see their real-time status — playing on Court 1, or their position in the waiting queue. No guessing, no asking the admin.',
  },
  {
    type: 'cta', duration: 6000,
    narration: 'Hosted Play by CourtGo. Run better sessions. Play more. Manage less.',
  },
];

// ── Measure actual MP3 duration via ffmpeg stderr ─────────────────────────
function getMp3Duration(filePath) {
  const r = spawnSync(ffmpegPath, ['-i', filePath, '-f', 'null', 'pipe:1'], { encoding: 'utf8' });
  const out = r.stderr || '';
  const m = out.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
  if (!m) return null;
  return parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
}

// ── 1. TTS audio ──────────────────────────────────────────────────────────
async function generateAudio() {
  console.log('\n1/4  Generating narration...');
  for (let i = 0; i < SLIDES.length; i++) {
    const outPath = path.join(AUD_DIR, `slide-${i}.mp3`);
    if (fs.existsSync(outPath)) { console.log(`     slide-${i}.mp3 (cached)`); continue; }
    const text = SLIDES[i].narration;
    const url  = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob&ttsspeed=0.9`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) throw new Error(`TTS failed slide ${i}: ${res.status}`);
    const buf = await res.buffer();
    fs.writeFileSync(outPath, buf);
    console.log(`     slide-${i}.mp3  (${(buf.length/1024).toFixed(0)} KB)`);
    await new Promise(r => setTimeout(r, 400));
  }

  // Sync each slide's duration to its actual audio length + 600 ms breathing room
  console.log('     Syncing slide durations to audio...');
  for (let i = 0; i < SLIDES.length; i++) {
    const dur = getMp3Duration(path.join(AUD_DIR, `slide-${i}.mp3`));
    if (dur) {
      SLIDES[i].duration = Math.ceil(dur * 1000) + 600;
      console.log(`     slide-${i}: ${dur.toFixed(2)}s audio → ${(SLIDES[i].duration / 1000).toFixed(1)}s slide`);
    }
  }
}

// ── 2. Build animated HTML ─────────────────────────────────────────────────
function buildHTML() {
  console.log('\n2/4  Building presentation...');

  const starts = [];
  let acc = 0;
  for (const s of SLIDES) { starts.push(acc); acc += s.duration / 1000; }
  const totalSec = acc;

  let dynCss = '';
  for (let i = 0; i < SLIDES.length; i++) {
    const st  = starts[i].toFixed(3);
    const dur = (SLIDES[i].duration / 1000).toFixed(3);
    const kf  = i === SLIDES.length - 1 ? 'showLast' : 'showSlide';
    dynCss += `#s${i}{animation:${kf} ${dur}s ${st}s both}\n`;
    dynCss += `#d${i}{animation:dotOn ${dur}s ${st}s both}\n`;

    if (SLIDES[i].type === 'title') {
      [['.t-logo',0.10],['.t-badge',0.40],['.t-h1',0.70],['.t-sub',1.00]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .8s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    } else if (SLIDES[i].type === 'feature') {
      const bDir = SLIDES[i].reverse ? 'sInL' : 'sInR';
      dynCss += `#s${i} .browser-col{animation:${bDir} .8s ${(starts[i]+0.15).toFixed(3)}s both}\n`;
      [['.f-tag',0.35],['.f-title',0.55],['.f-desc',0.75]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .6s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
      [0.95,1.10,1.25,1.40].forEach((off,j) => {
        dynCss += `#s${i} .f-bullets li:nth-child(${j+1}){animation:fUp .5s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    } else if (SLIDES[i].type === 'split') {
      [['.sp-tag',0.20],['.sp-title',0.45],['.sp-left',0.65],['.sp-right',0.90]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .7s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    } else if (SLIDES[i].type === 'cta') {
      [['.cta-logo',0.20],['.cta-tag',0.40],['.cta-h2',0.60],['.cta-sub',0.80],['.cta-btn',1.00],['.cta-url',1.20]].forEach(([sel,off]) => {
        dynCss += `#s${i} ${sel}{animation:fUp .8s ${(starts[i]+off).toFixed(3)}s both}\n`;
      });
    }
  }

  // Browser-window chrome helper
  function browserFrame(src, h = 452) {
    return `<div class="browser-col">
      <div class="browser-glow"></div>
      <div class="browser-frame">
        <div class="browser-bar">
          <span class="bd bd-r"></span><span class="bd bd-y"></span><span class="bd bd-g"></span>
          <div class="browser-addr"></div>
        </div>
        <div class="browser-content" style="height:${h}px">
          <img src="${src}"/>
        </div>
      </div>
    </div>`;
  }

  const slidesHtml = SLIDES.map((s, i) => {
    if (s.type === 'title') return `
  <div class="slide title-slide" id="s${i}">
    <div class="ti">
      <img src="http://localhost:4200/CourtGo.png" class="t-logo"/>
      <div class="t-badge"><span class="tdot"></span>Hosted Play</div>
      <h1 class="t-h1">The smarter way to<br><span class="ac">RUN CLUB SESSIONS.</span></h1>
      <p class="t-sub">Digital payments · QR check-in · Auto court rotation · Live queue board</p>
    </div>
  </div>`;

    if (s.type === 'cta') return `
  <div class="slide cta-slide" id="s${i}">
    <img src="http://localhost:4200/CourtGo.png" class="cta-logo"/>
    <div class="cta-tag">Hosted Play</div>
    <h2 class="cta-h2">Run better sessions.<br><span class="ac">Play more. Manage less.</span></h2>
    <p class="cta-sub">Available now on CourtGo — for tennis and pickleball clubs.</p>
    <div class="cta-btn">Get Started Free</div>
    <p class="cta-url">courtgo.app</p>
  </div>`;

    if (s.type === 'split') return `
  <div class="slide split-slide" id="s${i}">
    <div class="sp-header">
      <div class="sp-tag">${s.tag}</div>
      <h2 class="sp-title">${s.title.replace('\n','<br>')}</h2>
    </div>
    <div class="sp-browsers">
      <div class="sp-left">
        <div class="sp-label">${s.labelLeft}</div>
        <div class="browser-frame browser-sm">
          <div class="browser-bar"><span class="bd bd-r"></span><span class="bd bd-y"></span><span class="bd bd-g"></span><div class="browser-addr"></div></div>
          <div class="browser-content" style="height:330px"><img src="${s.imgLeft}"/></div>
        </div>
      </div>
      <div class="sp-arrow">→</div>
      <div class="sp-right">
        <div class="sp-label">${s.labelRight}</div>
        <div class="browser-frame browser-sm">
          <div class="browser-bar"><span class="bd bd-r"></span><span class="bd bd-y"></span><span class="bd bd-g"></span><div class="browser-addr"></div></div>
          <div class="browser-content" style="height:330px"><img src="${s.imgRight}"/></div>
        </div>
      </div>
    </div>
  </div>`;

    const bullets = s.bullets.map(b =>
      `<li><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7cff4e" stroke-width="3" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>${b}</li>`
    ).join('');
    const textHtml = `
      <div class="text-col">
        <div class="f-tag">${s.tag}</div>
        <h2 class="f-title">${s.title.replace('\n','<br>')}</h2>
        <p class="f-desc">${s.desc}</p>
        <ul class="f-bullets">${bullets}</ul>
      </div>`;
    const bFrame = browserFrame(s.img);
    return `
  <div class="slide feature-slide${s.reverse?' rev':''}" id="s${i}">
    ${s.reverse ? textHtml + bFrame : bFrame + textHtml}
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
.wm{position:fixed;top:20px;left:32px;z-index:200}.wm img{height:24px}
/* Progress dots */
.progress{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:200}
.dot{width:7px;height:7px;border-radius:4px;background:rgba(255,255,255,.18)}
/* Slides */
.slide{position:absolute;inset:0;opacity:0;display:flex;align-items:center;z-index:1}
/* Title */
.title-slide{justify-content:center}
.ti{display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
.t-logo{height:48px}
.t-badge{display:inline-flex;align-items:center;gap:8px;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.65);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:.3rem .85rem;border-radius:100px}
.tdot{width:7px;height:7px;border-radius:50%;background:#7cff4e;box-shadow:0 0 8px #7cff4e;flex-shrink:0}
.t-h1{font-size:3.8rem;font-weight:800;letter-spacing:-.04em;line-height:1.07}.ac{color:#7cff4e}
.t-sub{font-size:1rem;color:rgba(255,255,255,.4)}
/* Feature: browser left (or right when .rev), text the other side */
.feature-slide{padding:0 40px;gap:48px;align-items:center}.feature-slide.rev{flex-direction:row-reverse}
/* Browser window frame */
.browser-col{flex:0 0 auto;position:relative}
.browser-glow{position:absolute;width:100%;height:200px;bottom:-60px;left:0;background:radial-gradient(ellipse,rgba(124,255,78,.18) 0%,transparent 70%);filter:blur(20px);pointer-events:none;z-index:0}
.browser-frame{width:730px;border-radius:10px;border:1px solid rgba(255,255,255,.13);overflow:hidden;box-shadow:0 24px 64px rgba(0,0,0,.75),0 0 0 1px rgba(124,255,78,.05);background:#111d14;position:relative;z-index:1}
.browser-bar{height:30px;background:#182b1e;display:flex;align-items:center;padding:0 12px;gap:6px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0}
.bd{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.bd-r{background:#ff5f57}.bd-y{background:#febc2e}.bd-g{background:#28c840}
.browser-addr{flex:1;margin:0 10px;height:16px;background:rgba(255,255,255,.05);border-radius:3px}
.browser-content{overflow:hidden;display:block}
.browser-content img{width:730px;height:auto;display:block;object-fit:cover;object-position:top left}
/* Small browser for split slide */
.browser-sm{width:530px}
.browser-sm .browser-content img{width:530px}
/* Text column */
.text-col{flex:1;min-width:0}
.f-tag{display:inline-flex;align-items:center;font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7cff4e;background:rgba(124,255,78,.08);border:1px solid rgba(124,255,78,.2);padding:.24rem .65rem;border-radius:100px;margin-bottom:12px}
.f-title{font-size:2.4rem;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:#fff;margin-bottom:12px}
.f-desc{font-size:.88rem;color:rgba(255,255,255,.45);line-height:1.7;margin-bottom:16px}
.f-bullets{list-style:none;display:flex;flex-direction:column;gap:9px}
.f-bullets li{display:flex;align-items:center;gap:9px;font-size:.85rem;color:rgba(255,255,255,.75);font-weight:500}
/* Split slide */
.split-slide{flex-direction:column;justify-content:center;align-items:center;gap:20px}
.sp-header{text-align:center}
.sp-tag{display:inline-flex;align-items:center;font-size:.66rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#7cff4e;background:rgba(124,255,78,.08);border:1px solid rgba(124,255,78,.2);padding:.24rem .65rem;border-radius:100px;margin-bottom:8px}
.sp-title{font-size:2.2rem;font-weight:800;letter-spacing:-.03em;line-height:1.1}
.sp-browsers{display:flex;align-items:flex-start;gap:28px}
.sp-left,.sp-right{display:flex;flex-direction:column;align-items:center;gap:8px}
.sp-label{font-size:.68rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.38)}
.sp-arrow{font-size:2rem;color:#7cff4e;opacity:.6;align-self:center;flex-shrink:0;margin-top:30px}
/* CTA */
.cta-slide{flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:16px}
.cta-logo{height:42px}
.cta-tag{display:inline-flex;align-items:center;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7cff4e;background:rgba(124,255,78,.08);border:1px solid rgba(124,255,78,.2);padding:.3rem .85rem;border-radius:100px}
.cta-h2{font-size:3.1rem;font-weight:800;letter-spacing:-.03em}
.cta-sub{font-size:1rem;color:rgba(255,255,255,.45)}
.cta-btn{display:inline-block;padding:.9rem 2.6rem;background:#7cff4e;color:#081209;font-weight:700;font-size:1rem;border-radius:12px;box-shadow:0 0 28px rgba(124,255,78,.5)}
.cta-url{font-size:.82rem;color:rgba(255,255,255,.28);letter-spacing:.06em}
/* Keyframes */
@keyframes showSlide{0%{opacity:0}6%{opacity:1}88%{opacity:1}100%{opacity:0}}
@keyframes showLast{0%{opacity:0}6%{opacity:1}100%{opacity:1}}
@keyframes fUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
@keyframes sInR{from{opacity:0;transform:translateX(65px) scale(.94)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes sInL{from{opacity:0;transform:translateX(-65px) scale(.94)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes dotOn{0%{background:rgba(255,255,255,.18);width:7px}6%{background:#7cff4e;width:22px;border-radius:4px}88%{background:#7cff4e;width:22px}100%{background:rgba(255,255,255,.18);width:7px}}
${dynCss}
</style></head>
<body>
<div class="bg"><div class="orb o1"></div><div class="orb o2"></div><div class="grid"></div></div>
<div class="wm"><img src="http://localhost:4200/CourtGo.png"/></div>
<div class="progress">${dotsHtml}</div>
${slidesHtml}
</body></html>`;

  fs.writeFileSync(HTML_OUT, html);
  console.log(`     presentation-hp.html  (${totalSec.toFixed(1)}s total)`);
  return totalSec;
}

// ── 3. Record video ────────────────────────────────────────────────────────
async function recordVideo(totalSec) {
  const ms = Math.ceil(totalSec * 1000) + 2000;
  console.log(`\n3/4  Recording (~${Math.ceil(ms/1000)}s) — a browser window will open...`);

  // Remove any leftover webm files so we pick up only the new one
  fs.readdirSync(VID_DIR).filter(f => f.endsWith('.webm')).forEach(f => fs.unlinkSync(path.join(VID_DIR, f)));

  // headless:false is required — headless Chrome freezes CSS animation timelines
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: VID_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' });
  await page.goto('http://localhost:4200/presentation-hp.html', { waitUntil: 'load' });
  await page.evaluate(() =>
    Promise.all(Array.from(document.images).filter(i=>!i.complete).map(i=>new Promise(r=>{i.onload=i.onerror=r;})))
  );
  console.log('     Images loaded — recording...');
  await new Promise(r => setTimeout(r, ms));
  await ctx.close();
  await browser.close();
  const files = fs.readdirSync(VID_DIR).filter(f => f.endsWith('.webm'));
  if (!files.length) throw new Error('No .webm found');
  const webm = path.join(VID_DIR, 'raw-hp.webm');
  if (fs.existsSync(webm)) fs.unlinkSync(webm);
  fs.renameSync(path.join(VID_DIR, files.sort().at(-1)), webm);
  console.log('     raw-hp.webm saved');
  return webm;
}

// ── 4. Mux audio + video ──────────────────────────────────────────────────
function combineAV(webmPath) {
  console.log('\n4/4  Combining audio + video...');
  const concatFile = path.join(AUD_DIR, 'concat.txt');
  fs.writeFileSync(concatFile, SLIDES.map((_,i)=>`file '${path.join(AUD_DIR,`slide-${i}.mp3`).replace(/\\/g,'/')}'`).join('\n'));
  const narMp3 = path.join(AUD_DIR, 'narration.mp3');
  const outMp4 = path.join(VID_DIR, 'hosted-play.mp4');
  execFileSync(ffmpegPath, ['-y','-f','concat','-safe','0','-i',concatFile,'-c:a','libmp3lame',narMp3]);
  execFileSync(ffmpegPath, ['-y','-i',webmPath,'-i',narMp3,'-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','128k','-shortest',outMp4]);
  const mb = (fs.statSync(outMp4).size/1024/1024).toFixed(1);
  console.log(`\n✅  public/video/hosted-play.mp4  (${mb} MB)`);
  console.log(`    Preview: http://localhost:4200/video/hosted-play.mp4`);
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  if (fs.existsSync(AUD_DIR)) fs.readdirSync(AUD_DIR).filter(f=>f.endsWith('.mp3')).forEach(f=>fs.unlinkSync(path.join(AUD_DIR,f)));
  await generateAudio();
  const totalSec = buildHTML();
  const webm = await recordVideo(totalSec);
  combineAV(webm);
})().catch(e => { console.error('\n❌', e.message); process.exit(1); });

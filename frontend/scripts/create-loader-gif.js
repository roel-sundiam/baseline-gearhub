/**
 * Captures the CGLoader animation from a headless browser and writes a GIF.
 * Output: frontend/public/CGLoader.gif
 * Usage: node scripts/create-loader-gif.js
 */

const puppeteer = require('puppeteer');
const GIFEncoder = require('gif-encoder-2');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const OUT_PATH = path.join(__dirname, '../public/CGLoader.gif');
const IMG_PATH = path.join(__dirname, '../public/CGLoader.png');
const WIDTH = 420;
const HEIGHT = 320; // approx 16:9 crop of the loader area
const FPS = 12;
const DURATION_MS = 1600; // one full spin + ball pulse cycle
const FRAMES = Math.round((DURATION_MS / 1000) * FPS);
const FRAME_DELAY = Math.round(100 / FPS); // GIF delay in 1/100s units

// Read the loader image as base64 so we can embed it in the HTML
const imgBase64 = fs.readFileSync(IMG_PATH).toString('base64');

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: #080f09;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .cg-loader-scene {
    position: relative;
    width: ${WIDTH}px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .cg-loader-img {
    width: 100%;
    display: block;
    border-radius: 12px;
    animation: cgPulse 2.4s ease-in-out infinite;
  }
  @keyframes cgPulse {
    0%, 100% { filter: brightness(1) drop-shadow(0 0 8px rgba(163,230,53,0.2)); }
    50%       { filter: brightness(1.08) drop-shadow(0 0 18px rgba(163,230,53,0.45)); }
  }
  .cg-loader-spin-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -54%);
    width: 54%;
    aspect-ratio: 1;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: #a3e635;
    border-right-color: rgba(163,230,53,0.3);
    animation: cgSpin 1.6s linear infinite;
    pointer-events: none;
  }
  @keyframes cgSpin { to { transform: translate(-50%, -54%) rotate(360deg); } }
  .cg-loader-ball-glow {
    position: absolute;
    bottom: 22%;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #a3e635;
    animation: cgBallPulse 1.6s ease-in-out infinite;
    box-shadow: 0 0 8px 2px rgba(163,230,53,0.6);
    pointer-events: none;
  }
  @keyframes cgBallPulse {
    0%, 100% { transform: translateX(-50%) scale(1);   opacity: 0.85; }
    50%       { transform: translateX(-50%) scale(1.4); opacity: 1; }
  }
  .cg-loader-bar {
    width: 55%;
    height: 3px;
    background: rgba(163,230,53,0.12);
    border-radius: 99px;
    overflow: hidden;
    margin-top: -14%;
  }
  .cg-loader-bar-fill {
    height: 100%;
    width: 40%;
    background: linear-gradient(90deg, transparent, #a3e635, transparent);
    border-radius: 99px;
    animation: cgShimmer 1.4s ease-in-out infinite;
  }
  @keyframes cgShimmer {
    0%   { transform: translateX(-150%); }
    100% { transform: translateX(350%); }
  }
</style>
</head>
<body>
  <div class="cg-loader-scene">
    <img src="data:image/png;base64,${imgBase64}" class="cg-loader-img" />
    <div class="cg-loader-spin-ring"></div>
    <div class="cg-loader-ball-glow"></div>
    <div class="cg-loader-bar"><div class="cg-loader-bar-fill"></div></div>
  </div>
</body>
</html>`;

(async () => {
  console.log(`Capturing ${FRAMES} frames at ${FPS}fps (${DURATION_MS}ms)...`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.setContent(HTML, { waitUntil: 'networkidle0' });

  // Let animations settle for one frame before capturing
  await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));

  const frameInterval = DURATION_MS / FRAMES;
  const pngBuffers = [];

  for (let i = 0; i < FRAMES; i++) {
    const buf = await page.screenshot({ type: 'png' });
    pngBuffers.push(buf);
    if (i < FRAMES - 1) {
      await new Promise(r => setTimeout(r, frameInterval));
    }
  }

  await browser.close();
  console.log(`Captured ${pngBuffers.length} frames. Encoding GIF...`);

  const encoder = new GIFEncoder(WIDTH, HEIGHT, 'neuquant', true);
  encoder.setDelay(Math.round(frameInterval));
  encoder.setRepeat(0); // loop forever
  encoder.setQuality(10);
  encoder.start();

  for (let i = 0; i < pngBuffers.length; i++) {
    process.stdout.write(`\r  encoding frame ${i + 1}/${pngBuffers.length}`);
    const buf = Buffer.isBuffer(pngBuffers[i]) ? pngBuffers[i] : Buffer.from(pngBuffers[i]);
    const png = PNG.sync.read(buf);
    encoder.addFrame(new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength));
  }

  encoder.finish();
  process.stdout.write('\n');

  fs.writeFileSync(OUT_PATH, encoder.out.getData());
  const kb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Done! Saved to ${OUT_PATH} (${kb} KB)`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

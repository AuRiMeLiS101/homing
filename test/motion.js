// Record Gennady's acts frame by frame, so his motion can be judged like an animator would: one frame per 1/30 s.
// node test/motion.js <width> <height> <act,act,...> [frames] [outdir]
// Acts are Gennady act names (cheer, bigV, dance, roar, gasp, smallWin, shrug, point, wave, whistle, binos, pet,
// capTip, sky, nod, trophy), "walk" for the intro walk in, or "idle" for plain idle time.
// Writes PNG frames per act into <outdir>/<act>/ and an mp4 per act when ffmpeg is installed.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

(async () => {
  const [w, h, actsArg, framesArg, outArg] = process.argv.slice(2);
  const acts = (actsArg || 'cheer').split(',');
  const frames = +(framesArg || 60);
  const out = path.resolve(outArg || path.join(__dirname, 'out/motion', `${w}x${h}`));
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: +w < 900 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[error] ' + m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?fast=1`);
  await page.waitForSelector('#startBtn:not([disabled])', { timeout: 180000 });
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__homingReady === true, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('spin').getAttribute('aria-label') === 'Spin' && !document.querySelector('.modal:not([hidden])'), null, { timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { G.app.ticker.stop(); gsap.globalTimeline.pause(); G.step(1); });
  for (const act of acts) {
    const dir = path.join(out, act);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    // the clip leaves room for hops and a thrown cap
    const clip = await page.evaluate(() => {
      const b = Gennady.bounds();
      const x0 = Math.max(0, b.x - b.width * 0.55), x1 = Math.min(G.W, b.x + b.width * 1.55);
      const y0 = Math.max(0, b.y - b.height * 0.5), y1 = Math.min(G.H, b.y + b.height * 1.08);
      return { x: Math.floor(x0), y: Math.floor(y0), width: Math.floor(x1 - x0) & ~1, height: Math.floor(y1 - y0) & ~1 };
    });
    await page.evaluate((a) => {
      if (a === 'walk') { Gennady.walkIn(G.W + 420 * Gennady.R.scale, 1.35); return; }
      if (a === 'idle') return;
      const m = /^tier(\d)$/.exec(a);
      if (m) { Gennady.bigWin(+m[1]); return; }
      Gennady.act(a);
    }, act);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(() => G.step(1 / 30));
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`), clip, timeout: 180000 });
    }
    await page.evaluate(() => { Gennady.stopAct(); G.step(1); });
    console.log('recorded', act, frames, 'frames', JSON.stringify(clip));
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, 'f%03d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-pix_fmt', 'yuv420p', path.join(out, `${act}.mp4`)]);
    } catch (e) { console.log('ffmpeg failed for', act, e.message.split('\n')[0]); }
  }
  const paint = await page.evaluate(() => Gennady.paintMs);
  console.log('paintMs', paint && paint.toFixed(1));
  console.log(logs.length ? logs.slice(0, 20).join('\n') : 'no console errors');
  await browser.close();
  srv.close();
})();

// Record the title and the intro frame by frame on the game's own clock, then encode an mp4.
// node test/intro_rec.js <outdir> [width] [height] [titleSeconds] [introSeconds]
// The page is frozen as soon as the title is live; every frame is one 1/30 s step of the game and of gsap, so the
// camera move, the logo's glide and the pigeon's landing are framed exactly however slow the renderer is.
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
  const [out, w = '1280', h = '800', titleS = '2.2', introS = '5.2'] = process.argv.slice(2);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (f.endsWith('.png')) fs.unlinkSync(path.join(out, f));
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[error] ' + m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?fast=1`);
  await page.waitForSelector('#startBtn:not([disabled])', { timeout: 240000 });
  // freeze at once: the pigeon's flight is a gsap tween, so it waits for our steps
  await page.evaluate(() => { G.app.ticker.stop(); gsap.globalTimeline.pause(); });
  await page.waitForFunction(() => Intro.flying || Intro.landed, null, { timeout: 60000 }).catch(() => logs.push('[rec] bird never started'));
  let n = 0;
  const shot = async () => { await page.screenshot({ path: path.join(out, `f${String(n).padStart(4, '0')}.png`), timeout: 120000 }); n++; };
  const step = () => page.evaluate(() => G.step(1 / 30));
  const tf = Math.round(+titleS * 30), inf = Math.round(+introS * 30);
  for (let i = 0; i < tf; i++) { await step(); await shot(); }
  console.log('title frames', tf);
  await page.click('#startBtn');
  await page.waitForFunction(() => document.getElementById('start').classList.contains('go'), null, { timeout: 60000 });
  for (let i = 0; i < inf; i++) { await step(); await shot(); if (i % 30 === 0) console.log('intro frame', i); }
  console.log(logs.length ? logs.join('\n') : 'no console errors');
  await browser.close();
  srv.close();
  const mp4 = path.join(out, 'intro.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(out, 'f%04d.png'), '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-pix_fmt', 'yuv420p', '-crf', '19', mp4]);
  console.log('wrote', mp4, n, 'frames');
})();

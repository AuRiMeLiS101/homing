// Record Gennady on his own stage (test/gena_rig.html), one frame per 1/30 s, so motion can be judged like an animator.
// node test/rig_motion.js <out dir> <act,act,...> [frames] [width] [height] [query]
// Writes <out>/<act>/fNNN.png and <out>/<act>.mp4 (when ffmpeg is installed). Physics runs at 60 steps a second.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
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
  const [outArg, actsArg, framesArg, wArg, hArg, query] = process.argv.slice(2);
  const out = path.resolve(outArg || path.join(__dirname, 'out/rig'));
  const acts = (actsArg || 'cheer').split(',');
  const frames = +(framesArg || 60), W = +(wArg || 520), H = +(hArg || 760);
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push('[' + m.type() + '] ' + m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/test/gena_rig.html` + (query ? '?' + query : ''));
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 }).catch((e) => logs.push('[ready] ' + e.message.split('\n')[0]));
  if (actsArg && actsArg.startsWith('poses:')) {
    fs.mkdirSync(out, { recursive: true });
    const names = actsArg.slice(6).split('+');
    const shots = await page.evaluate((n) => window.poseSheet(n), names);
    shots.forEach((u, i) => fs.writeFileSync(path.join(out, `pose_${names[i]}.png`), Buffer.from(u.split(',')[1], 'base64')));
    console.log('poses', names.length);
    acts.length = 0;
  }
  if (actsArg === 'parts') {
    fs.mkdirSync(out, { recursive: true });
    const url = await page.evaluate(() => window.partsSheet());
    if (url) fs.writeFileSync(path.join(out, 'parts.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('parts sheet', url ? 'written' : 'missing');
    acts.length = 0;
  }
  for (const act of acts) {
    const dir = path.join(out, act);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await page.evaluate((a) => window.act(a), act);
    for (let i = 0; i < frames; i++) {
      await page.evaluate(() => window.step(1 / 30));
      await page.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`), timeout: 120000 });
    }
    await page.evaluate(() => { window.stop(); window.step(1.2); });
    try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(dir, 'f%03d.png'), '-pix_fmt', 'yuv420p', path.join(out, `${act}.mp4`)]); } catch (e) { /* no ffmpeg */ }
    console.log('recorded', act);
  }
  console.log('paintMs', await page.evaluate(() => Gennady.paintMs.toFixed(2)).catch(() => '?'));
  console.log(logs.length ? logs.slice(0, 30).join('\n') : 'no console errors');
  await browser.close();
  srv.close();
})();

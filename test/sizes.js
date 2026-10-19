// Screenshot one game state at many screen sizes in a single page load, to catch crops and collisions.
// node test/sizes.js <out-prefix> <WxH,WxH,...> [eval before shots]
// The page starts at the first size, then is resized to each size in turn (the game relayouts on resize).
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  const [prefix, sizesArg, pre] = process.argv.slice(2);
  const sizes = sizesArg.split(',').map((s) => s.split('x').map(Number));
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: sizes[0][0], height: sizes[0][1] }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 6).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('[error] ' + m.text()); });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?fast=1`);
  await page.waitForSelector('#startBtn:not([disabled])', { timeout: 180000 });
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__homingReady === true, null, { timeout: 180000 });
  await page.waitForFunction(() => document.getElementById('spin').getAttribute('aria-label') === 'Spin' && !document.querySelector('.modal:not([hidden])'), null, { timeout: 180000 });
  await page.waitForTimeout(1200);
  if (pre) console.log('pre', JSON.stringify(await page.evaluate(pre)));
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    // let the resize land, then freeze so every shot shows a settled frame
    await page.waitForTimeout(900);
    await page.evaluate(() => { G.app.ticker.stop(); gsap.globalTimeline.pause(); G.step && G.step(0.6); });
    await page.screenshot({ path: `${prefix}-${w}x${h}.png`, timeout: 180000 });
    await page.evaluate(() => { gsap.globalTimeline.resume(); G.app.ticker.start(); });
    console.log('shot', `${w}x${h}`);
  }
  console.log(logs.length ? logs.slice(0, 20).join('\n') : 'no console errors');
  await browser.close();
  srv.close();
})();

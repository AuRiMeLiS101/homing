// Drive the game in headless Chromium and capture screenshots.
// node test/play.js <out-prefix> <width> <height> <query> <script...>
// The page is served over HTTP from dist/ (same files Vercel serves), at /index.html.
// script steps: start | ready | wait:<ms> | shot:<name> | spin | key:<Key> | click:<selector> | tap:<x>,<y>
//               until-idle[:<ms>] | eval:<js> | hover:<selector> | down:<selector> (press and hold for a pressed state shot)
//               until:<js condition> (polls the page) | freeze (stop the game clock and gsap so a fleeting moment can be
//               captured; the canvas keeps its last frame) | thaw
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
  const [prefix, w, h, query, ...steps] = process.argv.slice(2);
  const srv = await serve();
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: +w < 900 });
  const logs = [];
  page.on('console', (m) => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push(`[${t}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  page.on('requestfailed', (r) => logs.push('[requestfailed] ' + r.url()));
  const url = `http://127.0.0.1:${srv.address().port}/index.html` + (query && query !== '-' ? '?' + query : '');
  await page.goto(url);
  const t0 = Date.now();
  for (const s of steps) {
    const [cmd, arg] = s.split(/:(.+)/);
    try {
      if (cmd === 'start') {
        await page.waitForSelector('#startBtn:not([disabled])', { timeout: 120000 });
        await page.click('#startBtn');
      } else if (cmd === 'wait') await page.waitForTimeout(+arg);
      else if (cmd === 'shot') { await page.screenshot({ path: `${prefix}-${arg}.png`, timeout: 180000 }); console.log('shot', arg, ((Date.now() - t0) / 1000).toFixed(1) + 's'); }
      else if (cmd === 'ready') await page.waitForFunction(() => window.__homingReady === true, null, { timeout: 120000 });
      else if (cmd === 'spin') await page.keyboard.press('Space');
      else if (cmd === 'key') await page.keyboard.press(arg);
      else if (cmd === 'click') await page.click(arg);
      else if (cmd === 'hover') await page.hover(arg);
      else if (cmd === 'down') { await page.hover(arg); await page.mouse.down(); }
      else if (cmd === 'up') await page.mouse.up();
      else if (cmd === 'tap') { const [x, y] = arg.split(',').map(Number); await page.mouse.click(x, y); }
      else if (cmd === 'until-idle') await page.waitForFunction(() => window.__homingIdle ? window.__homingIdle() : (document.getElementById('spin').getAttribute('aria-label') === 'Spin' && !document.querySelector('.modal:not([hidden])')), null, { timeout: +(arg || 180000) });
      else if (cmd === 'eval') { const r = await page.evaluate(arg); console.log('eval', JSON.stringify(r)); }
      else if (cmd === 'until') await page.waitForFunction(arg, null, { timeout: 180000, polling: 40 });
      else if (cmd === 'freeze') await page.evaluate(() => { G.app.ticker.stop(); gsap.globalTimeline.pause(); G.app.render(); });
      else if (cmd === 'thaw') await page.evaluate(() => { gsap.globalTimeline.resume(); G.app.ticker.start(); });
    } catch (e) { logs.push(`[step ${s}] ${e.message.split('\n')[0]}`); }
  }
  const fps = await page.evaluate(() => (window.__homingFps || null)).catch(() => null);
  console.log(logs.length ? logs.slice(0, 40).join('\n') : 'no console errors', fps ? '\nfps ' + fps : '');
  await browser.close();
  srv.close();
})();

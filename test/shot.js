// usage: node test/shot.js <html file> <out png> [width] [height] [waitTitle]
const { chromium } = require('playwright');
(async () => {
  const [file, out, w = '1600', h = '1200'] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: +w, height: +h } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + require('path').resolve(file));
  await page.waitForFunction(() => document.title === 'ready', null, { timeout: 60000 }).catch(() => errors.push('timeout waiting for ready'));
  await page.screenshot({ path: out, fullPage: true });
  console.log(errors.join('\n') || 'no errors');
  await browser.close();
})();

// Audio stress: fire the game's sounds in overlapping bursts, the way a big win show and Race Day do, and report any
// errors the mixer swallowed (Tone throws when a voice is scheduled out of order). node test/audio_stress.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const outDir = path.resolve(__dirname, 'out/audio');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  const html = `<!doctype html><html><body><script src="file://${path.resolve(__dirname, '../node_modules/tone/build/Tone.js')}"></script>
<script>${fs.readFileSync(path.resolve(__dirname, '../src/game/audio.js'), 'utf8')}</script></body></html>`;
  const tmp = path.join(outDir, 'stress.html');
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  const res = await page.evaluate(async () => {
    await Audio2.init();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    let seen = 0;
    const check = (label) => { const e = Audio2.errors; if (e.n > seen) { log.push(label + ' -> ' + e.last); seen = e.n; } };
    const SHOW = ['tierUp', 'cannon', 'crowd', 'chant', 'firework', 'crackle', 'count', 'collect', 'kaching', 'coinIn', 'coinTick', 'fanfare', 'whoosh', 'stamp', 'stampMajor', 'flockPass', 'pop', 'click', 'tick', 'thunk', 'win', 'chain', 'land', 'flap', 'coo', 'dive', 'capsule', 'mult', 'ticketSlam', 'clockHit', 'gust', 'bell', 'roll', 'heart', 'raceHit', 'whistle', 'tag', 'step'];
    // each sound alone, then every pair in the same frame, then a random storm with the music running
    for (const n of SHOW) { Audio2.play(n, { n: 2, step: 3, tier: 1, m: 5, k: 0.5 }); await wait(30); check('solo ' + n); }
    await wait(1500);
    for (let i = 0; i < SHOW.length; i++) for (let j = 0; j < SHOW.length; j++) {
      Audio2.play(SHOW[i], { n: 1, step: 2, tier: 0 }); Audio2.play(SHOW[j], { n: 3, step: 4, tier: 2 });
      check('pair ' + SHOW[i] + ' + ' + SHOW[j]);
      if ((i * SHOW.length + j) % 40 === 0) await wait(60);
    }
    await wait(1500);
    for (const track of ['base', 'race', 'victory']) {
      Audio2.music(track); Audio2.intensity(5); Audio2.victoryLevel(3);
      await wait(600);
      const t0 = performance.now();
      while (performance.now() - t0 < 4000) {
        const k = 1 + Math.floor(Math.random() * 3);
        for (let q = 0; q < k; q++) Audio2.play(SHOW[Math.floor(Math.random() * SHOW.length)], { n: Math.floor(Math.random() * 6), step: 2 + Math.floor(Math.random() * 5), tier: Math.floor(Math.random() * 4), m: 10 });
        check('storm ' + track);
        await wait(20 + Math.random() * 120);
      }
      Audio2.slowmo(true); await wait(500); Audio2.slowmo(false); await wait(300); check('slowmo ' + track);
    }
    Audio2.music(null);
    await wait(800);
    check('storm end');
    return { errors: Audio2.errors.n, log: log.slice(0, 30), drops: Audio2.errors.drops };
  });
  console.log('storm', JSON.stringify(res, null, 1));
  // the real sequences in a fresh page: a storm that brutal leaves the headless audio clock seconds behind
  const page2 = await browser.newPage();
  page2.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page2.goto('file://' + tmp);
  const seq = await page2.evaluate(async () => {
    await Audio2.init();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(800);
    const a0 = Tone.now(), w0 = performance.now();
    const log = [];
    let seen = 0;
    const check = (label) => { const e = Audio2.errors; if (e.n > seen) { log.push(label + ' -> ' + e.last); seen = e.n; } };
    // the real sequences: the Race Day intro, a Race Day spin with fireworks overhead, and a full big win show
    const playAt = (ms, name, o) => setTimeout(() => Audio2.play(name, o || {}), ms);
    playAt(0, 'roll', { dur: 1.2 });
    playAt(560, 'raceHit'); playAt(560, 'crowd'); playAt(575, 'whistle');
    for (let i = 0; i < 4; i++) playAt(600 + i * 160, 'firework');
    playAt(900, 'stamp'); playAt(1700, 'stampMajor');
    setTimeout(() => Audio2.music('race'), 560);
    await wait(2600);
    for (let i = 0; i < 40; i++) {
      if (Math.random() < 0.12) Audio2.play('firework');
      Audio2.play(['click', 'thunk', 'tick', 'coinIn', 'kaching', 'win', 'pop', 'capsule', 'mult'][i % 9], { n: i % 6, step: 2 + (i % 4), m: 5 });
      await wait(90 + Math.random() * 120);
    }
    playAt(0, 'fanfare');
    for (let i = 0; i < 120; i++) playAt(40 + i * 33, 'count', { k: i / 120 });
    playAt(300, 'tierUp', { tier: 0 });
    playAt(1300, 'tierUp', { tier: 1 }); playAt(1300, 'cannon'); playAt(1302, 'cannon'); playAt(1300, 'crowd');
    playAt(2300, 'tierUp', { tier: 2 }); playAt(2300, 'flockPass'); playAt(2600, 'whoosh'); playAt(2820, 'whoosh');
    playAt(3300, 'tierUp', { tier: 3 }); playAt(3300, 'chant');
    for (let i = 0; i < 26; i++) if (Math.random() < 0.6) playAt(300 + i * 150, Math.random() < 0.5 ? 'firework' : 'crackle');
    playAt(4200, 'collect'); playAt(5200, 'kaching', { n: 4, big: true });
    setTimeout(() => { Audio2.victoryLevel(0); Audio2.music('victory'); }, 0);
    setTimeout(() => Audio2.victoryLevel(3), 3300);
    await wait(6500);
    Audio2.music(null);
    await wait(600);
    check('sequences');
    const clock = { audio: +(Tone.now() - a0).toFixed(2), wall: +((performance.now() - w0) / 1000).toFixed(2) };
    return { errors: Audio2.errors.n, log: log.slice(0, 30), drops: Audio2.errors.drops, clock };
  });
  console.log('sequences', JSON.stringify(seq, null, 1));
  await browser.close();
})();

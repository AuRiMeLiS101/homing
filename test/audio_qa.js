// Audio QA: render every sound and both music tracks through the real mix chain in headless Chromium,
// capture the master output, and write WAV files for loudness analysis.
// node test/audio_qa.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SFX = [
  ['click', 0.6], ['punch', 1.6], ['thunk', 0.8], ['thunkBig', 1.4], ['whoosh', 0.9], ['flap', 1.2], ['coo', 1.6], ['tag', 0.9], ['tick', 0.5],
  ['dive', 1.4], ['land', 0.9], ['capsule', 1.2], ['coin', 1.2], ['coinBig', 1.6], ['mult', 1.6], ['multBig', 2.2], ['step', 0.5], ['win', 1.4], ['pop', 0.8], ['stamp', 1.8], ['stampMajor', 2.2],
  ['whistle', 1.4], ['bell', 2.4], ['tram', 2.4], ['heart', 0.9], ['count', 0.4], ['crowd', 3.4], ['firework', 1.6], ['roll', 1.8],
  ['fanfare', 3.0], ['raceHit', 2.6], ['logo', 3.0], ['collect', 1.4], ['no', 0.8], ['riser', 2.6],
  ['ticketSlam', 1.0], ['coinTick', 0.3], ['coinIn', 0.6], ['kaching', 1.2], ['kachingBig', 1.6], ['chain2', 1.4], ['chain4', 1.6], ['chain6', 1.8],
  ['clockHit', 2.8], ['tierUp0', 2.2], ['tierUp3', 2.4], ['chant', 3.0], ['cannon', 0.9], ['crackle', 1.0], ['flockPass', 1.8], ['gust', 3.4]
];

(async () => {
  const outDir = path.resolve(__dirname, 'out/audio');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
  const html = `<!doctype html><html><body><script src="file://${path.resolve(__dirname, '../node_modules/tone/build/Tone.js')}"></script>
<script>${fs.readFileSync(path.resolve(__dirname, '../src/game/audio.js'), 'utf8')}</script></body></html>`;
  const tmp = path.join(outDir, 'qa.html');
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.evaluate(async () => {
    // hand Tone a native context so a ScriptProcessor tap can be attached to the master output
    Tone.setContext(new Tone.Context(new AudioContext({ sampleRate: 48000 })));
    await Audio2.init();
    const ctx = Tone.getContext().rawContext;
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    window.__rec = { on: false, L: [], R: [] };
    sp.onaudioprocess = (e) => {
      if (!window.__rec.on) return;
      window.__rec.L.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      window.__rec.R.push(new Float32Array(e.inputBuffer.getChannelData(1)));
    };
    Tone.getDestination().output.connect(sp);
    sp.connect(ctx.destination);
    window.__sr = ctx.sampleRate;
  });
  const sr = await page.evaluate(() => window.__sr);
  async function capture(name, seconds, startJs) {
    await page.evaluate(() => { window.__rec.L = []; window.__rec.R = []; window.__rec.on = true; });
    await page.evaluate(startJs);
    await page.waitForTimeout(seconds * 1000);
    const data = await page.evaluate(() => {
      window.__rec.on = false;
      const n = window.__rec.L.reduce((a, b) => a + b.length, 0);
      const out = new Float32Array(n * 2);
      let o = 0;
      for (let i = 0; i < window.__rec.L.length; i++) {
        const l = window.__rec.L[i], r = window.__rec.R[i];
        for (let j = 0; j < l.length; j++) { out[o++] = l[j]; out[o++] = r[j]; }
      }
      // base64 encode
      const u8 = new Uint8Array(out.buffer);
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    });
    const buf = Buffer.from(data, 'base64');
    // WAV float32 stereo
    const hdr = Buffer.alloc(44);
    hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + buf.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
    hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(3, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(sr, 24);
    hdr.writeUInt32LE(sr * 8, 28); hdr.writeUInt16LE(8, 32); hdr.writeUInt16LE(32, 34); hdr.write('data', 36); hdr.writeUInt32LE(buf.length, 40);
    fs.writeFileSync(path.join(outDir, name + '.wav'), Buffer.concat([hdr, buf]));
    console.log('captured', name, (buf.length / 8 / sr).toFixed(2) + 's');
  }
  // silence the ambience so each sound is measured on its own
  await page.evaluate(() => Audio2.ambience(0));
  await page.waitForTimeout(1500);
  for (const [name, dur] of SFX) {
    const special = { riser: `Audio2.play('riser', { dur: 2 })`, win: `Audio2.play('win', { step: 3 })`, count: `Audio2.play('count', { k: 0.5 })`,
      coin: `Audio2.play('coin', { n: 0 })`, coinBig: `Audio2.play('coin', { n: 5, big: true })`, mult: `Audio2.play('mult', { m: 2 })`, multBig: `Audio2.play('mult', { m: 25 })`,
      coinTick: `Audio2.play('coinTick', { k: 0.5 })`, coinIn: `Audio2.play('coinIn', { n: 2 })`, kaching: `Audio2.play('kaching', { n: 1 })`, kachingBig: `Audio2.play('kaching', { n: 4, big: true })`,
      chain2: `Audio2.play('chain', { step: 2 })`, chain4: `Audio2.play('chain', { step: 4 })`, chain6: `Audio2.play('chain', { step: 6 })`,
      tierUp0: `Audio2.play('tierUp', { tier: 0 })`, tierUp3: `Audio2.play('tierUp', { tier: 3 })`,
      gust: `Audio2.ambience(0.35); Audio2.play('gust')` };
    const js = special[name] || `Audio2.play('${name}')`;
    await capture('sfx_' + name, dur, js);
    await page.waitForTimeout(250);
  }
  await page.evaluate(() => Audio2.ambience(0));
  await capture('amb', 6, `Audio2.ambience(0.35)`);
  await capture('amb_rain', 6, `Audio2.rain(true)`);
  await page.evaluate(() => Audio2.rain(false));
  await capture('amb_crowd', 5, `Audio2.crowdLoop(true)`);
  await page.evaluate(() => Audio2.crowdLoop(false));
  await page.waitForTimeout(1500);
  await page.evaluate(() => Audio2.ambience(0));
  await capture('intro_accordion', 5, `Audio2.accordionIntro()`);
  await capture('music_base', 20, `Audio2.music('base')`);
  await page.evaluate(() => Audio2.music(null));
  await page.waitForTimeout(800);
  await capture('music_race', 14, `Audio2.music('race')`);
  await capture('music_race_chain4', 10, `Audio2.intensity(4)`);
  await page.evaluate(() => { Audio2.intensity(0); Audio2.music(null); });
  await page.waitForTimeout(800);
  await capture('music_base_chain5', 12, `Audio2.music('base'); Audio2.intensity(5)`);
  await page.evaluate(() => { Audio2.intensity(0); });
  // a slow motion beat in the middle of the band, then the victory band cutting in on the slam
  await capture('mix_slowmo', 4, `Audio2.slowmo(true); setTimeout(() => Audio2.slowmo(false), 800); setTimeout(() => { Audio2.music('victory'); Audio2.play('tierUp', { tier: 0 }); }, 850)`);
  await page.evaluate(() => Audio2.music(null));
  await page.waitForTimeout(800);
  await capture('music_victory0', 10, `Audio2.victoryLevel(0); Audio2.music('victory')`);
  await capture('music_victory3', 10, `Audio2.victoryLevel(3)`);
  await page.evaluate(() => { Audio2.victoryLevel(0); Audio2.music(null); });
  await page.waitForTimeout(800);
  // a busy moment: race music with a stamp, crowd and fireworks on top
  await capture('mix_race_moment', 4, `Audio2.play('raceHit'); Audio2.play('crowd'); setTimeout(() => Audio2.play('stampMajor'), 900); setTimeout(() => Audio2.play('firework'), 400); setTimeout(() => Audio2.play('coin'), 1500); setTimeout(() => Audio2.play('mult'), 2100);`);
  await page.evaluate(() => Audio2.music(null));
  await browser.close();
})();

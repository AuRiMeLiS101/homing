/* Cinematic intro: dusk comes up, the loft bursts open, the flock writes the title, Gennady arrives. */
const Intro = (function () {
  let skip = false;
  const flyers = [];

  function letterPoints(word, maxW, maxH, n) {
    const c = document.createElement('canvas');
    const W = 900, H = 260;
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#000';
    x.font = '900 230px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(word, W / 2, H / 2 + 10);
    const d = x.getImageData(0, 0, W, H).data;
    const pts = [];
    const step = 13;
    for (let yy = 0; yy < H; yy += step) for (let xx = 0; xx < W; xx += step) if (d[(yy * W + xx) * 4 + 3] > 128) pts.push([xx, yy]);
    // thin to n points
    const out = [];
    const k = Math.max(1, pts.length / n);
    for (let i = 0; i < pts.length && out.length < n; i += k) out.push(pts[Math.floor(i)]);
    const sc = Math.min(maxW / W, maxH / H);
    return out.map(([px, py]) => ({ x: (px - W / 2) * sc, y: (py - H / 2) * sc }));
  }

  function wait(ms) { return new Promise((r) => { const t = setTimeout(r, skip ? 0 : ms); if (skip) clearTimeout(t); }); }

  async function play(onSkipReady) {
    skip = false;
    const onTap = () => { skip = true; };
    setTimeout(() => window.addEventListener('pointerdown', onTap), 400);
    const root = G.layers.root;
    World.snapNight();
    Audio2.ambience(0.55);
    Audio2.accordionIntro();
    // camera starts tilted up at the sky
    const cam = { s: 1.35, y: G.H * 0.38 };
    const applyCam = () => { G.layers.cam.scale.set(cam.s); G.layers.cam.x = (G.W - G.W * cam.s) / 2; G.layers.cam.y = cam.y + (G.H - G.H * cam.s) * 0.5; };
    applyCam();
    Gennady.R.root.visible = false;
    Loft.C.sym.visible = false;
    gsap.to(cam, { s: 1, y: 0, duration: 4.2, ease: 'power2.inOut', onUpdate: applyCam });
    setTimeout(() => World.setMode('base', 3.2), 300);
    await wait(1500);
    Audio2.play('tram');
    await wait(1500);
    if (!skip) {
      // the loft bursts open
      const b = Loft.bounds();
      const ox = b.x + b.w / 2, oy = b.grid.y + b.grid.h * 0.4;
      FX.impact(ox, oy, 0.7);
      FX.feathers(ox, oy, 40, { scale: G.unit + 0.4, power: 1.5 });
      Audio2.play('flap'); setTimeout(() => Audio2.play('flap'), 120); setTimeout(() => Audio2.play('flap'), 260);
      Audio2.play('coo', { pitch: 1 }); setTimeout(() => Audio2.play('coo', { pitch: 3 }), 400);
      const pts = letterPoints('HOMING', G.W * (G.portrait ? 0.92 : 0.62), G.playH * 0.3, 96);
      const cx = G.W / 2, cy = G.portrait ? G.holdArea.y + G.holdArea.h * 0.6 : G.playH * 0.24;
      const schemes = ['white', 'grey', 'white', 'red', 'dark', 'pied'];
      pts.forEach((p, i) => {
        const s = new PIXI.AnimatedSprite(G.tex.fly[schemes[i % schemes.length]]);
        s.anchor.set(0.556, 0.537); s.animationSpeed = U.rand(0.42, 0.62); s.play(); s.gotoAndPlay(U.randInt(0, 9));
        const sc = Math.max(0.16, G.unit * 0.24) * 0.73 / G.tex.birdS;
        s.scale.set(sc * 0.4);
        s.x = ox + U.rand(-b.grid.w * 0.4, b.grid.w * 0.4); s.y = oy + U.rand(-b.grid.h * 0.3, b.grid.h * 0.3);
        G.layers.flyers.addChild(s); flyers.push(s);
        const tx = cx + p.x, ty = cy + p.y;
        const o = { x: s.x, y: s.y };
        gsap.to(s.scale, { x: (tx > s.x ? 1 : -1) * sc, y: sc, duration: 0.6, delay: i * 0.008 });
        s._tw = gsap.to(o, {
          motionPath: { path: [{ x: s.x, y: s.y }, { x: s.x + U.rand(-300, 300) * G.unit, y: s.y - U.rand(150, 380) * G.unit }, { x: tx, y: ty }], curviness: 1.5 },
          duration: U.rand(1.3, 1.8), delay: i * 0.012, ease: 'power2.inOut',
          onUpdate: () => { if (!s.destroyed) { s.x = o.x; s.y = o.y; } },
          onComplete: () => { s._hx = tx; s._hy = ty; s._ph = Math.random() * 6; }
        });
      });
    }
    await wait(2100);
    // stamp the title
    const lx = G.W / 2, ly = G.portrait ? G.holdArea.y + G.holdArea.h * 0.6 : G.playH * 0.24;
    if (!skip) {
      Audio2.play('logo');
      FX.impact(lx, ly, 1.8);
      FX.flash(COL.PAPER, 0.55, 0.35);
      FX.confetti(lx, ly, 70, null, 1.3);
      // scatter the flock
      flyers.forEach((s) => {
        s._hx = null;
        if (s._tw) s._tw.kill();
        gsap.killTweensOf(s.scale);
        const a = Math.atan2(s.y - ly, s.x - lx) + U.rand(-0.4, 0.4), d = Math.max(G.W, G.H) * 0.9;
        const o = { x: s.x, y: s.y };
        s.scale.x = Math.cos(a) >= 0 ? Math.abs(s.scale.x) : -Math.abs(s.scale.x);
        gsap.to(o, { x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d - 200, duration: U.rand(0.9, 1.5), ease: 'power2.in', onUpdate: () => { if (!s.destroyed) { s.x = o.x; s.y = o.y; } }, onComplete: () => { if (!s.destroyed) s.destroy(); } });
      });
      flyers.length = 0;
      await FX.stamp('HOMING', lx, ly, { size: Math.min(260, G.W * (G.portrait ? 0.3 : 0.16)), color: '#F6ECD8', shadow: '#FF6A2B', banner: null, hold: 1.0, power: 1.2, impact: false });
    }
    flyers.forEach((s) => { if (s._tw) s._tw.kill(); if (!s.destroyed) s.destroy(); }); flyers.length = 0;
    gsap.killTweensOf(cam); cam.s = 1; cam.y = 0; applyCam();
    if (palNotBase()) World.setMode('base', 0.3);
    // Gennady arrives
    const R = Gennady.R.root;
    R.visible = true;
    if (!skip) {
      await Gennady.walkIn(G.W + 420 * Gennady.R.scale, 1.35);
      Gennady.act('whistle'); Audio2.play('whistle'); await wait(700);
    }
    window.removeEventListener('pointerdown', onTap);
    Loft.C.sym.visible = true;
    void onSkipReady;
  }

  function palNotBase() { return true; }

  function update() {
    for (const s of flyers) {
      if (s._hx != null) { s.x = s._hx + Math.sin(G.time * 3 + s._ph) * 4; s.y = s._hy + Math.cos(G.time * 4 + s._ph) * 3; }
    }
  }

  return { play, update };
})();

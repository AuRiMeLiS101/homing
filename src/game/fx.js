/* Homing FX: particles, camera shake, print-style impacts, stamps, wipes. */
const FX = (function () {
  const pool = [];
  const live = [];
  let layerFront, layerBack, root;
  let shakeAmp = 0, shakeDecay = 0, shakeT = 0;
  const filters = { rgb: null, shocks: [], zoom: null, adjust: null };
  let rgbAmt = 0;
  let flashG = null;
  const sunbursts = [];
  let speedLines = null, speedT = 0;

  function init(rootC, front, back) {
    root = rootC; layerFront = front; layerBack = back;
    flashG = new PIXI.Graphics();
    flashG.alpha = 0;
    (G.layers.overlay || front.parent).addChild(flashG);
    try {
      filters.rgb = new PIXI.filters.RGBSplitFilter({ red: { x: 0, y: 0 }, green: { x: 0, y: 0 }, blue: { x: 0, y: 0 } });
    } catch (e) { filters.rgb = null; }
  }

  function getSprite(tex) {
    const s = pool.pop() || new PIXI.Sprite(tex);
    s.texture = tex; s.anchor.set(0.5); s.alpha = 1; s.rotation = 0; s.scale.set(1); s.tint = 0xFFFFFF; s.blendMode = 'normal'; s.visible = true;
    return s;
  }

  // Particle budget: weaker devices get fewer. Frame time decides; important bursts pass o.must.
  function budget() {
    const ft = G.ftEma || 16;
    return ft > 45 ? 170 : ft > 30 ? 280 : 480;
  }

  // o: { tex, x, y, vx, vy, ax, ay, drag, life, s0, s1, a0, a1, rot, vr, tint, sway, swayF, back, blend, layer, must }
  function emit(o) {
    if (o.layer && o.layer.destroyed) return null;
    if (live.length >= budget()) {
      if (!o.must) return null;
      const old = live.shift(); old.s.parent && old.s.parent.removeChild(old.s); pool.push(old.s);
    }
    const s = getSprite(o.tex);
    s.x = o.x; s.y = o.y; s.tint = o.tint == null ? 0xFFFFFF : o.tint;
    if (o.blend) s.blendMode = o.blend;
    s.rotation = o.rot || 0;
    (o.layer || (o.back ? layerBack : layerFront)).addChild(s);
    const p = { s, vx: o.vx || 0, vy: o.vy || 0, ax: o.ax || 0, ay: o.ay || 0, drag: o.drag == null ? 1 : o.drag, life: o.life || 1, t: 0,
      s0: o.s0 == null ? 1 : o.s0, s1: o.s1 == null ? (o.s0 == null ? 1 : o.s0) : o.s1, a0: o.a0 == null ? 1 : o.a0, a1: o.a1 == null ? 0 : o.a1,
      vr: o.vr || 0, sway: o.sway || 0, swayF: o.swayF || 3, ph: Math.random() * 6.28, fadeIn: o.fadeIn || 0, kx: o.kx || 1, ky: o.ky || 1, spin: o.spin || 0 };
    s.scale.set(p.s0 * p.kx, p.s0 * p.ky); s.alpha = p.a0;
    live.push(p);
    return p;
  }

  function update(dt) {
    const sec = dt / 1000;
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      p.t += sec;
      const k = p.t / p.life;
      if (k >= 1) { p.s.parent && p.s.parent.removeChild(p.s); pool.push(p.s); live.splice(i, 1); continue; }
      p.vx += p.ax * sec; p.vy += p.ay * sec;
      if (p.drag !== 1) { const d = Math.pow(p.drag, sec * 60); p.vx *= d; p.vy *= d; }
      p.s.x += (p.vx + (p.sway ? Math.sin(p.t * p.swayF + p.ph) * p.sway : 0)) * sec;
      p.s.y += p.vy * sec;
      p.s.rotation += p.vr * sec;
      const sc = p.s0 + (p.s1 - p.s0) * k;
      // spinning coins flip by squashing their width
      p.s.scale.set(sc * p.kx * (p.spin ? Math.max(0.12, Math.abs(Math.cos(p.t * p.spin + p.ph))) : 1), sc * p.ky);
      let a = p.a0 + (p.a1 - p.a0) * k;
      if (p.fadeIn && p.t < p.fadeIn) a *= p.t / p.fadeIn;
      p.s.alpha = a;
    }
    // shake
    if (shakeAmp > 0.2 && !G.reduced) {
      shakeT += sec;
      root.x = (Math.sin(shakeT * 91) + Math.sin(shakeT * 37)) * 0.5 * shakeAmp;
      root.y = (Math.cos(shakeT * 83) + Math.sin(shakeT * 29)) * 0.5 * shakeAmp;
      shakeAmp *= Math.pow(shakeDecay, sec * 60);
    } else if (root.x || root.y) { root.x = 0; root.y = 0; shakeAmp = 0; }
    // rgb split decay
    if (filters.rgb) {
      if (rgbAmt > 0.15) {
        const a = rgbAmt;
        filters.rgb.red = { x: -a, y: a * 0.3 }; filters.rgb.blue = { x: a, y: -a * 0.3 }; filters.rgb.green = { x: 0, y: 0 };
        rgbAmt *= Math.pow(0.86, sec * 60);
      } else rgbAmt = 0;
    }
    // shockwaves
    for (let i = filters.shocks.length - 1; i >= 0; i--) {
      const f = filters.shocks[i];
      f.time += sec * f._spd;
      if (f.time > f._end) filters.shocks.splice(i, 1);
    }
    for (const sb of sunbursts) { sb.g.rotation += sb.speed * sec; }
    if (speedLines && speedLines.visible) { speedT += sec; if (speedT > 0.06) { speedT = 0; drawSpeedLines(); } }
    // camera: zoom punches and rolls around the middle of the play area
    if (G.camReady && G.layers.cam) {
      const cam = G.layers.cam, cx = G.W / 2, cy = (G.playH || G.H) * 0.46;
      cam.pivot.set(cx, cy); cam.position.set(cx + CAM.x, cy + CAM.y);
      cam.scale.set(CAM.z * CAM.zp); cam.rotation = CAM.r;
    }
    applyFilters();
  }

  // forget every particle living in a layer that is about to be destroyed
  function dropLayer(layer) {
    for (let i = live.length - 1; i >= 0; i--) {
      const p = live[i];
      if (p.s.parent === layer) { layer.removeChild(p.s); pool.push(p.s); live.splice(i, 1); }
    }
  }

  // ---------- camera ----------
  const CAM = { z: 1, zp: 1, r: 0, x: 0, y: 0 };
  // a quick zoom punch that springs back
  function punch(p, dur) {
    if (G.reduced) return;
    gsap.killTweensOf(CAM, 'zp');
    gsap.fromTo(CAM, { zp: 1 + p }, { zp: 1, duration: dur || 0.42, ease: 'power3.out' });
  }
  // hold a slow push in (big win show), roll a little, then release
  function camTo(z, r, dur, ease) {
    if (G.reduced) return Promise.resolve();
    gsap.killTweensOf(CAM, 'z,r');
    return new Promise((res) => gsap.to(CAM, { z, r: r || 0, duration: dur || 0.6, ease: ease || 'power2.inOut', onComplete: res, onInterrupt: res }));
  }
  // the reset always wins over a move still in flight
  function camReset(dur) { gsap.killTweensOf(CAM, 'z,r,x,y'); gsap.to(CAM, { z: 1, r: 0, x: 0, y: 0, duration: dur || 0.5, ease: 'power2.out' }); }

  // ---------- slow motion ----------
  // The main ticker scales game time by G.timeScale; gsap follows it. A beat eases into slow motion, holds, and
  // snaps back. Runs on real time, so awaiting it is a fixed pause in the flow.
  const SLOW = { on: false, t: 0, inT: 0.12, hold: 0.5, outT: 0.12, k: 0.2 };
  function slowmo(hold, k) {
    if (G.reduced) return U.waitReal((hold || 0.5) * 600);
    Object.assign(SLOW, { on: true, t: 0, hold: hold || 0.5, k: k || 0.2 });
    return U.waitReal((SLOW.inT + SLOW.hold) * 1000);
  }
  function timeTick(realMs) {
    if (!SLOW.on) { if (G.timeScale !== 1) { G.timeScale = 1; gsap.globalTimeline.timeScale(1); } return; }
    SLOW.t += realMs / 1000;
    const t = SLOW.t, a = SLOW.inT, b = a + SLOW.hold, c = b + SLOW.outT;
    let s;
    if (t < a) s = U.lerp(1, SLOW.k, t / a);
    else if (t < b) s = SLOW.k;
    else if (t < c) s = U.lerp(SLOW.k, 1, (t - b) / SLOW.outT);
    else { s = 1; SLOW.on = false; }
    G.timeScale = s; gsap.globalTimeline.timeScale(s);
  }

  // ---------- coins ----------
  let coinsOut = 0;
  // A coin spins along an arc to the target, leaving a glitter trail. Resolves on arrival.
  function coinFly(x0, y0, x1, y1, o) {
    o = o || {};
    const layer = o.layer || G.layers.hud;
    const s = new PIXI.Sprite(G.tex.coin); s.anchor.set(0.5);
    coinsOut++;
    const k0 = (o.size || 46) * Math.max(0.6, G.unit) / 110;
    s.x = x0; s.y = y0; s.scale.set(k0 * 0.55);
    layer.addChild(s);
    const side = o.side || (Math.random() < 0.5 ? -1 : 1);
    const cx = (x0 + x1) / 2 + side * U.rand(60, 200) * G.unit, cy = Math.min(y0, y1) - U.rand(80, 220) * G.unit;
    const st = { t: 0 }, spin = U.rand(9, 15), ph = Math.random() * 6;
    let lastX = x0, lastY = y0, acc = 0;
    return new Promise((res) => {
      gsap.to(st, {
        t: 1, duration: o.dur || U.rand(0.5, 0.7), delay: o.delay || 0, ease: 'power1.in',
        onStart: () => { if (o.onStart) o.onStart(); },
        onUpdate: () => {
          const t = st.t, u = 1 - t;
          const x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
          s.x = x; s.y = y;
          // spin: the width squashes through the flip, the edge frame shows when it is thin
          const c = Math.cos(t * spin + ph), w = Math.abs(c);
          s.texture = w < 0.22 ? G.tex.coinEdge : G.tex.coin;
          // pops out of the box, then shrinks a touch as it drops into the ticket
          const grow = t < 0.12 ? 0.55 + (t / 0.12) * 0.55 : 1.1 - (t - 0.12) * 0.4;
          s.scale.set(k0 * Math.max(0.3, w < 0.22 ? 1 : w) * grow, k0 * grow);
          s.rotation = (x - lastX) * 0.004;
          acc += Math.hypot(x - lastX, y - lastY);
          if (acc > 14 * G.unit + 6) {
            acc = 0;
            emit({ tex: G.tex.sparkle, x: x + U.rand(-6, 6), y: y + U.rand(-6, 6), vx: U.rand(-30, 30), vy: U.rand(-30, 30), life: U.rand(0.25, 0.45), s0: U.rand(0.16, 0.3) * Math.max(0.6, G.unit), s1: 0, a0: 1, a1: 0, tint: U.pick([COL.YELLOW, COL.PAPER, COL.ORANGE]), blend: 'add', layer });
          }
          lastX = x; lastY = y;
        },
        onComplete: () => {
          s.destroy(); coinsOut--;
          sparks(x1, y1, 4, COL.YELLOW, 0.45);
          if (o.onArrive) o.onArrive();
          res();
        }
      });
    });
  }

  // ---------- celebration ----------
  // a confetti cannon fired from (x, y) toward angle a
  function cannon(x, y, a, n, power, layer) {
    power = power || 1;
    layer = layer || G.layers.overlay;
    const colors = [COL.PINK, COL.YELLOW, COL.TEALL, COL.ORANGE, COL.PAPER, COL.VIOLETL];
    for (let i = 0; i < n; i++) {
      const aa = a + U.rand(-0.32, 0.32), sp = U.rand(700, 1500) * power * Math.max(0.7, G.unit);
      emit({ tex: G.tex.white, x, y, vx: Math.cos(aa) * sp, vy: Math.sin(aa) * sp, ay: 1100, drag: 0.93, life: U.rand(1.8, 3.2), s0: Math.max(0.7, G.unit), a0: 1, a1: 0.7,
        rot: Math.random() * 6, vr: U.rand(-12, 12), tint: U.pick(colors), sway: U.rand(40, 90), swayF: U.rand(3, 7), kx: U.rand(2.4, 3.6), ky: U.rand(4.4, 6.4), layer, must: i < 12 });
    }
    for (let i = 0; i < 6; i++) emit({ tex: G.tex.soft, x, y, vx: Math.cos(a) * U.rand(80, 260), vy: Math.sin(a) * U.rand(80, 260), drag: 0.9, life: U.rand(0.6, 1.1), s0: 0.3, s1: 1.2, a0: 0.5, a1: 0, tint: 0xF6ECD8, layer });
    Audio2.play('cannon');
  }
  // a rocket climbs with a spark trail, then bursts: ring, palm or crackle
  function rocket(x, y, color, kind, layer) {
    const x0 = x + U.rand(-80, 80) * G.unit, y0 = (G.playH || G.H) + 20;
    const st = { t: 0 };
    let n = 0;
    gsap.to(st, {
      t: 1, duration: U.rand(0.55, 0.8), ease: 'power2.out',
      onUpdate: () => {
        if (layer && layer.destroyed) return;
        const px = U.lerp(x0, x, st.t), py = U.lerp(y0, y, st.t);
        if (n++ % 2 === 0) emit({ tex: G.tex.dot, x: px, y: py, vx: U.rand(-20, 20), vy: U.rand(20, 80), life: U.rand(0.3, 0.5), s0: 0.14, s1: 0.02, a0: 0.9, a1: 0, tint: 0xFFE7A8, blend: 'add', layer });
      },
      onComplete: () => { if (layer && layer.destroyed) return; burst(x, y, color, kind, layer); Audio2.play('firework'); }
    });
  }
  function burst(x, y, color, kind, layer) {
    if (layer && layer.destroyed) return;
    const c2 = U.pick([COL.PAPER, COL.YELLOW, COL.PINK, COL.TEALL]);
    const n = kind === 'ring' ? 40 : kind === 'palm' ? 26 : 50;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + U.rand(-0.04, 0.04);
      const sp = kind === 'ring' ? 330 : U.rand(160, 400);
      const big = kind === 'palm';
      emit({ tex: G.tex.dot, x, y, vx: Math.cos(a) * sp * Math.max(0.7, G.unit), vy: Math.sin(a) * sp * Math.max(0.7, G.unit), ay: big ? 260 : 140, drag: big ? 0.95 : 0.93,
        life: U.rand(1.1, big ? 2.2 : 1.6), s0: big ? 0.34 : U.rand(0.18, 0.3), s1: 0.04, a0: 1, a1: 0, tint: i % 3 ? color : c2, blend: 'add', layer });
    }
    if (kind === 'crackle') setTimeout(() => { if (layer && layer.destroyed) return; for (let i = 0; i < 18; i++) emit({ tex: G.tex.sparkle, x: x + U.rand(-140, 140) * G.unit, y: y + U.rand(-120, 140) * G.unit, life: U.rand(0.15, 0.35), s0: U.rand(0.2, 0.4), s1: 0, a0: 1, a1: 0, tint: 0xFFFFFF, blend: 'add', layer }); Audio2.play('crackle'); }, 650);
    emit({ tex: G.tex.soft, x, y, life: 0.5, s0: 0.5, s1: 2.6, a0: 0.85, a1: 0, tint: color, blend: 'add', layer });
  }

  function applyFilters() {
    const list = [];
    if (filters.rgb && rgbAmt > 0.15) list.push(filters.rgb);
    for (const f of filters.shocks) list.push(f);
    if (filters.zoom && filters.zoom._on) list.push(filters.zoom);
    if (filters.adjust && filters.adjust._on) list.push(filters.adjust);
    if (list.length) { root.filters = list; root.filterArea = G.app.screen; }
    else if (root.filters) { root.filters = null; }
  }

  function shake(power, decay) {
    if (G.reduced) return;
    shakeAmp = Math.max(shakeAmp, power); shakeDecay = decay || 0.88;
  }
  function rgb(power) { if (G.reduced || !filters.rgb) return; rgbAmt = Math.max(rgbAmt, power); }
  function shock(x, y, opts) {
    if (G.reduced) return;
    opts = opts || {};
    try {
      const f = new PIXI.filters.ShockwaveFilter({ center: { x, y }, amplitude: opts.amp || 26, wavelength: opts.wave || 180, speed: opts.speed || 900, brightness: 1.08, radius: opts.radius || -1, time: 0 });
      f._spd = 1; f._end = opts.dur || 1.0;
      filters.shocks.push(f);
      if (filters.shocks.length > 3) filters.shocks.shift();
    } catch (e) { /* filter unavailable */ }
  }
  function zoomBlur(x, y, strength, dur) {
    if (G.reduced) return Promise.resolve();
    try {
      if (!filters.zoom) filters.zoom = new PIXI.filters.ZoomBlurFilter({ strength: 0, center: { x, y }, innerRadius: 60 });
      const z = filters.zoom; z.center = { x, y }; z._on = true; z.strength = strength;
      return new Promise((res) => gsap.to(z, { strength: 0, duration: dur || 0.8, ease: 'power2.out', onComplete: () => { z._on = false; res(); } }));
    } catch (e) { return Promise.resolve(); }
  }
  function adjust(on, opts) {
    try {
      if (!filters.adjust) filters.adjust = new PIXI.filters.AdjustmentFilter({ saturation: 1, contrast: 1, brightness: 1 });
      const f = filters.adjust;
      if (on) { f._on = true; Object.assign(f, opts || {}); } else { f._on = false; }
    } catch (e) { /* ignore */ }
  }
  function flash(color, alpha, dur) {
    if (G.reduced) alpha = Math.min(alpha, 0.25);
    flashG.clear().rect(-50, -50, G.W + 100, G.H + 100).fill({ color: color == null ? COL.PAPER : color });
    gsap.killTweensOf(flashG);
    flashG.alpha = alpha;
    gsap.to(flashG, { alpha: 0, duration: dur || 0.25, ease: 'power2.out' });
  }
  function impact(x, y, power) {
    power = power || 1;
    shake(14 * power, 0.86);
    rgb(Math.min(6, 5 * power));
    if (power >= 1) shock(x, y, { amp: 22 * power, wave: 200, dur: 0.9 });
    flash(COL.PAPER, 0.18 * power, 0.2);
  }

  // ---- emitters ----
  function feathers(x, y, n, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(120, 420) * (opts.power || 1);
      emit({ tex: U.pick(G.tex.feather), x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, ay: 220, drag: 0.94, life: U.rand(1.2, 2.4),
        s0: U.rand(0.35, 0.7) * (opts.scale || 1), a0: 1, a1: 0, rot: Math.random() * 6, vr: U.rand(-4, 4), sway: U.rand(40, 90), swayF: U.rand(2, 5), back: opts.back, layer: opts.layer });
    }
  }
  function splat(x, y, color, scale, back) {
    emit({ tex: U.pick(G.tex.splat), x, y, tint: color, life: 0.9, s0: 0.2 * scale, s1: 1.1 * scale, a0: 0.95, a1: 0, rot: Math.random() * 6, back });
  }
  function confetti(x, y, n, colors, power, layer) {
    colors = colors || [COL.PINK, COL.YELLOW, COL.TEAL, COL.ORANGE, COL.PAPER, COL.VIOLETL];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + U.rand(-1.1, 1.1), sp = U.rand(300, 900) * (power || 1);
      emit({ tex: G.tex.white, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 900, drag: 0.95, life: U.rand(1.5, 3), s0: G.unit || 1, a0: 1, a1: 0.6,
        rot: Math.random() * 6, vr: U.rand(-10, 10), tint: U.pick(colors), sway: U.rand(30, 80), swayF: U.rand(3, 7), kx: U.rand(2.2, 3.4), ky: U.rand(4, 6), layer });
    }
  }
  function sparks(x, y, n, color, power, layer) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(200, 700) * (power || 1);
      emit({ tex: G.tex.sparkle, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 300, drag: 0.9, life: U.rand(0.4, 0.9), s0: U.rand(0.25, 0.6), s1: 0, a0: 1, a1: 0.6,
        tint: color == null ? COL.YELLOW : color, rot: Math.random() * 6, vr: U.rand(-6, 6), blend: 'add', layer });
    }
  }
  function dust(x, y, n) {
    for (let i = 0; i < (n || 8); i++) {
      emit({ tex: G.tex.soft, x: x + U.rand(-30, 30), y: y + U.rand(-6, 6), vx: U.rand(-90, 90), vy: U.rand(-60, -10), drag: 0.9, life: U.rand(0.5, 0.9), s0: 0.2, s1: 0.6, a0: 0.55, a1: 0, tint: 0xE8D8B8 });
    }
  }
  function steam(x, y, layer) {
    const p = emit({ tex: G.tex.soft, x: x + U.rand(-6, 6), y, vx: U.rand(-10, 20), vy: U.rand(-60, -40), life: U.rand(2, 3), s0: 0.15, s1: 0.7, a0: 0.0, a1: 0, fadeIn: 0.6, tint: 0xF6ECD8, back: true, layer });
    if (p) p.a0 = 0.35;
  }
  function firework(x, y, color, n, back) {
    n = n || 46;
    const c2 = U.pick([COL.PAPER, COL.YELLOW, COL.PINK, COL.TEALL]);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + U.rand(-0.05, 0.05), sp = U.rand(220, 380);
      emit({ tex: G.tex.dot, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 140, drag: 0.93, life: U.rand(1.1, 1.6), s0: U.rand(0.18, 0.3), s1: 0.05, a0: 1, a1: 0, tint: i % 3 ? color : c2, blend: 'add', back });
    }
    emit({ tex: G.tex.soft, x, y, life: 0.5, s0: 0.5, s1: 2.4, a0: 0.8, a1: 0, tint: color, blend: 'add', back });
  }
  function coinRain(n, tex, layer) {
    for (let i = 0; i < n; i++) {
      emit({ tex: tex || G.tex.coin, x: U.rand(0, G.W), y: U.rand(-200, -40), vx: U.rand(-60, 60), vy: U.rand(200, 500), ay: 600, life: U.rand(1.8, 2.6), s0: U.rand(0.32, 0.5) * Math.max(0.6, G.unit), a0: 1, a1: 1, rot: U.rand(-0.4, 0.4), vr: U.rand(-2, 2), spin: U.rand(6, 12), layer });
    }
  }
  // coins burst up out of a point and tumble down
  function coinFountain(x, y, n, power, layer) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + U.rand(-0.6, 0.6), sp = U.rand(600, 1150) * (power || 1) * Math.max(0.7, G.unit);
      emit({ tex: G.tex.coin, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 1500, life: U.rand(1.2, 1.8), s0: U.rand(0.34, 0.5) * Math.max(0.6, G.unit), a0: 1, a1: 0.9, rot: U.rand(-0.5, 0.5), vr: U.rand(-3, 3), spin: U.rand(8, 14), layer, must: i < 8 });
    }
  }

  // ---- stamps ----
  function stamp(str, x, y, opts) {
    opts = opts || {};
    const layer = opts.layer || G.layers.hud;
    const c = new PIXI.Container();
    c.x = x; c.y = y;
    let banner = null;
    if (opts.banner) {
      banner = sprite(opts.banner);
      c.addChild(banner);
    }
    const t = stampText(str, opts.size || 120, opts.color || '#F6ECD8', { shadowColor: opts.shadow || '#1B1622', letterSpacing: opts.ls || 2 });
    c.addChild(t);
    if (banner) { banner.width = t.width + 80; banner.height = t.height * 1.05; }
    c.rotation = opts.rot == null ? U.rand(-0.08, 0.08) : opts.rot;
    layer.addChild(c);
    c.scale.set(opts.from || 2.6); c.alpha = 0;
    const hold = opts.hold == null ? 0.7 : opts.hold;
    return new Promise((res) => {
      const tl = gsap.timeline({ onComplete: () => { if (!opts.keep) c.destroy({ children: true }); res(c); } });
      tl.to(c, { alpha: 1, duration: 0.06 });
      tl.to(c.scale, { x: opts.scale || 1, y: opts.scale || 1, duration: U.T(0.32), ease: 'back.out(2.2)' }, 0);
      tl.add(() => { if (opts.impact !== false) impact(x, y, opts.power || 0.6); if (opts.splat) splat(x, y, opts.splat, (opts.size || 120) / 90, false); if (opts.sound) Audio2.play(opts.sound); }, U.T(0.12));
      if (!opts.keep) {
        tl.to(c, { alpha: 0, duration: U.T(0.25), ease: 'power1.in' }, '+=' + U.T(hold));
        tl.to(c.scale, { x: (opts.scale || 1) * 1.15, y: (opts.scale || 1) * 1.15, duration: U.T(0.25) }, '<');
      }
    });
  }
  // small onomatopoeia pop
  function pop(str, x, y, color, size) {
    const t = stampText(str, size || 44 * G.unit, color || '#FFD23F', {});
    t.x = x; t.y = y; t.rotation = U.rand(-0.35, 0.35);
    G.layers.hud.addChild(t);
    t.scale.set(0.2);
    gsap.timeline({ onComplete: () => t.destroy() })
      .to(t.scale, { x: 1, y: 1, duration: 0.22, ease: 'back.out(3)' })
      .to(t, { y: y - 40 * G.unit, alpha: 0, duration: 0.5, ease: 'power1.in' }, '+=0.25');
  }

  // rotating print sunburst
  function sunburst(parent, x, y, r, colors, n, speed) {
    const g = new PIXI.Graphics();
    n = n || 24;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 0.5) / n) * Math.PI * 2;
      g.poly([0, 0, Math.cos(a0) * r, Math.sin(a0) * r, Math.cos(a1) * r, Math.sin(a1) * r]).fill({ color: colors[i % colors.length] });
    }
    g.x = x; g.y = y;
    parent.addChild(g);
    const sb = { g, speed: speed == null ? 0.25 : speed };
    sunbursts.push(sb);
    sb.destroy = () => { const i = sunbursts.indexOf(sb); if (i >= 0) sunbursts.splice(i, 1); g.destroy(); };
    return sb;
  }

  function drawSpeedLines() {
    const g = speedLines; g.clear();
    const cx = G.W / 2, cy = G.H * 0.45, R = Math.hypot(G.W, G.H) * 0.6;
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, r0 = R * U.rand(0.45, 0.7), w = U.rand(0.004, 0.012);
      g.poly([cx + Math.cos(a) * R, cy + Math.sin(a) * R, cx + Math.cos(a + w) * r0, cy + Math.sin(a + w) * r0, cx + Math.cos(a + w * 2) * R, cy + Math.sin(a + w * 2) * R]).fill({ color: COL.PAPER, alpha: 0.75 });
    }
  }
  function speed(on) {
    if (G.reduced && on) return;
    if (!on && !speedLines) return;
    if (!speedLines) { speedLines = new PIXI.Graphics(); G.layers.overlay.addChild(speedLines); }
    speedLines.visible = on; if (on) drawSpeedLines(); else speedLines.clear();
  }

  // halftone dot wipe; returns { covered: Promise, reveal(): Promise }
  function dotWipe(color) {
    const g = new PIXI.Graphics();
    G.layers.overlay.addChild(g);
    const st = { p: 0 };
    const draw = () => {
      g.clear();
      const step = Math.max(34, Math.min(G.W, G.H) / 12);
      const cols = Math.ceil(G.W / step) + 2, rows = Math.ceil(G.H / step) + 2;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const d = (i / cols + j / rows) / 2;
        const k = U.clamp(st.p * 2.2 - d * 1.2, 0, 1);
        if (k <= 0) continue;
        g.circle(i * step + (j % 2) * step / 2, j * step, k * step * 0.78).fill({ color });
      }
    };
    let res1;
    const covered = new Promise((r) => { res1 = r; });
    gsap.to(st, { p: 1, duration: 0.55, ease: 'power2.in', onUpdate: draw, onComplete: res1 });
    return {
      covered,
      reveal() {
        return new Promise((r) => gsap.to(st, { p: 0, duration: 0.6, ease: 'power2.out', onUpdate: draw, onComplete: () => { g.destroy(); r(); } }));
      }
    };
  }

  function resize() { /* flash rect redrawn on use */ }

  return { init, update, emit, shake, rgb, shock, zoomBlur, adjust, flash, impact, feathers, splat, confetti, sparks, dust, steam, firework, coinRain, stamp, pop, sunburst, speed, dotWipe, resize,
    punch, camTo, camReset, slowmo, timeTick, coinFly, coinFountain, cannon, rocket, burst, dropLayer, CAM, get live() { return live.length; }, get coinsOut() { return coinsOut; } };
})();

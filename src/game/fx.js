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

  // o: { tex, x, y, vx, vy, ax, ay, drag, life, s0, s1, a0, a1, rot, vr, tint, sway, swayF, back, blend }
  function emit(o) {
    const s = getSprite(o.tex);
    s.x = o.x; s.y = o.y; s.tint = o.tint == null ? 0xFFFFFF : o.tint;
    if (o.blend) s.blendMode = o.blend;
    s.rotation = o.rot || 0;
    (o.back ? layerBack : layerFront).addChild(s);
    const p = { s, vx: o.vx || 0, vy: o.vy || 0, ax: o.ax || 0, ay: o.ay || 0, drag: o.drag == null ? 1 : o.drag, life: o.life || 1, t: 0,
      s0: o.s0 == null ? 1 : o.s0, s1: o.s1 == null ? (o.s0 == null ? 1 : o.s0) : o.s1, a0: o.a0 == null ? 1 : o.a0, a1: o.a1 == null ? 0 : o.a1,
      vr: o.vr || 0, sway: o.sway || 0, swayF: o.swayF || 3, ph: Math.random() * 6.28, fadeIn: o.fadeIn || 0, kx: o.kx || 1, ky: o.ky || 1 };
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
      p.s.scale.set(sc * p.kx, sc * p.ky);
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
    applyFilters();
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
    rgb(10 * power);
    if (power >= 1) shock(x, y, { amp: 22 * power, wave: 200, dur: 0.9 });
    flash(COL.PAPER, 0.18 * power, 0.2);
  }

  // ---- emitters ----
  function feathers(x, y, n, opts) {
    opts = opts || {};
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(120, 420) * (opts.power || 1);
      emit({ tex: U.pick(G.tex.feather), x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, ay: 220, drag: 0.94, life: U.rand(1.2, 2.4),
        s0: U.rand(0.35, 0.7) * (opts.scale || 1), a0: 1, a1: 0, rot: Math.random() * 6, vr: U.rand(-4, 4), sway: U.rand(40, 90), swayF: U.rand(2, 5), back: opts.back });
    }
  }
  function splat(x, y, color, scale, back) {
    emit({ tex: U.pick(G.tex.splat), x, y, tint: color, life: 0.9, s0: 0.2 * scale, s1: 1.1 * scale, a0: 0.95, a1: 0, rot: Math.random() * 6, back });
  }
  function confetti(x, y, n, colors, power) {
    colors = colors || [COL.PINK, COL.YELLOW, COL.TEAL, COL.ORANGE, COL.PAPER, COL.VIOLETL];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + U.rand(-1.1, 1.1), sp = U.rand(300, 900) * (power || 1);
      emit({ tex: G.tex.white, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 900, drag: 0.95, life: U.rand(1.5, 3), s0: G.unit || 1, a0: 1, a1: 0.6,
        rot: Math.random() * 6, vr: U.rand(-10, 10), tint: U.pick(colors), sway: U.rand(30, 80), swayF: U.rand(3, 7), kx: U.rand(2.2, 3.4), ky: U.rand(4, 6) });
    }
  }
  function sparks(x, y, n, color, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = U.rand(200, 700) * (power || 1);
      emit({ tex: G.tex.sparkle, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 300, drag: 0.9, life: U.rand(0.4, 0.9), s0: U.rand(0.25, 0.6), s1: 0, a0: 1, a1: 0.6,
        tint: color == null ? COL.YELLOW : color, rot: Math.random() * 6, vr: U.rand(-6, 6), blend: 'add' });
    }
  }
  function dust(x, y, n) {
    for (let i = 0; i < (n || 8); i++) {
      emit({ tex: G.tex.soft, x: x + U.rand(-30, 30), y: y + U.rand(-6, 6), vx: U.rand(-90, 90), vy: U.rand(-60, -10), drag: 0.9, life: U.rand(0.5, 0.9), s0: 0.2, s1: 0.6, a0: 0.55, a1: 0, tint: 0xE8D8B8 });
    }
  }
  function steam(x, y) {
    emit({ tex: G.tex.soft, x: x + U.rand(-6, 6), y, vx: U.rand(-10, 20), vy: U.rand(-60, -40), life: U.rand(2, 3), s0: 0.15, s1: 0.7, a0: 0.0, a1: 0, fadeIn: 0.6, tint: 0xF6ECD8, back: true }).a0 = 0.35;
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
  function coinRain(n, colorTex) {
    for (let i = 0; i < n; i++) {
      emit({ tex: colorTex || G.tex.cap.COIN, x: U.rand(0, G.W), y: U.rand(-200, -40), vx: U.rand(-60, 60), vy: U.rand(200, 500), ay: 600, life: U.rand(1.8, 2.6), s0: U.rand(0.18, 0.32) * G.unit, a0: 1, a1: 1, rot: Math.random() * 6, vr: U.rand(-4, 4) });
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
    if (G.reduced) return;
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

  return { init, update, emit, shake, rgb, shock, zoomBlur, adjust, flash, impact, feathers, splat, confetti, sparks, dust, steam, firework, coinRain, stamp, pop, sunburst, speed, dotWipe, resize };
})();

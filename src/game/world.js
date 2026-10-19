/* Homing world: posterized dusk sky, city, tram, flock, rooftop props, Race Day festoons and the weather. */
const World = (function () {
  const PAL = {
    base: [0x241D45, 0x3B2E6E, 0x5E3B8C, 0x93407F, 0xD4566F, 0xF27A55, 0xFFB052],
    race: [0x2A0F3D, 0x5A1C6B, 0x9E2A7C, 0xE23E6B, 0xFF6A3D, 0xFF9A2E, 0xFFD046],
    night: [0x0E0A1E, 0x161033, 0x241A4A, 0x372360, 0x4E2C6E, 0x6A3672, 0x8A4474]
  };
  const CITY = { base: [0x3A2C66, 0x2E2350], race: [0x4A1E5E, 0x341447], night: [0x1C1438, 0x140F2A] };
  let C = {};
  let palFrom = PAL.base, palTo = PAL.base, palT = 1;
  let cityFrom = CITY.base, cityTo = CITY.base;
  const flock = [];
  let windows = [], winTimer = 0, winRedraw = 0;
  const neigh = [];
  let tram = null, tramTimer = 6, tramDir = 1;
  let ventTimer = 0, fireTimer = 0, confT = 1;
  let towerLight = null;
  let seedR = 7;
  const rnd = () => { seedR = (seedR * 16807) % 2147483647; return seedR / 2147483647; };
  // parallax: the pointer (or a slow drift on touch screens) nudges each layer by its depth
  const PX = { x: 0, y: 0, tx: 0, ty: 0, last: -99 };
  // weather
  const WX = { wind: 1, windT: 1, gustT: 40, rainT: 200, rain: 0, rainOn: false, rainLeft: 0, planeT: 30, lit: false };
  let plane = null, planeLights = [];
  const bulbs = [], pennants = [];

  function build(world) {
    C.sky = new PIXI.Graphics(); world.addChild(C.sky);
    C.dots = new PIXI.Container(); world.addChild(C.dots);
    C.sunC = new PIXI.Container(); world.addChild(C.sunC);
    C.sunRays = new PIXI.Graphics(); C.sunC.addChild(C.sunRays);
    C.sun = new PIXI.Graphics(); C.sunC.addChild(C.sun);
    C.planeC = new PIXI.Container(); world.addChild(C.planeC);
    C.clouds = new PIXI.Container(); world.addChild(C.clouds);
    C.farC = new PIXI.Container(); world.addChild(C.farC);
    C.far = new PIXI.Graphics(); C.farC.addChild(C.far);
    towerLight = sprite(G.tex.soft); towerLight.tint = 0xFF3B3B; towerLight.blendMode = 'add'; C.farC.addChild(towerLight);
    C.bridge = new PIXI.Graphics(); C.farC.addChild(C.bridge);
    tram = sprite(G.tex.tram, 0.5, 1); C.farC.addChild(tram); tram.visible = false;
    G.layers.fxBack = new PIXI.Container(); world.addChild(G.layers.fxBack);
    C.flock = new PIXI.Container(); world.addChild(C.flock);
    C.midC = new PIXI.Container(); world.addChild(C.midC);
    C.mid = new PIXI.Graphics(); C.midC.addChild(C.mid);
    C.win = new PIXI.Graphics(); C.midC.addChild(C.win);
    C.neigh = new PIXI.Container(); C.midC.addChild(C.neigh);
    C.roof = new PIXI.Container(); world.addChild(C.roof);
    C.roofG = new PIXI.Graphics(); C.roof.addChild(C.roofG);
    C.antennas = new PIXI.Container(); C.roof.addChild(C.antennas);
    C.dish = sprite(G.tex.dish, 0.5, 1); C.roof.addChild(C.dish);
    C.vent = sprite(G.tex.vent, 0.5, 1); C.roof.addChild(C.vent);
    C.line = new PIXI.Graphics(); C.roof.addChild(C.line);
    C.laundry = new PIXI.Container(); C.roof.addChild(C.laundry);
    // Race Day festoons: strings of pennants and bulbs strung across the roofs
    C.fest = new PIXI.Container(); C.fest.alpha = 0; C.fest.visible = false; world.addChild(C.fest);
    C.festLines = new PIXI.Graphics(); C.fest.addChild(C.festLines);
    C.festGlow = new PIXI.Container(); C.fest.addChild(C.festGlow);
    C.festItems = new PIXI.Container(); C.fest.addChild(C.festItems);
    // a warm glow behind the loft, and the drizzle veil
    C.glow = sprite(G.tex.soft); C.glow.tint = 0xFF9A4A; C.glow.blendMode = 'add'; C.glow.alpha = 0.32; world.addChild(C.glow);
    C.veil = new PIXI.Graphics(); C.veil.alpha = 0; world.addChild(C.veil);
    // particles that belong in front of the blocks and behind the loft: rain, gusts, neighbours' confetti, vent steam
    G.layers.fxMid = new PIXI.Container(); world.addChild(G.layers.fxMid);
    for (let i = 0; i < 4; i++) {
      const c = sprite(G.tex.cloud[i % 3], 0.5, 0.5);
      c._v = U.rand(6, 16) * (i % 2 ? 1 : -1); c._k = i;
      C.clouds.addChild(c);
    }
    for (let i = 0; i < 28; i++) {
      const s = new PIXI.Sprite(G.tex.sil[0]);
      s.anchor.set(0.556, 0.537);
      s.tint = 0x1F1638;
      C.flock.addChild(s);
      flock.push({ s, x: Math.random(), y: Math.random() * 0.3, vx: 0, vy: 0, ph: Math.random() * 6, f: Math.random(), rate: U.rand(2.4, 3.4), glide: 0, flaps: U.randInt(3, 8), face: 1, faceT: 1, head: 0, bank: 0, size: U.rand(0.7, 1.2) });
    }
    for (let i = 0; i < 4; i++) {
      const l = sprite(G.tex.laundry[i], 0.5, 0.02);
      l._ph = Math.random() * 6;
      C.laundry.addChild(l);
    }
    for (let i = 0; i < 3; i++) { const a = new PIXI.Graphics(); a._ph = Math.random() * 6; C.antennas.addChild(a); }
    plane = sprite(G.tex.plane); plane.visible = false; C.planeC.addChild(plane);
    for (let i = 0; i < 2; i++) { const l = sprite(G.tex.soft); l.blendMode = 'add'; l.tint = i ? 0xFFFFFF : 0xFF3B3B; plane.addChild(l); planeLights.push(l); }
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      PX.tx = U.clamp((e.clientX / Math.max(1, G.W)) * 2 - 1, -1, 1); PX.ty = U.clamp((e.clientY / Math.max(1, G.H)) * 2 - 1, -1, 1); PX.last = G.time;
    }, { passive: true });
  }

  function skyBands() {
    const k = palT;
    return palTo.map((c, i) => U.mixColor(palFrom[i], c, k));
  }

  let dotsBuilt = false;
  function drawSky() {
    const W = G.W, H = G.H, hz = G.horizonY;
    const cols = skyBands();
    const g = C.sky; g.clear();
    // band boundaries crowd toward the horizon
    const edges = [0, 0.2, 0.36, 0.5, 0.62, 0.73, 0.84, 1.0].map((t) => t * (hz + H * 0.08));
    // the top band reaches far above the screen so intro camera moves never show bare canvas
    for (let i = 0; i < 7; i++) {
      const top = i === 0 ? -H * 1.5 : edges[i] - 1;
      g.rect(-W * 0.3, top, W * 1.6, edges[i + 1] - top + 2).fill({ color: cols[i] });
    }
    g.rect(-W * 0.3, edges[7] - 1, W * 1.6, H - edges[7] + 2).fill({ color: cols[6] });
    // halftone transitions (strips built on layout, tinted every redraw)
    if (!dotsBuilt) {
      C.dots.removeChildren().forEach((d) => d.destroy());
      for (let i = 1; i < 7; i++) {
        const y = edges[i];
        const hgt = Math.max(16, (edges[i + 1] - edges[i]) * 0.42);
        for (let s = 0; s < 2; s++) {
          const ts = new PIXI.TilingSprite({ texture: G.tex.dotTile[s ? 2 : 1], width: W + 40, height: hgt / 2 });
          ts.x = -20; ts.y = y + s * hgt / 2; ts.tileScale.set(Math.max(0.8, G.unit * 1.2));
          ts._band = i - 1;
          C.dots.addChild(ts);
        }
      }
      dotsBuilt = true;
    }
    C.dots.children.forEach((ts) => { ts.tint = cols[ts._band]; });
    // sun
    const sr = Math.max(60, Math.min(W, H) * 0.11);
    C.sunBase = { x: W * (G.portrait ? 0.72 : 0.8), y: hz - sr * 0.25 };
    C.sunC.x = C.sunBase.x; C.sunC.y = C.sunBase.y;
    C.sun.clear();
    C.sun.circle(0, 0, sr * 1.55).fill({ color: cols[6], alpha: 0.35 });
    C.sun.circle(0, 0, sr * 1.25).fill({ color: 0xFFD046, alpha: 0.35 });
    C.sun.circle(0, 0, sr).fill({ color: 0xFFD046 });
    C.sun.circle(sr * 0.08, sr * 0.08, sr).stroke({ color: 0xFF6A2B, width: 4, alpha: 0.8 });
    C.sunRays.clear();
    const n = 18, R = sr * 6;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = a0 + Math.PI / n * 0.8;
      C.sunRays.poly([0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R]).fill({ color: 0xFFE7A8, alpha: 0.07 });
    }
  }

  function drawCity() {
    const W = G.W, hz = G.horizonY, H = G.H;
    const cc = cityTo.map((c, i) => U.mixColor(cityFrom[i], c, palT));
    const g = C.far; g.clear();
    seedR = 11;
    // far skyline, drawn past both edges so the parallax never shows its ends
    let x = -60;
    const pts = [-60, hz + 40];
    while (x < W + 80) {
      const w = (24 + rnd() * 70) * Math.max(0.6, G.unit);
      const h = (20 + rnd() * 90) * Math.max(0.6, G.unit);
      pts.push(x, hz - h, x + w, hz - h);
      x += w + rnd() * 10;
    }
    pts.push(W + 80, hz + 40);
    g.poly(pts).fill({ color: cc[0] });
    // TV tower
    // keep the tower in open sky beside the loft, never half hidden behind it
    const leftGap = G.loftX - G.loftW / 2;
    const tx = G.portrait ? W * 0.12 : Math.min(W * 0.16, leftGap * 0.55), th = Math.min(H * 0.38, 420 * G.unit + 120);
    g.poly([tx - 14 * G.unit, hz, tx - 3 * G.unit, hz - th, tx + 3 * G.unit, hz - th, tx + 14 * G.unit, hz]).fill({ color: cc[0] });
    g.ellipse(tx, hz - th * 0.72, 22 * G.unit, 9 * G.unit).fill({ color: cc[0] });
    g.rect(tx - 1.5 * G.unit, hz - th - 40 * G.unit, 3 * G.unit, 40 * G.unit).fill({ color: cc[0] });
    towerLight.x = tx; towerLight.y = hz - th - 40 * G.unit; towerLight.scale.set(0.25 * G.unit + 0.1);
    // tiny windows on the skyline
    seedR = 19;
    for (let i = 0; i < 70; i++) {
      const wx = rnd() * W, wy = hz - rnd() * 70 * G.unit - 8;
      g.rect(wx, wy, 3 * G.unit + 1, 3 * G.unit + 1).fill({ color: 0xFFC27A, alpha: 0.55 });
    }
    // bridge
    const by = hz + 18 * G.unit;
    C.bridge.clear();
    C.bridge.rect(-60, by, W + 120, 7 * G.unit + 2).fill({ color: cc[1] });
    for (let px = -40; px < W + 80; px += 140 * G.unit + 40) C.bridge.rect(px, by, 9 * G.unit + 2, 60 * G.unit).fill({ color: cc[1] });
    G.bridgeY = by;
    // mid blocks (panel blocks)
    drawMid(cc);
  }

  function drawMid(cc) {
    const W = G.W, gy = G.groundY, u = G.unit;
    const g = C.mid; g.clear();
    const blocks = G.portrait
      ? [{ x: -50 * u - 12, w: 240 * u + 12, h: 0.42 }, { x: W - 190 * u, w: 240 * u + 12, h: 0.36 }]
      : [{ x: -40 * u - 12, w: 340 * u + 12, h: 0.5 }, { x: W * 0.16, w: 170 * u, h: 0.36 }, { x: W - 300 * u, w: 340 * u + 12, h: 0.46 }, { x: W * 0.74, w: 150 * u, h: 0.3 }];
    windows = [];
    seedR = 29;
    blocks.forEach((b, bi) => {
      const top = gy - G.playH * b.h;
      g.rect(b.x, top, b.w, gy - top + 4).fill({ color: cc[1] });
      g.rect(b.x, top - 10 * u, b.w, 10 * u).fill({ color: U.mixColor(cc[1], 0x000000, 0.25) });
      const cw = 30 * u, ch = 34 * u;
      const cols = Math.floor((b.w - 20 * u) / cw), rows = Math.floor((gy - top - 30 * u) / ch);
      const ox = b.x + (b.w - cols * cw) / 2;
      for (let r = 0; r < rows; r++) {
        // balcony band every other floor
        if (r % 2 === 1) g.rect(b.x + 4 * u, top + 18 * u + r * ch + ch - 8 * u, b.w - 8 * u, 5 * u).fill({ color: U.mixColor(cc[1], 0x000000, 0.3) });
        for (let c = 0; c < cols; c++) {
          windows.push({ x: ox + c * cw + 6 * u, y: top + 18 * u + r * ch, w: cw - 12 * u, h: ch - 14 * u, on: rnd() < 0.35, tv: rnd() < 0.07, ph: rnd() * 6, b: bi });
        }
      }
      b.top = top;
    });
    C.blocks = blocks;
    drawWindows();
  }

  function drawWindows() {
    const g = C.win; g.clear();
    for (const w of windows) {
      const on = w.on || WX.lit;
      if (!on) { g.rect(w.x, w.y, w.w, w.h).fill({ color: 0x000000, alpha: 0.18 }); continue; }
      const col = w.tv ? (Math.sin(G.time * 9 + w.ph) > 0.2 ? 0x7FD3FF : 0x4C8BD8) : (WX.lit ? (Math.sin(G.time * 6 + w.ph * 3) > 0 ? 0xFFE08A : 0xFFB45E) : (w.ph > 3 ? 0xFFC86B : 0xFF9E5A));
      g.rect(w.x, w.y, w.w, w.h).fill({ color: col, alpha: 0.92 });
      g.rect(w.x + w.w * 0.48, w.y, Math.max(1, w.w * 0.06), w.h).fill({ color: 0x1B1622, alpha: 0.5 });
    }
  }

  function drawRoof() {
    const W = G.W, H = G.H, gy = G.groundY, u = G.unit;
    const g = C.roofG; g.clear();
    g.rect(-60, gy, W + 120, H - gy + 20).fill({ color: 0x2A2140 });
    g.rect(-60, gy, W + 120, 6 * u + 2).fill({ color: 0x1B1622 });
    for (let x = -60; x < W + 80; x += 48 * u + 10) g.rect(x, gy + 10 * u, 2, H - gy).fill({ color: 0x1B1622, alpha: 0.35 });
    // antennas
    const ax = G.portrait ? [W * 0.08, W * 0.9] : [W * 0.06, W * 0.2, W * 0.93];
    C.antennas.children.forEach((a, i) => {
      a.visible = i < ax.length;
      if (!a.visible) return;
      a.clear();
      const h = (G.portrait ? 120 : 190) * u + 30;
      a.rect(-2 * u - 1, -h, 4 * u + 2, h).fill({ color: 0x1B1622 });
      for (let k = 0; k < 4; k++) { const w = (60 - k * 10) * u; a.rect(-w / 2, -h + k * 22 * u, w, 4 * u + 1).fill({ color: 0x1B1622 }); }
      a.x = ax[i]; a.y = gy;
    });
    C.dish.visible = !G.portrait; C.dish.x = W * 0.86; C.dish.y = gy; C.dish.scale.set(0.8 * u + 0.1);
    C.vent.x = G.portrait ? W * 0.94 : W * 0.04; C.vent.y = gy; C.vent.scale.set(0.75 * u + 0.1);
    // laundry line (landscape only, left side)
    C.line.clear();
    C.laundry.visible = !G.portrait;
    if (!G.portrait) {
      const x0 = W * 0.03, x1 = Math.min(W * 0.27, G.loftX - G.loftW * 0.55), y0 = gy - G.playH * 0.42;
      if (x1 - x0 > 160 * u) {
        C.line.moveTo(x0, y0).quadraticCurveTo((x0 + x1) / 2, y0 + 40 * u, x1, y0).stroke({ width: 3, color: 0x1B1622 });
        C.line.rect(x0 - 3, y0, 6, gy - y0).fill({ color: 0x1B1622 });
        C.line.rect(x1 - 3, y0, 6, gy - y0).fill({ color: 0x1B1622 });
        C.laundry.children.forEach((l, i) => {
          const t = (i + 0.7) / 4.4;
          l.x = x0 + (x1 - x0) * t; l.y = y0 + Math.sin(t * Math.PI) * 38 * u; l.scale.set(0.62 * u + 0.08);
          l._baseY = l.y;
        });
      } else C.laundry.visible = false;
    }
  }

  // festoons: two sagging strings between the tower blocks, a pennant and a bulb in turn
  function drawFestoons() {
    const W = G.W, u = G.unit;
    const g = C.festLines; g.clear();
    C.festItems.removeChildren().forEach((d) => d.destroy());
    C.festGlow.removeChildren().forEach((d) => d.destroy());
    bulbs.length = 0; pennants.length = 0;
    const top = G.portrait ? G.holdArea.y + G.holdArea.h * 0.15 : G.horizonY * 0.42;
    const strings = G.portrait
      ? [{ x0: -10, y0: top + 40 * u, x1: W + 10, y1: top + 10 * u, sag: 46 * u }]
      : [{ x0: -10, y0: top - 60 * u, x1: G.loftX - G.loftW * 0.46, y1: top + 10 * u, sag: 46 * u }, { x0: G.loftX + G.loftW * 0.46, y0: top, x1: W + 10, y1: top - 70 * u, sag: 50 * u }, { x0: -10, y0: top + 60 * u, x1: W + 10, y1: top + 40 * u, sag: 70 * u }];
    const at = (s, t) => ({ x: U.lerp(s.x0, s.x1, t), y: U.lerp(s.y0, s.y1, t) + Math.sin(t * Math.PI) * s.sag });
    strings.forEach((s, si) => {
      g.moveTo(s.x0, s.y0);
      for (let i = 1; i <= 24; i++) { const p = at(s, i / 24); g.lineTo(p.x, p.y); }
      g.stroke({ width: 2.5, color: 0x1B1622 });
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0);
      const n = Math.max(4, Math.floor(len / (46 * u + 14)));
      for (let i = 1; i < n; i++) {
        const p = at(s, i / n);
        if (i % 2) {
          const f = sprite(G.tex.pennant[(i + si * 2) % G.tex.pennant.length], 0.5, 0.06);
          f.x = p.x; f.y = p.y; f.scale.set(0.42 * u + 0.12); f._ph = i * 0.7 + si; f._k = f.scale.x;
          C.festItems.addChild(f); pennants.push(f);
        } else {
          const glow = sprite(G.tex.soft); glow.blendMode = 'add'; glow.tint = 0xFFC86B; glow.x = p.x; glow.y = p.y + 16 * u; glow.scale.set(0.42 * u + 0.12);
          C.festGlow.addChild(glow);
          const b = sprite(G.tex.bulb, 0.5, 0.05); b.x = p.x; b.y = p.y; b.scale.set(0.5 * u + 0.15); b._ph = Math.random() * 6; b._glow = glow;
          C.festItems.addChild(b); bulbs.push(b);
        }
      }
    });
  }

  function layout() {
    dotsBuilt = false;
    drawSky(); drawCity(); drawRoof(); drawFestoons();
    C.clouds.children.forEach((c, i) => {
      c.y = G.horizonY * (0.18 + i * 0.16);
      c.x = ((i * 0.37 + 0.1) % 1) * G.W;
      c.scale.set(G.unit * (0.7 + (i % 2) * 0.3) + 0.15);
    });
    tram.scale.set(0.3 * G.unit + 0.05);
    // the warm glow sits behind the gable
    C.glow.x = G.loftX; C.glow.y = G.groundY - HomingWorld.LOFT.h * G.loftScale * 0.7;
    C.glow.scale.set((G.loftW * 2.2) / 128, (G.loftW * 1.7) / 128);
    C.veil.clear().rect(-60, -60, G.W + 120, G.H + 120).fill({ color: 0x1A1430 });
    plane.scale.set(0.42 * G.unit + 0.12);
    planeLights.forEach((l, i) => { l.x = i ? -40 : 50; l.y = i ? 20 : 22; l.scale.set(0.12); });
  }

  // ---------- weather ----------
  function gust() {
    WX.windT = 3.2;
    setTimeout(() => { WX.windT = 1; }, 2600);
    Audio2.play('gust');
    const dir = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 9; i++) {
      FX.emit({ tex: U.pick(G.tex.feather), x: dir > 0 ? -40 : G.W + 40, y: U.rand(0.15, 0.75) * G.playH, vx: dir * U.rand(420, 720) * Math.max(0.6, G.unit), vy: U.rand(-60, 40), ay: 30, drag: 0.995,
        life: U.rand(2.2, 3.4), s0: U.rand(0.3, 0.55) * (G.unit + 0.2), a0: 0.85, a1: 0.5, rot: Math.random() * 6, vr: U.rand(-6, 6), sway: U.rand(30, 70), swayF: U.rand(2, 4), layer: G.layers.fxMid });
    }
  }
  function rainTick(sec) {
    // drizzle: fine streaks slanting with the wind, a veil over the sky, a soft hiss
    const n = Math.min(8, Math.floor(sec * 150 + Math.random()));
    for (let i = 0; i < n; i++) {
      FX.emit({ tex: G.tex.streak, x: U.rand(-100, G.W + 100), y: U.rand(-80, G.playH * 0.4), vx: -120 * WX.wind, vy: U.rand(900, 1200), life: U.rand(0.6, 0.9), s0: Math.max(0.6, G.unit), a0: 0.45, a1: 0.3, rot: Math.atan2(120 * WX.wind, 1000), tint: 0xD8CFF5, layer: G.layers.fxMid });
    }
  }
  function startRain(on) {
    WX.rainOn = on;
    gsap.to(C.veil, { alpha: on ? 0.16 : 0, duration: 2.5 });
    Audio2.rain(on);
    if (on) setTimeout(() => { if (WX.rainOn) Gennady.actIfIdle('sky'); }, 1200);
  }
  function weather(sec) {
    if (G.mode !== 'race' && !G.reduced) {
      WX.gustT -= sec;
      if (WX.gustT <= 0) { WX.gustT = U.rand(35, 75); gust(); }
      WX.rainT -= sec;
      if (!WX.rainOn && WX.rainT <= 0) { WX.rainLeft = U.rand(14, 22); startRain(true); }
      if (WX.rainOn) { WX.rainLeft -= sec; rainTick(sec); if (WX.rainLeft <= 0) { WX.rainT = U.rand(160, 320); startRain(false); } }
    } else if (WX.rainOn) { WX.rainT = U.rand(160, 320); startRain(false); }
    WX.wind = U.lerp(WX.wind, WX.windT * (G.mode === 'race' ? 1.8 : 1), Math.min(1, sec * 2));
    // a plane crosses the far sky now and then, blinking
    WX.planeT -= sec;
    if (!plane.visible && WX.planeT <= 0) {
      plane.visible = true; plane._dir = Math.random() < 0.5 ? 1 : -1;
      plane.scale.x = Math.abs(plane.scale.x) * plane._dir;
      plane.x = plane._dir > 0 ? -80 : G.W + 80; plane.y = G.horizonY * U.rand(0.12, 0.3);
    }
    if (plane.visible) {
      plane.x += plane._dir * (26 * G.unit + 14) * sec;
      planeLights[0].alpha = Math.sin(G.time * 7) > 0.6 ? 1 : 0.1;
      planeLights[1].alpha = Math.sin(G.time * 5 + 1) > 0.75 ? 1 : 0.05;
      if (plane.x < -120 || plane.x > G.W + 120) { plane.visible = false; WX.planeT = U.rand(50, 110); }
    }
  }

  function update(dt) {
    const sec = dt / 1000;
    weather(sec);
    const wind = WX.wind;
    for (const c of C.clouds.children) {
      c.x += c._v * sec * (G.mode === 'race' ? 2.2 : 1) * (0.6 + wind * 0.4);
      if (c.x < -c.width) c.x = G.W + c.width * 0.5;
      if (c.x > G.W + c.width) c.x = -c.width * 0.5;
    }
    C.sunRays.rotation += sec * 0.03;
    towerLight.alpha = (Math.sin(G.time * 3) > 0.3) ? 1 : 0.15;
    // parallax: follow the pointer for a while, then drift on our own
    if (G.time - PX.last > 6) { PX.tx = Math.sin(G.time * 0.09) * 0.6; PX.ty = Math.sin(G.time * 0.07 + 1) * 0.4; }
    PX.x = U.lerp(PX.x, G.reduced ? 0 : PX.tx, Math.min(1, sec * 2.2)); PX.y = U.lerp(PX.y, G.reduced ? 0 : PX.ty, Math.min(1, sec * 2.2));
    const pu = Math.max(0.6, G.unit);
    if (C.sunBase) { C.sunC.x = C.sunBase.x - PX.x * 3 * pu; C.sunC.y = C.sunBase.y - PX.y * 2 * pu; }
    C.clouds.x = -PX.x * 3 * pu; C.clouds.y = -PX.y * 2 * pu;
    C.planeC.x = -PX.x * 2 * pu;
    C.farC.x = -PX.x * 4 * pu; C.farC.y = -PX.y * 1.5 * pu;
    C.flock.x = -PX.x * 6 * pu;
    C.midC.x = -PX.x * 9 * pu; C.midC.y = -PX.y * 2.5 * pu;
    C.fest.x = -PX.x * 4 * pu;
    // the gable glow breathes
    C.glow.alpha = (G.mode === 'race' ? 0.42 : 0.3) + Math.sin(G.time * 1.3) * 0.04;
    // flock: steer toward a wandering attractor, keep apart, match neighbours' heading, bank and glide
    const ax = G.W * (0.5 + 0.38 * Math.sin(G.time * 0.11)), ay = G.horizonY * (0.34 + 0.16 * Math.sin(G.time * 0.23));
    const R2 = 900 * G.unit * G.unit + 400, A2 = R2 * 6;
    for (let i = 0; i < flock.length; i++) {
      const b = flock[i];
      const px = b.x * G.W, py = b.y * G.H;
      let fx = (ax - px) * 0.0009 + Math.sin(G.time * 0.7 + b.ph) * 0.16 + (wind - 1) * 0.05, fy = (ay - py) * 0.0012 + Math.cos(G.time * 0.9 + b.ph) * 0.11;
      let avx = 0, avy = 0, n = 0;
      for (let j = 0; j < flock.length; j++) {
        if (i === j) continue; const o = flock[j];
        const dx = px - o.x * G.W, dy = py - o.y * G.H, d2 = dx * dx + dy * dy;
        if (d2 < R2) { fx += dx * 0.004; fy += dy * 0.004; }
        if (d2 < A2) { avx += o.vx; avy += o.vy; n++; }
      }
      if (n) { fx += (avx / n - b.vx) * 0.05; fy += (avy / n - b.vy) * 0.05; }
      b.vx = (b.vx + fx * sec * 60) * 0.97; b.vy = (b.vy + fy * sec * 60) * 0.97;
      const sp = Math.hypot(b.vx, b.vy), max = 3.3;
      if (sp > max) { b.vx *= max / sp; b.vy *= max / sp; }
      b.x += b.vx * sec * 60 / G.W; b.y += b.vy * sec * 60 / G.H;
      b.s.x = b.x * G.W; b.s.y = b.y * G.H;
      // wings: a flap cycle with the odd glide
      if (b.glide > 0) { b.glide -= sec; b.s.texture = G.tex.silGlide; }
      else {
        const before = Math.floor(b.f); b.f += sec * b.rate;
        if (Math.floor(b.f) !== before && --b.flaps <= 0) { b.glide = U.rand(0.3, 1.1); b.flaps = U.randInt(3, 9); }
        b.s.texture = G.tex.sil[Math.floor((b.f % 1) * G.tex.sil.length) % G.tex.sil.length];
      }
      if (Math.abs(b.vx) > 0.25) b.face = b.vx >= 0 ? 1 : -1;
      b.faceT = U.lerp(b.faceT, b.face, Math.min(1, sec * 6));
      const head = Math.atan2(b.vy, b.vx); let dh = head - b.head; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; b.head = head;
      b.bank = U.lerp(b.bank, U.clamp(dh / Math.max(sec, 1e-3) * 0.1, -0.5, 0.5), Math.min(1, sec * 4));
      const k = ((22 * G.unit + 8) * b.size) / (282 * G.tex.silS);
      b.s.rotation = (U.clamp(Math.atan2(b.vy, Math.abs(b.vx) + 0.6), -0.6, 0.6) * 0.6 + b.bank * 0.5) * Math.sign(b.faceT);
      b.s.scale.set(k * b.faceT, k * (1 - Math.abs(b.bank) * 0.3));
    }
    // windows
    winTimer -= sec;
    if (winTimer <= 0 && windows.length) {
      winTimer = G.mode === 'race' ? 0.12 : 0.7;
      const w = windows[Math.floor(Math.random() * windows.length)];
      w.on = !w.on;
    }
    winRedraw -= sec;
    if (winRedraw <= 0) { winRedraw = 0.09; drawWindows(); }
    // tram
    tramTimer -= sec;
    if (!tram.visible && tramTimer <= 0) {
      tram.visible = true; tramDir = Math.random() < 0.5 ? 1 : -1;
      tram.scale.x = Math.abs(tram.scale.x) * tramDir;
      tram.x = tramDir > 0 ? -tram.width : G.W + tram.width; tram.y = G.bridgeY;
      Audio2.play('tram');
    }
    if (tram.visible) {
      tram.x += tramDir * 90 * G.unit * sec + tramDir * 20 * sec;
      if (Math.random() < 0.04) FX.sparks(tram.x + tramDir * tram.width * 0.05 + C.farC.x, tram.y - tram.height + C.farC.y, 3, 0x9FE8FF, 0.25, G.layers.fxBack);
      if ((tramDir > 0 && tram.x > G.W + tram.width) || (tramDir < 0 && tram.x < -tram.width)) { tram.visible = false; tramTimer = U.rand(22, 40); }
    }
    // laundry and antennas sway with the wind
    C.laundry.children.forEach((l) => { l.rotation = Math.sin(G.time * 2.1 * wind + l._ph) * 0.12 * wind; l.skew.x = Math.sin(G.time * 3.3 * Math.min(2, wind) + l._ph) * 0.08 * wind; });
    C.antennas.children.forEach((a) => { a.rotation = Math.sin(G.time * 1.3 + a._ph) * 0.015 * wind; });
    // vent steam
    ventTimer -= sec;
    if (ventTimer <= 0) { ventTimer = 0.35; FX.steam(C.vent.x, C.vent.y - C.vent.height * 0.95, G.layers.fxMid); }
    // festoons: pennants flutter, bulbs chase
    if (C.fest.visible) {
      pennants.forEach((f) => { f.rotation = Math.sin(G.time * 3.1 * Math.min(2, wind) + f._ph) * 0.16 * wind; f.scale.x = f._k * (0.85 + 0.15 * Math.cos(G.time * 4 + f._ph)); });
      bulbs.forEach((b, i) => { const on = Math.sin(G.time * 5 - i * 0.9) > -0.2; b.alpha = on ? 1 : 0.55; b._glow.alpha = on ? 0.75 : 0.15; });
    }
    // race fireworks and neighbours throwing confetti
    if (G.mode === 'race') {
      fireTimer -= sec;
      if (fireTimer <= 0) {
        fireTimer = U.rand(0.7, 1.6);
        FX.firework(U.rand(0.05, 0.95) * G.W, U.rand(0.08, 0.5) * G.horizonY, U.pick([COL.PINK, COL.YELLOW, COL.TEALL, COL.ORANGE, COL.VIOLETL]), 40, true);
        Audio2.play('firework');
      }
      confT -= sec;
      if (confT <= 0 && neigh.length) {
        confT = U.rand(0.5, 1.3);
        const n = U.pick(neigh);
        FX.confetti(n.x + C.midC.x, n.y - n.height * 0.8 + C.midC.y, 8, null, 0.45, G.layers.fxMid);
      }
    }
    if (neigh.length) neigh.forEach((n) => { if (Math.random() < 0.06) n.texture = G.tex.neigh[n._c][n.texture === G.tex.neigh[n._c][0] ? 1 : 0]; });
    if (palT < 1) { drawSky(); drawCity(); }
  }

  function setMode(mode, dur) {
    palFrom = skyBands();
    cityFrom = cityTo.map((c, i) => U.mixColor(cityFrom[i], c, palT));
    palTo = PAL[mode] || PAL.base;
    cityTo = CITY[mode] || CITY.base;
    palT = 0;
    gsap.to({ v: 0 }, { v: 1, duration: dur == null ? 1.2 : dur, onUpdate() { palT = this.targets()[0].v; }, onComplete() { palT = 1; drawSky(); drawCity(); } });
    clearTimeout(cheerT); cheering = false;
    if (mode === 'race') { showNeighbours(); festoons(true); Audio2.crowdLoop(true); } else { hideNeighbours(); festoons(false); Audio2.crowdLoop(false); }
  }
  function festoons(on) {
    gsap.killTweensOf(C.fest);
    if (on) { C.fest.visible = true; gsap.to(C.fest, { alpha: 1, duration: 0.6 }); }
    else gsap.to(C.fest, { alpha: 0, duration: 0.4, onComplete: () => { C.fest.visible = false; } });
  }

  function showNeighbours() {
    hideNeighbours();
    const cands = windows.filter((w) => w.y < G.groundY - 40);
    for (let i = 0; i < Math.min(9, cands.length); i++) {
      const w = cands[Math.floor(Math.random() * cands.length)];
      const ci = U.randInt(0, G.tex.neigh.length - 1);
      const s = sprite(G.tex.neigh[ci][1], 0.5, 1);
      s._c = ci;
      s.x = w.x + w.w / 2; s.y = w.y + w.h;
      const sc = (w.h / 120) * 1.4; s.scale.set(0);
      C.neigh.addChild(s); neigh.push(s);
      w.on = true;
      gsap.to(s.scale, { x: sc, y: sc, duration: 0.35, delay: i * 0.08, ease: 'back.out(2.5)' });
    }
  }
  function hideNeighbours() {
    neigh.splice(0).forEach((s) => gsap.to(s.scale, { x: 0, y: 0, duration: 0.25, onComplete: () => s.destroy() }));
  }

  // neighbours lean out of their windows for a big win in the base game
  function cheer(on, secs) {
    if (G.mode === 'race') return;
    clearTimeout(cheerT);
    if (on) {
      if (!cheering) showNeighbours();
      cheering = true;
      if (secs) cheerT = setTimeout(() => cheer(false), secs * 1000);
    } else if (cheering) { hideNeighbours(); cheering = false; }
  }
  let cheering = false, cheerT = 0;

  // every window on the block lights up and flickers (the top big win tier)
  function lightsUp(on) { WX.lit = !!on; drawWindows(); }

  function snapNight() { palFrom = PAL.night; palTo = PAL.night; cityFrom = CITY.night; cityTo = CITY.night; palT = 1; drawSky(); drawCity(); }

  return { build, layout, update, setMode, snapNight, cheer, lightsUp, gust, C, flock, WX };
})();

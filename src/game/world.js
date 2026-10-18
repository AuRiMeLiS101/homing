/* Homing world: posterized dusk sky, city, tram, flock, rooftop props. */
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
  let ventTimer = 0, fireTimer = 0;
  let towerLight = null;
  let seedR = 7;
  const rnd = () => { seedR = (seedR * 16807) % 2147483647; return seedR / 2147483647; };

  function build(world) {
    C.sky = new PIXI.Graphics(); world.addChild(C.sky);
    C.dots = new PIXI.Container(); world.addChild(C.dots);
    C.sunC = new PIXI.Container(); world.addChild(C.sunC);
    C.sunRays = new PIXI.Graphics(); C.sunC.addChild(C.sunRays);
    C.sun = new PIXI.Graphics(); C.sunC.addChild(C.sun);
    C.clouds = new PIXI.Container(); world.addChild(C.clouds);
    C.far = new PIXI.Graphics(); world.addChild(C.far);
    towerLight = sprite(G.tex.soft); towerLight.tint = 0xFF3B3B; towerLight.blendMode = 'add'; world.addChild(towerLight);
    C.bridge = new PIXI.Graphics(); world.addChild(C.bridge);
    tram = sprite(G.tex.tram, 0.5, 1); world.addChild(tram); tram.visible = false;
    G.layers.fxBack = new PIXI.Container(); world.addChild(G.layers.fxBack);
    C.flock = new PIXI.Container(); world.addChild(C.flock);
    C.mid = new PIXI.Graphics(); world.addChild(C.mid);
    C.win = new PIXI.Graphics(); world.addChild(C.win);
    C.neigh = new PIXI.Container(); world.addChild(C.neigh);
    C.roof = new PIXI.Container(); world.addChild(C.roof);
    C.roofG = new PIXI.Graphics(); C.roof.addChild(C.roofG);
    C.antennas = new PIXI.Container(); C.roof.addChild(C.antennas);
    C.dish = sprite(G.tex.dish, 0.5, 1); C.roof.addChild(C.dish);
    C.vent = sprite(G.tex.vent, 0.5, 1); C.roof.addChild(C.vent);
    C.line = new PIXI.Graphics(); C.roof.addChild(C.line);
    C.laundry = new PIXI.Container(); C.roof.addChild(C.laundry);
    C.bunting = new PIXI.Graphics(); C.bunting.alpha = 0;
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
    C.sunC.x = W * (G.portrait ? 0.72 : 0.8); C.sunC.y = hz - sr * 0.25;
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
    // far skyline
    let x = -20;
    const pts = [-20, hz + 40];
    while (x < W + 40) {
      const w = (24 + rnd() * 70) * Math.max(0.6, G.unit);
      const h = (20 + rnd() * 90) * Math.max(0.6, G.unit);
      pts.push(x, hz - h, x + w, hz - h);
      x += w + rnd() * 10;
    }
    pts.push(W + 40, hz + 40);
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
    C.bridge.rect(-20, by, W + 40, 7 * G.unit + 2).fill({ color: cc[1] });
    for (let px = 0; px < W + 80; px += 140 * G.unit + 40) C.bridge.rect(px, by, 9 * G.unit + 2, 60 * G.unit).fill({ color: cc[1] });
    G.bridgeY = by;
    // mid blocks (panel blocks)
    drawMid(cc);
  }

  function drawMid(cc) {
    const W = G.W, gy = G.groundY, u = G.unit;
    const g = C.mid; g.clear();
    const blocks = G.portrait
      ? [{ x: -40 * u, w: 230 * u, h: 0.42 }, { x: W - 190 * u, w: 230 * u, h: 0.36 }]
      : [{ x: -30 * u, w: 330 * u, h: 0.5 }, { x: W * 0.16, w: 170 * u, h: 0.36 }, { x: W - 300 * u, w: 330 * u, h: 0.46 }, { x: W * 0.74, w: 150 * u, h: 0.3 }];
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
    });
    drawWindows();
  }

  function drawWindows() {
    const g = C.win; g.clear();
    for (const w of windows) {
      if (!w.on) { g.rect(w.x, w.y, w.w, w.h).fill({ color: 0x000000, alpha: 0.18 }); continue; }
      const col = w.tv ? (Math.sin(G.time * 9 + w.ph) > 0.2 ? 0x7FD3FF : 0x4C8BD8) : (w.ph > 3 ? 0xFFC86B : 0xFF9E5A);
      g.rect(w.x, w.y, w.w, w.h).fill({ color: col, alpha: 0.92 });
      g.rect(w.x + w.w * 0.48, w.y, Math.max(1, w.w * 0.06), w.h).fill({ color: 0x1B1622, alpha: 0.5 });
    }
  }

  function drawRoof() {
    const W = G.W, H = G.H, gy = G.groundY, u = G.unit;
    const g = C.roofG; g.clear();
    g.rect(-20, gy, W + 40, H - gy + 20).fill({ color: 0x2A2140 });
    g.rect(-20, gy, W + 40, 6 * u + 2).fill({ color: 0x1B1622 });
    for (let x = -20; x < W + 40; x += 48 * u + 10) g.rect(x, gy + 10 * u, 2, H - gy).fill({ color: 0x1B1622, alpha: 0.35 });
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

  function layout() {
    dotsBuilt = false;
    drawSky(); drawCity(); drawRoof();
    C.clouds.children.forEach((c, i) => {
      c.y = G.horizonY * (0.18 + i * 0.16);
      c.x = ((i * 0.37 + 0.1) % 1) * G.W;
      c.scale.set(G.unit * (0.7 + (i % 2) * 0.3) + 0.15);
    });
    tram.scale.set(0.3 * G.unit + 0.05);
    C.bunting.clear();
  }

  function update(dt) {
    const sec = dt / 1000;
    for (const c of C.clouds.children) {
      c.x += c._v * sec * (G.mode === 'race' ? 2.2 : 1);
      if (c.x < -c.width) c.x = G.W + c.width * 0.5;
      if (c.x > G.W + c.width) c.x = -c.width * 0.5;
    }
    C.sunRays.rotation += sec * 0.03;
    towerLight.alpha = (Math.sin(G.time * 3) > 0.3) ? 1 : 0.15;
    // flock: steer toward a wandering attractor, keep apart, match neighbours' heading, bank and glide
    const ax = G.W * (0.5 + 0.38 * Math.sin(G.time * 0.11)), ay = G.horizonY * (0.34 + 0.16 * Math.sin(G.time * 0.23));
    const R2 = 900 * G.unit * G.unit + 400, A2 = R2 * 6;
    for (let i = 0; i < flock.length; i++) {
      const b = flock[i];
      const px = b.x * G.W, py = b.y * G.H;
      let fx = (ax - px) * 0.0009 + Math.sin(G.time * 0.7 + b.ph) * 0.16, fy = (ay - py) * 0.0012 + Math.cos(G.time * 0.9 + b.ph) * 0.11;
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
      if (Math.random() < 0.04) FX.sparks(tram.x + tramDir * tram.width * 0.05, tram.y - tram.height, 3, 0x9FE8FF, 0.25);
      if ((tramDir > 0 && tram.x > G.W + tram.width) || (tramDir < 0 && tram.x < -tram.width)) { tram.visible = false; tramTimer = U.rand(22, 40); }
    }
    // laundry and antennas sway
    const wind = G.mode === 'race' ? 1.8 : 1;
    C.laundry.children.forEach((l, i) => { l.rotation = Math.sin(G.time * 2.1 * wind + l._ph) * 0.12 * wind; l.skew.x = Math.sin(G.time * 3.3 + l._ph) * 0.08 * wind; });
    C.antennas.children.forEach((a) => { a.rotation = Math.sin(G.time * 1.3 + a._ph) * 0.015 * wind; });
    // vent steam
    ventTimer -= sec;
    if (ventTimer <= 0) { ventTimer = 0.35; FX.steam(C.vent.x, C.vent.y - C.vent.height * 0.95); }
    // race fireworks + neighbours
    if (G.mode === 'race') {
      fireTimer -= sec;
      if (fireTimer <= 0) {
        fireTimer = U.rand(0.7, 1.6);
        FX.firework(U.rand(0.05, 0.95) * G.W, U.rand(0.08, 0.5) * G.horizonY, U.pick([COL.PINK, COL.YELLOW, COL.TEALL, COL.ORANGE, COL.VIOLETL]), 40, true);
        Audio2.play('firework');
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
    if (mode === 'race') showNeighbours(); else hideNeighbours();
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

  function snapNight() { palFrom = PAL.night; palTo = PAL.night; cityFrom = CITY.night; cityTo = CITY.night; palT = 1; drawSky(); drawCity(); }

  return { build, layout, update, setMode, snapNight, cheer, C, flock };
})();

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
  // crane: k = 1 is the title shot, high above the roofs looking at the sky; k = 0 is the game. Each depth group
  // drops by depth * k * D, and the loft, Gennady and the birds in flight drop the full D with the roof
  const CR = { k: 0, D: 0, auto: false, groups: [], fore: [] };
  // weather
  const WX = { wind: 1, windT: 1, gustT: 40, rainT: 200, rain: 0, rainOn: false, rainLeft: 0, planeT: 30, lit: false };
  let plane = null, planeLights = [];
  const bulbs = [], pennants = [];
  // a few loft pigeons pottering about the roof: they peck, walk a few steps, turn, and flutter up now and then
  const peckers = [];

  function feetAnchor(tex) {
    try {
      const c = tex.source.resource, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
      for (let y = c.height - 1; y > 0; y--) for (let k = 0; k < c.width; k += 2) if (d[(y * c.width + k) * 4 + 3] > 40) return (y + 1) / c.height;
    } catch (e) { /* fall back */ }
    return 0.86;
  }
  // vertical fade (transparent at the top, solid at the bottom) or a radial vignette, as textures to tint and stretch
  function gradTex(kind) {
    const c = document.createElement('canvas');
    if (kind === 'v') {
      c.width = 4; c.height = 256;
      const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      x.fillStyle = g; x.fillRect(0, 0, 4, 256);
    } else {
      c.width = c.height = 256;
      const x = c.getContext('2d'), g = x.createRadialGradient(128, 118, 40, 128, 128, 182);
      g.addColorStop(0, 'rgba(14,10,30,0)'); g.addColorStop(0.62, 'rgba(14,10,30,0.18)'); g.addColorStop(1, 'rgba(14,10,30,0.62)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    }
    return texFrom(c, false);
  }

  function build(world) {
    // depth groups, far to near: the intro's crane moves each by its depth, so the city opens up in layers
    const grp = (depth) => { const c = new PIXI.Container(); c._depth = depth; world.addChild(c); CR.groups.push(c); return c; };
    const gSky = grp(0.06), gCloud = grp(0.2), gFar = grp(0.42), gFlock = grp(0.55), gMid = grp(0.74), gNear = grp(1), gScreen = grp(0);
    C.sky = new PIXI.Sprite(PIXI.Texture.WHITE); gSky.addChild(C.sky);
    C.dots = new PIXI.Container(); gSky.addChild(C.dots);
    // the first stars in the deep band at the top of the evening; they twinkle
    C.stars = new PIXI.Container(); gSky.addChild(C.stars);
    for (let i = 0; i < 44; i++) {
      const st = sprite(G.tex.soft); st.blendMode = 'add'; st.tint = i % 5 ? 0xFFF1D6 : 0xCFE6FF;
      st._ph = Math.random() * 6; st._sp = U.rand(0.7, 1.9); st._k = U.rand(0.5, 1.15); C.stars.addChild(st);
    }
    C.sunC = new PIXI.Container(); gSky.addChild(C.sunC);
    C.sunRays = new PIXI.Graphics(); C.sunC.addChild(C.sunRays);
    C.sun = new PIXI.Graphics(); C.sunC.addChild(C.sun);
    C.planeC = new PIXI.Container(); gSky.addChild(C.planeC);
    C.clouds = new PIXI.Container(); gCloud.addChild(C.clouds);
    C.farC = new PIXI.Container(); gFar.addChild(C.farC);
    C.far = new PIXI.Graphics(); C.farC.addChild(C.far);
    towerLight = sprite(G.tex.soft); towerLight.tint = 0xFF3B3B; towerLight.blendMode = 'add'; C.farC.addChild(towerLight);
    C.bridge = new PIXI.Graphics(); C.farC.addChild(C.bridge);
    tram = sprite(G.tex.tram, 0.5, 1); C.farC.addChild(tram); tram.visible = false;
    // aerial perspective: the far skyline sinks into the glow of the horizon
    C.haze = new PIXI.Sprite(gradTex('v')); C.haze.alpha = 0.55; gFar.addChild(C.haze);
    G.layers.fxBack = new PIXI.Container(); gFar.addChild(G.layers.fxBack);
    C.flock = new PIXI.Container(); gFlock.addChild(C.flock);
    C.midC = new PIXI.Container(); gMid.addChild(C.midC);
    C.mid = new PIXI.Graphics(); C.midC.addChild(C.mid);
    C.winLow = new PIXI.Graphics(); C.midC.addChild(C.winLow);
    C.win = new PIXI.Graphics(); C.midC.addChild(C.win);
    C.tv = new PIXI.Graphics(); C.midC.addChild(C.tv);
    C.rail = new PIXI.Graphics(); C.midC.addChild(C.rail);
    C.neigh = new PIXI.Container(); C.midC.addChild(C.neigh);
    C.roof = new PIXI.Container(); gNear.addChild(C.roof);
    C.roofG = new PIXI.Graphics(); C.roof.addChild(C.roofG);
    C.antennas = new PIXI.Container(); C.roof.addChild(C.antennas);
    C.dish = sprite(G.tex.dish, 0.5, 1); C.roof.addChild(C.dish);
    C.vent = sprite(G.tex.vent, 0.5, 1); C.roof.addChild(C.vent);
    C.line = new PIXI.Graphics(); C.roof.addChild(C.line);
    // the loft sits on the roof: a soft contact shadow under its plinth
    C.loftShadow = sprite(G.tex.soft); C.loftShadow.tint = 0x0C0816; C.loftShadow.alpha = 0.55; C.roof.addChild(C.loftShadow);
    C.laundry = new PIXI.Container(); C.roof.addChild(C.laundry);
    // Race Day festoons: strings of pennants and bulbs strung across the roofs
    C.fest = new PIXI.Container(); C.fest.alpha = 0; C.fest.visible = false; gNear.addChild(C.fest);
    C.festLines = new PIXI.Graphics(); C.fest.addChild(C.festLines);
    C.festGlow = new PIXI.Container(); C.fest.addChild(C.festGlow);
    C.festItems = new PIXI.Container(); C.fest.addChild(C.festItems);
    // a warm glow behind the loft, and the drizzle veil
    C.glow = sprite(G.tex.soft); C.glow.tint = 0xFF9A4A; C.glow.blendMode = 'add'; C.glow.alpha = 0.32; gNear.addChild(C.glow);
    C.veil = new PIXI.Graphics(); C.veil.alpha = 0; gScreen.addChild(C.veil);
    // particles that belong in front of the blocks and behind the loft: rain, gusts, neighbours' confetti, vent steam
    G.layers.fxMid = new PIXI.Container(); gNear.addChild(G.layers.fxMid);
    // a soft vignette pulls the eye in to the loft; it darkens the city only, never the grid or Gennady
    C.vig = new PIXI.Sprite(gradTex('r')); gScreen.addChild(C.vig);
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
    C.peck = new PIXI.Container(); C.roof.addChild(C.peck);
    ['grey', 'white', 'pied'].forEach((br, i) => {
      const set = G.tex.bird && G.tex.bird[br];
      if (!set || !set.perch) return;
      const s = new PIXI.Sprite(set.perch);
      // stand them on their feet: find the lowest painted row of the perched frame once
      s.anchor.set(0.556, feetAnchor(set.perch));
      C.peck.addChild(s);
      peckers.push({ s, set, mode: 'peck', t: U.rand(0.5, 2), bob: 0, dir: i % 2 ? -1 : 1, x: 0, home: 0, range: 1, hop: 0, vy: 0, y: 0 });
    });
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
  const hexCss = (c) => '#' + (c >>> 0).toString(16).padStart(6, '0').slice(-6);
  // one smooth dusk gradient through the palette's bands (still crowding toward the horizon), with a fine riso
  // grain laid over it instead of hard bands and dotted seams
  function drawSky() {
    const W = G.W, H = G.H, hz = G.horizonY;
    const cols = skyBands();
    if (!C.skyCv) { C.skyCv = document.createElement('canvas'); C.skyCv.width = 2; C.skyCv.height = 512; }
    const top = -H * 1.5, bottom = H + 20, span = bottom - top;
    const edges = [0, 0.2, 0.36, 0.5, 0.62, 0.73, 0.84, 1.0].map((t) => t * (hz + H * 0.08));
    const x = C.skyCv.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, hexCss(cols[0]));
    for (let i = 0; i < 7; i++) g.addColorStop(U.clamp(((edges[i] + edges[i + 1]) / 2 - top) / span, 0, 1), hexCss(cols[i]));
    g.addColorStop(1, hexCss(cols[6]));
    x.fillStyle = g; x.fillRect(0, 0, 2, 512);
    if (!C.skyTx) { C.skyTx = texFrom(C.skyCv, false); C.sky.texture = C.skyTx; } else C.skyTx.source.update();
    C.sky.x = -W * 0.3; C.sky.y = top; C.sky.width = W * 1.6; C.sky.height = span;
    if (!dotsBuilt) {
      C.dots.removeChildren().forEach((d) => d.destroy());
      const ts = new PIXI.TilingSprite({ texture: G.tex.dotTile[2], width: W + 40, height: hz + H * 0.1 + 40 });
      ts.x = -20; ts.y = -20; ts.tileScale.set(Math.max(0.8, G.unit * 1.2));
      C.dots.addChild(ts);
      dotsBuilt = true;
    }
    C.dots.children.forEach((ts) => { ts.tint = U.mixColor(cols[1], 0x000000, 0.35); ts.alpha = 0.2; });
    if (C.haze) C.haze.tint = cols[5];
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
    const pts = [-60, hz + 40 + G.H * 0.7];
    while (x < W + 80) {
      const w = (24 + rnd() * 70) * Math.max(0.6, G.unit);
      const h = (20 + rnd() * 90) * Math.max(0.6, G.unit);
      pts.push(x, hz - h, x + w, hz - h);
      x += w + rnd() * 10;
    }
    pts.push(W + 80, hz + 40 + G.H * 0.7);
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
    const rl = C.rail; rl.clear();
    const blocks = G.portrait
      ? [{ x: -50 * u - 12, w: 240 * u + 12, h: 0.42 }, { x: W - 190 * u, w: 240 * u + 12, h: 0.36 }]
      : [{ x: -40 * u - 12, w: 340 * u + 12, h: 0.5 }, { x: W * 0.16, w: 170 * u, h: 0.36 }, { x: W - 300 * u, w: 340 * u + 12, h: 0.46 }, { x: W * 0.74, w: 150 * u, h: 0.3 }];
    windows = [];
    const low = [];
    seedR = 29;
    const dark = (c, k) => U.mixColor(c, 0x000000, k), warm = (c, k) => U.mixColor(c, 0xFF8A5A, k);
    const sunX = C.sunBase ? C.sunBase.x : W * 0.8;
    blocks.forEach((b, bi) => {
      // the blocks run on down past the roof line: the roof hides it, but the intro's crane shows their lower floors
      const top = gy - G.playH * b.h, hh = gy - top + 4 + G.H * 0.7;
      // the block, warm along the edge that faces the setting sun and shaded along the other
      g.rect(b.x, top, b.w, hh).fill({ color: cc[1] });
      const sunRight = b.x + b.w / 2 < sunX, edge = Math.max(4, 7 * u);
      g.rect(sunRight ? b.x + b.w - edge : b.x, top, edge, hh).fill({ color: warm(cc[1], 0.3) });
      g.rect(sunRight ? b.x : b.x + b.w - edge * 1.7, top, edge * 1.7, hh).fill({ color: dark(cc[1], 0.22) });
      // parapet, and a water tank or a lift room on most roofs
      g.rect(b.x - 2 * u, top - 10 * u, b.w + 4 * u, 10 * u).fill({ color: dark(cc[1], 0.25) });
      if (rnd() < 0.75) {
        const tw = Math.min(b.w * 0.26, 70 * u), tx = b.x + b.w * (0.18 + rnd() * 0.5);
        if (rnd() < 0.5) {
          g.rect(tx, top - 50 * u, tw, 30 * u).fill({ color: dark(cc[1], 0.2) });
          g.rect(tx, top - 50 * u, tw, 5 * u).fill({ color: dark(cc[1], 0.38) });
          for (const lx of [0.12, 0.84]) g.rect(tx + tw * lx, top - 20 * u, 3 * u, 10 * u).fill({ color: dark(cc[1], 0.38) });
        } else {
          g.rect(tx, top - 34 * u, tw, 24 * u).fill({ color: dark(cc[1], 0.12) });
          g.rect(tx + tw * 0.62, top - 30 * u, tw * 0.22, 14 * u).fill({ color: dark(cc[1], 0.32) });
        }
      }
      // concrete panels: seams between the floors and every other bay
      const cw = (27 + rnd() * 9) * u, ch = (32 + rnd() * 8) * u;
      const cols = Math.max(1, Math.floor((b.w - 20 * u) / cw)), rows = Math.max(1, Math.floor((gy + G.H * 0.7 - top - 30 * u) / ch));
      const ox = b.x + (b.w - cols * cw) / 2, y00 = top + 12 * u;
      const seam = Math.max(1, 1.2 * u);
      for (let r = 0; r <= rows; r++) g.rect(b.x + 4 * u, y00 + r * ch, b.w - 8 * u, seam).fill({ color: dark(cc[1], 0.4), alpha: 0.32 });
      for (let c = 2; c < cols; c += 2) g.rect(ox + c * cw - seam / 2, y00, seam, rows * ch).fill({ color: dark(cc[1], 0.4), alpha: 0.22 });
      const wf = 0.54 + rnd() * 0.16, hf = 0.56 + rnd() * 0.14, balc = rnd() < 0.65;
      for (let r = 0; r < rows; r++) {
        const y0 = y00 + r * ch;
        for (let c = 0; c < cols; c++) {
          const ww = cw * wf, wh = ch * hf, wx = ox + c * cw + (cw - ww) / 2, wy = y0 + (ch - wh) * 0.42;
          const cur = rnd();
          const win = { x: wx, y: wy, w: ww, h: wh, on: rnd() < 0.24, tv: rnd() < 0.08, ph: rnd() * 6, b: bi, cur: cur < 0.25 ? 1 : cur < 0.45 ? 2 : cur < 0.6 ? 3 : 0, plant: rnd() < 0.12 };
          // floors under the roof line only show during the intro's crane: they are painted once and never flicker
          (wy > gy ? low : windows).push(win);
        }
        // balconies on alternate floors: a solid front over the lower part of two windows at a time
        if (balc && r % 2 === 1) {
          for (let c = 0; c + 1 < cols; c += 3) {
            const bx = ox + c * cw + cw * 0.08, bw = cw * 1.84, by = y0 + ch * 0.62, bh = ch * 0.36;
            rl.rect(bx, by, bw, bh).fill({ color: dark(cc[1], 0.12) });
            rl.rect(bx, by, bw, Math.max(1, 2 * u)).fill({ color: warm(cc[1], 0.25) });
            for (let k = 1; k < 4; k++) rl.rect(bx + (bw * k) / 4, by + 2 * u, seam, bh - 3 * u).fill({ color: dark(cc[1], 0.35), alpha: 0.5 });
          }
        }
      }
      b.top = top;
    });
    C.blocks = blocks;
    drawWindows(); drawWindows(true);
    drawLow(low);
  }
  function drawLow(list) {
    const g = C.winLow; g.clear();
    for (const w of list) {
      if (!w.on) { g.rect(w.x, w.y, w.w, w.h).fill({ color: 0x0E0A1C, alpha: 0.42 }); continue; }
      const col = w.ph > 4 ? 0xFFE0A0 : w.ph > 2 ? 0xFFC86B : 0xFF9E5A;
      g.rect(w.x - w.w * 0.14, w.y - w.h * 0.12, w.w * 1.28, w.h * 1.24).fill({ color: col, alpha: 0.13 });
      g.rect(w.x, w.y, w.w, w.h).fill({ color: col, alpha: 0.95 });
      if (w.cur & 1) g.rect(w.x, w.y, w.w * 0.26, w.h).fill({ color: 0x8A3A4A, alpha: 0.5 });
      g.rect(w.x + w.w * 0.48, w.y, Math.max(1, w.w * 0.05), w.h).fill({ color: 0x1B1622, alpha: 0.45 });
    }
  }

  // still windows redraw only when one switches; the flickering TVs (and every window when the block lights up)
  // redraw on their own small layer at a steady beat
  function drawWindows(tvOnly) {
    const flick = WX.lit;
    const g = tvOnly && !flick ? C.tv : C.win;
    g.clear();
    if (!tvOnly || flick) C.tv.clear();
    const u = G.unit, px = Math.max(1, 2 * u);
    for (const w of windows) {
      if (tvOnly && !flick && !(w.tv && w.on)) continue;
      if (!tvOnly && !flick && w.tv && w.on) continue;
      const on = w.on || WX.lit;
      if (!on) {
        // dark glass with a faint glint of the evening sky
        g.rect(w.x, w.y, w.w, w.h).fill({ color: 0x0E0A1C, alpha: 0.42 });
        g.poly([w.x + w.w * 0.12, w.y + w.h, w.x + w.w * 0.6, w.y, w.x + w.w * 0.82, w.y, w.x + w.w * 0.34, w.y + w.h]).fill({ color: 0xFFC8B0, alpha: 0.07 });
        continue;
      }
      const col = w.tv ? (Math.sin(G.time * 9 + w.ph) > 0.2 ? 0x8FD8FF : 0x4C8BD8) : (WX.lit ? (Math.sin(G.time * 6 + w.ph * 3) > 0 ? 0xFFE08A : 0xFFB45E) : (w.ph > 4 ? 0xFFE0A0 : w.ph > 2 ? 0xFFC86B : 0xFF9E5A));
      g.rect(w.x - w.w * 0.14, w.y - w.h * 0.12, w.w * 1.28, w.h * 1.24).fill({ color: col, alpha: 0.13 });
      g.rect(w.x, w.y, w.w, w.h).fill({ color: col, alpha: 0.95 });
      // curtains, the frame's cross bar, a plant on the sill, the sill's shadow
      if (w.cur & 1) g.rect(w.x, w.y, w.w * 0.26, w.h).fill({ color: 0x8A3A4A, alpha: 0.5 });
      if (w.cur & 2) g.rect(w.x + w.w * 0.74, w.y, w.w * 0.26, w.h).fill({ color: 0x8A3A4A, alpha: 0.5 });
      g.rect(w.x + w.w * 0.48, w.y, Math.max(1, w.w * 0.05), w.h).fill({ color: 0x1B1622, alpha: 0.45 });
      g.rect(w.x, w.y + w.h * 0.34, w.w, Math.max(1, w.h * 0.04)).fill({ color: 0x1B1622, alpha: 0.3 });
      if (w.plant) g.circle(w.x + w.w * 0.3, w.y + w.h * 0.84, w.w * 0.17).fill({ color: 0x1B1622, alpha: 0.7 });
      g.rect(w.x, w.y + w.h - px, w.w, px).fill({ color: 0x1B1622, alpha: 0.4 });
    }
  }

  function drawRoof() {
    const W = G.W, H = G.H, gy = G.groundY, u = G.unit;
    const g = C.roofG; g.clear();
    g.rect(-60, gy, W + 120, H - gy + 20).fill({ color: 0x2A2140 });
    g.rect(-60, gy, W + 120, 6 * u + 2).fill({ color: 0x1B1622 });
    for (let x = -60; x < W + 80; x += 48 * u + 10) g.rect(x, gy + 10 * u, 2, H - gy).fill({ color: 0x1B1622, alpha: 0.35 });
    // antennas and the dish keep out from behind Gennady, where they read as parts of him
    const clear = (x, pad) => !G.genSpan || x < G.genSpan.x0 - pad || x > G.genSpan.x1 + pad;
    const ax = (G.portrait ? [W * 0.08, W * 0.9] : [W * 0.06, W * 0.2, W * 0.93]).filter((x) => clear(x, 26 * u + 10));
    C.antennas.children.forEach((a, i) => {
      a.visible = i < ax.length;
      if (!a.visible) return;
      a.clear();
      const h = (G.portrait ? 120 : 190) * u + 30;
      a.rect(-2 * u - 1, -h, 4 * u + 2, h).fill({ color: 0x1B1622 });
      for (let k = 0; k < 4; k++) { const w = (60 - k * 10) * u; a.rect(-w / 2, -h + k * 22 * u, w, 4 * u + 1).fill({ color: 0x1B1622 }); }
      a.x = ax[i]; a.y = gy;
    });
    C.dish.visible = !G.portrait && clear(W * 0.86, 70 * u + 20); C.dish.x = W * 0.86; C.dish.y = gy; C.dish.scale.set(0.8 * u + 0.1);
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
    seedR = 41;
    C.stars.children.forEach((st) => {
      st.x = rnd() * G.W; st.y = Math.pow(rnd(), 1.5) * G.horizonY * 0.36 - 10;
      st.scale.set(st._k * (0.045 * G.unit + 0.018));
    });
    C.clouds.children.forEach((c, i) => {
      c.y = G.horizonY * (0.18 + i * 0.16);
      c.x = ((i * 0.37 + 0.1) % 1) * G.W;
      c.scale.set(G.unit * (0.7 + (i % 2) * 0.3) + 0.15);
    });
    tram.scale.set(0.3 * G.unit + 0.05);
    // where the pigeons potter: the free roof under the loft on phones, beside the loft's foot on wider screens
    const pu = Math.max(0.6, G.unit), lx0 = G.loftX - G.loftW / 2;
    const spots = G.portrait
      ? [[G.W * 0.55, G.W * 0.92], [G.W * 0.62, G.W * 0.95], [G.W * 0.4, G.W * 0.7]]
      : [[lx0 - 150 * pu, lx0 - 30 * pu], [lx0 - 120 * pu, lx0 - 20 * pu], [-1, -1]];
    const gy2 = G.portrait ? G.groundY + (G.playH - G.groundY) * 0.62 : G.groundY + 3;
    peckers.forEach((p, i) => {
      const [a, b] = spots[i] || [-1, -1];
      p.on = a >= 0 && b - a > 30 && (G.portrait || a > 140 * pu);
      p.s.visible = p.on;
      p.home = (a + b) / 2; p.range = (b - a) / 2; p.x = p.home + U.rand(-0.5, 0.5) * p.range; p.y = gy2 + i * 4 * pu;
      p.k = (Math.max(34, 70 * G.unit) / (282 * G.tex.birdS)) * (0.9 + i * 0.06);
    });
    C.loftShadow.x = G.loftX; C.loftShadow.y = G.groundY + 6 * G.unit; C.loftShadow.scale.set((G.loftW * 1.25) / 128, (34 * G.unit + 14) / 128);
    // the warm glow sits behind the gable
    C.glow.x = G.loftX; C.glow.y = G.groundY - HomingWorld.LOFT.h * G.loftScale * 0.7;
    C.glow.scale.set((G.loftW * 2.2) / 128, (G.loftW * 1.7) / 128);
    C.veil.clear().rect(-60, -60, G.W + 120, G.H + 120).fill({ color: 0x1A1430 });
    const hzTop = G.horizonY - G.playH * 0.3;
    C.haze.x = -80; C.haze.width = G.W + 160; C.haze.y = hzTop; C.haze.height = G.horizonY + 40 * G.unit - hzTop;
    C.vig.x = -40; C.vig.y = -40; C.vig.width = G.W + 80; C.vig.height = G.H + 80;
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
    for (const st of C.stars.children) { const w = 0.5 + 0.5 * Math.sin(G.time * st._sp + st._ph); st.alpha = 0.18 + 0.72 * w * w * w; }
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
      drawWindows(); drawWindows(true);
    }
    winRedraw -= sec;
    if (winRedraw <= 0) { winRedraw = 0.09; drawWindows(true); }
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
    for (const p of peckers) {
      // on phones the Race Day board takes the roof under the loft, so they keep out of its way
      p.s.visible = p.on && !(G.portrait && G.mode === 'race');
      if (!p.s.visible) continue;
      p.t -= sec;
      if (p.mode === 'peck') {
        // head down, head up: the two perched frames
        p.bob -= sec; if (p.bob <= 0) { p.bob = U.rand(0.18, 0.5); p.s.texture = p.s.texture === p.set.perch ? p.set.perchBob : p.set.perch; }
        if (p.t <= 0) { const r = Math.random(); p.mode = r < 0.55 ? 'walk' : r < 0.8 ? 'turn' : 'hop'; p.t = U.rand(0.5, 1.3); if (p.mode === 'hop' && !G.reduced) { p.vy = -U.rand(160, 260) * G.unit; p.s.texture = p.set.perchFlap || p.set.perch; } }
      } else if (p.mode === 'walk') {
        p.x += p.dir * 28 * G.unit * sec;
        p.s.texture = Math.sin(G.time * 18) > 0 ? p.set.perch : p.set.perchBob;
        if (Math.abs(p.x - p.home) > p.range) { p.dir = Math.sign(p.home - p.x) || 1; }
        if (p.t <= 0) { p.mode = 'peck'; p.t = U.rand(1, 3); }
      } else if (p.mode === 'turn') { p.dir *= -1; p.mode = 'peck'; p.t = U.rand(0.8, 2.4); }
      else if (p.mode === 'hop') {
        p.hop += p.vy * sec; p.vy += 900 * G.unit * sec;
        if (p.hop >= 0) { p.hop = 0; p.vy = 0; p.mode = 'peck'; p.t = U.rand(1, 3); p.s.texture = p.set.perch; }
      }
      p.s.x = p.x; p.s.y = p.y + p.hop;
      p.s.scale.set(p.k * p.dir, p.k);
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
    applyCrane();
  }

  function applyCrane() {
    // on the title the distance follows Gennady (his pose settles after the first frames); the intro fixes it
    if (CR.auto && CR.k > 0) CR.D = Math.max(CR.D, craneDistance());
    const off = CR.k * CR.D;
    for (const g of CR.groups) g.y = g._depth * off;
    for (const l of CR.fore) if (l && !l.destroyed) l.y = off;
  }
  // the distance that hides the whole roof and everything on it below the bottom edge
  function craneDistance() {
    const loftTop = G.groundY - HomingWorld.LOFT.h * G.loftScale;
    let top = loftTop;
    // his bounds are on screen, so take back whatever crane offset his layer carries right now
    try { const b = Gennady.bounds(); if (b && isFinite(b.y)) top = Math.min(top, b.y - (G.layers.gennady ? G.layers.gennady.y : 0)); } catch (e) { /* not built yet */ }
    // the pet on his cap stands a little above the cap
    return Math.max(G.H * 0.5, G.H - top + 90 * Math.max(0.6, G.unit));
  }
  function crane(k, D) {
    CR.k = k;
    CR.auto = D == null;
    CR.D = D == null ? craneDistance() : D;
    if (!CR.fore.length && G.layers) CR.fore = [G.layers.loft, G.layers.gennady, G.layers.flight];
    applyCrane();
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
  function lightsUp(on) { WX.lit = !!on; drawWindows(); drawWindows(true); }

  function snapNight() { palFrom = PAL.night; palTo = PAL.night; cityFrom = CITY.night; cityTo = CITY.night; palT = 1; drawSky(); drawCity(); }

  return { build, layout, update, setMode, snapNight, cheer, lightsUp, gust, crane, craneDistance, CR, C, flock, WX };
})();

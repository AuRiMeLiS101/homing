/* HOMING logo. Custom heavy lettering built from geometry (no stock face), set on a gentle bridge with a racing
   slant. The O is the race clock that times a homing pigeon in, and a pigeon is landing on its crown. Under the
   word sits a tram ticket plaque. Layered like a screen printed sticker: a soft cast shadow, one solid extrusion
   with a heavy outer keyline, an orange rim, an ink keyline round each letter, a cream face with a cut bevel
   (edges that face up catch the light, edges that face down fall into shade) and a single gloss pass. Light comes
   from the top left like the rest of the game. Drawn in design units (cap height 230), scaled to the pixels shown. */
(function (root) {
  'use strict';
  const AC = root.HomingArtCore, C = AC.C;
  const CAP = 230;

  // ---------- geometry helpers ----------
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  function arc(cx, cy, rx, ry, a0, a1, n) {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return out;
  }
  function area(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; }
  // outer contours turn one way and holes the other, so a nonzero fill unions the parts and keeps counters open
  const solid = (p) => (area(p) < 0 ? p.slice().reverse() : p);
  const hole = (p) => (area(p) > 0 ? p.slice().reverse() : p);
  function densify(p, step) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
      for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)]);
    }
    return out;
  }
  function rot(p, cx, cy, a) { const c = Math.cos(a), s = Math.sin(a); return p.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]); }

  // ---------- the letters ----------
  // Stems 60 wide, bars 52, diagonals cut to the same colour. Each glyph lists its contours and its advance.
  const OR = 127, OI = 66;              // clock ring: outer and inner radius
  const GRX = 116, GRY = 127, GT = 58;  // G bowl
  function glyphs() {
    const H = { w: 190, c: [rect(0, 0, 60, CAP), rect(130, 0, 190, CAP), rect(50, 90, 140, 142)].map(solid) };
    const ocx = OR, ocy = CAP / 2, top = ocy - OR;
    const O = {
      w: OR * 2, clock: { cx: ocx, cy: ocy },
      c: [solid(arc(ocx, ocy, OR, OR, 0, Math.PI * 2, 160).slice(0, -1)), hole(arc(ocx, ocy, OI, OI, 0, Math.PI * 2, 120).slice(0, -1)),
        // the crown: a stem and a knurled cap, and the lap button at two o'clock
        solid(rect(ocx - 17, top - 34, ocx + 17, top + 12)), solid(rect(ocx - 36, top - 64, ocx + 36, top - 28)),
        solid(rot(rect(ocx - 15, top - 20, ocx + 15, top + 16), ocx, ocy, Math.PI * 0.27))]
    };
    const M = { w: 260, c: [solid([[0, CAP], [0, 0], [70, 0], [130, 116], [190, 0], [260, 0], [260, CAP], [200, CAP], [200, 98], [150, 190], [110, 190], [60, 98], [60, CAP]])] };
    const I = { w: 60, c: [solid(rect(0, 0, 60, CAP))] };
    const N = { w: 196, c: [solid([[0, CAP], [0, 0], [70, 0], [136, 128], [136, 0], [196, 0], [196, CAP], [126, CAP], [60, 102], [60, CAP]])] };
    // G: an open bowl cut radially at the top right, and a bar that runs in from the right at the waist
    const gcx = GRX, gcy = CAP / 2, a0 = -0.07, a1 = Math.PI * 2 - 1.08;
    const ring = arc(gcx, gcy, GRX, GRY, a0, a1, 140).concat(arc(gcx, gcy, GRX - GT, GRY - GT, a1, a0, 110));
    const G = { w: GRX * 2, c: [solid(ring), solid(rect(gcx + 4, gcy - 8, gcx + GRX, gcy + 46)), solid(rect(gcx + GRX - 60, gcy - 8, gcx + GRX, gcy + 70))] };
    return { H, O, M, I, N, G };
  }

  // ---------- the word on its bridge ----------
  const WORD = 'HOMING', GAP = 12;
  const OPT = { arch: 34, bulge: 0.07, skew: 0.12, step: 5 };
  function buildWord(o) {
    const g = glyphs();
    let x = 0;
    const placed = [];
    for (const ch of WORD) { const gl = g[ch]; placed.push({ ch, gl, x }); x += gl.w + GAP; }
    const width = x - GAP, mid = width / 2, half = width / 2;
    const warp = ([px, py]) => {
      const u = (px - mid) / half, k = 1 - u * u, h = CAP - py;
      return [px + h * o.skew, CAP - h * (1 + o.bulge * k) - o.arch * k];
    };
    const contours = [];
    let clock = null;
    for (const p of placed) {
      for (const c of p.gl.c) contours.push(densify(c.map(([cx, cy]) => [cx + p.x, cy]), o.step).map(warp));
      if (p.gl.clock) {
        const cx = p.x + p.gl.clock.cx, cy = p.gl.clock.cy;
        // the dial follows the warp: its centre, its size and the lean of its vertical axis
        const c0 = warp([cx, cy]), t = warp([cx, cy - OR]), bt = warp([cx, cy + OR]);
        clock = { x: c0[0], y: c0[1], r: Math.hypot(t[0] - bt[0], t[1] - bt[1]) / 2, lean: Math.atan2(t[0] - bt[0], bt[1] - t[1]), warp,
          crown: warp([cx, cy - OR - 64]), cap: warp([cx, cy - OR - 46]), ox: cx, oy: cy };
      }
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of contours) for (const [px, py] of c) { if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
    return { contours, clock, box: { x0, y0, x1, y1 }, width, warp };
  }
  function pathOf(contours, dx, dy) {
    const p = new Path2D();
    dx = dx || 0; dy = dy || 0;
    for (const c of contours) {
      p.moveTo(c[0][0] + dx, c[0][1] + dy);
      for (let i = 1; i < c.length; i++) p.lineTo(c[i][0] + dx, c[i][1] + dy);
      p.closePath();
    }
    return p;
  }

  // ---------- colours and weights ----------
  const K = {
    ink: C.INK, shadow: 'rgba(14,8,26,0.55)',
    rim: '#FF8A3A', rimTop: '#FFA650', rimBot: '#F2692A', extTop: '#E4501E', extBot: '#8E2412',
    faceTop: '#FFF9EC', faceMid: '#F8EAD0', faceBot: '#F4CB96', lit: '#FFFFFF', shade: '#E39A63',
    dial: '#12303A', tick: '#F6ECD8', hand: '#FF6A2B',
    plaque: '#00838A', plaqueTop: '#22A69E', plaqueBot: '#006C74', plaqueExt: '#063E46', plaqueText: '#F6ECD8', stub: '#FFD23F'
  };
  // stroke widths in design units: the outer keyline, the rim inside it, the keyline round each letter face
  const RIM = { out: 30, rim: 20, key: 6 };
  const EXT = { depth: 40, dx: 0.3 };

  // ---------- painting ----------
  function dilateDraw(x, path, r, color) {
    x.fillStyle = color; x.strokeStyle = color; x.lineWidth = r * 2; x.lineJoin = 'round';
    x.fill(path); if (r > 0) x.stroke(path);
  }
  // a cast shadow: the silhouette drawn far off canvas with its blurred shadow thrown back into place
  function castShadow(x, path, r, blur, dy, color, s) {
    x.save();
    const far = 10000;
    x.shadowColor = color; x.shadowBlur = blur * s; x.shadowOffsetX = far * s; x.shadowOffsetY = dy * s;
    x.translate(-far, 0);
    dilateDraw(x, path, r, '#000');
    x.restore();
  }
  const big = (b) => [b.x0 - 80, b.y0 - 300, b.x1 - b.x0 + 160, b.y1 - b.y0 + 600];

  function paintBlock(x, W, s, o) {
    const steps = Math.max(8, Math.ceil((EXT.depth * s) / 1.2));
    const ex = (t) => [EXT.depth * EXT.dx * t, EXT.depth * t];
    const face = pathOf(W.contours);
    // 1. cast shadow of the whole block
    if (o.shadow !== false) {
      const block = new Path2D();
      for (let i = 0; i <= 8; i++) { const [dx, dy] = ex(i / 8); block.addPath(pathOf(W.contours, dx, dy)); }
      castShadow(x, block, RIM.out, 26, 24, K.shadow, s);
    }
    // 2. the extrusion: a heavy ink keyline round the whole block, then the body, darkening with depth
    for (let i = steps; i >= 0; i--) { const [dx, dy] = ex(i / steps); dilateDraw(x, pathOf(W.contours, dx, dy), RIM.out, K.ink); }
    for (let i = steps; i >= 1; i--) {
      const t = i / steps, [dx, dy] = ex(t);
      dilateDraw(x, pathOf(W.contours, dx, dy), RIM.rim, mix(K.extTop, K.extBot, Math.pow(t, 0.85)));
    }
    // the rim is the front plane: bright, lit from above, with a fine ink line where it turns into the extrusion
    x.save(); x.globalAlpha = 0.55; dilateDraw(x, pathOf(W.contours, 0, 3), RIM.rim + 1.5, K.ink); x.restore();
    const rg = x.createLinearGradient(0, W.box.y0 - RIM.rim, 0, W.box.y1 + RIM.rim);
    rg.addColorStop(0, K.rimTop); rg.addColorStop(1, K.rimBot);
    dilateDraw(x, face, RIM.rim, rg);
  }
  function paintFace(x, W, s, o) {
    const face = pathOf(W.contours);
    // 3. the ink keyline round each letter face
    dilateDraw(x, face, RIM.key, K.ink);
    // 4. the face: a shaded band on edges that face down, a lit band on edges that face up, a warm ramp between
    const b = W.box, R = big(b);
    const g = x.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, K.faceTop); g.addColorStop(0.55, K.faceMid); g.addColorStop(1, K.faceBot);
    x.save();
    x.clip(face);
    x.fillStyle = K.shade; x.fillRect(...R);
    x.clip(pathOf(W.contours, 0, -13));
    x.fillStyle = K.lit; x.fillRect(...R);
    x.clip(pathOf(W.contours, -2.5, 8));
    x.fillStyle = g; x.fillRect(...R);
    x.restore();
    // 5. one gloss pass across the upper face, the way enamel catches a window
    if (o.gloss !== false) {
      x.save(); x.clip(face); x.clip(pathOf(W.contours, 0, 18));
      const gl = new Path2D(), w = b.x1 - b.x0;
      const yA = b.y0 + 34, yB = b.y0 + 96;
      gl.moveTo(b.x0 - 40, yA + 40);
      gl.bezierCurveTo(b.x0 + w * 0.3, yA - 30, b.x0 + w * 0.7, yA - 10, b.x1 + 40, yA + 10);
      gl.lineTo(b.x1 + 40, yB - 20);
      gl.bezierCurveTo(b.x0 + w * 0.7, yB - 30, b.x0 + w * 0.3, yB, b.x0 - 40, yB + 50);
      gl.closePath();
      x.fillStyle = 'rgba(255,255,255,0.45)'; x.fill(gl);
      x.restore();
    }
    return face;
  }

  // the race clock's face inside the O: a dark dial, ticks, the sweep hand stopped as a bird is clocked in
  function paintClock(x, W, o) {
    const k = W.clock;
    if (!k) return;
    const r = (OI - RIM.key) * (k.r / OR);
    x.save();
    x.translate(k.x, k.y); x.rotate(k.lean);
    const g = x.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#22505E'); g.addColorStop(1, K.dial);
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r + 0.5, 0, Math.PI * 2); x.fill();
    // the ring throws a shadow onto the top of the dial
    x.save(); x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.clip();
    x.fillStyle = 'rgba(0,0,0,0.4)'; x.beginPath(); x.arc(0, 0, r * 1.2, 0, Math.PI * 2); x.arc(0, r * 0.14, r * 1.02, 0, Math.PI * 2, true); x.fill('evenodd');
    x.restore();
    // ticks: twelve, the quarters long
    x.strokeStyle = K.tick; x.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2, q = i % 3 === 0;
      x.lineWidth = q ? 7 : 4;
      const r0 = r * (q ? 0.6 : 0.72), r1 = r * 0.86;
      x.beginPath(); x.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); x.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1); x.stroke();
    }
    // the sweep hand (a layered logo paints it on its own canvas so it can run)
    if (o.hand !== false) handAt(x, r, o.hand == null ? HAND : o.hand);
    // glass: a soft window reflection across the top left
    x.save(); x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.clip();
    x.fillStyle = 'rgba(255,255,255,0.13)'; x.beginPath(); x.ellipse(-r * 0.28, -r * 0.48, r * 0.8, r * 0.34, -0.5, 0, Math.PI * 2); x.fill();
    x.restore();
    x.restore();
    // knurling on the crown cap
    x.save(); x.translate(k.cap[0], k.cap[1]); x.rotate(k.lean);
    x.strokeStyle = 'rgba(27,22,34,0.32)'; x.lineWidth = 4;
    for (let i = -3; i <= 3; i++) { x.beginPath(); x.moveTo(i * 9, -11); x.lineTo(i * 9, 11); x.stroke(); }
    x.restore();
  }

  // the sweep hand with its counterweight tail and the centre cap, drawn about the dial's centre
  const HAND = 0.62;
  function handAt(x, r, a) {
    x.save(); x.rotate(a);
    x.fillStyle = K.ink; x.beginPath(); x.moveTo(-7.5, r * 0.28); x.lineTo(-4.5, -r * 0.8); x.lineTo(0, -r * 0.9); x.lineTo(4.5, -r * 0.8); x.lineTo(7.5, r * 0.28); x.closePath(); x.fill();
    x.fillStyle = K.hand; x.beginPath(); x.moveTo(-3.8, r * 0.22); x.lineTo(-2.2, -r * 0.76); x.lineTo(0, -r * 0.83); x.lineTo(2.2, -r * 0.76); x.lineTo(3.8, r * 0.22); x.closePath(); x.fill();
    x.restore();
    x.fillStyle = K.ink; x.beginPath(); x.arc(0, 0, 13, 0, Math.PI * 2); x.fill();
    x.fillStyle = K.hand; x.beginPath(); x.arc(0, 0, 8, 0, Math.PI * 2); x.fill();
  }
  function paintHand(x, W, a) {
    const k = W.clock;
    if (!k) return;
    x.save(); x.translate(k.x, k.y); x.rotate(k.lean);
    handAt(x, (OI - RIM.key) * (k.r / OR), a);
    x.restore();
  }

  // ---------- the ticket plaque ----------
  function ticketPath(x0, y0, w, h, r, notch) {
    const p = new Path2D(), x1 = x0 + w, y1 = y0 + h, ym = y0 + h / 2;
    p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.arcTo(x1, y0, x1, y0 + r, r);
    p.lineTo(x1, ym - notch); p.arc(x1, ym, notch, -Math.PI / 2, Math.PI / 2, true);
    p.lineTo(x1, y1 - r); p.arcTo(x1, y1, x1 - r, y1, r); p.lineTo(x0 + r, y1); p.arcTo(x0, y1, x0, y1 - r, r);
    p.lineTo(x0, ym + notch); p.arc(x0, ym, notch, Math.PI / 2, -Math.PI / 2, true);
    p.lineTo(x0, y0 + r); p.arcTo(x0, y0, x0 + r, y0, r); p.closePath();
    return p;
  }
  const TAG_FONT = '900 36px "Archivo", "Helvetica Neue", Arial, sans-serif';
  function plaqueBox(W, o, x) {
    const text = o.tagline || 'ROOFTOP PIGEON RACING';
    x.save(); x.font = TAG_FONT; if ('letterSpacing' in x) x.letterSpacing = '7px';
    const tw = x.measureText(text).width; x.restore();
    const stubW = 86, w = tw + 84 + stubW, h = 70;
    const b = W.box, cx = (b.x0 + b.x1) / 2 + 10, top = CAP + 22;
    return { text, stubW, w, h, cx, top, x0: cx - w / 2 };
  }
  function paintPlaque(x, W, s, o) {
    const P = plaqueBox(W, o, x), { stubW, w, h, top, x0 } = P;
    x.save();
    // lean with the word
    x.translate(P.cx, top + h / 2); x.transform(1, 0, -OPT.skew, 1, 0, 0); x.translate(-P.cx, -(top + h / 2));
    const body = ticketPath(x0, top, w, h, 10, 13);
    const depth = 16;
    if (o.shadow !== false) castShadow(x, body, 16, 16, 18, K.shadow, s);
    for (let i = depth; i >= 0; i -= 2) { x.save(); x.translate(i * EXT.dx, i); dilateDraw(x, body, 15, K.ink); x.restore(); }
    for (let i = depth; i >= 2; i -= 2) { x.save(); x.translate(i * EXT.dx, i); dilateDraw(x, body, 7, K.plaqueExt); x.restore(); }
    dilateDraw(x, body, 6, K.ink);
    x.save(); x.clip(body);
    const g = x.createLinearGradient(0, top, 0, top + h);
    g.addColorStop(0, K.plaqueTop); g.addColorStop(0.5, K.plaque); g.addColorStop(1, K.plaqueBot);
    x.fillStyle = g; x.fillRect(x0 - 10, top - 10, w + 20, h + 20);
    x.fillStyle = K.stub; x.fillRect(x0 - 10, top - 10, stubW + 10, h + 20);
    // top edge catches the light
    x.fillStyle = 'rgba(255,255,255,0.3)'; x.fillRect(x0 - 10, top, w + 20, 6);
    x.restore();
    // the perforation and the loft number on the stub
    x.fillStyle = K.ink;
    for (let yy = top + 9; yy < top + h - 5; yy += 11) { x.beginPath(); x.arc(x0 + stubW, yy, 3.4, 0, Math.PI * 2); x.fill(); }
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 40px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif';
    x.fillText('№9', x0 + stubW / 2 - 3, top + h / 2 + 2);
    x.font = TAG_FONT; if ('letterSpacing' in x) x.letterSpacing = '7px';
    const tx = x0 + stubW + (w - stubW) / 2 + 4;
    x.fillStyle = 'rgba(4,36,42,0.6)'; x.fillText(P.text, tx + 2, top + h / 2 + 4);
    x.fillStyle = K.plaqueText; x.fillText(P.text, tx, top + h / 2 + 1);
    x.restore();
    return P;
  }

  // ---------- the pigeon on the crown ----------
  const birdCache = new Map();
  function birdArt(pose, breed, bs) {
    const key = pose + breed + bs.toFixed(4);
    if (birdCache.has(key)) return birdCache.get(key);
    const B = root.HomingBirds;
    const lw = 8;
    const art = B.frameCanvas(pose, breed, bs, { lw: lw * bs, mis: 3 * bs, dotScale: 1 });
    const flat = B.frameCanvas(pose, breed, bs, { flat: '#000', lw: lw * bs });
    const d = flat.getContext('2d').getImageData(0, 0, flat.width, flat.height).data;
    // the box of everything painted
    let bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
    for (let yy = 0; yy < flat.height; yy++) for (let xx = 0; xx < flat.width; xx++) if (d[(yy * flat.width + xx) * 4 + 3] > 100) { if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy; }
    // the toes of a perched bird sit at (9, 60) in bird units (see the legs in art_birds.js)
    const foot = { x: (9 - B.BOX.x0) * bs, y: (60 - B.BOX.y0) * bs };
    const out = { art, flat, foot, box: { x0: bx0, y0: by0, x1: bx1, y1: by1 } };
    birdCache.set(key, out);
    return out;
  }
  function tinted(src, color) {
    const c = AC.mk(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }
  // dilate a silhouette by stamping it round three rings
  function stamp(x, src, px, py, r) {
    for (const f of [1, 0.66, 0.33]) {
      const n = Math.max(12, Math.round(28 * f));
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; x.drawImage(src, px + Math.cos(a) * r * f, py + Math.sin(a) * r * f); }
    }
    x.drawImage(src, px, py);
  }
  // where the bird goes, in design units, for a given canvas scale
  function birdPlace(W, s, o) {
    const bs = (o.birdSize || 0.66) * s;
    const A = birdArt(o.pose || 'land', o.breed || 'white', bs);
    const k = W.clock;
    const ox = k.crown[0] - A.foot.x / s + (o.birdDx || 0), oy = k.crown[1] - A.foot.y / s + (o.birdDy || 2);
    return { A, ox, oy, box: { x0: ox + A.box.x0 / s, y0: oy + A.box.y0 / s, x1: ox + A.box.x1 / s, y1: oy + A.box.y1 / s } };
  }
  function paintBird(x, s, place, origin, part) {
    const { A } = place;
    const px = (place.ox - origin.x) * s, py = (place.oy - origin.y) * s;
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    if (part !== 'art') {
      stamp(x, tinted(A.flat, K.ink), px + 1.5 * s, py + 3 * s, (RIM.out - 5) * s);
      stamp(x, tinted(A.flat, K.rimTop), px, py, (RIM.rim - 8) * s);
    }
    if (part !== 'rims') {
      stamp(x, tinted(A.flat, K.ink), px, py, RIM.key * s);
      x.drawImage(A.art, px, py);
    }
    x.restore();
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
    const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
    const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }

  // ---------- public ----------
  // paint({ s: pixels per design unit, bird, plaque, shadow, gloss, pose, breed, hand })
  // returns { canvas, s, word, crown, clock, plaque } with positions in canvas pixels
  // the plan: geometry, placements and the canvas bounds in design units, shared by paint() and layers()
  function plan(o) {
    o = Object.assign({ s: 0.5, bird: true, plaque: true }, o || {});
    const s = o.s;
    const W = buildWord(Object.assign({}, OPT, o.warp || {}));
    const b = W.box;
    const P = o.plaque ? plaqueBox(W, o, AC.mk(4, 4).getContext('2d')) : null;
    // the bird's place is planned even when it is not painted, so a layered logo keeps the same bounds
    const bird = W.clock && o.bird !== false ? birdPlace(W, s, o) : null;
    let left = b.x0 - RIM.out - 34, right = b.x1 + RIM.out + EXT.depth * EXT.dx + 34;
    let top = b.y0 - RIM.out - 24, bottom = b.y1 + EXT.depth + RIM.out + 40;
    if (W.clock) top = Math.min(top, W.clock.crown[1] - RIM.out - 20);
    if (P) { left = Math.min(left, P.x0 - 40); right = Math.max(right, P.x0 + P.w + 50); bottom = Math.max(bottom, P.top + P.h + 16 + 44); }
    if (bird) { top = Math.min(top, bird.box.y0 - RIM.out - 10); left = Math.min(left, bird.box.x0 - RIM.out - 10); right = Math.max(right, bird.box.x1 + RIM.out + 10); }
    const at = (px, py) => ({ x: (px - left) * s, y: (py - top) * s });
    return {
      o, s, W, P, bird, left, top, right, bottom, w: Math.ceil((right - left) * s), h: Math.ceil((bottom - top) * s),
      meta: {
        s, w: Math.ceil((right - left) * s), h: Math.ceil((bottom - top) * s),
        word: Object.assign(at(b.x0, b.y0), { w: (b.x1 - b.x0) * s, h: (b.y1 - b.y0) * s }),
        crown: W.clock ? at(W.clock.crown[0], W.clock.crown[1]) : null,
        clock: W.clock ? Object.assign(at(W.clock.x, W.clock.y), { r: W.clock.r * s }) : null,
        handAngle: HAND,
        plaque: P ? Object.assign(at(P.x0, P.top), { w: P.w * s, h: P.h * s }) : null
      }
    };
  }
  function surface(pl) {
    const c = AC.mk(pl.w, pl.h), x = c.getContext('2d');
    x.setTransform(pl.s, 0, 0, pl.s, -pl.left * pl.s, -pl.top * pl.s);
    x.lineJoin = 'round'; x.lineCap = 'round';
    return { c, x };
  }

  // paint({ s: pixels per design unit, bird, plaque, shadow, gloss, pose, breed, hand }): the whole lockup on one canvas
  // returns { canvas, s, word, crown, clock, plaque } with positions in canvas pixels
  function paint(o) {
    const pl = plan(o), { W, P, bird, s } = pl;
    const { c, x } = surface(pl);
    paintBlock(x, W, s, pl.o);
    // the bird's outer keyline and rim go under the letter faces, so the clock's crown stays whole under its feet
    if (bird) paintBird(x, s, bird, { x: pl.left, y: pl.top }, 'rims');
    paintFace(x, W, s, pl.o);
    paintClock(x, W, pl.o);
    if (P) paintPlaque(x, W, s, pl.o);
    if (bird) paintBird(x, s, bird, { x: pl.left, y: pl.top }, 'art');
    return Object.assign({ canvas: c }, pl.meta);
  }

  // layers(o): the same lockup split for animation, every canvas the same size and registration:
  // block (shadow, extrusion, rim), birdRims, face (letter faces and the clock), birdArt, plaque.
  // frame(pose) paints a flying bird with its rims on its own canvas; ax, ay is its toe point, which sits on
  // meta.crown once landed (pose 'land').
  function layers(o) {
    const pl = plan(Object.assign({}, o, { bird: true })), { W, P, bird, s } = pl;
    const out = { meta: pl.meta };
    let L = surface(pl); paintBlock(L.x, W, s, pl.o); out.block = L.c;
    L = surface(pl); paintBird(L.x, s, bird, { x: pl.left, y: pl.top }, 'rims'); out.birdRims = L.c;
    L = surface(pl); paintFace(L.x, W, s, pl.o); paintClock(L.x, W, Object.assign({}, pl.o, { hand: false })); out.face = L.c;
    // the hand on its own canvas, painted pointing straight up: turn it about meta.clock by meta.handAngle to rest
    L = surface(pl); paintHand(L.x, W, 0); out.hand = L.c;
    L = surface(pl); paintBird(L.x, s, bird, { x: pl.left, y: pl.top }, 'art'); out.birdArt = L.c;
    if (P) { L = surface(pl); paintPlaque(L.x, W, s, pl.o); out.plaque = L.c; }
    // where the landed bird's canvas sits, so a flying frame can be registered to it
    out.landAt = { x: (bird.ox - pl.left) * s, y: (bird.oy - pl.top) * s };
    out.frame = (pose) => {
      const bs = (pl.o.birdSize || 0.66) * s;
      const A = birdArt(pose, pl.o.breed || 'white', bs);
      const pad = Math.ceil((RIM.out + 4) * s);
      const c = AC.mk(A.art.width + pad * 2, A.art.height + pad * 2), x = c.getContext('2d');
      stamp(x, tinted(A.flat, K.ink), pad + 1.5 * s, pad + 3 * s, (RIM.out - 5) * s);
      stamp(x, tinted(A.flat, K.rimTop), pad, pad, (RIM.rim - 8) * s);
      stamp(x, tinted(A.flat, K.ink), pad, pad, RIM.key * s);
      x.drawImage(A.art, pad, pad);
      // the canvas origin relative to the landed bird's canvas origin
      return { canvas: c, ox: -pad, oy: -pad };
    };
    return out;
  }

  // the lockup's size in design units, for choosing a paint scale before painting
  const measured = {};
  function measure(o) {
    o = o || {};
    const key = (o.plaque === false ? 'p0' : 'p1') + (o.bird === false ? 'b0' : 'b1');
    if (!measured[key]) { const pl = plan(Object.assign({}, o, { s: 0.25 })); measured[key] = { w: pl.meta.w / 0.25, h: pl.meta.h / 0.25 }; }
    return measured[key];
  }

  root.HomingLogo = { paint, layers, measure, K, OPT, RIM, EXT };
})(typeof self !== 'undefined' ? self : this);

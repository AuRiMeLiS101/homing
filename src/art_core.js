/* Homing art core: canvas painter with print effects.
   Misregistered fills (paper knockout + shifted color), halftone shading,
   ink linework, and pixel displacement for line boil. */
(function (root) {
  'use strict';

  const C = {
    INK: '#1B1622', PAPER: '#F6ECD8', PAPER2: '#E8D8B8',
    TEAL: '#00838A', TEALD: '#0A4F5C', TEALL: '#46B9B1',
    ORANGE: '#FF6A2B', ORANGED: '#D4461A',
    YELLOW: '#FFD23F', YELLOWD: '#E8A915',
    PINK: '#FF4FA3',
    VIOLET: '#5B3E96', VIOLETD: '#33225E', VIOLETL: '#8C72C9',
    PLUM: '#8E3B7F', CORAL: '#F2675E', BLUE: '#2C6BD8', BLUED: '#1C3F86',
    WOOD: '#B9773F', WOODD: '#7E4A22', WOODL: '#D69A5C',
    SKIN: '#F2A27C', SKIND: '#D47F5A', HAIR: '#E4DDD0',
    PIG: '#9FB0B8', PIGL: '#D2DCE0', PIGD: '#5F717D',
    TAN: '#E3B07C', BOX: '#2A1E2B'
  };

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    return c;
  }

  // ---- seeded value noise for displacement ----
  function makeNoise(seed) {
    const p = new Uint8Array(512);
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const g = new Float32Array(256); for (let i = 0; i < 256; i++) g[i] = rnd() * 2 - 1;
    const fade = (t) => t * t * (3 - 2 * t);
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = g[p[(p[xi & 255] + yi) & 255]], b = g[p[(p[(xi + 1) & 255] + yi) & 255]];
      const c = g[p[(p[xi & 255] + yi + 1) & 255]], d = g[p[(p[(xi + 1) & 255] + yi + 1) & 255]];
      const u = fade(xf), v = fade(yf);
      return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    };
  }

  // Displace pixels by smooth noise: hand-printed wobble. amp in px, period in px.
  function roughen(src, seed, amp, period) {
    const w = src.width, h = src.height;
    const sctx = src.getContext('2d');
    const sd = sctx.getImageData(0, 0, w, h).data;
    const out = mk(w, h);
    const octx = out.getContext('2d');
    const od = octx.createImageData(w, h);
    const d = od.data;
    const nx = makeNoise(seed), ny = makeNoise(seed + 101);
    const f = 1 / period;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = nx(x * f, y * f) * amp, dy = ny(x * f, y * f) * amp;
        let sx = Math.round(x + dx), sy = Math.round(y + dy);
        if (sx < 0) sx = 0; else if (sx >= w) sx = w - 1;
        if (sy < 0) sy = 0; else if (sy >= h) sy = h - 1;
        const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
        d[di] = sd[si]; d[di + 1] = sd[si + 1]; d[di + 2] = sd[si + 2]; d[di + 3] = sd[si + 3];
      }
    }
    octx.putImageData(od, 0, 0);
    return out;
  }

  const patternCache = new Map();
  function dotTile(color, sp, r) {
    const key = color + sp + '_' + r;
    if (patternCache.has(key)) return patternCache.get(key);
    const t = mk(sp, sp);
    const x = t.getContext('2d');
    x.fillStyle = color;
    x.beginPath(); x.arc(sp / 2, sp / 2, r, 0, Math.PI * 2); x.fill();
    // half dots at corners so the grid reads as halftone
    x.beginPath(); x.arc(0, 0, r * 0.6, 0, Math.PI * 2); x.arc(sp, 0, r * 0.6, 0, Math.PI * 2); x.arc(0, sp, r * 0.6, 0, Math.PI * 2); x.arc(sp, sp, r * 0.6, 0, Math.PI * 2); x.fill();
    patternCache.set(key, t);
    return t;
  }
  function dotPattern(ctx, color, sp, r, angle) {
    const pat = ctx.createPattern(dotTile(color, sp || 7, r || 1.7), 'repeat');
    if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().rotate(angle == null ? 28 : angle));
    return pat;
  }

  function P(d) { return d instanceof Path2D ? d : new Path2D(d); }
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  function circ(cx, cy, r) { return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`; }
  function ell(cx, cy, rx, ry) { return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`; }
  function star(cx, cy, n, r1, r2, rot) {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const a = (rot || 0) + (i * Math.PI) / n;
      const r = i % 2 === 0 ? r1 : r2;
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1);
    }
    return d + 'Z';
  }

  // Painter: draws parts with print-style layers.
  function Painter(w, h, scale) {
    this.w = w; this.h = h; this.s = scale || 1;
    this.c = mk(w * this.s, h * this.s);
    this.x = this.c.getContext('2d');
    this.x.scale(this.s, this.s);
    this.x.lineJoin = 'round'; this.x.lineCap = 'round';
    this.mis = [4, 4];
    this.light = [-12, -12];
    this.lineW = 7;
  }
  Painter.prototype.layer = function () {
    const c = mk(this.w * this.s, this.h * this.s); const x = c.getContext('2d'); x.scale(this.s, this.s); x.lineJoin = 'round'; x.lineCap = 'round'; return { c, x };
  };
  Painter.prototype.blit = function (c, alpha) {
    const x = this.x; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); if (alpha != null) x.globalAlpha = alpha; x.drawImage(c, 0, 0); x.restore();
  };
  // part: { d, fill, shade, shadeColor, line, lw, knock, mis, under, underColor, hi }
  Painter.prototype.part = function (o) {
    const x = this.x, path = P(o.d);
    const mis = o.mis || this.mis;
    if (o.under) { // extra underprint layer further offset
      x.save(); x.translate(mis[0] * 2.2, mis[1] * 2.2);
      x.fillStyle = o.under === true ? dotPattern(x, o.underColor || C.INK, 6, 2.2) : o.under;
      x.fill(path); x.restore();
    }
    if (o.fill) {
      if (o.knock !== false) { x.fillStyle = C.PAPER; x.fill(path); }
      x.save(); x.translate(mis[0], mis[1]); x.fillStyle = o.fill; x.fill(path); x.restore();
    }
    if (o.shade) {
      const L = this.layer();
      L.x.fillStyle = dotPattern(L.x, o.shadeColor || C.INK, o.shadeSp || 7, o.shadeR || 1.9);
      L.x.globalAlpha = o.shadeA || 0.55;
      L.x.fill(path);
      L.x.globalAlpha = 1;
      L.x.globalCompositeOperation = 'destination-out';
      const lt = o.lightOff || this.light;
      L.x.translate(lt[0], lt[1]); L.x.fill(path);
      this.blit(L.c);
    }
    if (o.hi) { // paper highlight crescent on the light side
      const L = this.layer();
      L.x.fillStyle = o.hiColor || C.PAPER; L.x.globalAlpha = o.hiA || 0.55;
      L.x.fill(path);
      L.x.globalAlpha = 1; L.x.globalCompositeOperation = 'destination-out';
      const hv = o.hiOff || [7, 7];
      L.x.translate(hv[0], hv[1]); L.x.fill(path);
      this.blit(L.c);
    }
    if (o.line !== false) {
      x.strokeStyle = o.lineColor || C.INK; x.lineWidth = o.lw || this.lineW;
      x.stroke(path);
    }
    return this;
  };
  Painter.prototype.stroke = function (d, color, w, opts) {
    const x = this.x; x.save();
    if (opts && opts.mis) x.translate(this.mis[0], this.mis[1]);
    x.strokeStyle = color || C.INK; x.lineWidth = w || this.lineW;
    if (opts && opts.cap) x.lineCap = opts.cap;
    x.stroke(P(d)); x.restore(); return this;
  };
  // A stroke with an ink outline: draw ink wider, color inside.
  Painter.prototype.tube = function (d, color, w, inkW) {
    this.stroke(d, C.INK, w + (inkW || this.lineW) * 2);
    this.stroke(d, color, w, { mis: false });
    return this;
  };
  Painter.prototype.fillOnly = function (d, color, alpha) {
    const x = this.x; x.save(); if (alpha != null) x.globalAlpha = alpha; x.fillStyle = color; x.fill(P(d)); x.restore(); return this;
  };
  Painter.prototype.clipTo = function (d, fn) {
    const x = this.x; x.save(); x.clip(P(d)); fn(this); x.restore(); return this;
  };
  Painter.prototype.text = function (str, cx, cy, size, opts) {
    opts = opts || {};
    const x = this.x;
    const font = `${opts.weight || 900} ${size}px ${opts.family || '"Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'}`;
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    const m = x.measureText(str);
    const asc = m.actualBoundingBoxAscent || size * 0.72, desc = m.actualBoundingBoxDescent || 0;
    const by = cy + (asc - desc) / 2;
    const mis = opts.mis || this.mis;
    if (opts.under) { x.save(); x.fillStyle = opts.under; x.fillText(str, cx + mis[0] * 2.4, by + mis[1] * 2.4); x.restore(); }
    if (opts.fill) {
      x.fillStyle = C.PAPER; x.fillText(str, cx, by);
      x.fillStyle = opts.fill; x.fillText(str, cx + mis[0], by + mis[1]);
      if (opts.shade) {
        const L = this.layer();
        L.x.font = font; L.x.textAlign = 'center'; L.x.textBaseline = 'alphabetic';
        L.x.fillStyle = dotPattern(L.x, C.INK, 7, 2); L.x.globalAlpha = 0.5;
        L.x.fillText(str, cx, by);
        L.x.globalAlpha = 1; L.x.globalCompositeOperation = 'destination-out';
        L.x.fillText(str, cx - 9, by - 9);
        this.blit(L.c);
      }
    }
    if (opts.line !== false) { x.strokeStyle = opts.lineColor || C.INK; x.lineWidth = opts.lw || this.lineW; x.lineJoin = 'round'; x.strokeText(str, cx, by); }
    return this;
  };
  Painter.prototype.done = function (boil) {
    if (!boil) return this.c;
    return roughen(this.c, boil.seed, boil.amp * this.s, boil.period * this.s);
  };

  root.HomingArtCore = { C, mk, Painter, rr, circ, ell, star, P, dotPattern, dotTile, roughen, makeNoise };
})(typeof self !== 'undefined' ? self : this);

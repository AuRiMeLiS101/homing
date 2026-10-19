/* Homing world art: the loft, props, particles and helpers. */
(function (root) {
  'use strict';
  const A = root.HomingArtCore;
  const { C, Painter, rr, circ, ell, star, mk } = A;

  const LOFT = { w: 1122, h: 1110, gridX: 76, gridY: 262, cell: 150, gap: 14, cols: 6, rows: 5 };

  // Sticker treatment: paper die-cut border, ink ring, offset print shadow.
  function sticker(src, b, opts) {
    opts = opts || {};
    const paper = opts.paper || C.PAPER, inkW = opts.ink == null ? 3 : opts.ink;
    const W = src.width + b * 2 + 10, H = src.height + b * 2 + 10;
    function sil(color) {
      const c = mk(src.width, src.height), x = c.getContext('2d');
      x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
      return c;
    }
    const out = mk(W, H), o = out.getContext('2d');
    const ink = sil(C.INK), pap = sil(paper);
    const N = 28;
    // shadow
    o.globalAlpha = 0.5;
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; o.drawImage(ink, b + 9 + Math.cos(a) * b, b + 9 + Math.sin(a) * b); }
    o.globalAlpha = 1;
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; o.drawImage(ink, b + Math.cos(a) * b, b + Math.sin(a) * b); }
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2; o.drawImage(pap, b + Math.cos(a) * (b - inkW), b + Math.sin(a) * (b - inkW)); }
    o.drawImage(src, b, b);
    return out;
  }

  function cellRect(c, r) {
    return { x: LOFT.gridX + c * (LOFT.cell + LOFT.gap), y: LOFT.gridY + r * (LOFT.cell + LOFT.gap), w: LOFT.cell, h: LOFT.cell };
  }

  function paintLoft(scale, seed) {
    const p = new Painter(LOFT.w, LOFT.h, scale);
    p.lineW = 7; p.mis = [5, 5]; p.light = [-18, -18];
    const W = LOFT.w;
    // side posts
    p.part({ d: rr(14, 210, 46, 880, 10), fill: C.WOODL, shade: true, hi: true });
    p.part({ d: rr(W - 60, 210, 46, 880, 10), fill: C.WOODL, shade: true, hi: true });
    // front body
    p.part({ d: rr(30, 214, W - 60, 862, 16), fill: C.WOOD, shade: true });
    p.clipTo(rr(30, 214, W - 60, 862, 16), (q) => {
      for (let y = 240; y < 1080; y += 56) {
        q.stroke(`M30 ${y}H${W - 30}`, C.WOODD, 4);
        for (const nx of [46, W - 46]) q.fillOnly(circ(nx, y + 14, 4), C.INK);
      }
      for (let i = 0; i < 40; i++) {
        const y = 250 + ((i * 97) % 820), x0 = 60 + ((i * 211) % 960);
        q.stroke(`M${x0} ${y}C${x0 + 30} ${y - 4} ${x0 + 60} ${y + 4} ${x0 + 90} ${y}`, 'rgba(27,22,34,0.25)', 3);
      }
    });
    // grid well
    p.part({ d: rr(56, 240, W - 112, 826, 12), fill: '#1C1420', lw: 6 });
    for (let r = 0; r < LOFT.rows; r++) for (let c = 0; c < LOFT.cols; c++) {
      const b = cellRect(c, r);
      p.part({ d: rr(b.x - 7, b.y - 7, b.w + 14, b.h + 14, 10), fill: C.WOODL, lw: 5, mis: [3, 3] });
      p.part({ d: rr(b.x, b.y, b.w, b.h, 8), fill: C.BOX, lw: 5, mis: [0, 0], knock: false });
      p.clipTo(rr(b.x, b.y, b.w, b.h, 8), (q) => {
        q.fillOnly(rr(b.x, b.y, b.w, 34, 0), '#120C14', 0.85);
        q.x.save(); q.x.fillStyle = A.dotPattern(q.x, '#000', 7, 2.2); q.x.globalAlpha = 0.45; q.x.fill(new Path2D(rr(b.x, b.y + 30, b.w, 40, 0))); q.x.restore();
        // straw bits
        q.stroke(`M${b.x + 20} ${b.y + b.h - 22}L${b.x + 44} ${b.y + b.h - 30}M${b.x + 90} ${b.y + b.h - 24}L${b.x + 118} ${b.y + b.h - 20}`, 'rgba(232,184,96,0.6)', 3);
      });
      p.part({ d: rr(b.x + 12, b.y + b.h - 20, b.w - 24, 16, 6), fill: C.WOODD, lw: 4, mis: [2, 2] });
    }
    // plinth
    p.part({ d: rr(10, 1066, W - 20, 40, 10), fill: C.WOODD, shade: true });
    // landing board
    p.part({ d: rr(22, 206, W - 44, 26, 8), fill: C.WOODD, shade: true });
    // gable
    p.part({ d: `M64 210L561 74L${W - 64} 210Z`, fill: C.WOODL, shade: true });
    p.clipTo(`M64 210L561 74L${W - 64} 210Z`, (q) => {
      for (let y = 100; y < 212; y += 26) q.stroke(`M60 ${y}H${W - 60}`, C.WOODD, 3);
    });
    // portholes with wire
    for (const px of [318, 804]) {
      p.part({ d: circ(px, 184, 24), fill: '#1C1420', lw: 6 });
      p.clipTo(circ(px, 184, 21), (q) => {
        for (let i = -3; i <= 3; i++) {
          q.stroke(`M${px - 24 + i * 12} 160L${px + i * 12} 208`, 'rgba(210,220,224,0.5)', 2);
          q.stroke(`M${px + i * 12} 160L${px - 24 + i * 12} 208`, 'rgba(210,220,224,0.5)', 2);
        }
      });
      p.stroke(circ(px, 184, 24), C.WOODD, 7);
    }
    // sign in the gable
    p.part({ d: rr(421, 128, 280, 72, 10), fill: C.PAPER, shade: true, shadeA: 0.25 });
    p.text('LOFT №9', 561, 164, 54, { fill: C.INK, line: false, mis: [2, 2] });
    p.fillOnly(circ(436, 142, 5), C.INK); p.fillOnly(circ(686, 142, 5), C.INK);
    // roof
    const roofD = `M-4 214L561 6L${W + 4} 214L${W + 4} 256L561 52L-4 256Z`;
    p.part({ d: roofD, fill: C.ORANGE, shade: true, hi: true, lw: 8 });
    p.clipTo(roofD, (q) => {
      for (let x = 10; x < W; x += 26) q.stroke(`M${x} 0V270`, C.ORANGED, 5);
    });
    p.stroke(roofD, C.INK, 8);
    p.part({ d: rr(536, -2, 50, 34, 8), fill: C.ORANGED, lw: 6 });
    return p.done(seed ? { seed, amp: 1.4, period: 22 } : null);
  }

  function cloud(variant, color, color2) {
    const p = new Painter(520, 220, 1);
    const shapes = [
      'M40 170C20 170 14 140 40 132C36 100 76 86 100 104C110 64 170 56 190 96C214 54 290 60 300 110C330 84 392 98 392 140C430 136 450 170 420 180Z',
      'M30 160C10 156 20 128 46 128C50 96 92 90 112 108C134 70 196 76 206 112C236 92 280 108 280 138C318 128 340 160 300 172Z',
      'M60 180C30 182 26 150 60 146C56 120 96 106 120 124C138 96 186 96 196 126C222 112 262 124 262 150C300 140 330 168 300 184Z'
    ];
    const d = shapes[variant % shapes.length];
    p.x.save(); p.x.translate(14, 12); p.x.fillStyle = color2; p.x.fill(new Path2D(d)); p.x.restore();
    p.x.fillStyle = color; p.x.fill(new Path2D(d));
    const L = p.layer(); L.x.fillStyle = A.dotPattern(L.x, color2, 8, 2.6); L.x.fill(new Path2D(d)); L.x.globalCompositeOperation = 'destination-out'; L.x.translate(-26, -26); L.x.fill(new Path2D(d));
    p.blit(L.c, 0.9);
    return p.c;
  }

  function tram() {
    const p = new Painter(420, 150, 1);
    p.lineW = 5; p.mis = [3, 3];
    p.stroke('M150 34L210 4L270 34', C.INK, 4);
    p.stroke('M190 4H232', C.INK, 4);
    p.part({ d: rr(20, 36, 380, 86, 14), fill: C.ORANGE, shade: true });
    p.part({ d: rr(20, 90, 380, 22, 4), fill: C.PAPER2, lw: 4 });
    for (let i = 0; i < 7; i++) p.part({ d: rr(36 + i * 52, 48, 38, 34, 5), fill: '#FFE7A8', lw: 4 });
    p.part({ d: rr(14, 116, 392, 14, 5), fill: C.INK, lw: 2 });
    p.part({ d: circ(80, 132, 12), fill: C.INK, lw: 2 }); p.part({ d: circ(340, 132, 12), fill: C.INK, lw: 2 });
    p.text('9', 380, 66, 28, { fill: C.INK, line: false, mis: [1, 1] });
    return p.c;
  }

  function dish() {
    const p = new Painter(170, 190, 1);
    p.lineW = 6;
    p.stroke('M84 118L70 186M84 118L104 186', C.INK, 6);
    p.part({ d: 'M24 40C40 112 120 140 150 104C110 100 60 76 24 40Z', fill: C.PAPER2, shade: true, hi: true });
    p.stroke('M86 92L128 54', C.INK, 5);
    p.part({ d: circ(130, 52, 8), fill: C.ORANGE, lw: 4 });
    return p.c;
  }

  function vent() {
    const p = new Painter(140, 170, 1);
    p.lineW = 6;
    p.part({ d: rr(40, 70, 60, 96, 6), fill: C.PIGD, shade: true, hi: true });
    p.part({ d: 'M20 76L70 30L120 76Z', fill: C.PIG, shade: true });
    p.stroke('M44 100H96M44 120H96M44 140H96', C.INK, 3);
    return p.c;
  }

  function laundry(kind) {
    const p = new Painter(150, 170, 1);
    p.lineW = 5; p.mis = [3, 3];
    if (kind === 0) { // shirt
      p.part({ d: 'M30 20L60 10C66 22 84 22 90 10L120 20L140 56L114 66L112 160L38 160L36 66L10 56Z', fill: C.CORAL, shade: true, hi: true });
      p.stroke('M75 24V160', C.INK, 3);
      p.fillOnly(circ(75, 60, 3), C.INK); p.fillOnly(circ(75, 90, 3), C.INK);
    } else if (kind === 1) { // vest
      p.part({ d: 'M40 14L56 14C60 40 90 40 94 14L110 14L118 150L32 150Z', fill: C.PAPER, shade: true, hi: true });
    } else if (kind === 2) { // big shorts
      p.part({ d: 'M22 14H128L136 120L88 124L75 70L62 124L14 120Z', fill: C.BLUE, shade: true, hi: true });
      for (let i = 0; i < 6; i++) p.fillOnly(circ(36 + i * 16, 50 + (i % 2) * 22, 6), C.PAPER, 0.85);
    } else { // sock pair
      p.part({ d: 'M30 10H62V96C62 112 56 124 40 124H24C14 124 14 108 26 104L30 100Z', fill: C.TEAL, shade: true });
      p.part({ d: 'M88 10H120V100C120 116 114 128 98 128H82C72 128 72 112 84 108L88 104Z', fill: C.ORANGE, shade: true });
      p.stroke('M30 26H62M88 26H120', C.PAPER, 6);
    }
    return p.c;
  }

  function feather(color) {
    const p = new Painter(64, 96, 1);
    p.lineW = 3; p.mis = [2, 2];
    p.part({ d: 'M32 6C50 26 52 62 34 90C14 62 14 26 32 6Z', fill: color || C.PIGL, shade: true, lw: 3 });
    p.stroke('M32 14V92', C.INK, 2.5);
    p.stroke('M32 40L22 30M32 54L44 44M32 66L22 58', C.INK, 2);
    return p.c;
  }

  function splat(seed, color) {
    const p = new Painter(160, 160, 1);
    let s = seed * 999 + 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    let d = '';
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 42 + rnd() * 18 * (i % 2 ? 1 : 0.4);
      const x = 80 + Math.cos(a) * r, y = 80 + Math.sin(a) * r;
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    d += 'Z';
    p.x.fillStyle = color; p.x.fill(new Path2D(d));
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, r = 56 + rnd() * 20, rr2 = 3 + rnd() * 7;
      p.fillOnly(circ(80 + Math.cos(a) * r, 80 + Math.sin(a) * r, rr2), color);
    }
    return p.c;
  }

  function sparkle(color) {
    const c = mk(64, 64), x = c.getContext('2d');
    x.fillStyle = color || '#FFFFFF';
    x.beginPath(); x.moveTo(32, 0); x.quadraticCurveTo(36, 28, 64, 32); x.quadraticCurveTo(36, 36, 32, 64); x.quadraticCurveTo(28, 36, 0, 32); x.quadraticCurveTo(28, 28, 32, 0); x.fill();
    return c;
  }

  function dotTex(r, size) {
    const c = mk(size, size), x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.beginPath(); x.arc(size / 2, size / 2, r, 0, Math.PI * 2); x.fill();
    return c;
  }

  function softDot(size) {
    const c = mk(size, size), x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  }

  // Neighbour on a balcony, arms down or up (cheering).
  function neighbour(color, armsUp) {
    const p = new Painter(90, 120, 1);
    p.lineW = 4; p.mis = [2, 2];
    if (armsUp) p.stroke('M24 60L10 20M66 60L80 20', C.INK, 10);
    else p.stroke('M24 60L18 96M66 60L72 96', C.INK, 10);
    p.part({ d: rr(20, 52, 50, 68, 14), fill: color, lw: 4 });
    p.part({ d: circ(45, 36, 18), fill: C.SKIN, lw: 4 });
    return p.c;
  }

  // HUD medallion for the loft multiplier
  function medallion() {
    const p = new Painter(300, 300, 1);
    p.lineW = 8; p.mis = [5, 5];
    p.part({ d: star(150, 150, 18, 146, 128, 0), fill: C.YELLOW, shade: true });
    p.part({ d: circ(150, 150, 118), fill: C.VIOLET, shade: true, hi: true });
    p.stroke(circ(150, 150, 104), C.PAPER, 7);
    return p.c;
  }

  // Ticket-shaped banner used behind stamped words
  function banner(w, h, color) {
    const p = new Painter(w + 20, h + 20, 1);
    p.lineW = 8; p.mis = [6, 6];
    let d = `M10 10H${w + 10}`;
    const teeth = 10, step = h / teeth;
    for (let i = 0; i < teeth; i++) d += `L${w + (i % 2 ? 10 : 0)} ${10 + step * (i + 1)}`;
    d += `H10`;
    for (let i = teeth - 1; i >= 0; i--) d += `L${(i % 2 ? 10 : 20)} ${10 + step * i}`;
    d += 'Z';
    p.part({ d, fill: color || C.PAPER, shade: true, shadeA: 0.3 });
    return p.c;
  }

  // A loft coin: brass disc with a stamped 9, ink rim and halftone shade. Spun on screen by squashing its width.
  function coin() {
    const p = new Painter(110, 110, 1);
    p.lineW = 6; p.mis = [3, 3]; p.light = [-9, -9];
    p.part({ d: circ(55, 55, 46), fill: C.YELLOW, shade: true, shadeA: 0.5, hi: true, hiA: 0.6, hiOff: [6, 6] });
    p.stroke(circ(55, 55, 35), C.YELLOWD, 4);
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2; p.stroke(`M${55 + Math.cos(a) * 39} ${55 + Math.sin(a) * 39}L${55 + Math.cos(a) * 43} ${55 + Math.sin(a) * 43}`, C.INK, 2.4); }
    p.part({ d: star(55, 56, 5, 22, 9.5, -Math.PI / 2), fill: C.ORANGE, lw: 4.5 });
    p.stroke('M30 34C36 26 44 22 52 21', C.PAPER, 5);
    return p.c;
  }
  // the same coin seen edge on, for the middle of a flip
  function coinEdge() {
    const p = new Painter(110, 110, 1);
    p.lineW = 6; p.mis = [3, 3];
    p.part({ d: rr(43, 9, 24, 92, 12), fill: C.YELLOWD, shade: true, shadeA: 0.45 });
    for (let y = 22; y < 92; y += 10) p.stroke(`M48 ${y}H62`, C.INK, 2);
    return p.c;
  }
  // Race Day bunting: a pennant on a string, in one of the print colours
  function pennant(color) {
    const p = new Painter(70, 84, 1);
    p.lineW = 4.5; p.mis = [3, 3];
    p.part({ d: 'M8 8H62L37 76Z', fill: color, shade: true, shadeA: 0.35 });
    p.stroke('M18 18H52', C.PAPER, 3, {});
    return p.c;
  }
  // a festoon bulb: glass, brass cap, ink outline
  function bulb() {
    const p = new Painter(40, 56, 1);
    p.lineW = 3.5; p.mis = [2, 2];
    p.part({ d: rr(14, 4, 12, 12, 3), fill: C.WOODD });
    p.part({ d: 'M20 14C30 14 34 24 34 32C34 42 28 50 20 50C12 50 6 42 6 32C6 24 10 14 20 14Z', fill: '#FFF2B8', hi: true, hiA: 0.8 });
    return p.c;
  }
  // chain badge: a rosette sticker the chain number sits on
  function rosette(color) {
    const p = new Painter(220, 220, 1);
    p.lineW = 7; p.mis = [4, 4];
    p.part({ d: star(110, 110, 16, 104, 88, 0.1), fill: color, shade: true, shadeA: 0.4 });
    p.part({ d: circ(110, 110, 74), fill: C.INK, line: false });
    p.stroke(circ(110, 110, 66), color, 4);
    return p.c;
  }
  // rain streak and a little night plane
  function streak() {
    const c = mk(6, 64), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    x.fillStyle = g; x.fillRect(1.5, 0, 3, 64);
    return c;
  }
  function plane() {
    const p = new Painter(120, 44, 1);
    p.lineW = 0; p.mis = [0, 0];
    p.fillOnly('M6 24C30 20 70 18 104 20C112 21 116 24 112 27C90 30 40 30 12 28Z', '#2E2350');
    p.fillOnly('M50 22L70 4H78L66 22ZM52 27L72 40H80L66 26ZM8 24L4 10H12L22 23Z', '#2E2350');
    return p.c;
  }

  root.HomingWorld = { LOFT, sticker, cellRect, paintLoft, cloud, tram, dish, vent, laundry, feather, splat, sparkle, dotTex, softDot, neighbour, medallion, banner, coin, coinEdge, pennant, bulb, rosette, streak, plane };
})(typeof self !== 'undefined' ? self : this);

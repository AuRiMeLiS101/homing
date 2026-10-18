/* Gennady: cut-out rig parts. Each part has a canvas and an anchor (pivot) in its own pixels. */
(function (root) {
  'use strict';
  const A = root.HomingArtCore;
  const { C, Painter, rr, circ, ell } = A;
  const INKA = 'rgba(27,22,34,0.35)';

  function mkP(w, h) { const p = new Painter(w, h, 1); p.lineW = 8; p.mis = [5, 5]; p.light = [-16, -16]; return p; }

  const PARTS = {
    torso: { w: 380, h: 470, ax: 190, ay: 460, paint(p) {
      p.part({ d: rr(154, 18, 72, 100, 24), fill: C.SKIN, shade: true });
      p.part({ d: 'M58 118C66 90 116 78 190 78C264 78 314 90 322 118L348 340C352 392 322 446 276 456L104 456C58 446 28 392 32 340Z', fill: C.TEAL, shade: true, hi: true });
      p.tube('M72 140L48 346', C.ORANGE, 10, 6);
      p.tube('M308 140L332 346', C.ORANGE, 10, 6);
      p.part({ d: rr(58, 420, 264, 42, 16), fill: C.TEALD, shade: true });
      p.tube('M190 104V420', C.PAPER, 5, 4);
      p.part({ d: rr(181, 300, 18, 30, 5), fill: C.PAPER, lw: 4 });
      p.part({ d: 'M122 84L160 146L190 104L220 146L258 84Z', fill: C.TEALD, shade: true });
      p.part({ d: rr(234, 176, 52, 28, 7), fill: C.ORANGE, lw: 5 });
      p.text('№9', 260, 191, 22, { fill: C.PAPER, line: false, mis: [1, 1] });
      // belly fold lines
      p.stroke('M96 360C150 380 230 380 284 360', INKA, 5);
    } },
    legL: { w: 120, h: 250, ax: 60, ay: 20, paint(p) {
      p.part({ d: rr(22, 0, 76, 226, 36), fill: C.TEALD, shade: true, hi: true });
      p.tube('M40 24V196', C.ORANGE, 7, 5);
      p.part({ d: rr(18, 196, 84, 40, 16), fill: C.TEALD });
    } },
    legR: { w: 120, h: 250, ax: 60, ay: 20, paint(p) {
      p.part({ d: rr(22, 0, 76, 226, 36), fill: C.TEALD, shade: true, hi: true });
      p.tube('M80 24V196', C.ORANGE, 7, 5);
      p.part({ d: rr(18, 196, 84, 40, 16), fill: C.TEALD });
    } },
    slipper: { w: 190, h: 96, ax: 95, ay: 52, paint(p) {
      p.part({ d: ell(95, 68, 84, 22), fill: C.WOODD });
      p.part({ d: 'M18 64C22 30 62 16 108 18C146 20 172 36 176 64Z', fill: C.TAN, shade: true, hi: true });
      p.tube('M32 44C62 24 124 22 158 44', C.ORANGE, 14, 6);
    } },
    head: { w: 340, h: 340, ax: 170, ay: 316, paint(p) {
      p.part({ d: ell(52, 182, 26, 40), fill: C.SKIN, shade: true });
      p.part({ d: ell(288, 182, 26, 40), fill: C.SKIN, shade: true });
      p.stroke('M58 166C44 178 46 196 58 206M282 166C296 178 294 196 282 206', C.INK, 5);
      p.part({ d: ell(170, 172, 122, 132), fill: C.SKIN, shade: true, hi: true });
      p.part({ d: 'M58 124C44 178 52 228 82 252L100 136Z', fill: C.HAIR, shade: true, lw: 6 });
      p.part({ d: 'M282 124C296 178 288 228 258 252L240 136Z', fill: C.HAIR, shade: true, lw: 6 });
      p.stroke('M146 46C150 28 170 24 176 42M180 46C188 32 204 34 204 50', C.INK, 4);
      p.fillOnly(ell(128, 84, 36, 15), C.PAPER, 0.55);
      p.stroke('M118 102Q170 88 222 102M132 116Q170 106 208 116', INKA, 5);
      p.fillOnly(circ(104, 228, 24), C.ORANGE, 0.28);
      p.fillOnly(circ(236, 228, 24), C.ORANGE, 0.28);
      p.part({ d: 'M170 178C140 226 150 262 174 266C206 266 210 232 192 208Z', fill: C.SKIND, shade: true, lw: 7 });
      p.stroke('M164 256C168 260 176 260 180 256', C.INK, 4);
      // stubble
      const dots = [[128, 296], [146, 302], [196, 302], [214, 296], [170, 306], [118, 284], [222, 284]];
      for (const [x, y] of dots) p.fillOnly(circ(x, y, 2.4), INKA);
    } },
    armUpper: { w: 110, h: 232, ax: 55, ay: 30, paint(p) {
      p.part({ d: rr(14, 4, 82, 222, 41), fill: C.TEAL, shade: true, hi: true });
      p.tube('M55 34V196', C.ORANGE, 7, 5);
    } },
    armLower: { w: 104, h: 214, ax: 52, ay: 28, paint(p) {
      p.part({ d: rr(14, 4, 76, 204, 38), fill: C.TEAL, shade: true, hi: true });
      p.tube('M52 30V166', C.ORANGE, 6, 5);
      p.part({ d: rr(12, 168, 80, 42, 16), fill: C.TEALD });
    } },
    handOpen: { w: 132, h: 132, ax: 66, ay: 22, paint(p) {
      p.part({ d: ell(30, 62, 15, 27), fill: C.SKIN, lw: 6 });
      p.part({ d: ell(68, 72, 44, 46), fill: C.SKIN, shade: true, hi: true });
      p.stroke('M52 104V118M68 108V122M84 104V118', C.INK, 5);
    } },
    handFist: { w: 132, h: 132, ax: 66, ay: 22, paint(p) {
      p.part({ d: circ(66, 70, 42), fill: C.SKIN, shade: true, hi: true });
      p.stroke('M40 92C52 100 80 100 92 92M44 76H88', C.INK, 5);
      p.part({ d: ell(32, 64, 13, 20), fill: C.SKIN, lw: 6 });
    } },
    whistle: { w: 96, h: 64, ax: 14, ay: 32, paint(p) {
      p.part({ d: rr(14, 14, 56, 34, 14), fill: C.PAPER2, shade: true, lw: 6 });
      p.part({ d: rr(62, 20, 26, 16, 5), fill: C.PAPER2, lw: 6 });
      p.fillOnly(circ(36, 31, 7), C.INK);
    } },
    binos: { w: 200, h: 120, ax: 100, ay: 60, paint(p) {
      p.part({ d: rr(14, 20, 78, 84, 28), fill: C.TEAL, shade: true, hi: true });
      p.part({ d: rr(108, 20, 78, 84, 28), fill: C.TEAL, shade: true, hi: true });
      p.part({ d: rr(84, 44, 32, 30, 8), fill: C.VIOLETD });
      p.part({ d: ell(53, 62, 26, 26), fill: C.PAPER, lw: 6 });
      p.part({ d: ell(147, 62, 26, 26), fill: C.PAPER, lw: 6 });
      p.stroke('M40 52L52 44M134 52L146 44', C.TEALL, 6);
    } },
    pennant: { w: 240, h: 150, ax: 16, ay: 14, paint(p) {
      p.tube('M16 10V146', C.WOODD, 8, 5);
      p.part({ d: 'M22 16L226 52L22 96Z', fill: C.ORANGE, shade: true, hi: true });
      p.text('№9', 88, 56, 40, { fill: C.PAPER, line: false, mis: [2, 2] });
    } }
  };

  function paintPart(name, boil) {
    const def = PARTS[name];
    const p = mkP(def.w, def.h);
    def.paint(p);
    const c = p.done(boil ? { seed: boil, amp: 1.8, period: 18 } : null);
    return { canvas: c, ax: def.ax, ay: def.ay, w: def.w, h: def.h };
  }

  root.HomingGennady = { paintPart, PARTS: Object.keys(PARTS) };
})(typeof self !== 'undefined' ? self : this);

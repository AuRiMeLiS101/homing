/* Homing symbols. Each painter draws into a 256 x 256 space. */
(function (root) {
  'use strict';
  const A = root.HomingArtCore;
  const { C, Painter, rr, circ, ell, star } = A;

  const RANKS = {
    A: { fill: C.TEAL, under: C.ORANGE },
    K: { fill: C.VIOLET, under: C.TEALL },
    Q: { fill: C.CORAL, under: C.VIOLETL },
    J: { fill: C.BLUE, under: C.ORANGE },
    T: { fill: C.TEALD, under: C.CORAL }
  };

  function rank(p, k) {
    const r = RANKS[k];
    const str = k === 'T' ? '10' : k;
    const size = k === 'T' ? 178 : 206;
    p.lineW = 8;
    p.text(str, 128, 132, size, { fill: r.fill, under: r.under, shade: true, lw: 9 });
    // small ink speck accents for print texture
    p.fillOnly(circ(206, 54, 5), r.under);
    p.fillOnly(circ(44, 210, 4), r.fill);
  }

  function tea(p) {
    // steam behind
    p.stroke('M178 128C164 112 190 100 176 82C164 68 184 56 176 40', C.INK, 7);
    p.stroke('M204 132C194 120 212 110 202 96', C.INK, 6);
    // cap knob
    p.part({ d: rr(84, 30, 34, 22, 7), fill: C.ORANGED });
    // thermos body
    p.part({ d: rr(56, 72, 82, 154, 20), fill: C.TEAL, shade: true, hi: true });
    // label band
    p.part({ d: rr(56, 142, 82, 30, 2), fill: C.PAPER2, lw: 6 });
    p.text('№9', 97, 157, 26, { fill: C.TEALD, line: false, mis: [1, 1] });
    // cap
    p.part({ d: rr(48, 46, 98, 36, 10), fill: C.ORANGE, shade: true });
    // shine
    p.fillOnly(rr(70, 92, 11, 40, 5), C.PAPER, 0.85);
    // cup
    p.stroke('M206 166C238 168 238 206 204 210', C.INK, 20);
    p.stroke('M206 166C238 168 238 206 204 210', C.ORANGE, 8);
    p.part({ d: 'M148 150L216 150L206 226L158 226Z', fill: C.ORANGE, shade: true, hi: true });
    p.part({ d: ell(182, 152, 34, 8), fill: C.WOODD, lw: 6 });
  }

  function radio(p) {
    // handle
    p.tube('M70 98C66 54 190 54 186 98', C.TEALD, 10, 6);
    // antenna
    p.stroke('M182 100L230 30', C.INK, 9);
    p.part({ d: circ(230, 30, 10), fill: C.ORANGE, lw: 6 });
    // body
    p.part({ d: rr(28, 90, 200, 132, 26), fill: C.ORANGE, shade: true, hi: true });
    // speaker
    p.part({ d: circ(88, 156, 46), fill: C.PAPER, shade: true, shadeA: 0.35 });
    p.clipTo(circ(88, 156, 42), (q) => {
      for (let i = -3; i <= 3; i++) q.stroke(`M40 ${156 + i * 12}H136`, C.INK, 5);
    });
    p.part({ d: circ(88, 156, 46), line: true, fill: null });
    // dial
    p.part({ d: rr(146, 112, 64, 32, 7), fill: C.PAPER2, lw: 6 });
    for (let i = 0; i < 6; i++) p.stroke(`M${154 + i * 10} 120V126`, C.INK, 3);
    p.stroke('M184 114V142', C.PINK, 4);
    // knobs
    p.part({ d: circ(160, 186, 16), fill: C.TEAL, shade: true, lw: 6 });
    p.part({ d: circ(200, 186, 16), fill: C.TEAL, shade: true, lw: 6 });
    p.stroke('M160 176V186', C.PAPER, 4); p.stroke('M200 176L206 184', C.PAPER, 4);
    // floating note
    p.part({ d: ell(30, 54, 11, 8), fill: C.PAPER, lw: 5 });
    p.stroke('M40 52V18L56 24', C.INK, 6);
  }

  function seed(p) {
    // spilled seeds
    const seeds = [[200, 228], [214, 216], [226, 230], [188, 236], [236, 212], [208, 240]];
    for (const [x, y] of seeds) p.part({ d: ell(x, y, 7, 5), fill: C.PAPER2, lw: 3 });
    // sack
    p.part({ d: 'M60 108C34 152 40 214 68 230L188 230C216 214 222 152 196 108Z', fill: C.TAN, shade: true, hi: true });
    // neck
    p.part({ d: 'M88 112L96 64L160 64L168 112Z', fill: C.TAN, shade: true });
    // fringe
    p.part({ d: 'M96 66L80 38L108 52L126 30L142 52L172 38L160 66Z', fill: C.TAN });
    // tie
    p.part({ d: rr(80, 98, 96, 18, 7), fill: C.ORANGE, lw: 6 });
    p.stroke('M176 108C196 116 200 134 190 144', C.INK, 6);
    // stencil label
    p.text('№9', 128, 172, 60, { fill: C.TEALD, line: false, mis: [2, 2] });
    // weave marks
    p.stroke('M74 140L84 146M170 138L180 132M78 196L88 192M174 200L182 206', C.INK, 3);
  }

  function bino(p) {
    // strap
    p.tube('M48 104C14 152 28 214 74 236', C.ORANGE, 10, 6);
    // eyepieces
    p.part({ d: rr(64, 44, 46, 36, 10), fill: C.VIOLETD, lw: 6 });
    p.part({ d: rr(146, 44, 46, 36, 10), fill: C.VIOLETD, lw: 6 });
    // barrels
    p.part({ d: rr(48, 70, 76, 150, 28), fill: C.TEAL, shade: true, hi: true });
    p.part({ d: rr(132, 70, 76, 150, 28), fill: C.TEAL, shade: true, hi: true });
    // bridge + wheel
    p.part({ d: rr(116, 104, 24, 50, 7), fill: C.VIOLETD, lw: 6 });
    p.part({ d: rr(112, 64, 32, 24, 7), fill: C.ORANGE, lw: 6 });
    // lenses
    p.part({ d: ell(86, 198, 28, 13), fill: C.PAPER, lw: 6 });
    p.part({ d: ell(170, 198, 28, 13), fill: C.PAPER, lw: 6 });
    p.stroke('M72 196L84 192M156 196L168 192', C.TEALL, 4);
    // grip ridges
    p.stroke('M60 120H112M60 132H112M144 120H196M144 132H196', C.TEALD, 4);
  }

  function medal(p, color, ring) {
    p.part({ d: star(128, 128, 16, 124, 112, 0), fill: ring, lw: 6 });
    p.part({ d: circ(128, 128, 106), fill: color, shade: true });
    p.stroke(circ(128, 128, 96), C.PAPER, 6);
  }

  function champ(p) {
    medal(p, C.ORANGE, C.YELLOW);
    const Bd = root.HomingBirds;
    const x = p.x;
    x.save(); x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.clip();
    x.fillStyle = C.ORANGED; x.globalAlpha = 0.35; x.fillRect(0, 168, 256, 90); x.globalAlpha = 1;
    if (Bd) {
      // the loft's champion: a blue bar racer, chest out, painted with the flight birds' painter
      const k = 0.66;
      x.translate(122, 154); x.scale(k, k);
      Bd.paintBird(x, 'perch', 'grey', { s: k * p.s, lw: 6.4 * p.s, mis: 3 * p.s, cache: {}, boil: null, dotScale: p.s });
    }
    x.restore();
    p.stroke(circ(128, 128, 92), C.INK, 6);
    // rosette
    p.part({ d: 'M186 168L176 214L192 204L202 220L208 172Z', fill: C.TEAL, lw: 5 });
    p.part({ d: star(196, 156, 12, 30, 24, 0), fill: C.PAPER, lw: 5 });
    p.part({ d: circ(196, 156, 12), fill: C.PINK, lw: 4 });
  }

  function gena(p) {
    medal(p, C.VIOLET, C.YELLOW);
    const Gn = root.HomingGennady;
    if (Gn) {
      // the same painter as the host, cropped to a portrait in the medal
      const x = p.x, k = 0.4;
      const P = Gn.makePose('idle', { face: { mouth: 'smirk', smile: 0.6, lid: 0.22, brow: 0.2 } });
      const a = Gn.anchors(P);
      x.save();
      x.beginPath(); x.arc(128, 128, 92, 0, Math.PI * 2); x.clip();
      x.fillStyle = C.VIOLETD; x.globalAlpha = 0.35; x.fillRect(0, 150, 256, 120); x.globalAlpha = 1;
      x.translate(128 - a.head.x * k, 146 - a.head.y * k); x.scale(k, k);
      Gn.paint(x, P, { s: k * p.s, lw: 5.2 * p.s, mis: 3 * p.s, cache: {}, boil: null, dotScale: p.s });
      x.restore();
    }
    p.stroke(circ(128, 128, 92), C.INK, 6);
  }

  function burst(p) {
    p.part({ d: star(128, 128, 14, 126, 92, 0.1), fill: C.YELLOW, shade: true, shadeA: 0.3, lw: 6 });
  }

  function bird(p) {
    burst(p);
    const Bd = root.HomingBirds;
    if (!Bd) return;
    // a racer bursting off the grid, band on its leg
    const x = p.x, k = 0.66;
    x.save(); x.translate(134, 142); x.rotate(-0.16); x.scale(k, k);
    Bd.paintBird(x, 'takeoff', 'grey', { s: k * p.s, lw: 6.6 * p.s, mis: 3 * p.s, cache: {}, boil: null, dotScale: p.s });
    x.restore();
  }

  function clock(p) {
    burst(p);
    // bells
    p.part({ d: circ(78, 62, 28), fill: C.YELLOW, shade: true, lw: 7 });
    p.part({ d: circ(178, 62, 28), fill: C.YELLOW, shade: true, lw: 7 });
    p.stroke('M128 40V70', C.INK, 8);
    p.part({ d: circ(128, 36, 9), fill: C.ORANGE, lw: 5 });
    // ring lines
    p.stroke('M36 40L50 50M30 66H46M220 40L206 50M226 66H210', C.INK, 6);
    // box
    p.part({ d: rr(42, 66, 172, 152, 20), fill: C.WOOD, shade: true, hi: true });
    p.stroke('M50 96H206M50 188H206', C.WOODD, 4);
    // dial
    p.part({ d: circ(128, 142, 56), fill: C.PAPER, shade: true, shadeA: 0.3 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r1 = i % 3 === 0 ? 40 : 46;
      p.stroke(`M${128 + Math.cos(a) * r1} ${142 + Math.sin(a) * r1}L${128 + Math.cos(a) * 52} ${142 + Math.sin(a) * 52}`, C.INK, i % 3 === 0 ? 6 : 3);
    }
    p.stroke('M128 142L128 104M128 142L156 160', C.INK, 8);
    p.part({ d: circ(128, 142, 7), fill: C.ORANGE, lw: 4 });
    // feet
    p.part({ d: rr(56, 214, 30, 16, 5), fill: C.WOODD, lw: 5 });
    p.part({ d: rr(170, 214, 30, 16, 5), fill: C.WOODD, lw: 5 });
    // label
    p.part({ d: rr(62, 200, 132, 42, 8), fill: C.INK, lw: 4 });
    p.text('RACE', 128, 222, 38, { fill: C.YELLOW, line: false, mis: [2, 2] });
  }

  function capsule(p, kind) {
    const body = kind === 'mult' ? C.VIOLET : C.YELLOW;
    const cap = kind === 'mult' ? C.YELLOW : C.ORANGE;
    p.x.save(); p.x.translate(128, 128); p.x.rotate(-0.28); p.x.translate(-128, -128);
    p.part({ d: rr(28, 86, 200, 84, 42), fill: body, shade: true, hi: true });
    p.part({ d: 'M180 86H186A42 42 0 0 1 186 170H180Z', fill: cap, shade: true });
    p.stroke('M180 88V168', C.INK, 6);
    if (kind === 'flock') {
      // whistle icon
      p.part({ d: rr(66, 108, 74, 40, 14), fill: C.PAPER, lw: 6 });
      p.part({ d: circ(84, 128, 9), fill: C.INK, lw: 2 });
      p.stroke('M140 118H164', C.INK, 8);
    }
    p.x.restore();
    // feather stuck to it
    p.part({ d: 'M30 214C46 182 74 168 104 166C88 190 64 210 34 222Z', fill: C.PIGL, lw: 5 });
    p.stroke('M36 218C58 196 80 180 100 170', C.INK, 3);
  }

  const PAINT = { A: (p) => rank(p, 'A'), K: (p) => rank(p, 'K'), Q: (p) => rank(p, 'Q'), J: (p) => rank(p, 'J'), T: (p) => rank(p, 'T'), TEA: tea, RAD: radio, SEED: seed, BINO: bino, CHAMP: champ, GENA: gena, BIRD: bird, CLOCK: clock,
    CAP_COIN: (p) => capsule(p, 'coin'), CAP_MULT: (p) => capsule(p, 'mult'), CAP_FLOCK: (p) => capsule(p, 'flock') };

  function paintSymbol(kind, scale, boilSeed) {
    const p = new Painter(256, 256, scale);
    PAINT[kind](p);
    return p.done(boilSeed ? { seed: boilSeed, amp: 1.7, period: 16 } : null);
  }

  root.HomingSymbols = { paintSymbol, KINDS: Object.keys(PAINT) };
})(typeof self !== 'undefined' ? self : this);

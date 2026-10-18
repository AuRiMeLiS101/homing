/* Gennady, painted whole. A skeleton pose goes in, one coherent illustration comes out.
   Parts are drawn back to front in depth groups. Inside a group every ink outline goes down first and the
   paper knockout and colour go on top, so overlapping shapes merge into one clean silhouette: no joints,
   no seams. The colour plate is offset as a whole, like a misregistered riso drum, and the line boil is a
   tiny coherent wobble of the whole drawing instead of parts shifting against each other. */
(function (root) {
  'use strict';
  const AC = root.HomingArtCore;
  const C = AC.C;

  const INK = AC.Ink;
  const { V, clamp, lerp, frame, compose, ap, capsule, translated, Pen, makeX, group, line, fill, dotsFill } = INK;
  const BOIL = INK.BOIL;

  // ---------- palettes ----------
  const SKIN = '#F4A47E', HAIR = '#F7F2E8', HAIRS = '#B9AFA2', MOUTH = '#4A1A2A', TONGUE = '#F2675E', GOLD = '#FFD23F', GOLDD = '#E8A915';
  const FITS = {
    base: {
      jacket: C.TEAL, collar: C.ORANGE, yoke: C.ORANGE, piping: C.PAPER, zip: C.PAPER, hem: C.TEALD, vest: '#FBF7EE',
      sleeve: C.TEAL, cuff: C.ORANGE, stripe: C.ORANGE, pants: '#0E5A66', pantsStripe: C.PAPER, ankle: C.TEALD,
      sock: C.PAPER, sockStripe: C.ORANGE, shoe: C.CORAL, shoeCuff: '#FBF4E6', sole: '#4E2A1C', pom: C.ORANGE,
      crown: '#33285F', band: '#1B1622', capPiping: C.YELLOW, badge: C.YELLOW, visor: '#1E1830',
      hand: SKIN, glove: false, slippers: true
    },
    race: {
      jacket: '#F1E2C2', collar: C.TEAL, yoke: null, piping: C.YELLOW, zip: null, hem: C.TEAL, vest: null,
      sleeve: '#F1E2C2', cuff: C.TEAL, stripe: null, pants: C.TEALD, pantsStripe: C.YELLOW, ankle: C.TEALD,
      sock: null, shoe: '#2A2333', shoeCuff: null, sole: '#120E18', pom: null,
      crown: '#FBF6EC', band: C.TEAL, capPiping: C.YELLOW, badge: C.YELLOW, visor: '#1E1830',
      hand: '#FFFDF7', glove: true, slippers: false, buttons: GOLD, epaulette: C.TEAL, fringe: C.YELLOW, rosette: C.YELLOW
    }
  };

  // ---------- pose ----------
  function defaultPose() {
    return {
      outfit: 'base', turn: -0.35,
      hipShift: 0, hipDrop: 0, lean: 0, breathe: 0, belly: 0, shrug: 0,
      head: { rot: 0, x: 0, y: 0 },
      // hand targets in torso space (origin at the pelvis); hx/hy is a head space target blended in by att
      A: { x: -186, y: -84, hx: 0, hy: 0, att: 0, bend: 1, hand: 'relax', hr: 0.25, z: 0 },
      B: { x: 46, y: -150, hx: 0, hy: 0, att: 0, bend: -1, hand: 'relax', hr: -0.9, z: 1 },
      legA: { x: -78, y: 0, bend: 1, rot: -0.22 }, legB: { x: 78, y: 0, bend: -1, rot: 0.22 },
      face: { eyes: 'bead', lid: 0.2, lookX: 0, lookY: 0, brow: 0.05, browL: 0, browR: 0, browAng: 0.08, mouth: 'flat', jaw: 0, smile: 0, puff: 0, sweat: 0, squint: 0, blush: 0.6, side: 0 },
      cap: { lift: 0, rot: 0, x: 0 },
      prop: { binos: 0, whistle: 0, pennant: 0, flag: 0, trophy: 0, medal: 0 },
      fx: { stache: 0, capWob: 0, belly: 0 }
    };
  }

  // ---------- skeleton ----------
  const HS = 1.19; // head scale: a big readable head on a round body
  function solve(S, T, L1, L2, bend) {
    const dx = T.x - S.x, dy = T.y - S.y, d0 = Math.hypot(dx, dy);
    const d = clamp(d0, Math.abs(L1 - L2) + 2, L1 + L2 - 0.01);
    const a = Math.atan2(dy, dx);
    const cb = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const ua = a + bend * Math.acos(cb);
    const E = V(S.x + Math.cos(ua) * L1, S.y + Math.sin(ua) * L1);
    const la = Math.atan2(T.y - E.y, T.x - E.x);
    return { S, E, W: V(E.x + Math.cos(la) * L2, E.y + Math.sin(la) * L2), ua, la };
  }
  function rig(P) {
    const K = {}, turn = P.turn;
    K.pel = V(P.hipShift, -226 + P.hipDrop);
    K.Mt = frame(K.pel.x, K.pel.y, P.lean);
    const T = (x, y) => ap(K.Mt, x, y);
    const br = P.breathe, sh = P.shrug;
    const shY = -282 - sh * 34 - br * 5;
    K.shA = T(-120 * (1 + turn * 0.16), shY + 3);
    K.shB = T(126 * (1 - turn * 0.06), shY);
    K.neck = T(turn * 12, -336 - br * 7 - sh * 6);
    K.Mh = compose(frame(K.neck.x + P.head.x, K.neck.y + P.head.y + sh * 14, P.lean * 0.45 + P.head.rot), frame(0, -114 * HS, 0, HS));
    const outward = (S, T2, L1, L2, mode) => {
      const r1 = solve(S, T2, L1, L2, 1), r2 = solve(S, T2, L1, L2, -1);
      const d1 = Math.abs(r1.E.x - K.pel.x), d2 = Math.abs(r2.E.x - K.pel.x);
      return (mode === 'in') === (d1 > d2) ? r2 : r1;
    };
    const arm = (Q, S) => {
      const tt = T(Q.x, Q.y);
      const th = Q.att ? ap(K.Mh, Q.hx, Q.hy) : tt;
      const tgt = V(lerp(tt.x, th.x, Q.att || 0), lerp(tt.y, th.y, Q.att || 0));
      const st = Q.stretch || 1; const r = outward(S, tgt, 150 * st, 136 * st, Q.bend);
      r.hand = Q.hand; r.hr = Q.hr || 0; r.z = Q.z;
      return r;
    };
    K.A = arm(P.A, K.shA); K.B = arm(P.B, K.shB);
    K.hipA = V(K.pel.x - 64, K.pel.y + 4); K.hipB = V(K.pel.x + 64, K.pel.y + 4);
    const leg = (Q, H) => {
      const r = outward(H, V(Q.x, Q.y - 44), 100, 88, Q.bend);
      r.rot = Q.rot || 0; r.foot = V(r.W.x, r.W.y + 44);
      return r;
    };
    K.legA = leg(P.legA, K.hipA); K.legB = leg(P.legB, K.hipB);
    return K;
  }

  // ---------- hands (local: wrist at origin, +x along the forearm, thumb on -y) ----------
  function handShapes(pen, pose) {
    const S = [];
    const palm = (arr) => pen.blob(arr);
    switch (pose) {
      case 'fist':
        S.push(palm([[2, -36], [46, -42], [82, -34], [94, -8], [90, 24], [62, 42], [18, 40], [-6, 4]]));
        S.push(pen.cap(30, -34, 16, 66, -14, 14));
        break;
      case 'point':
        S.push(palm([[4, -32], [44, -38], [72, -30], [80, -6], [78, 24], [56, 38], [16, 36], [-4, 4]]));
        S.push(pen.cap(62, -20, 13, 124, -26, 11));
        S.push(pen.cap(28, -30, 14, 58, -10, 12));
        break;
      case 'thumb':
        S.push(palm([[4, -30], [44, -34], [76, -28], [86, -4], [82, 24], [58, 38], [16, 36], [-4, 4]]));
        S.push(pen.cap(34, -30, 15, 34, -86, 13));
        break;
      case 'open':
        S.push(palm([[6, -30], [42, -36], [62, -26], [68, 0], [62, 28], [42, 36], [6, 32], [-4, 0]]));
        S.push(pen.cap(56, -22, 14, 100, -40, 12)); S.push(pen.cap(60, 0, 14, 110, -2, 12)); S.push(pen.cap(56, 22, 13, 98, 36, 11));
        S.push(pen.cap(24, -30, 15, 46, -72, 13));
        break;
      case 'palm':
        S.push(palm([[4, -30], [40, -34], [76, -30], [108, -18], [114, -4], [104, 8], [72, 16], [42, 32], [6, 30], [-4, 0]]));
        S.push(pen.cap(22, -30, 14, 46, -62, 12));
        break;
      case 'two':
        S.push(palm([[4, -32], [44, -38], [72, -30], [80, -6], [78, 24], [56, 38], [16, 36], [-4, 4]]));
        S.push(pen.cap(62, -22, 12, 114, -24, 11)); S.push(pen.cap(64, 0, 12, 114, -2, 11));
        S.push(pen.cap(28, -30, 14, 58, -10, 12));
        break;
      default: // relax: a soft mitten, fingers together
        S.push(palm([[4, -30], [40, -36], [74, -34], [100, -26], [112, -10], [110, 8], [96, 22], [64, 32], [30, 34], [4, 28], [-6, 0]]));
        S.push(pen.cap(26, -30, 15, 56, -50, 13));
    }
    return S;
  }
  function handDetails(X, pen, pose, glove) {
    const L = (arr, w) => line(X, pen.curve(arr), w == null ? 0.7 : w);
    if (pose === 'relax') { L([[110, -6], [88, -8]]); L([[104, 12], [84, 10]]); }
    if (pose === 'fist') { L([[80, -18], [92, -14]]); L([[82, 4], [92, 6]]); L([[78, 24], [86, 28]]); }
    if (pose === 'point' || pose === 'two' || pose === 'thumb') { L([[72, -16], [80, -14]]); L([[74, 4], [82, 6]]); L([[70, 22], [76, 26]]); }
    if (pose === 'palm') { L([[78, -6], [104, -6]], 0.6); }
    if (glove) { L([[18, -12], [44, -14]], 0.55); L([[18, 0], [46, 0]], 0.55); L([[18, 12], [44, 14]], 0.55); }
  }

  // ---------- body parts ----------
  function drawHand(X, K, arm, side) {
    const fit = X.fit;
    const dir = arm.la + arm.hr * side;
    const M = compose(frame(arm.W.x, arm.W.y, dir), frame(0, 0, 0, 1.16, -side * 1.16));
    const pen = new Pen(M, side > 0 ? 41 : 43);
    const shapes = handShapes(pen, arm.hand).map((d, i) => ({ d, fill: fit.hand, shade: i === 0 ? { off: [-14 * side, -14] } : null, shadeA: fit.glove ? 0.3 : 0.42 }));
    group(X, shapes, () => handDetails(X, pen, arm.hand, fit.glove));
  }
  function drawSleeve(X, K, arm, side) {
    const fit = X.fit, S = arm.S, E = arm.E, W = arm.W;
    const d = V(W.x - E.x, W.y - E.y), L = Math.hypot(d.x, d.y) || 1, u = V(d.x / L, d.y / L);
    const cufA = V(W.x - u.x * 16, W.y - u.y * 16), cufB = V(W.x + u.x * 10, W.y + u.y * 10);
    const sleeve = new Path2D();
    capsule(S, 55, E, 47, sleeve); capsule(E, 47, cufA, 40, sleeve);
    const cuff = capsule(cufA, 41, cufB, 40);
    const shapes = [{ d: sleeve, fill: fit.sleeve }, { d: cuff, fill: fit.cuff }];
    group(X, shapes, (ctx) => {
      // shadow down the far side of the sleeve, like a lit cylinder
      const nx = -u.y, ny = u.x;
      const sgn = (nx * (S.x - K.pel.x) + ny * 0) >= 0 ? 1 : -1;
      const rim = new Path2D();
      rim.moveTo(S.x + 30, S.y + 30); rim.lineTo(E.x + 24, E.y + 26); rim.lineTo(cufA.x + 22, cufA.y + 22);
      ctx.save(); ctx.strokeStyle = X.dots(); ctx.globalAlpha = 0.5; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(rim); ctx.restore();
      const hl = new Path2D(); hl.moveTo(S.x - 22, S.y - 28); hl.lineTo(E.x - 20, E.y - 22);
      ctx.save(); ctx.strokeStyle = X.paper; ctx.globalAlpha = 0.32; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.stroke(hl); ctx.restore();
      if (fit.stripe) {
        // a single stripe down the outside of the sleeve
        const off = (p, r) => { const t = V(p.x - K.pel.x, p.y); const s = Math.sign(t.x) || side; return V(p.x + s * r * 0.62, p.y); };
        const st = new Path2D(); const a = off(S, 50), b = off(E, 42), c = off(cufA, 36);
        st.moveTo(a.x, a.y); st.quadraticCurveTo(b.x, b.y, c.x, c.y);
        line(X, st, 4.2, X.ink); line(X, st, 2.4, fit.stripe);
        void sgn;
      }
      // cuff rib
      const cr = new Path2D(); const nn = V(-u.y, u.x);
      cr.moveTo(cufA.x + nn.x * 38, cufA.y + nn.y * 38); cr.lineTo(cufA.x - nn.x * 38, cufA.y - nn.y * 38);
      line(X, cr, 0.9);
      // elbow fold
      const ef = new Path2D(); const eu = V(E.x - S.x, E.y - S.y); const el = Math.hypot(eu.x, eu.y) || 1;
      const en = V(-eu.y / el, eu.x / el);
      ef.moveTo(E.x + en.x * 14 - eu.x / el * 8, E.y + en.y * 14 - eu.y / el * 8); ef.quadraticCurveTo(E.x, E.y + 6, E.x - en.x * 14 + eu.x / el * 4, E.y - en.y * 14 + eu.y / el * 4);
      line(X, ef, 0.6, X.ink, 0.6);
    });
  }
  function drawArm(X, K, which) {
    const arm = K[which], side = which === 'A' ? -1 : 1;
    drawHand(X, K, arm, side);
    drawSleeve(X, K, arm, side);
  }

  function drawLeg(X, K, P, which) {
    const fit = X.fit, L = K[which === 'A' ? 'legA' : 'legB'], side = which === 'A' ? -1 : 1;
    const H = L.S, Kn = L.E, An = L.W;
    // shoe first, then the trouser leg over its opening
    drawShoe(X, L, side);
    const leg = new Path2D();
    capsule(H, 62, Kn, 54, leg); capsule(Kn, 54, V(An.x, An.y - 6), 47, leg);
    const shapes = [{ d: leg, fill: fit.pants }];
    let ankle = null;
    if (fit.slippers) { ankle = capsule(V(An.x, An.y - 14), 45, V(An.x, An.y + 4), 42); shapes.push({ d: ankle, fill: fit.ankle }); }
    group(X, shapes, (ctx) => {
      const rim = new Path2D(); rim.moveTo(H.x + side * 34, H.y + 10); rim.lineTo(Kn.x + side * 30, Kn.y); rim.lineTo(An.x + side * 26, An.y - 10);
      ctx.save(); ctx.strokeStyle = X.dots(); ctx.globalAlpha = 0.5; ctx.lineWidth = 34; ctx.lineCap = 'round'; ctx.stroke(rim); ctx.restore();
      if (fit.pantsStripe) {
        const st = new Path2D(); st.moveTo(H.x + side * 40, H.y + 6); st.quadraticCurveTo(Kn.x + side * 40, Kn.y, An.x + side * 34, An.y - 14);
        line(X, st, 3.6, X.ink); line(X, st, 1.9, fit.pantsStripe);
      }
      const kf = new Path2D(); kf.moveTo(Kn.x - 18, Kn.y - 6); kf.quadraticCurveTo(Kn.x, Kn.y + 6, Kn.x + 16, Kn.y - 4);
      line(X, kf, 0.6, X.ink, 0.55);
      if (ankle) { const rb = new Path2D(); rb.moveTo(An.x - 40, An.y - 14); rb.lineTo(An.x + 40, An.y - 14); line(X, rb, 0.8); }
    });
  }
  function drawShoe(X, L, side) {
    const fit = X.fit, F = L.foot;
    const M = compose(frame(F.x, F.y, L.rot * 0.6), frame(0, 0, 0, side * 1.3, 1.3));
    const pen = new Pen(M, side > 0 ? 51 : 53);
    const shapes = [];
    if (fit.slippers) {
      shapes.push({ d: pen.blob([[-46, -4], [-40, -30], [-6, -44], [36, -38], [76, -20], [94, 2], [78, 16], [10, 20], [-36, 16]]), fill: fit.shoe, shade: { off: [-12, -16] }, hi: { off: [10, 12] } });
      shapes.push({ d: pen.blob([[-40, 8], [10, 12], [86, 6], [80, 16], [10, 20], [-36, 16]]), fill: fit.sole, line: false });
    } else {
      shapes.push({ d: pen.blob([[-42, -2], [-36, -30], [0, -40], [40, -30], [80, -14], [96, 4], [80, 18], [10, 22], [-36, 18]]), fill: fit.shoe, hi: { off: [8, 10] }, hiA: 0.5 });
      shapes.push({ d: pen.blob([[-38, 8], [40, 6], [92, 6], [84, 20], [10, 22], [-36, 20]]), fill: fit.sole, line: false });
    }
    group(X, shapes, () => {
      if (fit.slippers) {
        line(X, pen.curve([[-40, 8], [10, 12], [88, 6]]), 0.8);
        for (let i = 0; i < 3; i++) line(X, pen.curve([[-10 + i * 26, -30 + i * 4], [6 + i * 26, -4 + i * 2]]), 0.5, X.ink, 0.35);
        // fluffy cuff around the opening
        const cuff = pen.blob([[-36, -30], [-20, -40], [0, -44], [22, -42], [40, -34], [30, -24], [0, -26], [-28, -22]]);
        group(X, [{ d: cuff, fill: fit.shoeCuff }], () => {
          for (let i = 0; i < 5; i++) dotsFill(X, pen.circle(-26 + i * 14, -33 + (i % 2) * 4, 3.4), C.INK, 0.35);
        });
        if (fit.pom) group(X, [{ d: pen.circle(54, -24, 14), fill: fit.pom, shade: true }]);
      } else {
        line(X, pen.curve([[-38, 8], [20, 8], [90, 6]]), 0.8);
        line(X, pen.curve([[46, -30], [62, -20]]), 0.6, X.paper, 0.8);
      }
    });
  }

  function torsoOutline(P, turn) {
    const br = P.breathe, sh = P.shrug, bj = P.belly + (P.fx ? P.fx.belly : 0);
    const bell = (y) => Math.exp(-Math.pow((y + 96) / 92, 2));
    const pts = [
      [0, 34], [104, 28], [158, 0], [188 + bj * 9, -70], [190 + bj * 7, -138], [170, -204], [144, -252],
      [120, -290 - sh * 30], [88, -320 - sh * 22], [46, -338 - sh * 10], [0, -342]
    ];
    const right = pts.map(([x, y]) => [x * (1 + (y < -150 ? br * 0.035 : 0)), y * (1 + (y < -150 ? br * 0.018 : 0))]);
    const left = right.slice(1, -1).reverse().map(([x, y]) => [-x * (1 + turn * 0.06), y]);
    return right.concat(left).map(([x, y]) => [x + turn * 28 * bell(y), y]);
  }
  function drawTorso(X, K, P) {
    const fit = X.fit, turn = P.turn;
    const pen = new Pen(K.Mt, 61);
    const body = pen.blob(torsoOutline(P, turn));
    const zx = turn * 46;
    const shapes = [{ d: body, fill: fit.jacket, shade: { off: [-26, -22] }, shadeA: 0.48, hi: { off: [18, 16] } }];
    const hem = pen.blob([[-170, -12], [-90, 0], [0, 2], [90, 0], [170, -12], [158, 0], [104, 28], [0, 34], [-104, 28], [-158, 0]]);
    shapes.push({ d: hem, fill: fit.hem, line: false });
    group(X, shapes, () => {
      line(X, pen.curve([[-174, -12], [-90, 0], [0, 2], [90, 0], [174, -12]]), 0.9);
      for (let i = -4; i <= 4; i++) line(X, pen.curve([[i * 30 + zx * 0.4, 4 + Math.abs(i) * 1.5], [i * 28 + zx * 0.4, 26 - Math.abs(i) * 2.5]]), 0.45, X.ink, 0.5);
      if (fit.yoke) {
        // a bold yoke band across the chest with paper piping
        const yk = pen.blob([[-170, -238], [-60, -214], [zx, -210], [80, -216], [170, -242], [160, -282], [70, -260], [zx, -256], [-70, -258], [-160, -280]]);
        fill(X, translated(yk, X.mis, X.mis), fit.yoke);
        line(X, pen.curve([[-172, -236], [-60, -212], [zx, -208], [80, -214], [172, -240]]), 0.9);
        line(X, pen.curve([[-162, -282], [-70, -258], [zx, -254], [70, -258], [162, -282]]), 0.9);
        line(X, pen.curve([[-170, -228], [-60, -203], [zx, -199], [80, -205], [170, -232]]), 2.2, X.ink);
        line(X, pen.curve([[-170, -228], [-60, -203], [zx, -199], [80, -205], [170, -232]]), 1.0, fit.piping);
      }
      if (fit.zip) {
        // white vest in the open collar, then the zipper running down over the belly
        const v = pen.blob([[zx - 34, -334], [zx + 34, -334], [zx + 6, -276], [zx - 6, -276]]);
        fill(X, v, fit.vest); line(X, v, 0.8);
        for (const [hx, hy] of [[-8, -312], [6, -320], [-2, -300]]) line(X, pen.curve([[zx + hx - 4, hy], [zx + hx, hy - 5], [zx + hx + 4, hy]]), 0.55, '#8E8578');
        const zl = pen.curve([[zx, -276], [zx - 3 + turn * 6, -150], [zx - 4 + turn * 12, -60], [zx - 2 + turn * 8, 16]]);
        line(X, zl, 2.6, X.ink); line(X, zl, 1.1, fit.zip);
        const zp = pen.blob([[zx - 7, -272], [zx + 7, -272], [zx + 8, -242], [zx - 8, -242]]);
        group(X, [{ d: zp, fill: C.YELLOW }]);
        // chest patch with the loft number
        const px = 96 + turn * 18, py = -176;
        const patch = pen.blob([[px - 28, py - 20], [px + 28, py - 22], [px + 30, py + 20], [px - 28, py + 22]]);
        group(X, [{ d: patch, fill: C.PAPER2 }], (ctx) => {
          const c = pen.p(px, py + 1);
          ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r - 0.04); ctx.fillStyle = C.TEALD; ctx.font = '900 30px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('№9', 1.5, 2); ctx.restore();
        });
        // belly fold under the chest
        line(X, pen.curve([[110, -120], [140, -112], [164, -122]]), 0.6, X.ink, 0.6);
      } else {
        // parade tunic: front placket, two rows of brass buttons
        const pl = pen.curve([[zx, -330], [zx - 2 + turn * 6, -160], [zx - 2 + turn * 10, 14]]);
        line(X, pl, 1.0);
        for (let i = 0; i < 4; i++) {
          const y = -280 + i * 62;
          for (const ox of [-46, 46]) {
            const bt = pen.circle(zx + ox * (ox < 0 ? 1 + turn * 0.3 : 1 - turn * 0.2) + turn * 6, y, 11);
            group(X, [{ d: bt, fill: fit.buttons, shade: true, shadeA: 0.35 }]);
          }
        }
        // piping along the hem
        line(X, pen.curve([[-170, -30], [-90, -20], [0, -18], [90, -20], [170, -30]]), 1.6, fit.piping);
        // race official's sash, near shoulder to far hip
        const sa = pen.poly([[118, -318], [168, -280], [-110, -40], [-160, -70]]);
        fill(X, translated(sa, X.mis, X.mis), C.ORANGE);
        dotsFill(X, sa, C.INK, 0.18);
        line(X, pen.curve([[118, -318], [-160, -70]]), 0.9); line(X, pen.curve([[168, -280], [-110, -40]]), 0.9);
        const se = pen.curve([[124, -305], [-150, -62]]); line(X, se, 1.2, fit.piping);
        const se2 = pen.curve([[160, -284], [-116, -50]]); line(X, se2, 1.2, fit.piping);
      }
    });
    // stand-up collar
    const cl = pen.blob([[zx - 78, -326], [zx - 50, -352], [zx - 10, -346], [zx - 4, -322], [zx - 38, -306]]);
    const cr = pen.blob([[zx + 78, -326], [zx + 50, -352], [zx + 10, -346], [zx + 4, -322], [zx + 38, -306]]);
    group(X, [{ d: cl, fill: fit.collar, shade: true, shadeA: 0.35 }, { d: cr, fill: fit.collar, shade: true, shadeA: 0.35 }], () => {
      if (!fit.zip) { line(X, pen.curve([[zx - 70, -322], [zx - 40, -340], [zx - 12, -336]]), 1.4, fit.piping); line(X, pen.curve([[zx + 70, -322], [zx + 40, -340], [zx + 12, -336]]), 1.4, fit.piping); }
    });
    if (!fit.zip) {
      const rx = 92 + turn * 18, ry = -216;
      const rib1 = pen.poly([[rx - 18, ry + 10], [rx - 2, ry + 10], [rx - 8, ry + 78], [rx - 18, ry + 66], [rx - 30, ry + 74]]);
      const rib2 = pen.poly([[rx + 2, ry + 10], [rx + 18, ry + 10], [rx + 30, ry + 72], [rx + 18, ry + 64], [rx + 6, ry + 74]]);
      group(X, [{ d: rib1, fill: C.ORANGE }, { d: rib2, fill: C.TEAL }]);
      const pts = [];
      for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, r = i % 2 ? 30 : 38; pts.push([rx + Math.cos(a) * r, ry + Math.sin(a) * r]); }
      group(X, [{ d: pen.poly(pts), fill: fit.rosette, shade: true, shadeA: 0.3 }], () => {
        group(X, [{ d: pen.circle(rx, ry, 17), fill: C.PAPER }], (ctx) => {
          const c = pen.p(rx, ry + 1); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r); ctx.fillStyle = C.INK; ctx.font = '900 22px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('9', 0, 1); ctx.restore();
        });
      });
    }
  }

  // parade epaulettes sit on top of the shoulders, over the sleeves
  function drawEpaulettes(X, K, P) {
    const fit = X.fit; if (fit.zip) return;
    const turn = P.turn, pen = new Pen(K.Mt, 63);
    for (const sg of [-1, 1]) {
      const sx = sg * (sg < 0 ? 128 * (1 + turn * 0.16) : 134), sy = -294 - P.shrug * 32;
      const ep = pen.blob([[sx - 42, sy + 4], [sx - 36, sy - 18], [sx + 36, sy - 20], [sx + 44, sy + 2], [sx + 32, sy + 13], [sx - 32, sy + 15]]);
      group(X, [{ d: ep, fill: fit.epaulette, shade: true, shadeA: 0.35 }], () => {
        for (let i = 0; i < 8; i++) { const fx0 = sx - 33 + i * 9.5; const fr = pen.curve([[fx0, sy + 12], [fx0 + 1, sy + 36]]); line(X, fr, 2.4, X.ink); line(X, fr, 1.2, fit.fringe); }
        line(X, pen.curve([[sx - 32, sy - 5], [sx + 32, sy - 7]]), 1.3, fit.fringe);
      });
    }
  }

  function drawWhistle(X, K, P) {
    const fit = X.fit;
    if (!fit.zip && !P.prop.whistle) return;
    const turn = P.turn, zx = turn * 46;
    const T = new Pen(K.Mt, 71);
    const w = P.prop.whistle;
    const chest = T.p(zx + 26, -222);
    const mouth = ap(K.Mh, turn * 40 + 10, 92);
    const at = V(lerp(chest.x, mouth.x, w), lerp(chest.y, mouth.y, w));
    const n1 = T.p(zx - 44, -334), n2 = T.p(zx + 44, -334);
    const sag = 34 * (1 - w);
    const cord = new Path2D();
    cord.moveTo(n1.x, n1.y); cord.quadraticCurveTo((n1.x + at.x) / 2 - 8, (n1.y + at.y) / 2 + sag, at.x - 8, at.y - 4);
    cord.moveTo(n2.x, n2.y); cord.quadraticCurveTo((n2.x + at.x) / 2 + 8, (n2.y + at.y) / 2 + sag, at.x + 6, at.y - 6);
    line(X, cord, 2.4, X.ink); line(X, cord, 1.1, fit.zip ? C.ORANGE : C.YELLOW);
    const M = frame(at.x, at.y, (w > 0.5 ? -0.5 : 0.35) + P.lean, 1.3);
    const pen = new Pen(M, 73);
    group(X, [{ d: pen.blob([[-18, -10], [12, -12], [20, 0], [12, 12], [-18, 12], [-24, 0]]), fill: GOLD, shade: true, shadeA: 0.35 }, { d: pen.blob([[16, -7], [36, -6], [38, 6], [16, 8]]), fill: GOLD }], () => {
      fill(X, pen.circle(-6, 0, 5), C.INK);
      line(X, pen.curve([[-12, -8], [4, -9]]), 0.6, C.PAPER, 0.8);
    });
  }

  // ---------- head ----------
  function drawHead(X, K, P) {
    const fit = X.fit, f = P.face, turn = P.turn;
    const R = 124, al = turn * 0.62;
    const proj = (x) => R * Math.sin(Math.asin(clamp(x / R, -0.985, 0.985)) + al);
    const fsc = (x) => { const th = Math.asin(clamp(x / R, -0.985, 0.985)); return clamp(Math.cos(th + al) / Math.cos(th), 0.5, 1.25); };
    const M = K.Mh, pen = new Pen(M, 11);
    const jaw = f.jaw * 36, pf = f.puff * 18, shift = R * Math.sin(al);
    const sideNear = turn <= 0 ? 1 : -1;
    const raw = [[0, -118], [64, -116], [102, -90], [112, -40], [114, 4], [126 + pf, 44 + jaw * 0.25], [118 + pf * 0.6, 88 + jaw * 0.7], [80, 116 + jaw], [0, 128 + jaw],
      [-80, 116 + jaw], [-118 - pf * 0.6, 88 + jaw * 0.7], [-126 - pf, 44 + jaw * 0.25], [-114, 4], [-112, -40], [-100, -86], [-64, -110]];
    const headPts = raw.map(([x, y]) => [x + shift * 0.42 * clamp((y + 10) / 140, 0, 1), y]);
    // far ear sits behind the skull
    const earX = (s) => proj(s * 114) + s * 6;
    const ear = (s, sc) => pen.ellipse(earX(s), 0, 26 * sc, 38 * sc, s * 0.12);
    const farS = -sideNear;
    group(X, [{ d: ear(farS, 0.92), fill: SKIN, shade: true, shadeA: 0.4 }], () => line(X, pen.curve([[earX(farS) + farS * 4, -18], [earX(farS) - farS * 10, -4], [earX(farS) + farS * 2, 16]]), 0.7));
    const headD = pen.blob(headPts);
    const nearEar = ear(sideNear, 1.04);
    group(X, [{ d: headD, fill: SKIN, shade: { off: [-30 + turn * 20, -24] }, shadeA: 0.42, hi: { off: [16, 14] }, hiA: 0.3 }, { d: nearEar, fill: SKIN, shade: true, shadeA: 0.42 }], () => {
      const ex = earX(sideNear);
      line(X, pen.curve([[ex + sideNear * 8, -22], [ex - sideNear * 6, -10], [ex - sideNear * 4, 8], [ex + sideNear * 6, 20]]), 0.8);
      line(X, pen.curve([[ex - sideNear * 18, -14], [ex - sideNear * 22, 4]]), 0.7, X.ink, 0.6);
      // cheeks: halftone blush
      const bl = clamp(f.blush + f.smile * 0.3 + f.puff * 0.5, 0, 1);
      if (bl > 0) for (const s of [-1, 1]) dotsFill(X, pen.ellipse(proj(s * 72), 44, 30 * fsc(s * 72), 20, 0), C.CORAL, 0.55 * bl);
      // stubble
      const stub = [[-70, 92], [-52, 104], [-30, 112], [30, 112], [52, 104], [70, 92], [-86, 74], [86, 74], [-10, 118], [12, 118]];
      for (const [sx, sy] of stub) fill(X, pen.circle(proj(sx) + 0, sy + jaw * (sy > 90 ? 0.8 : 0.4), 2.1), C.INK, 0.38);
      // chin crease
      line(X, pen.curve([[proj(-16), 118 + jaw], [proj(0), 122 + jaw], [proj(16), 118 + jaw]]), 0.6, X.ink, 0.6);
      drawMouth(X, pen, f, proj, jaw);
      drawEyes(X, pen, f, proj, fsc);
      // crow's feet when he smiles or squints
      const cf = clamp(f.smile + f.squint, 0, 1);
      if (cf > 0.2) for (const s of [-1, 1]) { const x0 = proj(s * 70); line(X, pen.curve([[x0, -28], [x0 + s * 12, -34]]), 0.6, X.ink, cf); line(X, pen.curve([[x0, -18], [x0 + s * 13, -16]]), 0.6, X.ink, cf); }
    });
    drawStache(X, pen, f, proj, P);
    drawNose(X, pen, f, proj, turn);
    drawBrows(X, pen, f, proj, fsc);
    // white side hair poking out under the cap
    for (const s of [-1, 1]) {
      const bx = proj(s * 104) + s * 4;
      const near = s === sideNear;
      const tuft = pen.blob([[bx - s * 10, -92], [bx + s * 14, -94], [bx + s * 26, -78], [bx + s * 20, -66], [bx + s * 28, -54], [bx + s * 12, -40], [bx - s * 4, -46], [bx - s * 8, -70]]);
      if (near || Math.abs(turn) < 0.5) group(X, [{ d: tuft, fill: HAIR, shade: { off: [-s * 8, -8] }, shadeColor: HAIRS, shadeA: 0.7 }]);
    }
    if (f.sweat > 0.01) {
      const sx = proj(sideNear * 92), sy = -40 + f.sweat * 40;
      const drop = pen.blob([[sx, sy - 22], [sx + 9, sy - 2], [sx + 8, sy + 10], [sx, sy + 15], [sx - 8, sy + 10], [sx - 9, sy - 2]]);
      group(X, [{ d: drop, fill: '#CFEAE4' }], () => fill(X, pen.circle(sx - 3, sy + 2, 3), C.PAPER));
    }
    drawCap(X, K, P);
  }

  function drawEyes(X, pen, f, proj, fsc) {
    for (const s of [-1, 1]) {
      const x0 = proj(s * 44), sc = fsc(s * 44), y0 = -24;
      const lx = f.lookX * 7 * sc, ly = f.lookY * 5;
      const lid = clamp(f.lid + (s < 0 ? (f.lidL || 0) : (f.lidR || 0)), 0, 1);
      switch (f.eyes) {
        case 'happy': line(X, pen.curve([[x0 - 15 * sc, y0 + 6], [x0, y0 - 10], [x0 + 15 * sc, y0 + 6]]), 2.4); break;
        case 'closed': line(X, pen.curve([[x0 - 15 * sc, y0 - 2], [x0, y0 + 8], [x0 + 15 * sc, y0 - 2]]), 2.2); break;
        case 'wide': {
          const w = pen.ellipse(x0, y0 - 2, 24 * sc, 26, 0);
          group(X, [{ d: w, fill: C.PAPER }], () => {
            fill(X, pen.circle(x0 + lx * 1.4, y0 + ly, 8.5), C.INK);
            fill(X, pen.circle(x0 + lx * 1.4 - 3, y0 + ly - 3.5, 2.6), C.PAPER);
          });
          break;
        }
        case 'squeeze': line(X, pen.curve([[x0 - 16 * sc, y0 - 8], [x0 + 6 * s, y0], [x0 - 16 * sc, y0 + 8]].map(([x, y]) => [s > 0 ? x : 2 * x0 - x, y])), 2.4); break;
        default: {
          // bead eyes under heavy lids: the deadpan look
          const ex = x0 + lx, ey = y0 + ly;
          const bead = pen.ellipse(ex, ey, 13 * sc, 17.5, 0);
          fill(X, bead, C.INK);
          fill(X, pen.circle(ex - 4 * sc, ey - 6.5, 4.2), C.PAPER);
          if (lid > 0.02) {
            const top = y0 - 28, edge = y0 - 18 + lid * 36;
            const lidD = pen.blob([[x0 - 22 * sc, top], [x0 + 22 * sc, top], [x0 + 21 * sc, edge - 3], [x0, edge + 2], [x0 - 21 * sc, edge - 3]]);
            fill(X, lidD, SKIN);
            dotsFill(X, lidD, C.INK, 0.28);
            line(X, pen.curve([[x0 - 19 * sc, edge - 2], [x0, edge + 3], [x0 + 19 * sc, edge - 2]]), 2.1);
          }
          if (f.squint > 0.05) line(X, pen.curve([[x0 - 14 * sc, y0 + 14 - f.squint * 8], [x0, y0 + 10 - f.squint * 8], [x0 + 14 * sc, y0 + 14 - f.squint * 8]]), 1.0, X.ink, 0.8);
        }
      }
    }
  }
  function drawBrows(X, pen, f, proj, fsc) {
    const shapes = [];
    for (const s of [-1, 1]) {
      const raise = (f.brow + (s < 0 ? f.browL : f.browR)) * 16;
      const cx = proj(s * 50), cy = -64 - raise, sc = fsc(s * 50);
      const ang = (f.browAng || 0) * s;
      const pts = [[-36, 6], [-30, -6], [-14, -14], [4, -16], [22, -14], [36, -12], [48, -22], [46, -6], [36, 8], [12, 11], [-14, 12]];
      const M = compose(pen.M, compose(frame(cx, cy, -ang), frame(0, 0, 0, s * sc, 1)));
      shapes.push({ d: new Pen(M, 17 + s).blob(pts), fill: HAIR, shade: { off: [0, -9] }, shadeColor: HAIRS, shadeA: 0.75 });
    }
    group(X, shapes);
  }
  function drawNose(X, pen, f, proj, turn) {
    const nx = proj(0) + turn * 12, ny = 20;
    const d = pen.blob([[nx - 30, ny - 4], [nx - 22, ny - 30], [nx + 2, ny - 38], [nx + 24, ny - 28], [nx + 32, ny - 2], [nx + 26, ny + 22], [nx, ny + 30], [nx - 24, ny + 22]]);
    const wing = pen.circle(nx - turn * 30 + 22 * (turn <= 0 ? 1 : -1), ny + 14, 15);
    group(X, [{ d, fill: SKIN, shade: { off: [-12, -12] }, shadeA: 0.45, hi: { off: [9, 9] }, hiA: 0.45 }, { d: wing, fill: SKIN, shade: true, shadeA: 0.45 }], () => {
      dotsFill(X, pen.circle(nx + 6, ny + 4, 18), C.CORAL, 0.55);
      fill(X, pen.ellipse(nx - 4 + turn * 6, ny + 20, 6, 4, 0.3), C.INK, 0.7);
    });
  }
  function drawStache(X, pen, f, proj, P) {
    const lift = clamp(f.smile, -0.5, 1) * 16 + (P.fx ? P.fx.stache : 0) * 12;
    const spread = 1 + clamp(f.smile, 0, 1) * 0.08 + f.puff * 0.1;
    const right = [[8, 28], [34, 24], [62, 30], [86, 46 - lift * 0.5], [100, 66 - lift], [92, 76 - lift], [72, 70 - lift * 0.6], [56, 78 - lift * 0.4], [36, 70], [18, 76], [0, 68]];
    const left = right.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
    const pts = right.concat([[0, 68]]).concat(left).concat([[-8, 28]]);
    const mapped = pts.map(([x, y]) => [proj(x * spread * 0.92), y]);
    const d = pen.blob(mapped);
    group(X, [{ d, fill: HAIR, shade: { off: [0, -14] }, shadeColor: HAIRS, shadeA: 0.8 }], () => {
      for (const s of [-1, 1]) {
        line(X, pen.curve([[proj(s * 24), 40], [proj(s * 44), 54], [proj(s * 60), 64 - lift * 0.5]]), 0.55, '#9B9184');
        line(X, pen.curve([[proj(s * 40), 34], [proj(s * 64), 46], [proj(s * 80), 60 - lift * 0.8]]), 0.55, '#9B9184');
      }
    });
  }
  function drawMouth(X, pen, f, proj, jaw) {
    const mx = proj(0), my = 80;
    const ink = (d) => fill(X, d, MOUTH);
    switch (f.mouth) {
      case 'smile': line(X, pen.curve([[mx - 30, my - 2], [mx, my + 12], [mx + 30, my - 2]]), 1.6); break;
      case 'smirk': line(X, pen.curve([[mx - 14, my + 4], [mx + 14, my + 6], [mx + 34, my - 6]]), 1.6); break;
      case 'frown': line(X, pen.curve([[mx - 24, my + 12], [mx, my + 4], [mx + 24, my + 12]]), 1.6); break;
      case 'grin': {
        const d = pen.blob([[mx - 50, my - 12], [mx + 50, my - 12], [mx + 40, my + 20 + jaw * 0.5], [mx, my + 38 + jaw], [mx - 40, my + 20 + jaw * 0.5]]);
        ink(d);
        X.ctx.save(); X.ctx.clip(d);
        fill(X, pen.ellipse(mx + 4, my + 40 + jaw, 30, 18, 0), TONGUE);
        fill(X, pen.blob([[mx - 46, my - 14], [mx + 46, my - 14], [mx + 42, my + 2], [mx - 42, my + 2]]), C.PAPER);
        X.ctx.restore();
        line(X, d, 1.2);
        break;
      }
      case 'open': case 'shout': {
        const big = f.mouth === 'shout';
        const rx = big ? 40 : 22, ry = (big ? 34 : 24) + jaw * 0.6;
        const d = pen.ellipse(mx, my + ry * 0.7, rx, ry, 0);
        ink(d);
        X.ctx.save(); X.ctx.clip(d);
        fill(X, pen.ellipse(mx + 2, my + ry * 1.5, rx * 0.8, ry * 0.6, 0), TONGUE);
        if (big) fill(X, pen.blob([[mx - 34, my - 4], [mx + 34, my - 4], [mx + 30, my + 8], [mx - 30, my + 8]]), C.PAPER);
        X.ctx.restore();
        line(X, d, 1.2);
        break;
      }
      case 'o': { const d = pen.ellipse(mx, my + 14, 13, 17 + jaw * 0.3, 0); ink(d); line(X, d, 1.1); break; }
      case 'pucker': {
        const px = mx + (proj(30) - proj(0)) * 0.4;
        const d = pen.circle(px, my + 8, 15);
        group(X, [{ d, fill: SKIN, shade: true, shadeA: 0.4 }], () => fill(X, pen.circle(px, my + 8, 6), MOUTH));
        break;
      }
      default: // flat: just the lower lip under the moustache
        line(X, pen.curve([[mx - 16, my + 6], [mx, my + 10], [mx + 16, my + 6]]), 1.1);
    }
  }
  function drawCap(X, K, P) {
    const fit = X.fit, cp = P.cap, turn = P.turn;
    const wob = P.fx ? P.fx.capWob : 0;
    const Mc = compose(K.Mh, frame(cp.x + turn * 8, -114 - cp.lift, cp.rot + wob));
    const pen = new Pen(Mc, 21);
    const sh = turn * 24;
    const crown = pen.blob([[-114, -26], [-122, -60], [-140 + sh * 0.2, -92], [-132 + sh, -108], [-60 + sh, -120], [sh, -124], [62 + sh, -120], [134 + sh, -106], [142 + sh * 0.2, -90], [124, -60], [116, -26]]);
    const band = pen.blob([[-118, -36], [0, -32], [118, -36], [116, 0], [0, 6], [-116, 0]]);
    const visor = pen.blob([[-114, 0], [-60 + sh, 6], [sh, 8], [60 + sh, 6], [114, 0], [70 + sh * 1.2, 16], [sh * 1.3, 23], [-70 + sh * 1.2, 16]]);
    group(X, [{ d: crown, fill: fit.crown, shade: { off: [-20, -18] }, shadeA: fit.crown === '#FBF6EC' ? 0.3 : 0.45, hi: { off: [14, 14] }, hiA: 0.25 }, { d: band, fill: fit.band }, { d: visor, fill: fit.visor }], () => {
      line(X, pen.curve([[-118, -36], [0, -32], [118, -36]]), 0.9);
      line(X, pen.curve([[-116, 0], [0, 6], [116, 0]]), 0.9);
      if (fit.glove) {
        // parade cap: gold braid across the band
        const br = pen.curve([[-108, -18], [0, -12], [108, -18]]);
        line(X, br, 3.2, X.ink); line(X, br, 2.0, fit.capPiping);
        for (let i = -6; i <= 6; i++) line(X, pen.curve([[i * 16 - 3, -22 + Math.abs(i) * 0.4], [i * 16 + 3, -14 + Math.abs(i) * 0.4]]), 0.5, X.ink, 0.7);
      } else {
        line(X, pen.curve([[-116, -38], [0, -34], [116, -38]]), 1.0, fit.capPiping, 0.9);
      }
      line(X, pen.curve([[-80 + sh, 12], [sh, 17], [70 + sh, 11]]), 1.2, C.PAPER, 0.55);
      line(X, pen.curve([[-120 + sh * 0.2, -86], [-60 + sh, -110], [0 + sh, -114]]), 1.0, C.PAPER, 0.45);
    });
    // badge
    const bx = sh * 0.9, by = -66;
    const wings = pen.poly([[bx - 44, by - 6], [bx - 12, by - 8], [bx - 12, by + 6], [bx - 34, by + 4]]);
    const wings2 = pen.poly([[bx + 44, by - 6], [bx + 12, by - 8], [bx + 12, by + 6], [bx + 34, by + 4]]);
    group(X, [{ d: wings, fill: fit.badge }, { d: wings2, fill: fit.badge }, { d: pen.circle(bx, by, 17), fill: fit.badge, shade: true, shadeA: 0.3 }], (ctx) => {
      const c = pen.p(bx, by + 1);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r); ctx.fillStyle = C.INK; ctx.font = '900 22px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('9', 0, 1); ctx.restore();
      for (let i = 0; i < 3; i++) { line(X, pen.curve([[bx - 18 - i * 8, by - 4 + i], [bx - 22 - i * 8, by + 3]]), 0.5); line(X, pen.curve([[bx + 18 + i * 8, by - 4 + i], [bx + 22 + i * 8, by + 3]]), 0.5); }
    });
  }

  // ---------- props ----------
  function drawBinos(X, K, P) {
    const b = P.prop.binos; if (b < 0.5) return;
    const f = P.face, turn = P.turn;
    const R = 124, al = turn * 0.62;
    const proj = (x) => R * Math.sin(Math.asin(clamp(x / R, -0.985, 0.985)) + al);
    const pen = new Pen(K.Mh, 81);
    const S = [];
    for (const s of [-1, 1]) S.push({ d: pen.blob([[proj(s * 40) - 30, -64], [proj(s * 40) + 30, -64], [proj(s * 40) + 32, 10], [proj(s * 40) - 32, 10]]), fill: C.TEAL, shade: true, hi: true });
    S.push({ d: pen.blob([[proj(-12), -40], [proj(12), -40], [proj(12), -8], [proj(-12), -8]]), fill: C.VIOLETD });
    group(X, S, () => {
      for (const s of [-1, 1]) {
        const lx = proj(s * 40);
        group(X, [{ d: pen.ellipse(lx, -24, 24, 22, 0), fill: C.PAPER }], () => {
          dotsFill(X, pen.ellipse(lx + 4, -20, 22, 20, 0), C.TEALD, 0.6);
          line(X, pen.curve([[lx - 12, -32], [lx - 4, -38]]), 1.2, C.PAPER);
        });
        line(X, pen.curve([[lx - 28, -2], [lx + 28, -2]]), 0.7);
      }
      void f;
    });
  }
  function drawPennant(X, K, P) {
    const v = P.prop.pennant; if (v < 0.5) return;
    const arm = K.B, side = 1;
    const M = compose(frame(arm.W.x, arm.W.y, arm.la + arm.hr * side), frame(0, 0, 0, 1, -side));
    const pen = new Pen(M, 91);
    const pole = pen.cap(42, 70, 7, 42, -300, 7);
    const fl = P.prop.flag || 0;
    const w = Math.sin(fl) * 18, w2 = Math.sin(fl + 1.4) * 22;
    const flag = pen.blob([[46, -296], [130, -290 + w], [220, -262 + w2], [130, -226 + w], [46, -206]]);
    group(X, [{ d: pole, fill: C.WOODD }]);
    group(X, [{ d: flag, fill: C.ORANGE, shade: { off: [0, -20] }, shadeA: 0.4 }], (ctx) => {
      const c = pen.p(104, -252 + w * 0.6);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r + Math.PI / 2 * -1 + Math.PI / 2); ctx.fillStyle = C.PAPER; ctx.font = '900 46px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.scale(1, -1); ctx.fillText('№9', 0, 2); ctx.restore();
    });
  }
  function drawTrophy(X, K, P) {
    const v = P.prop.trophy; if (v < 0.5) return;
    const b = K.B.W;
    const pen = new Pen(frame(b.x + 6, b.y - 26, 0.12 + P.lean), 95);
    const bowl = pen.blob([[-86, -170], [86, -170], [78, -110], [44, -64], [0, -50], [-44, -64], [-78, -110]]);
    const stem = pen.blob([[-16, -56], [16, -56], [12, -16], [-12, -16]]);
    const base = pen.blob([[-56, -18], [56, -18], [62, 18], [-62, 18]]);
    const hl = pen.cap(-92, -150, 10, -122, -104, 10), hr = pen.cap(92, -150, 10, 122, -104, 10);
    group(X, [{ d: hl, fill: GOLD }, { d: hr, fill: GOLD }]);
    group(X, [{ d: bowl, fill: GOLD, shade: true, hi: true, shadeColor: '#B86A10', shadeA: 0.5 }, { d: stem, fill: GOLDD }, { d: base, fill: C.TEALD }], (ctx) => {
      line(X, pen.curve([[-86, -170], [0, -162], [86, -170]]), 0.9);
      const c = pen.p(0, -116); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r); ctx.fillStyle = C.ORANGED; ctx.font = '900 44px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('№9', 0, 2); ctx.restore();
      line(X, pen.curve([[-60, -156], [-50, -110]]), 2.0, C.PAPER, 0.6);
    });
  }
  function drawMedal(X, K, P) {
    const v = P.prop.medal; if (v < 0.5) return;
    const turn = P.turn, zx = turn * 46;
    const pen = new Pen(K.Mt, 97);
    const r1 = pen.poly([[zx - 40, -332], [zx - 18, -332], [zx + 4, -230], [zx - 14, -226]]);
    const r2 = pen.poly([[zx + 40, -332], [zx + 18, -332], [zx - 4, -230], [zx + 14, -226]]);
    group(X, [{ d: r1, fill: C.PINK }, { d: r2, fill: C.TEALL }]);
    group(X, [{ d: pen.circle(zx, -202, 34), fill: GOLD, shade: true, hi: true, shadeColor: '#B86A10' }], (ctx) => {
      const c = pen.p(zx, -201); ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(pen.r); ctx.fillStyle = C.ORANGED; ctx.font = '900 34px "Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('1', 0, 2); ctx.restore();
    });
  }

  // ---------- the whole character ----------
  // ctx is set up by the caller so that rig units map to pixels with the origin on the ground between the feet.
  // o: { s: pixels per rig unit, lw: ink line width in pixels, mis: colour plate offset in pixels, boil: frame number or null }
  function paint(ctx, P, o) {
    BOIL.amp = o.boil == null ? 0 : (o.boilAmp == null ? 0.7 : o.boilAmp) / o.s;
    BOIL.t = o.boil || 0;
    const X = makeX(ctx, o);
    X.fit = FITS[P.outfit] || FITS.base;
    const K = rig(P);
    // contact shadow
    if (!X.sil) {
      ctx.save(); ctx.fillStyle = 'rgba(16,10,26,0.34)';
      ctx.beginPath(); ctx.ellipse((K.legA.foot.x + K.legB.foot.x) / 2, 8, 200 + Math.abs(K.legB.foot.x - K.legA.foot.x) * 0.2, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const arms = [['A', K.A.z], ['B', K.B.z]];
    for (const [w, z] of arms) if (z === 0) drawArm(X, K, w);
    drawLeg(X, K, P, 'A'); drawLeg(X, K, P, 'B');
    drawTorso(X, K, P);
    drawMedal(X, K, P);
    if (P.prop.whistle < 0.5) drawWhistle(X, K, P);
    for (const [w, z] of arms) if (z === 1) drawArm(X, K, w);
    drawEpaulettes(X, K, P);
    drawHead(X, K, P);
    for (const [w, z] of arms) if (z === 2) drawArm(X, K, w);
    if (P.prop.whistle >= 0.5) drawWhistle(X, K, P);
    drawBinos(X, K, P);
    drawTrophy(X, K, P);
    drawPennant(X, K, P);
    return K;
  }


  // ---------- key poses: partial overrides of defaultPose, shared by the game and the character sheet ----------
  const HANG_A = { x: -212, y: -64, att: 0, hand: 'relax', hr: 0.15, z: 1, bend: 1 };
  const CRADLE_B = { x: 30, y: -150, att: 0, hand: 'relax', hr: 0.25, z: 1, bend: -1 };
  const POSES = {
    idle: { A: HANG_A, B: CRADLE_B },
    sky: { A: { att: 1, hx: -52, hy: -94, hand: 'relax', hr: -0.95, z: 2, bend: 1, stretch: 1.34 }, B: CRADLE_B, lean: -0.03, head: { y: -6, rot: -0.04 },
      face: { lookX: -0.7, lookY: -1, brow: 0.5, lid: 0.05, mouth: 'flat' } },
    capTip: { A: { att: 1, hx: -40, hy: -108, hand: 'fist', hr: -0.9, z: 2, bend: 1, stretch: 1.34 }, B: CRADLE_B, cap: { rot: -0.1, lift: 8 },
      face: { mouth: 'smirk', smile: 0.4, lid: 0.35, brow: 0.2 } },
    anticip: { hipDrop: 26, lean: -0.05, legA: { x: -100 }, legB: { x: 100 }, prop: { binos: 1 },
      A: { att: 1, hx: -74, hy: 22, hand: 'fist', hr: -1.4, z: 2, bend: 1 }, B: { att: 1, hx: 74, hy: 22, hand: 'fist', hr: 1.4, z: 2, bend: -1 },
      face: { brow: -0.5, browAng: -0.3, sweat: 0.7, mouth: 'flat', jaw: 0 } },
    smallWin: { A: { x: -222, y: -262, att: 0, hand: 'fist', hr: 0.15, z: 1, bend: 1 }, B: CRADLE_B, lean: -0.04, head: { rot: 0.07 }, hipDrop: 10,
      face: { mouth: 'smirk', smile: 0.8, lid: 0.32, squint: 0.6, brow: 0.35 } },
    cheer: { A: { x: -258, y: -650, att: 0, hand: 'fist', hr: 0, z: 1, bend: -1, stretch: 1.08 }, B: { x: 258, y: -650, att: 0, hand: 'fist', hr: 0, z: 1, bend: 1, stretch: 1.08 }, breathe: 1,
      face: { eyes: 'happy', mouth: 'grin', smile: 1, brow: 1, lid: 0 }, cap: { lift: 34, rot: -0.16 } },
    point: { A: { x: -300, y: -560, att: 0, hand: 'point', hr: 0, z: 1, bend: -1, stretch: 1.06 }, B: CRADLE_B, lean: -0.06,
      face: { lookX: -0.85, lookY: -0.8, eyes: 'bead', lid: 0, brow: 0.8, mouth: 'o' } },
    gasp: { hipDrop: 8, A: { x: -268, y: -500, att: 0, hand: 'open', hr: -1.2, z: 1, bend: 1 }, B: { x: 272, y: -500, att: 0, hand: 'open', hr: -1.2, z: 1, bend: -1 },
      face: { eyes: 'wide', mouth: 'shout', jaw: 1, brow: 1.4, lookX: -0.3 }, cap: { lift: 46, rot: 0.12 } },
    shrug: { shrug: 1, A: { x: -258, y: -236, att: 0, hand: 'palm', hr: -1.25, z: 1, bend: 1 }, B: { x: 262, y: -236, att: 0, hand: 'palm', hr: -1.25, z: 1, bend: -1 },
      head: { rot: -0.13 }, face: { brow: 0.9, browL: 0.35, browR: -0.1, lid: 0.42, lookX: 0.75, lookY: 0.2, mouth: 'frown' } },
    whistle: { lean: 0.04, head: { y: -6, rot: 0.04 }, prop: { whistle: 1 }, A: HANG_A,
      B: { att: 1, hx: 70, hy: 126, hand: 'fist', hr: -1.6, z: 2, bend: -1 },
      face: { eyes: 'closed', puff: 1, mouth: 'pucker', brow: 0.9, browAng: 0.15 } },
    proud: { breathe: 1, head: { y: -8, rot: -0.03 }, A: { x: -40, y: -76, att: 0, hand: 'fist', hr: 0, z: 0, bend: 1 }, B: { x: 40, y: -76, att: 0, hand: 'fist', hr: 0, z: 0, bend: -1 },
      face: { eyes: 'closed', mouth: 'smile', smile: 0.6, brow: 0.45 } },
    wave: { prop: { pennant: 1, flag: 0 }, A: HANG_A, B: { x: 206, y: -668, att: 0, hand: 'fist', hr: 0.3, z: 1, bend: 1, stretch: 1.08 }, lean: 0.03,
      face: { eyes: 'happy', mouth: 'grin', smile: 1, brow: 0.9, lid: 0 } },
    bigV: { breathe: 1, A: { x: -318, y: -610, att: 0, hand: 'fist', hr: 0, z: 1, bend: -1, stretch: 1.1 }, B: { x: 318, y: -610, att: 0, hand: 'fist', hr: 0, z: 1, bend: 1, stretch: 1.1 },
      legA: { x: -70, y: 0 }, legB: { x: 30, y: -96, bend: -1, rot: 0.5 },
      face: { eyes: 'happy', mouth: 'grin', jaw: 0.6, smile: 1, brow: 1.1, lid: 0 }, cap: { lift: 150, rot: -0.55 } },
    danceA: { hipDrop: 112, lean: -0.08, A: { x: 64, y: -258, att: 0, hand: 'fist', hr: 0.8, z: 1, bend: 1 }, B: { x: -56, y: -246, att: 0, hand: 'fist', hr: -0.8, z: 1, bend: -1 },
      legA: { x: -110, y: 0, bend: 1, rot: -0.3 }, legB: { x: 262, y: -150, bend: -1, rot: -1.3 },
      face: { eyes: 'happy', mouth: 'grin', smile: 1, brow: 0.8, lid: 0 } },
    danceB: { hipDrop: 112, lean: 0.08, A: { x: -300, y: -330, att: 0, hand: 'open', hr: -0.5, z: 1, bend: -1 }, B: { x: 300, y: -330, att: 0, hand: 'open', hr: -0.5, z: 1, bend: 1 },
      legA: { x: -262, y: -150, bend: 1, rot: 1.3 }, legB: { x: 110, y: 0, bend: -1, rot: 0.3 },
      face: { eyes: 'happy', mouth: 'open', smile: 1, brow: 1, lid: 0, jaw: 0.4 } },
    trophy: { breathe: 1, lean: 0.05, head: { rot: 0.1 }, prop: { trophy: 1 }, A: { x: -176, y: -112, att: 0, hand: 'fist', hr: 0.4, z: 1, bend: 1 }, B: { x: 262, y: -600, att: 0, hand: 'fist', hr: 0, z: 1, bend: 1, stretch: 1.1 },
      face: { eyes: 'closed', mouth: 'open', smile: 1, brow: 0.9, jaw: 0.3 }, cap: { rot: 0.1 } },
    roar: { breathe: 1, head: { y: -12 }, A: { x: -336, y: -470, att: 0, hand: 'open', hr: -0.3, z: 1, bend: -1, stretch: 1.08 }, B: { x: 336, y: -470, att: 0, hand: 'open', hr: -0.3, z: 1, bend: 1, stretch: 1.08 },
      legA: { x: -120 }, legB: { x: 120 }, face: { eyes: 'squeeze', mouth: 'shout', jaw: 1, brow: 1.3, smile: 0.4 }, cap: { lift: 230, rot: 0.9, x: 40 } },
    number1: { breathe: 1, prop: { medal: 1 }, A: { x: -176, y: -112, att: 0, hand: 'fist', hr: 0.4, z: 1, bend: 1 }, B: { x: 300, y: -640, att: 0, hand: 'point', hr: -0.1, z: 2, bend: 1, stretch: 1.12 },
      head: { rot: 0.06 }, face: { eyes: 'happy', mouth: 'grin', smile: 1, brow: 0.8, lid: 0, lookX: 0.6 } },
    walkA: { A: { x: -150, y: -60, att: 0, hand: 'relax', hr: 0, z: 1, bend: 1 }, B: { x: 150, y: -100, att: 0, hand: 'relax', hr: -0.4, z: 1, bend: -1 }, legA: { x: -120, y: 0, rot: -0.4 }, legB: { x: 70, y: -46, rot: 0.5 }, lean: -0.05 },
    walkB: { hipDrop: -14, A: { x: -210, y: -90, att: 0, hand: 'relax', hr: 0.4, z: 1, bend: 1 }, B: { x: 210, y: -60, att: 0, hand: 'relax', hr: 0, z: 1, bend: -1 }, legA: { x: -50, y: -40, rot: -0.5 }, legB: { x: 110, y: 0, rot: 0.3 }, lean: -0.05 }
  };
  // blend two complete poses: numbers ease, switches flip at the halfway point
  function mixPose(a, b, t) {
    const out = Array.isArray(a) ? [] : {};
    for (const k of new Set(Object.keys(a).concat(Object.keys(b)))) {
      const x = a[k], y = b[k];
      if (typeof x === 'number' && typeof y === 'number') out[k] = x + (y - x) * t;
      else if (x && y && typeof x === 'object' && typeof y === 'object') out[k] = mixPose(x, y, t);
      else out[k] = t < 0.5 ? (x === undefined ? y : x) : (y === undefined ? x : y);
    }
    return out;
  }
  function deepMerge(a, b) { for (const k in b) { const v = b[k]; if (v && typeof v === 'object' && !Array.isArray(v)) { a[k] = a[k] && typeof a[k] === 'object' ? a[k] : {}; deepMerge(a[k], v); } else a[k] = v; } return a; }
  // a complete pose: the default with a key pose and extra overrides layered on top
  function makePose(name, extra) { const P = defaultPose(); if (name && POSES[name]) deepMerge(P, JSON.parse(JSON.stringify(POSES[name]))); if (extra) deepMerge(P, JSON.parse(JSON.stringify(extra))); return P; }

  // where things sit, in rig space: the pet's perches, the face, the hands
  function anchors(P) {
    const K = rig(P);
    const turn = P.turn;
    const Mc = compose(K.Mh, frame(P.cap.x + turn * 8, -114 - P.cap.lift, P.cap.rot + (P.fx ? P.fx.capWob : 0)));
    const capTop = ap(Mc, turn * 12, -124);
    const fa = K.B; // pet sits on the near forearm, a little toward the elbow
    const arm = V(lerp(fa.E.x, fa.W.x, 0.42), lerp(fa.E.y, fa.W.y, 0.42) - 44);
    return { capTop, capRot: P.cap.rot + P.head.rot + P.lean * 0.45, arm, armRot: 0, head: ap(K.Mh, 0, 0), mouth: ap(K.Mh, turn * 40, 92), handA: K.A.W, handB: K.B.W, neck: K.neck, K };
  }

  // ---------- the pet pigeon (local: feet at origin, facing left) ----------
  function paintPet(ctx, pose, o) {
    BOIL.amp = o.boil == null ? 0 : 0.6 / o.s; BOIL.t = o.boil || 0;
    const X = makeX(ctx, o);
    const pen = new Pen(frame(0, 0, 0), 101);
    const up = pose === 'flap' || pose === 'flap2' || pose === 'startle';
    const bob = pose === 'bob' ? 1 : 0;
    const hx = -34 - bob * 10, hy = -98 + bob * 8;
    if (!up) { line(X, pen.curve([[-8, -24], [-12, -2]]), 2.6, C.CORAL); line(X, pen.curve([[10, -24], [12, -2]]), 2.6, C.CORAL); }
    else { line(X, pen.curve([[-6, -26], [-10, -12], [-18, -8]]), 2.6, C.CORAL); line(X, pen.curve([[10, -26], [8, -12], [0, -8]]), 2.6, C.CORAL); }
    if (!up) group(X, [{ d: pen.blob([[8, -18], [22, -18], [22, -10], [8, -10]]), fill: C.YELLOW }]);
    const tail = pen.blob([[34, -42], [76, -30], [84, -12], [66, -10], [30, -28]]);
    group(X, [{ d: tail, fill: '#E2DACB', shade: true, shadeA: 0.35 }]);
    const body = pen.blob([[-40, -64], [-18, -86], [16, -84], [44, -64], [50, -40], [30, -24], [-6, -20], [-36, -34]]);
    const neck = pen.blob([[-48, -60], [-50, -86], [hx - 6, hy + 4], [hx + 22, hy + 6], [-6, -70]]);
    const head = pen.circle(hx, hy, 22);
    const crest = pen.blob([[hx + 2, hy - 18], [hx + 14, hy - 34], [hx + 20, hy - 24], [hx + 28, hy - 30], [hx + 24, hy - 14]]);
    group(X, [{ d: body, fill: '#F3EEE4', shade: { off: [-12, -12] }, shadeColor: '#9A9184', shadeA: 0.45, hi: true }, { d: neck, fill: '#F3EEE4' }, { d: head, fill: '#F7F3EA', hi: true }, { d: crest, fill: '#F7F3EA' }], () => {
      dotsFill(X, pen.ellipse(-30, -66, 18, 14, -0.4), C.TEALL, 0.55);
      dotsFill(X, pen.ellipse(-24, -60, 10, 10, 0), C.PINK, 0.35);
      fill(X, pen.circle(hx - 4, hy - 4, 7.5), C.ORANGE);
      fill(X, pen.circle(hx - 5, hy - 4, 3.6), C.INK);
      fill(X, pen.circle(hx - 6.5, hy - 6, 1.4), C.PAPER);
    });
    const beak = pen.blob([[hx - 18, hy - 2], [hx - 38, hy + 4], [hx - 18, hy + 8]]);
    group(X, [{ d: beak, fill: C.TAN }], () => fill(X, pen.ellipse(hx - 18, hy - 4, 5, 3.4, 0), C.PAPER));
    if (!up) {
      const wing = pen.blob([[-26, -70], [10, -76], [40, -58], [56, -38], [24, -36], [-14, -44]]);
      group(X, [{ d: wing, fill: '#FBF8F1', shade: { off: [-8, -10] }, shadeColor: '#9A9184', shadeA: 0.5 }], () => {
        line(X, pen.curve([[-4, -58], [22, -54], [40, -46]]), 1.2, '#8E8578'); line(X, pen.curve([[2, -48], [26, -46], [44, -40]]), 1.2, '#8E8578');
      });
    } else {
      const wy = pose === 'flap2' ? 40 : 0;
      const w1 = pen.blob([[-10, -80], [-24, -140 + wy], [-4, -170 + wy * 1.4], [22, -150 + wy], [30, -110 + wy * 0.5], [20, -76]]);
      const w2 = pen.blob([[10, -78], [40, -130 + wy], [76, -150 + wy * 1.3], [70, -112 + wy], [48, -80]]);
      group(X, [{ d: w2, fill: '#E2DACB', shade: true, shadeA: 0.3 }]);
      group(X, [{ d: w1, fill: '#FBF8F1', shade: { off: [-8, -10] }, shadeColor: '#9A9184', shadeA: 0.5 }], () => {
        line(X, pen.curve([[-6, -120 + wy * 0.6], [8, -104 + wy * 0.4]]), 1.1, '#8E8578'); line(X, pen.curve([[4, -128 + wy * 0.7], [18, -108 + wy * 0.4]]), 1.1, '#8E8578');
      });
    }
  }

  root.HomingGennady = { paint, paintPet, defaultPose, makePose, mixPose, deepMerge, POSES, anchors, FITS, rig, frame, ap, compose };
})(typeof self !== 'undefined' ? self : this);

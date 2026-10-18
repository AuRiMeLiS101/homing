/* Homing pigeons, painted whole like Gennady. A parametric bird (flap angle, wing fold, sweep, pitch, tail fan,
   legs) is drawn in one pass with merged outlines and the same riso plate. The wings live in 3D: they swing
   around the body axis and are seen from a slightly raised camera, so a flap cycle foreshortens naturally.
   Five breeds. Flight frames are sampled from one smooth cycle; glide, dive, flare and takeoff poses and
   perched frames cover the rest. */
(function (root) {
  'use strict';
  const AC = root.HomingArtCore, C = AC.C, INK = AC.Ink;
  const { V, clamp, lerp, frame, compose, ap, capsule, Pen, makeX, group, line, fill, dotsFill } = INK;
  const BOIL = INK.BOIL;

  const BREEDS = {
    grey: { name: 'BLUE BAR', body: '#9FB0B8', wing: '#B7C5CB', under: '#D4DEE2', flight: '#5F717D', mark: '#1B1622', neck: '#2E8F86', sheen: '#8C72C9', tail: '#8797A0', band: '#2B3139', eye: C.ORANGE, pattern: 'bars' },
    red: { name: 'RED CHECK', body: '#B9744B', wing: '#CB8B60', under: '#E2B590', flight: '#7A4428', mark: '#6A3420', neck: '#B9497C', sheen: '#E7A23A', tail: '#A9683F', band: '#5C2E18', eye: C.ORANGE, pattern: 'check' },
    dark: { name: 'BLACK CHECK', body: '#5A6570', wing: '#707D88', under: '#9AA6AF', flight: '#2B3139', mark: '#22272E', neck: '#2E8F86', sheen: '#8C72C9', tail: '#4E5862', band: '#1B1622', eye: '#F2675E', pattern: 'check' },
    white: { name: 'WHITE RACER', body: '#F1ECE2', wing: '#FBF7EF', under: '#FFFDF8', flight: '#D6CDBF', mark: '#C9BFB0', neck: '#E6EFEA', sheen: '#EBCFE8', tail: '#E8E1D5', band: '#D2C8BA', eye: '#3A2B2B', pattern: 'plain' },
    pied: { name: 'PIED', body: '#F1ECE2', wing: '#FBF7EF', under: '#FFFDF8', flight: '#3C4550', mark: '#3C4550', neck: '#4C5966', sheen: '#2E8F86', tail: '#F1ECE2', band: '#3C4550', eye: C.ORANGE, pattern: 'pied', head: '#4C5966' }
  };
  const ORDER = ['grey', 'white', 'red', 'dark', 'pied'];

  // ---------- poses ----------
  const D2R = Math.PI / 180;
  function cyclePose(t) {
    const phi = 15 + 62 * Math.cos(t * Math.PI * 2);
    const fold = t < 0.5 ? 0.06 : 0.6 * Math.sin(Math.PI * (t - 0.5) / 0.5);
    const sweep = t < 0.5 ? -18 * Math.sin(Math.PI * t / 0.5) : 14 * Math.sin(Math.PI * (t - 0.5) / 0.5);
    return { phi, fold, sweep, pitch: 2.5 * Math.sin(t * Math.PI * 2), bob: -4 * Math.sin(t * Math.PI * 2), tail: 0.15, legs: 'tuck' };
  }
  const POSES = {
    glide: { phi: 30, fold: 0.1, sweep: 4, pitch: 0, bob: 0, tail: 0.25, legs: 'tuck' },
    dive: { phi: 24, fold: 0.72, sweep: 34, pitch: -16, bob: 0, tail: 0, legs: 'tuck' },
    flare: { phi: 66, fold: 0.08, sweep: -28, pitch: 26, bob: 0, tail: 1, legs: 'reach' },
    takeoff: { phi: 84, fold: 0.12, sweep: -12, pitch: 22, bob: 0, tail: 0.7, legs: 'dangle' },
    perch: { perched: true, legs: 'stand', head: 0, tail: 0, pitch: 18 },
    perchBob: { perched: true, legs: 'stand', head: 1, tail: 0, pitch: 12 },
    perchFlap: { perched: true, legs: 'stand', head: 0, tail: 0.3, phi: 52, fold: 0.42, sweep: 6, pitch: 16 },
    land: { perched: true, legs: 'bend', head: -0.4, tail: 0.6, phi: 40, fold: 0.3, sweep: -10, pitch: 12 }
  };
  const FLAP_N = 10;

  // ---------- wing geometry ----------
  // wing local: u forward along the body, v out along the span. Extended outline, scalloped trailing edge.
  const WING = [[0, 0], [12, 28], [16, 62], [10, 100], [-4, 140], [-14, 176], [-28, 174], [-26, 154], [-40, 158], [-38, 136], [-52, 136], [-46, 114], [-56, 108],
    [-50, 88], [-56, 76], [-46, 60], [-50, 44], [-42, 28], [-44, 12], [-32, 0]];
  const WRIST = [16, 62];
  const COVERT = [[2, 8], [12, 30], [14, 60], [-8, 70], [-28, 62], [-38, 42], [-36, 20], [-24, 4]];
  function foldPt(u, v, f) {
    // the hand (beyond the wrist) rotates back around the wrist as the wing folds
    if (v <= WRIST[1] && u > -70) return [u, v];
    const k = clamp((v - WRIST[1]) / 40 + 0.4, 0, 1);
    const a = -f * 2.0 * k;
    const du = u - WRIST[0], dv = v - WRIST[1];
    return [WRIST[0] + du * Math.cos(a) - dv * Math.sin(a), WRIST[1] + du * Math.sin(a) + dv * Math.cos(a) * (1 - f * 0.12)];
  }
  // project a wing point into body space: span swings around the body axis by phi, camera looks down by EPS
  const EPS = 34 * D2R;
  function wingPt(u, v, w, side) {
    const [fu, fv] = foldPt(u, v, w.fold);
    const sw = (w.sweep || 0) * D2R;
    const uu = fu * Math.cos(sw) - fv * Math.sin(sw), vv = fu * Math.sin(sw) + fv * Math.cos(sw);
    const ph = w.phi * D2R;
    const Y = vv * Math.sin(ph), Z = side * vv * Math.cos(ph);
    return [uu, -Y * Math.cos(EPS) + Z * Math.sin(EPS)];
  }

  // ---------- painting ----------
  function paintBird(ctx, poseName, breedName, o) {
    const pose = typeof poseName === 'string' ? (poseName.startsWith('flap') ? cyclePose(+poseName.slice(4) / FLAP_N) : POSES[poseName]) : poseName;
    const B = BREEDS[breedName] || BREEDS.grey;
    BOIL.amp = o.boil == null ? 0 : 0.5 / o.s; BOIL.t = o.boil || 0;
    const X = makeX(ctx, o);
    if (o.flat) { X.sil = true; X.ink = o.flat; }
    const perched = !!pose.perched;
    const M = frame(0, pose.bob || 0, -(pose.pitch || 0) * D2R);
    const pen = new Pen(M, 7);
    const shoulder = [18, -26];
    const wingShapes = (side) => {
      const w = { phi: pose.phi, fold: pose.fold, sweep: pose.sweep };
      const pts = WING.map(([u, v]) => { const [a, b] = wingPt(u, v, w, side); return [shoulder[0] + a, shoulder[1] + b]; });
      const cov = COVERT.map(([u, v]) => { const [a, b] = wingPt(u, v, w, side); return [shoulder[0] + a, shoulder[1] + b]; });
      return { pts, cov, w };
    };
    // far wing, behind the body
    if (!perched || pose.phi) {
      const fw = wingShapes(-1);
      group(X, [{ d: pen.blob(fw.pts), fill: B.flight, shade: true, shadeA: 0.35 }], () => {
        dotsFill(X, pen.blob(fw.cov), C.INK, 0.18);
      });
    }
    // tail: a fan that opens when he brakes
    const sp = clamp(pose.tail || 0, 0, 1);
    const tail = [[-70, -10], [-150 + sp * 20, -14 - sp * 22], [-160 + sp * 16, 2 + sp * 14], [-150 + sp * 26, 18 + sp * 44], [-72, 18]];
    group(X, [{ d: pen.blob(tail), fill: B.tail, shade: { off: [0, -10] }, shadeA: 0.35 }], () => {
      const tb = [[-142 + sp * 20, -12 - sp * 20], [-156 + sp * 16, 2 + sp * 13], [-144 + sp * 26, 16 + sp * 40]];
      line(X, pen.curve(tb), 4.2, B.band);
      for (let i = 1; i < 4; i++) { const k = i / 4; line(X, pen.curve([[-80, -6 + k * 22], [-146 + sp * 22, -12 - sp * 20 + k * (30 + sp * 62)]]), 0.5, C.INK, 0.5); }
    });
    // legs
    const legs = pose.legs || 'tuck';
    if (legs !== 'tuck') {
      const lp = perched ? new Pen(frame(0, 0, 0), 9) : pen;
      const L = (pts) => { const d = lp.curve(pts); line(X, d, 3.4, C.INK); line(X, d, 1.9, C.CORAL); };
      if (legs === 'stand') { L([[2, 24], [-2, 58]]); L([[18, 24], [20, 58]]); L([[-16, 60], [10, 60]]); L([[8, 60], [34, 60]]); }
      if (legs === 'bend') { L([[2, 24], [-10, 44], [-2, 56]]); L([[18, 24], [8, 44], [20, 56]]); L([[-16, 58], [10, 58]]); L([[8, 58], [34, 58]]); }
      if (legs === 'reach') { L([[10, 24], [34, 50], [46, 58]]); L([[20, 22], [46, 44], [58, 50]]); L([[40, 58], [58, 62]]); L([[52, 50], [70, 52]]); }
      if (legs === 'dangle') { L([[0, 24], [-8, 52]]); L([[14, 24], [6, 54]]); }
      if (legs === 'stand' || legs === 'bend') group(X, [{ d: lp.blob([[12, 34], [26, 34], [26, 42], [12, 42]]), fill: C.YELLOW }]);
    }
    // body, neck and head as one silhouette
    const hp = pose.head || 0;
    const hx = 86 + hp * 10, hy = -48 + hp * 14 - (perched ? 4 : 0);
    const body = [[74, 0], [66, -24], [38, -40], [0, -42], [-40, -32], [-74, -12], [-84, 4], [-78, 16], [-40, 30], [4, 36], [46, 32], [68, 18]];
    const neck = [[44, -30], [60, -46], [hx - 8, hy - 14], [hx + 14, hy - 12], [hx + 10, hy + 12], [70, -6], [52, 8]];
    const bodyFill = B.pattern === 'pied' ? B.body : B.body;
    group(X, [{ d: pen.blob(body), fill: bodyFill, shade: { off: [-10, -16] }, shadeA: 0.45, hi: { off: [8, 12] }, hiA: 0.35 }, { d: pen.blob(neck), fill: B.neck }, { d: pen.circle(hx, hy, 23), fill: B.head || B.body, hi: { off: [6, 6] }, hiA: 0.35 }], () => {
      // iridescent neck: halftone sheen
      dotsFill(X, pen.ellipse(62, -30, 18, 22, 0.5), B.sheen, 0.6);
      dotsFill(X, pen.ellipse(58, -14, 14, 12, 0.3), C.PAPER, 0.25);
      if (B.pattern === 'pied') { dotsFill(X, pen.ellipse(-30, 10, 26, 14, 0.2), B.mark, 0.85); fill(X, pen.ellipse(-50, -14, 16, 9, 0.4), B.mark, 0.9); }
      // eye: an orange ring and a bright pupil
      fill(X, pen.circle(hx + 6, hy - 4, 8), B.eye);
      fill(X, pen.circle(hx + 7, hy - 4, 3.8), C.INK);
      fill(X, pen.circle(hx + 5.6, hy - 6, 1.6), C.PAPER);
      line(X, pen.curve([[hx - 2, hy - 13], [hx + 8, hy - 15], [hx + 15, hy - 9]]), 0.6, C.INK, 0.5);
    });
    // beak and cere
    group(X, [{ d: pen.blob([[hx + 16, hy - 4], [hx + 38, hy + 2], [hx + 16, hy + 7]]), fill: C.TAN }], () => fill(X, pen.ellipse(hx + 18, hy - 5, 5.5, 3.6, 0), C.PAPER));
    // near wing, or the folded wing when perched
    if (perched && !pose.phi) {
      const fw = [[44, -26], [8, -32], [-40, -26], [-92, -12], [-128, -2], [-104, 8], [-60, 12], [-10, 10], [30, 0]];
      group(X, [{ d: pen.blob(fw), fill: B.wing, shade: { off: [-6, -10] }, shadeA: 0.4 }], () => featherMarks(X, pen, B, 'folded'));
    } else {
      const nw = wingShapes(1);
      const underside = pose.phi > 34;
      group(X, [{ d: pen.blob(nw.pts), fill: underside ? B.under : B.wing, shade: true, shadeA: 0.38 }], () => {
        // primaries darken toward the tips
        X.ctx.save(); X.ctx.clip(pen.blob(nw.pts));
        const tipPts = WING.slice(4, 12).map(([u, v]) => { const [a, b] = wingPt(u, v, nw.w, 1); return [shoulder[0] + a, shoulder[1] + b]; });
        const wr = wingPt(WRIST[0], WRIST[1], nw.w, 1);
        fill(X, pen.blob(tipPts.concat([[shoulder[0] + wr[0] - 20, shoulder[1] + wr[1]]])), B.flight, 0.9);
        X.ctx.restore();
        if (!underside) {
          fill(X, pen.blob(nw.cov), B.wing, 0.6);
          line(X, pen.blob(nw.cov), 0.55, C.INK, 0.55);
          featherMarks(X, pen, B, 'open', nw, shoulder);
        } else {
          for (let i = 0; i < 4; i++) { const a = wingPt(-10 - i * 12, 70 + i * 4, nw.w, 1), b = wingPt(-26 - i * 10, 130 + i * 6, nw.w, 1); line(X, pen.curve([[shoulder[0] + a[0], shoulder[1] + a[1]], [shoulder[0] + b[0], shoulder[1] + b[1]]]), 0.5, C.INK, 0.45); }
        }
      });
    }
  }
  function featherMarks(X, pen, B, kind, nw, sh) {
    if (kind === 'folded') {
      if (B.pattern === 'bars') { line(X, pen.curve([[22, -20], [-4, -14], [-30, -4]]), 3.4, B.mark); line(X, pen.curve([[8, -6], [-18, 2], [-40, 8]]), 3.4, B.mark); }
      if (B.pattern === 'check') for (const [x, y] of [[20, -18], [0, -20], [-20, -16], [10, -6], [-10, -6], [-30, -4], [0, 4], [-20, 6]]) fill(X, pen.poly([[x, y - 4], [x + 5, y], [x, y + 4], [x - 5, y]]), B.mark, 0.85);
      line(X, pen.curve([[-50, -18], [-96, -8], [-122, -2]]), 0.6, C.INK, 0.6);
      line(X, pen.curve([[-46, -6], [-90, 2], [-114, 4]]), 0.6, C.INK, 0.6);
      fill(X, pen.blob([[-60, -20], [-128, -2], [-104, 8], [-60, 10]]), B.flight, 0.85);
      return;
    }
    const P = (u, v) => { const [a, b] = wingPt(u, v, nw.w, 1); return [sh[0] + a, sh[1] + b]; };
    const fore = clamp(Math.abs(Math.sin(nw.w.phi * D2R) * Math.cos(EPS)) + Math.abs(Math.cos(nw.w.phi * D2R) * Math.sin(EPS)), 0.25, 1);
    if (B.pattern === 'bars' && fore > 0.72) {
      line(X, pen.curve([P(-6, 24), P(-18, 40), P(-28, 52)]), 2.6 * fore, B.mark);
      line(X, pen.curve([P(-22, 12), P(-34, 28), P(-42, 42)]), 2.6 * fore, B.mark);
    }
    if (B.pattern === 'check' && fore > 0.6) for (const [u, v] of [[-6, 16], [-16, 30], [-26, 44], [-24, 18], [-34, 32], [-40, 46], [-8, 44], [-2, 30]]) { const [x, y] = P(u, v); fill(X, pen.poly([[x, y - 4], [x + 5, y], [x, y + 4], [x - 5, y]]), B.mark, 0.85); }
    for (let i = 0; i < 4; i++) line(X, pen.curve([P(-8 - i * 6, 64 + i * 2), P(-22 - i * 8, 120 + i * 10)]), 0.5, C.INK, 0.5);
  }

  // ---------- frame list and textures ----------
  function frameNames() {
    const f = [];
    for (let i = 0; i < FLAP_N; i++) f.push('flap' + i);
    return f.concat(['glide', 'dive', 'flare', 'takeoff', 'perch', 'perchBob', 'perchFlap', 'land']);
  }
  const BOX = { x0: -175, x1: 140, y0: -220, y1: 190 };
  // paint one frame into a fresh canvas at s pixels per bird unit
  function frameCanvas(pose, breed, s, opts) {
    opts = opts || {};
    const c = document.createElement('canvas');
    c.width = Math.ceil((BOX.x1 - BOX.x0) * s); c.height = Math.ceil((BOX.y1 - BOX.y0) * s);
    const x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, -BOX.x0 * s, -BOX.y0 * s);
    paintBird(x, pose, breed, { s, lw: opts.lw || Math.max(1.4, 7.2 * s), mis: opts.mis == null ? Math.max(1, 5 * s) : opts.mis, cache: opts.cache || {}, boil: opts.boil == null ? null : opts.boil, dotScale: opts.dotScale || 1, flat: opts.flat });
    return c;
  }

  // legacy entry points used by the symbols and the world
  function flight(frameName, scheme, banded, boil) { return frameCanvas(frameName === 'up' ? 'flap0' : frameName === 'down' ? 'flap5' : frameName === 'mid' ? 'flap3' : 'glide', scheme, 0.55, { boil }); }
  function perched(bob, scheme) { return frameCanvas(bob ? 'perchBob' : 'perch', scheme, 0.55); }
  function silhouette(frameName, color) { return frameCanvas(frameName, 'grey', 0.2, { flat: color || '#FFFFFF', lw: 1 }); }

  root.HomingBirds = { paintBird, frameCanvas, frameNames, cyclePose, POSES, BREEDS, ORDER, BOX, FLAP_N, flight, perched, silhouette, FRAMES: ['up', 'mid', 'glide', 'down'], SCHEMES: ORDER };
})(typeof self !== 'undefined' ? self : this);

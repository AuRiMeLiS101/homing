/* The loft: wooden cabinet, 6 x 5 nest boxes, symbol sprites and their animations. */
const Loft = (function () {
  const L = HomingWorld.LOFT;
  const C = {};
  let cells = []; // cells[c][r] = sprite
  const SYM_SIZE = 166;
  let boilT = 0;

  function build(parent) {
    C.root = new PIXI.Container(); parent.addChild(C.root);
    C.loft = new PIXI.Sprite(G.tex.loft); C.loft.scale.set(1 / G.tex.loftScale); C.root.addChild(C.loft);
    C.hiBack = new PIXI.Container(); C.root.addChild(C.hiBack);
    C.hi = new PIXI.Graphics(); C.root.addChild(C.hi);
    C.symMask = new PIXI.Graphics().rect(56, 238, L.w - 112, 832).fill({ color: 0xffffff });
    C.root.addChild(C.symMask);
    C.sym = new PIXI.Container(); C.sym.mask = C.symMask; C.root.addChild(C.sym);
    C.front = new PIXI.Container(); C.root.addChild(C.front);
    cells = Array.from({ length: L.cols }, () => Array(L.rows).fill(null));
  }

  function layout() {
    const s = G.loftScale;
    gsap.killTweensOf(C.root.scale);
    C.root.pivot.set(L.w / 2, L.h);
    C.root.scale.set(s);
    C.root.x = G.loftX;
    C.root.y = G.groundY + 6 * s;
  }
  // the whole cabinet squashes on its base and springs back
  function bump(power) {
    if (G.reduced) return;
    const s = G.loftScale, p = power || 0.04;
    gsap.killTweensOf(C.root.scale);
    gsap.timeline()
      .to(C.root.scale, { x: s * (1 + p * 0.6), y: s * (1 - p), duration: 0.07, ease: 'power2.out' })
      .to(C.root.scale, { x: s, y: s, duration: 0.5, ease: 'elastic.out(1.2, 0.35)' });
  }

  function center(c, r) {
    const b = HomingWorld.cellRect(c, r);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }
  function globalOf(c, r) {
    const p = center(c, r);
    return C.root.toGlobal(new PIXI.Point(p.x, p.y));
  }
  function toLocal(x, y) { return C.root.toLocal(new PIXI.Point(x, y)); }
  const pitch = L.cell + L.gap;

  function makeSym(kind) {
    const bo = U.randInt(0, 2);
    const s = new PIXI.Sprite(G.tex.sym[kind][(G.boil + bo) % 3]);
    s.anchor.set(0.5); s._kind = kind; s._bo = bo;
    const k = SYM_SIZE / s.texture.width;
    s._k = k; s.scale.set(k);
    return s;
  }
  function setKind(s, kind) { s._kind = kind; s.texture = G.tex.sym[kind][(G.boil + s._bo) % 3]; }

  function setGrid(grid) {
    C.sym.removeChildren().forEach((s) => s.destroy());
    for (let c = 0; c < L.cols; c++) for (let r = 0; r < L.rows; r++) {
      const s = makeSym(grid[c][r]); const p = center(c, r); s.x = p.x; s.y = p.y;
      C.sym.addChild(s); cells[c][r] = s;
    }
  }

  function boilTick(dt) {
    boilT += dt;
    if (boilT < 140) return;
    boilT = 0;
    for (const s of C.sym.children) if (s._kind && G.tex.sym[s._kind]) s.texture = G.tex.sym[s._kind][(G.boil + s._bo) % 3];
  }

  // Old symbols drop out of the boxes, then the new grid drops in column by column.
  async function spinDrop(grid, opts) {
    opts = opts || {};
    const old = [];
    for (let c = 0; c < L.cols; c++) for (let r = 0; r < L.rows; r++) if (cells[c][r]) old.push({ s: cells[c][r], c, r });
    const outDur = U.T(0.28);
    old.forEach(({ s, c, r }) => {
      gsap.to(s, { y: s.y + 980, duration: outDur, delay: U.T(c * 0.035 + (4 - r) * 0.012), ease: 'power2.in', onComplete: () => s.destroy() });
    });
    Audio2.play('whoosh');
    await U.wait(140);
    cells = Array.from({ length: L.cols }, () => Array(L.rows).fill(null));
    const promises = [];
    const antFrom = opts.anticipateFrom == null ? 99 : opts.anticipateFrom;
    let extra = 0;
    for (let c = 0; c < L.cols; c++) {
      if (c >= antFrom) {
        extra += 0.85;
        if (c === antFrom) { opts.onAnticipate && opts.onAnticipate(); }
      }
      const colDelay = U.T(c * 0.075) + U.T(extra);
      for (let r = L.rows - 1; r >= 0; r--) {
        const s = makeSym(grid[c][r]);
        const p = center(c, r);
        s.x = p.x; s.y = p.y - 980; C.sym.addChild(s); cells[c][r] = s;
        const d = colDelay + U.T((L.rows - 1 - r) * 0.035);
        promises.push(new Promise((res) => gsap.to(s, { y: p.y, duration: U.T(0.42), delay: d, ease: 'back.out(1.15)', onComplete: res })));
        squashIn(s, d, U.T(0.27));
      }
      if (c >= antFrom) {
        const tt = colDelay + U.T(0.25);
        gsap.delayedCall(tt, () => { Audio2.play('thunkBig', { col: c }); bump(0.035); if (opts.onColumn) opts.onColumn(c); });
      } else gsap.delayedCall(colDelay + U.T(0.33), () => { Audio2.play('thunk', { col: c }); if (c === L.cols - 1) bump(0.018); });
    }
    await Promise.all(promises);
  }

  // stretch while falling, squash on landing, spring back
  function squashIn(s, delay, fallDur) {
    if (G.reduced) return;
    const k = s._k;
    gsap.timeline({ delay })
      .fromTo(s.scale, { x: k * 0.84, y: k * 1.22 }, { x: k * 1.14, y: k * 0.84, duration: fallDur, ease: 'power2.in' })
      .to(s.scale, { x: k, y: k, duration: U.T(0.32), ease: 'elastic.out(1.1, 0.42)' });
  }

  function clearHi() { C.hi.clear(); C.hiBack.removeChildren().forEach((d) => d.destroy()); }

  // Coins pop out of the winning boxes and fly to the ticket. More pay, more coins. opts.onCoins(first, span) tells
  // the ticket when they start arriving and over how long, so the number rolls as they land.
  function payCoins(ev, bet, opts) {
    const wp = Hud.winPos();
    const list = [];
    for (const w of ev.wins) {
      const n = U.clamp(Math.ceil(3 + 2.5 * Math.log2(1 + w.amt / bet)), 3, w.cells.length);
      const step = w.cells.length / n;
      for (let i = 0; i < n; i++) list.push(w.cells[Math.floor(i * step)]);
    }
    const coins = list.slice(0, 22);
    const lag = U.T(0.035), first = U.T(0.5);
    coins.forEach(([c, r], i) => {
      const gp = globalOf(c, r);
      const last = i === coins.length - 1;
      FX.coinFly(gp.x, gp.y, wp.x + U.rand(-30, 30) * G.loftScale, wp.y, {
        delay: i * lag, dur: first, size: 64,
        onArrive: () => { Audio2.play(last ? 'kaching' : 'coinIn', { n: i, big: last && ev.amt >= bet * 5 }); }
      });
    });
    if (opts && opts.onCoins) opts.onCoins(first, Math.max(0.12, (coins.length - 1) * lag));
  }

  // Highlight winning groups, show their pay, then clear them out.
  async function showWins(ev, bet, opts) {
    clearHi();
    const g = C.hi;
    const all = [];
    for (const w of ev.wins) for (const [c, r] of w.cells) all.push([c, r, w]);
    for (const [c, r] of all) {
      const b = HomingWorld.cellRect(c, r);
      g.roundRect(b.x - 9, b.y - 9, b.w + 18, b.h + 18, 14).stroke({ width: 10, color: COL.PINK });
      g.roundRect(b.x - 9, b.y - 9, b.w + 18, b.h + 18, 14).stroke({ width: 3, color: COL.INK });
      const sp = sprite(U.pick(G.tex.splat)); sp.tint = COL.PINK; sp.x = b.x + b.w / 2; sp.y = b.y + b.h / 2; sp.scale.set(0.2); sp.alpha = 0.9;
      C.hiBack.addChild(sp);
      gsap.to(sp.scale, { x: 1.15, y: 1.15, duration: U.T(0.25), ease: 'back.out(2)' });
    }
    g.alpha = 0;
    gsap.to(g, { alpha: 1, duration: U.T(0.12) });
    Audio2.play('win', { step: ev.step });
    // symbols jump
    const pulses = all.map(([c, r]) => {
      const s = cells[c][r]; if (!s) return null;
      return gsap.timeline().to(s.scale, { x: s._k * 1.22, y: s._k * 1.22, duration: U.T(0.16), ease: 'power2.out' })
        .to(s.scale, { x: s._k, y: s._k, duration: U.T(0.2), ease: 'bounce.out' })
        .to(s, { rotation: 0.12, duration: U.T(0.06), yoyo: true, repeat: 3 }, 0);
    });
    void pulses;
    // amount labels per group
    for (const w of ev.wins) {
      let sx = 0, sy = 0;
      for (const [c, r] of w.cells) { const p = center(c, r); sx += p.x; sy += p.y; }
      sx /= w.cells.length; sy /= w.cells.length;
      const gp = C.root.toGlobal(new PIXI.Point(sx, sy));
      showAmount(gp.x, gp.y, w.amt, w.n, w.s);
    }
    await U.wait(560);
    // clear out
    for (const [c, r] of all) {
      const s = cells[c][r]; if (!s) continue;
      cells[c][r] = null;
      const gp = C.root.toGlobal(new PIXI.Point(s.x, s.y));
      FX.splat(gp.x, gp.y, U.pick([COL.PINK, COL.YELLOW, COL.PAPER]), 0.55 * G.loftScale * 1.6);
      FX.confetti(gp.x, gp.y, 3, null, 0.35);
      gsap.to(s.scale, { x: s._k * 1.45, y: s._k * 1.45, duration: U.T(0.1), ease: 'power1.out' });
      gsap.to(s, { alpha: 0, rotation: U.rand(-0.6, 0.6), duration: U.T(0.16), delay: U.T(0.06), onComplete: () => s.destroy() });
    }
    payCoins(ev, bet, opts);
    // the punch grows with each rung of the chain, from a nudge to a jolt
    FX.shake(4 + Math.min(10, ev.step * 1.8), 0.85);
    FX.rgb(Math.min(3.5, 0.8 + ev.step * 0.5));
    FX.punch(Math.min(0.045, 0.008 + ev.step * 0.005));
    bump(Math.min(0.07, 0.02 + ev.step * 0.009));
    Audio2.play('pop', { n: all.length });
    gsap.to(g, { alpha: 0, duration: U.T(0.25), delay: U.T(0.1), onComplete: clearHi });
    await U.wait(240);
  }

  function showAmount(x, y, amt, n, kind) {
    const c = new PIXI.Container(); c.x = x; c.y = y;
    const t = monoText('+' + U.fmt(amt), Math.round(40 * G.unit + 14), '#F6ECD8', { stroke: '#1B1622', strokeW: Math.max(5, 9 * G.unit), shadow: true });
    const sub = labelText(n + '×', Math.round(15 * G.unit + 6), '#FFD23F');
    sub.y = -t.height * 0.62;
    c.addChild(t); c.addChild(sub);
    G.layers.hud.addChild(c);
    c.scale.set(0.3); c.rotation = U.rand(-0.1, 0.1);
    gsap.timeline({ onComplete: () => c.destroy({ children: true }) })
      .to(c.scale, { x: 1, y: 1, duration: U.T(0.25), ease: 'back.out(3)' })
      .to(c, { y: y - 60 * G.unit, duration: U.T(0.7), ease: 'power1.out' }, 0)
      .to(c, { alpha: 0, duration: U.T(0.25) }, U.T(0.75));
  }

  async function fall(drops) {
    const byCol = {};
    for (const d of drops) (byCol[d.c] || (byCol[d.c] = [])).push(d);
    const proms = [];
    for (const k of Object.keys(byCol)) {
      const c = +k, list = byCol[k];
      const old = cells[c];
      const movedFrom = new Set(list.filter((d) => !d.fresh).map((d) => d.from));
      const col = Array(L.rows).fill(null);
      for (let r = 0; r < L.rows; r++) if (old[r] && !movedFrom.has(r)) col[r] = old[r];
      for (const d of list) {
        let s;
        const p = center(c, d.to);
        if (d.fresh) {
          s = makeSym(d.s); s.x = p.x; s.y = center(c, 0).y + d.from * pitch - 220; C.sym.addChild(s);
        } else {
          s = old[d.from];
          if (!s) { s = makeSym(d.s); s.x = p.x; s.y = center(c, d.from).y; C.sym.addChild(s); }
        }
        if (s._kind !== d.s) setKind(s, d.s);
        col[d.to] = s;
        const dist = Math.abs(p.y - s.y);
        const fd = U.T(0.22 + dist / 2600), dl = U.T(c * 0.03 + (L.rows - d.to) * 0.02);
        proms.push(new Promise((res) => gsap.to(s, { y: p.y, duration: fd, delay: dl, ease: 'back.out(1.25)', onComplete: res })));
        squashIn(s, dl, fd * 0.62);
      }
      cells[c] = col;
      gsap.delayedCall(U.T(0.25 + c * 0.03), () => Audio2.play('thunk', { col: c, soft: true }));
    }
    await Promise.all(proms);
  }

  function sync(grid) {
    for (let c = 0; c < L.cols; c++) for (let r = 0; r < L.rows; r++) {
      const s = cells[c][r];
      if (!s) { const n = makeSym(grid[c][r]); const p = center(c, r); n.x = p.x; n.y = p.y; C.sym.addChild(n); cells[c][r] = n; }
      else if (s._kind !== grid[c][r]) setKind(s, grid[c][r]);
    }
  }

  function take(c, r) {
    const s = cells[c][r]; cells[c][r] = null;
    if (!s) return globalOf(c, r);
    const gp = C.root.toGlobal(new PIXI.Point(s.x, s.y));
    s.destroy();
    return gp;
  }

  function symAt(c, r) { return cells[c][r]; }

  function pulseKind(kind) {
    for (let c = 0; c < L.cols; c++) for (let r = 0; r < L.rows; r++) {
      const s = cells[c][r];
      if (s && s._kind === kind) gsap.to(s.scale, { x: s._k * 1.25, y: s._k * 1.25, duration: 0.18, yoyo: true, repeat: 3, ease: 'power1.inOut' });
    }
  }

  function clocksRing(list) {
    for (const [c, r] of list) {
      const s = cells[c][r]; if (!s) continue;
      gsap.to(s, { rotation: 0.22, duration: 0.05, yoyo: true, repeat: 15, ease: 'none', onComplete: () => { s.rotation = 0; } });
      gsap.to(s.scale, { x: s._k * 1.3, y: s._k * 1.3, duration: 0.3, yoyo: true, repeat: 1 });
      const gp = C.root.toGlobal(new PIXI.Point(s.x, s.y));
      FX.sparks(gp.x, gp.y, 14, COL.YELLOW, 0.8);
      FX.splat(gp.x, gp.y, COL.YELLOW, 1.1);
    }
  }

  // Capsule dropped by a landing bird
  function capsule(c, r, cap) {
    const p = center(c, r);
    const box = new PIXI.Container(); box.x = p.x; box.y = p.y - 6;
    const tex = cap.k === 'mult' ? G.tex.cap.MULT : (cap.k === 'flock' ? G.tex.cap.FLOCK : G.tex.cap.COIN);
    const s = sprite(tex); s.scale.set(150 / tex.width); box.addChild(s);
    let label = '';
    if (cap.k === 'coin') label = U.fmt(cap.amt);
    else if (cap.k === 'mult') label = '×' + cap.m;
    if (label) {
      const t = monoText(label, cap.k === 'mult' ? 54 : 40, cap.k === 'mult' ? '#FFD23F' : '#1B1622', { stroke: cap.k === 'mult' ? '#1B1622' : '#F6ECD8', strokeW: 8 });
      t.rotation = -0.28; t.y = -4; box.addChild(t);
    }
    C.front.addChild(box);
    box.scale.set(0.1); box.rotation = U.rand(-0.4, 0.4);
    gsap.to(box.scale, { x: 1, y: 1, duration: U.T(0.3), ease: 'back.out(3)' });
    gsap.to(box, { rotation: 0, duration: U.T(0.3) });
    return box;
  }

  // A capsule leaves its box on a curve with a glitter trail and lands in the ticket or the loft medal.
  function flyOut(obj, gx, gy, done) {
    const lp = C.front.toLocal(new PIXI.Point(gx, gy));
    const x0 = obj.x, y0 = obj.y;
    const cx = (x0 + lp.x) / 2 + U.rand(-160, 160), cy = Math.min(y0, lp.y) - U.rand(120, 260);
    const st = { t: 0 };
    let n = 0;
    gsap.to(obj, { rotation: U.rand(-0.5, 0.5), duration: U.T(0.5), ease: 'power1.inOut' });
    gsap.to(st, {
      t: 1, duration: U.T(0.5), ease: 'power2.in',
      onUpdate: () => {
        if (obj.destroyed) return;
        const t = st.t, u = 1 - t;
        obj.x = u * u * x0 + 2 * u * t * cx + t * t * lp.x; obj.y = u * u * y0 + 2 * u * t * cy + t * t * lp.y;
        const k = 1 - t * 0.62; obj.scale.set(k, k);
        if (n++ % 2) return;
        const gp = C.front.toGlobal(new PIXI.Point(obj.x, obj.y));
        FX.emit({ tex: G.tex.sparkle, x: gp.x + U.rand(-8, 8), y: gp.y + U.rand(-8, 8), vx: U.rand(-40, 40), vy: U.rand(-40, 40), life: U.rand(0.3, 0.5), s0: U.rand(0.25, 0.45) * Math.max(0.6, G.unit), s1: 0, a0: 1, a1: 0, tint: U.pick([COL.YELLOW, COL.PAPER, COL.ORANGE]), blend: 'add' });
      },
      onComplete: () => {
        const gp = C.front.toGlobal(new PIXI.Point(obj.x, obj.y));
        FX.sparks(gp.x, gp.y, 10, COL.YELLOW, 0.7);
        obj.destroy({ children: true }); done && done();
      }
    });
  }

  function bounds() {
    const tl = C.root.toGlobal(new PIXI.Point(0, 0)), br = C.root.toGlobal(new PIXI.Point(L.w, L.h));
    const gtl = C.root.toGlobal(new PIXI.Point(56, 238)), gbr = C.root.toGlobal(new PIXI.Point(L.w - 56, 1070));
    return { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y, grid: { x: gtl.x, y: gtl.y, w: gbr.x - gtl.x, h: gbr.y - gtl.y } };
  }

  return { build, layout, bump, setGrid, spinDrop, showWins, fall, sync, take, symAt, center, globalOf, toLocal, boilTick, capsule, flyOut, clocksRing, pulseKind, bounds, C, get cells() { return cells; } };
})();

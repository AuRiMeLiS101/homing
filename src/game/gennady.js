/* Gennady runtime: the puppet.
   Every body part is painted once into its own texture by the character painter, and the GPU moves the parts every
   frame: limbs turn on their joints, the torso is a mesh that breathes, squashes and jiggles, and the head plates are
   repainted only when his face changes. Between the acting and the drawing sits a physics layer. The acts tween a
   target pose; springs on every joint chase it while the body's own accelerations push them around, so arms swing and
   trail, the belly, cap and moustache bounce, and jumps crouch, launch, fly and land with weight. His pet pigeon is a
   separate little sprite that perches on his forearm or his cap and hops between them. */
const Gennady = (function () {
  const Gn = HomingGennady, GP = Gn.parts, HS = GP.HS, BX = GP.BOX;
  const PBOX = { x0: -130, x1: 130, y0: -220, y1: 30 }; // pet texture box, pet units
  const PET_K = 0.92;                                    // pet units to rig units
  const GRAV = 5600;                                     // rig units per s²: one g for a man about a thousand units tall
  const R = { scale: 0.5 };
  const P = Gn.makePose('idle');                         // the target pose: acts tween this
  const M = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };       // root motion, y up, rig units
  const X = { crouch: 0, tuck: 0 };                      // extra targets for jumps: crouch adds to the hip drop, tuck lifts the feet
  const TURN = P.turn;
  const RJ = GP.restJoints(TURN);
  let outfit = 'base';
  let busy = null, texS = 0, res = 1, built = false;
  let paintMs = 1;
  let blinkT = 2.5, blinkOn = false, lookOwner = null, trackK = 0;
  const pet = { tex: {}, perch: 'arm', pose: 'sit', hop: null, air: null, bobT: 1, squash: 1, flip: false, flapT: 0 };

  // ---------- small math ----------
  const V = (x, y) => ({ x, y });
  const wrap = (a) => { a %= Math.PI * 2; if (a > Math.PI) a -= Math.PI * 2; else if (a < -Math.PI) a += Math.PI * 2; return a; };
  const sm = (t) => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // semi implicit spring: k stiffness, z damping ratio, f outside acceleration; returns the acceleration it applied
  function spring(s, target, k, z, f, h) { const a = k * (target - s.x) - 2 * Math.sqrt(k) * z * s.v + (f || 0); s.v += a * h; s.x += s.v * h; return a; }
  function springA(s, target, k, z, f, h) { const a = k * wrap(target - s.x) - 2 * Math.sqrt(k) * z * s.v + (f || 0); s.v += a * h; s.x += s.v * h; return a; }
  const S1 = (x) => ({ x: x || 0, v: 0 });

  // ---------- physics tuning ----------
  // stiffness in 1/s², damping as a ratio of critical. Gains scale how much of the body's acceleration a part feels.
  const PHY = {
    hip: [330, 0.5], shift: [110, 0.8], lean: [170, 0.62], squash: [480, 0.3], belly: [190, 0.2], breathe: [40, 1], shrug: [260, 0.55],
    headPos: [260, 0.42], headRot: [210, 0.5], capLift: [150, 0.26], capRot: [130, 0.28], stache: [230, 0.22],
    ua: [250, 0.7], e: [360, 0.66], hr: [330, 0.4], st: [220, 0.72],
    armG: 0.28, foreWhip: 0.16, handWhip: 0.3, headG: 0.14, headRG: 0.45, bellyG: 0.0021, capG: 0.022, capRG: 0.25, stacheG: 0.0015
  };
  const S = {
    init: false,
    hip: S1(), shift: S1(), lean: S1(), squash: S1(), belly: S1(), breathe: S1(), shrug: S1(),
    headX: S1(), headY: S1(), headRot: S1(), capLift: S1(), capRot: S1(), capX: S1(), stache: S1(),
    ry: 0, rvy: 0
  };
  function armState(name, side) { return { name, side, ua: S1(), e: S1(), hr: S1(), st: S1(1), br: 0, S: null, E: null, W: null, la: 0, dir: 0, pS: null, vS: V(0, 0), aS: V(0, 0), pE: null, vE: V(0, 0), aE: V(0, 0) }; }
  const ARM = { A: armState('A', -1), B: armState('B', 1) };
  // joint accelerations, measured frame to frame and fed back as forces on the next frame
  const ACC = { neck: { p: null, v: V(0, 0), a: V(0, 0) }, pel: { p: null, v: V(0, 0), a: V(0, 0) }, head: { p: null, v: V(0, 0), a: V(0, 0), pr: 0, vr: 0, ar: 0 } };
  function track(o, p, sec) {
    if (!o.p) { o.p = V(p.x, p.y); return; }
    const vx = (p.x - o.p.x) / sec, vy = (p.y - o.p.y) / sec;
    const ax = U.clamp((vx - o.v.x) / sec, -30000, 30000), ay = U.clamp((vy - o.v.y) / sec, -30000, 30000);
    o.a.x = U.lerp(o.a.x, ax, 0.55); o.a.y = U.lerp(o.a.y, ay, 0.55);
    o.v.x = vx; o.v.y = vy; o.p.x = p.x; o.p.y = p.y;
  }

  // ---------- pose plumbing ----------
  // gsap tags tweened objects with _gsap; skip it when copying a pose
  function clone(o) {
    if (!o || typeof o !== 'object') return o;
    const out = Array.isArray(o) ? [] : {};
    for (const k in o) if (k !== '_gsap') out[k] = clone(o[k]);
    return out;
  }
  // write a blend of two poses into P in place, so direct tweens on P's fields keep working; the arms can run late
  function mixInto(dst, a, b, t, snap, tA, tB) {
    for (const k in b) {
      if (k === 'fx' || k === '_gsap') continue;
      const tk = k === 'A' && tA != null ? tA : k === 'B' && tB != null ? tB : t;
      const x = a[k], y = b[k];
      if (typeof y === 'number' && typeof x === 'number') dst[k] = x + (y - x) * tk;
      else if (y && typeof y === 'object') {
        if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {};
        mixInto(dst[k], x || {}, y, tk, snap);
        if ((k === 'A' || k === 'B') && dst === P && x && x !== dst[k]) sweep(dst[k], x, y, tk, k === 'A' ? RJ.shA : RJ.shB);
      } else dst[k] = tk >= snap ? y : x;
    }
  }
  // hands travel round the shoulder, angle and reach blended apart, so a raised arm sweeps out and up instead of
  // folding past his face on a straight line
  function sweep(dst, a, b, t, sh) {
    if ((a.att || 0) > 0.01 || (b.att || 0) > 0.01) return;
    const ax = a.x - sh.x, ay = a.y - sh.y, bx = b.x - sh.x, by = b.y - sh.y;
    const ra = Math.hypot(ax, ay), rb = Math.hypot(bx, by);
    if (ra < 20 || rb < 20) return;
    const aa = Math.atan2(ay, ax), ang = aa + wrap(Math.atan2(by, bx) - aa) * t, r = ra + (rb - ra) * t;
    dst.x = sh.x + Math.cos(ang) * r; dst.y = sh.y + Math.sin(ang) * r;
  }
  function target(name, extra) {
    const T = Gn.makePose(name, extra);
    T.outfit = outfit;
    return T;
  }
  // morph to a key pose. The start is captured when the tween begins, so it chains cleanly in timelines.
  // lag > 0 lets arm B arrive that many seconds after the rest of him, lag < 0 arm A: two hands never move as one
  function poseTo(name, dur, ease, extra, snap, lag) {
    const st = { t: 0 };
    let from = null, to = null;
    lag = lag || 0;
    const total = dur + Math.abs(lag), e = gsap.parseEase(ease || 'power2.inOut');
    snap = snap == null ? 0.3 : snap;
    return gsap.to(st, {
      t: 1, duration: total, ease: 'none',
      onStart() { from = clone(P); to = typeof name === 'string' ? target(name, extra) : name; },
      onUpdate() {
        if (!from) return;
        const time = st.t * total, k = e(U.clamp(time / dur, 0, 1));
        const kA = lag < 0 ? e(U.clamp((time + lag) / dur, 0, 1)) : k, kB = lag > 0 ? e(U.clamp((time - lag) / dur, 0, 1)) : k;
        mixInto(P, from, to, k, snap, kA, kB);
      }
    });
  }
  function restName() { return outfit === 'race' ? 'proud' : 'idle'; }
  // in portrait only his head and shoulders show, so the pet keeps to the cap where she is visible
  function homePerch() { return outfit === 'race' || G.portrait ? 'cap' : 'arm'; }
  function rest(d) {
    const t = gsap.timeline();
    t.add(poseTo(restName(), d || 0.42, 'power2.inOut', null, 0.4, 0.05), 0);
    t.to(M, { y: 0, rot: 0, duration: d || 0.42, ease: 'power2.inOut' }, 0);
    t.to(X, { crouch: 0, tuck: 0, duration: d || 0.42, ease: 'power2.inOut' }, 0);
    t.add(() => { petTo(homePerch(), 0.12); });
    return t;
  }

  // ---------- textures ----------
  const TX = { base: null, race: null };
  let plates = null;                 // head plates, repainted when his face changes
  let otherT = 0;
  function lwPx() { return U.clamp(5.6 * R.scale, 1.6, 3.6) * res; }
  function misPx() { return U.clamp(4.2 * R.scale, 1.2, 2.6) * res; }
  function opt(s, fit) { return { s, lw: lwPx(), mis: misPx(), outfit: fit || outfit, dotScale: res, cache: {} }; }
  function plate(box, s) {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil((box[1] - box[0]) * s)); c.height = Math.max(2, Math.ceil((box[3] - box[2]) * s));
    const x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, -box[0] * s, -box[2] * s);
    return { c, x };
  }
  function bake(box, s, draw) { const p = plate(box, s); draw(p.x); return { tex: texFrom(p.c, false), box, s }; }
  function bakePair(box, s, draw) { const a = plate(box, s), b = plate(box, s); draw(a.x, b.x); return [{ tex: texFrom(a.c, false), box, s }, { tex: texFrom(b.c, false), box, s }]; }
  function freeSet(set) { if (!set) return; for (const k in set) { const v = set[k]; if (Array.isArray(v)) v.forEach((q) => q.tex.destroy(true)); else if (v && v.tex) v.tex.destroy(true); } }
  // every part that does not change with his face, for one outfit at the current scale. A generator, so the other
  // outfit can bake a few parts per frame in the background
  function* bakeGen(fit, set) {
    const s = texS, t0 = performance.now();
    for (const side of [-1, 1]) {
      const n = side < 0 ? 'A' : 'B';
      for (const kind of ['upper', 'fore']) {
        for (const sh of [-1, 1]) {
          const [ink, paint] = bakePair(BX[kind], s, (ci, cp) => GP.paintLimb(ci, cp, kind, Object.assign(opt(s, fit), { side, shade: sh })));
          set[kind + n + (sh > 0 ? 'P' : 'N')] = paint;
          if (sh > 0) set[kind + n + 'Ink'] = ink; else ink.tex.destroy(true);
          yield;
        }
      }
      for (const kind of ['thigh', 'shin']) {
        const [ink, paint] = bakePair(BX[kind], s, (ci, cp) => GP.paintLimb(ci, cp, kind, Object.assign(opt(s, fit), { side, shade: 1 })));
        set[kind + n + 'Ink'] = ink; set[kind + n] = paint;
        yield;
      }
      for (const h of GP.HANDS) { set['hand' + n + h] = bake(BX.hand, s, (x) => GP.paintHand(x, opt(s, fit), h, side)); yield; }
      set['shoe' + n] = bake(BX.shoe, s, (x) => GP.paintShoe(x, opt(s, fit), side));
      yield;
    }
    set.torso = bake(BX.torso, s, (x) => GP.paintTorso(x, opt(s, fit)));
    yield;
    set.epaul = bake(BX.epaul, s, (x) => GP.paintEpaulettes(x, opt(s, fit)));
    set.medal = bake(BX.medal, s, (x) => GP.paintMedal(x, opt(s, fit)));
    set.cap = bake(BX.cap, s * HS, (x) => GP.paintCap(x, opt(s * HS, fit)));
    set.binos = bake(BX.binos, s * HS, (x) => GP.paintBinos(x, opt(s * HS, fit)));
    set.trophy = bake(BX.trophy, s, (x) => GP.paintTrophy(x, opt(s, fit)));
    set.whistle = bake(BX.whistle, s, (x) => GP.paintWhistle(x, opt(s, fit)));
    yield;
    set.pennant = [];
    for (let i = 0; i < 8; i++) { set.pennant.push(bake(BX.pennant, s, (x) => GP.paintPennant(x, opt(s, fit), (i / 8) * Math.PI * 2))); yield; }
    set.ms = performance.now() - t0;
  }
  function bakeSet(fit) { const set = {}, g = bakeGen(fit, set); while (!g.next().done); return set; }
  let bg = null; // the other outfit, baking in the background
  function bgStep(ms) {
    if (!bg) return;
    const t0 = performance.now();
    while (performance.now() - t0 < ms) {
      if (bg.gen.next().done) { if (bg.s === texS && !TX[bg.fit]) TX[bg.fit] = bg.set; else freeSet(bg.set); bg = null; return; }
    }
  }
  function headPlates() {
    const s = texS * HS;
    const mk = (box) => { const p = plate(box, s); return { c: p.c, x: p.x, tex: texFrom(p.c, false), box, s, sig: '' }; };
    plates = { base: mk(BX.head), stache: mk(BX.stache), top: mk(BX.head) };
  }
  const q = (v, n) => Math.round((v || 0) * n);
  function faceSig(which) {
    const f = P.face;
    if (which === 'stache') return q(f.smile, 40) + ',' + q(f.puff, 40);
    if (which === 'top') return [q(f.brow, 40), q(f.browL, 40), q(f.browR, 40), q(f.browAng, 60), q(f.sweat, 30)].join(',');
    return [f.eyes, f.mouth, q(f.lid, 50), q(f.lidL, 50), q(f.lidR, 50), q(f.lookX, 20), q(f.lookY, 20), q(f.jaw, 40), q(f.smile, 40), q(f.puff, 40), q(f.squint, 30), q(f.blush, 20)].join(',');
  }
  const PAINT_POSE = { turn: TURN, face: null, fx: { stache: 0, capWob: 0, belly: 0 }, outfit: 'base' };
  function repaintPlates(force) {
    if (!plates) return;
    let budget = force ? 3 : (paintMs > 5 ? 1 : 2);
    for (const k of ['base', 'top', 'stache']) {
      const pl = plates[k], sg = faceSig(k);
      if (pl.sig === sg || budget <= 0) continue;
      budget--;
      const t0 = performance.now();
      pl.x.setTransform(1, 0, 0, 1, 0, 0); pl.x.clearRect(0, 0, pl.c.width, pl.c.height);
      pl.x.setTransform(pl.s, 0, 0, pl.s, -pl.box[0] * pl.s, -pl.box[2] * pl.s);
      PAINT_POSE.face = P.face; PAINT_POSE.outfit = outfit;
      GP.paintHead(pl.x, opt(pl.s), PAINT_POSE, k);
      pl.tex.source.update();
      pl.sig = sg;
      paintMs = paintMs * 0.8 + (performance.now() - t0) * 0.2;
    }
  }
  function shadowTex() {
    const c = document.createElement('canvas'); c.width = 420; c.height = 52;
    const x = c.getContext('2d'); x.fillStyle = 'rgba(16,10,26,0.34)';
    x.beginPath(); x.ellipse(210, 26, 200, 22, 0, 0, Math.PI * 2); x.fill();
    return texFrom(c, true);
  }
  function paintPetTextures() {
    const ps = texS * PET_K;
    for (const k of ['sit', 'bob', 'flap', 'flap2', 'startle']) {
      const c = document.createElement('canvas');
      c.width = Math.ceil((PBOX.x1 - PBOX.x0) * ps); c.height = Math.ceil((PBOX.y1 - PBOX.y0) * ps);
      const x = c.getContext('2d');
      x.setTransform(ps, 0, 0, ps, -PBOX.x0 * ps, -PBOX.y0 * ps);
      Gn.paintPet(x, k, { s: ps, lw: lwPx(), mis: misPx() * 0.8, cache: {}, boil: null, dotScale: res });
      if (pet.tex[k]) pet.tex[k].destroy(true);
      pet.tex[k] = texFrom(c, true);
    }
    R.pet.anchor.set(-PBOX.x0 / (PBOX.x1 - PBOX.x0), -PBOX.y0 / (PBOX.y1 - PBOX.y0));
    R.pet.texture = pet.tex[pet.pose] || pet.tex.sit;
  }

  // ---------- the puppet ----------
  const L = {};
  function spr(parent) { const s = new PIXI.Sprite(PIXI.Texture.EMPTY); parent.addChild(s); return s; }
  function nine(parent) { const s = new PIXI.NineSliceSprite({ texture: PIXI.Texture.WHITE, leftWidth: 1, rightWidth: 1, topHeight: 0, bottomHeight: 0 }); s.visible = false; parent.addChild(s); return s; }
  function buildArm(name) {
    const C = new PIXI.Container();
    const a = { C, hand: spr(C), inkU: nine(C), inkF: nine(C), pUN: nine(C), pUP: nine(C), pFN: nine(C), pFP: nine(C) };
    return a;
  }
  function buildLeg(parent) {
    const C = new PIXI.Container(); parent.addChild(C);
    return { C, shoe: spr(C), inkT: spr(C), inkS: spr(C), pT: spr(C), pS: spr(C) };
  }
  function build(parent) {
    R.root = new PIXI.Container(); parent.addChild(R.root);
    // a seed crate under his feet when the spin button would otherwise cover them
    R.crate = new PIXI.Sprite(G.tex.crate); R.crate.anchor.set(0.5, 0.03); R.crate.visible = false; R.root.addChild(R.crate);
    R.shadow = new PIXI.Sprite(shadowTex()); R.shadow.anchor.set(0.5); R.root.addChild(R.shadow);
    R.body = new PIXI.Container(); R.root.addChild(R.body);
    const B = R.body;
    L.arm0 = new PIXI.Container(); B.addChild(L.arm0);
    L.legA = buildLeg(B); L.legB = buildLeg(B);
    L.torso = new PIXI.Container(); B.addChild(L.torso);
    L.medal = spr(L.torso);
    L.whBack = new PIXI.Container(); B.addChild(L.whBack);
    L.arm1 = new PIXI.Container(); B.addChild(L.arm1);
    L.epC = new PIXI.Container(); B.addChild(L.epC); L.epaul = spr(L.epC);
    L.head = new PIXI.Container(); B.addChild(L.head);
    L.headIn = new PIXI.Container(); L.headIn.y = -114; L.head.addChild(L.headIn);
    L.hBase = spr(L.headIn); L.hStache = spr(L.headIn); L.hTop = spr(L.headIn);
    L.capC = new PIXI.Container(); L.headIn.addChild(L.capC); L.cap = spr(L.capC);
    L.arm2 = new PIXI.Container(); B.addChild(L.arm2);
    L.whFront = new PIXI.Container(); B.addChild(L.whFront);
    L.cord = new PIXI.Graphics(); L.whistle = new PIXI.Sprite(PIXI.Texture.EMPTY);
    L.whBack.addChild(L.cord); L.whBack.addChild(L.whistle);
    L.binC = new PIXI.Container(); B.addChild(L.binC); L.binIn = new PIXI.Container(); L.binIn.y = -114; L.binC.addChild(L.binIn); L.binos = spr(L.binIn);
    L.props = new PIXI.Container(); B.addChild(L.props); L.trophy = spr(L.props); L.pennant = spr(L.props);
    L.A = buildArm('A'); L.B = buildArm('B');
    L.arm1.addChild(L.A.C); L.arm1.addChild(L.B.C);
    R.pet = new PIXI.Sprite(PIXI.Texture.EMPTY); R.root.addChild(R.pet);
    P.outfit = outfit;
  }
  // point a sprite's anchor at the part's own origin
  function setTex(s, t) {
    if (!t) { s.visible = false; return; }
    if (s.texture !== t.tex) {
      s.texture = t.tex;
      const b = t.box;
      if (s instanceof PIXI.NineSliceSprite) s._b = b;
      else s.anchor.set(-b[0] / (b[1] - b[0]), -b[2] / (b[3] - b[2]));
      s.scale.set(1 / t.s);
    }
    s.visible = true;
  }
  // limb segments stretch in the middle only, so the round joint caps keep their shape
  function setSeg(s, t, kind, st) {
    setTex(s, t);
    if (!t) return;
    const b = t.box, sc = t.s, len = GP.LIMB[kind].len;
    const mid0 = kind === 'fore' ? 10 : 0, mid1 = kind === 'fore' ? len - 60 : len;
    const left = (mid0 - b[0]) * sc, right = (b[1] - mid1) * sc, base = (b[1] - b[0]) * sc;
    if (s._lw !== left) { s.leftWidth = left; s.rightWidth = right; s._lw = left; }
    const w = base + len * (st - 1) * sc;
    if (Math.abs(s.width - w) > 0.01) s.width = w;
    const hh = (b[3] - b[2]) * sc;
    if (s._h !== hh) { s.height = hh; s._h = hh; }
    s.anchor.set((-b[0] * sc) / w, -b[2] / (b[3] - b[2]));
  }
  function applySet() {
    const set = TX[outfit];
    if (!set) return;
    for (const n of ['A', 'B']) {
      const g = L['leg' + n];
      setTex(g.shoe, set['shoe' + n]); setTex(g.inkT, set['thigh' + n + 'Ink']); setTex(g.inkS, set['shin' + n + 'Ink']); setTex(g.pT, set['thigh' + n]); setTex(g.pS, set['shin' + n]);
    }
    if (!L.mesh) {
      L.mesh = new PIXI.MeshPlane({ texture: set.torso.tex, verticesX: 9, verticesY: 12 });
      L.torso.addChildAt(L.mesh, 0);
    } else L.mesh.texture = set.torso.tex;
    L.mesh.position.set(set.torso.box[0], set.torso.box[2]); L.mesh.scale.set(1 / set.torso.s);
    L.meshRest = null;
    setTex(L.medal, set.medal); setTex(L.epaul, set.epaul); setTex(L.cap, set.cap); setTex(L.binos, set.binos); setTex(L.trophy, set.trophy); setTex(L.whistle, set.whistle);
    setTex(L.pennant, set.pennant[0]); L.pennant._k = -1;
    L.epaul.visible = outfit === 'race';
    // arms and hands take their new plates right away too: a redraw can come before the next update
    for (const a of [ARM.A, ARM.B]) {
      const Lr = L[a.name], n = a.name, st = a.st.x || 1;
      Lr._set = set;
      for (const [sp, k] of [[Lr.inkU, 'upper' + n + 'Ink'], [Lr.inkF, 'fore' + n + 'Ink'], [Lr.pUN, 'upper' + n + 'N'], [Lr.pUP, 'upper' + n + 'P'], [Lr.pFN, 'fore' + n + 'N'], [Lr.pFP, 'fore' + n + 'P']]) {
        sp._t = set[k]; setSeg(sp, sp._t, k.startsWith('upper') ? 'upper' : 'fore', st);
      }
      const hp = P[n].hand || 'relax';
      setTex(Lr.hand, set['hand' + n + hp] || set['hand' + n + 'relax']); Lr._hand = hp;
    }
  }
  function makeAll(want) {
    texS = want;
    if (bg) { bg.gen.return(); freeSet(bg.set); bg = null; }
    // the old plates are freed only after every sprite has its new one
    const old = [TX.base, TX.race];
    TX.base = null; TX.race = null;
    TX[outfit] = bakeSet(outfit);
    paintMs = Math.max(paintMs, TX[outfit].ms / 40);
    const oldPlates = plates; plates = null;
    headPlates();
    setTex(L.hBase, plates.base); setTex(L.hStache, plates.stache); setTex(L.hTop, plates.top);
    // the head plates keep their texture objects and repaint in place
    for (const s of [L.hBase, L.hStache, L.hTop]) s._keep = true;
    applySet();
    repaintPlates(true);
    paintPetTextures();
    old.forEach(freeSet);
    if (oldPlates) for (const k in oldPlates) oldPlates[k].tex.destroy(true);
    otherT = 1.5;
    built = true;
  }

  // ---------- layout ----------
  function layout(x, y, h, o) {
    o = o || {};
    const hadCrate = R.crate.visible, fromY = R.root.y;
    R.baseX = x; R.baseY = y; R.h = h;
    R.root.x = x; R.root.y = staged && G.portrait ? y - stageRise() : y;
    // in portrait he stands behind the loft: a mask in the shape of everything but the loft hides what it covers,
    // and it travels with his layer when the big win show lifts him above the shade
    const layer = R.root.parent;
    if (o.occlude) {
      if (!R.occ) R.occ = new PIXI.Graphics();
      if (R.occ.parent !== layer) layer.addChild(R.occ);
      R.occ.clear().poly(o.occlude).fill({ color: 0xffffff });
      layer.mask = R.occ;
    } else if (R.occ) { layer.mask = null; R.occ.clear(); }
    R.scale = h / 980;
    R.root.scale.set(R.scale);
    R.crate.visible = (o.crate || 0) > 0;
    R.crate.y = 0;
    if (R.crate.visible) {
      const k = (0.56 * h) / 320 / R.scale; R.crate.scale.set(k);
      // the crate arrives once the strip slides in: it drops under him and he hops up onto it
      if (o.animate && !hadCrate && !G.reduced) {
        gsap.killTweensOf(R.root, 'y'); gsap.killTweensOf(R.crate.scale);
        R.root.y = fromY;
        R.crate.scale.set(k * 0.2);
        gsap.to(R.crate.scale, { x: k, y: k, duration: 0.32, ease: 'back.out(3)' });
        const hold = () => { R.crate.y = (y - R.root.y) / R.scale; };
        hold();
        const t = gsap.timeline({ delay: 0.04 });
        t.to(X, { crouch: 30, duration: 0.08, ease: 'power2.in' }, 0);
        t.to(R.root, { y, duration: 0.36, ease: 'power1.out', onStart: () => Audio2.play('step'), onUpdate: hold, onComplete: () => { R.crate.y = 0; } }, 0.08);
        t.to(X, { crouch: -10, tuck: 0.6, duration: 0.16, ease: 'power2.out' }, 0.08).to(X, { crouch: 0, tuck: 0, duration: 0.2, ease: 'power2.in' });
        t.add(() => impact(900), 0.44);
      }
    }
    res = Math.min(window.devicePixelRatio || 1, 1.5);
    const want = R.scale * res;
    if (!texS || Math.abs(want - texS) / texS > 0.08) makeAll(want);
  }

  // ---------- body: torso deformation and joints ----------
  // the torso texture is painted at rest; breathing, shrugging, the belly's bounce and squash bend its mesh, and the
  // same map moves the shoulders and neck so arms and head stay attached
  const TM = { br: 0, sh: 0, bj: 0, sq: 0 };
  function tmap(x, y, out) {
    const wc = sm((-y - 150) / 100);
    x *= 1 + TM.br * 0.035 * wc; y *= 1 + TM.br * 0.018 * wc;
    const ws = sm((-y - 236) / 64);
    y -= TM.sh * (6 + 26 * Math.pow(Math.min(1, Math.abs(x) / 120), 0.8)) * ws;
    const bw = Math.exp(-Math.pow((y + 96) / 92, 2));
    x += TM.bj * 8 * bw * (x / 190); y += TM.bj * 6 * bw;
    y *= 1 - TM.sq * 0.11; x *= 1 + TM.sq * 0.075 * (0.55 + 0.45 * bw);
    out.x = x; out.y = y;
    return out;
  }
  const K = {
    pel: V(0, -226), lean: 0, shA: V(0, 0), shB: V(0, 0), neck: V(0, 0), head: V(0, 0), headRot: 0,
    legA: null, legB: null, capTop: V(0, 0), capRot: 0, chest: V(0, 0), cordA: V(0, 0), cordB: V(0, 0), mouth: V(0, 0)
  };
  const tmp = V(0, 0);
  function torsoPt(p, out) {
    tmap(p.x, p.y, tmp);
    const c = Math.cos(K.lean), s = Math.sin(K.lean);
    out.x = K.pel.x + tmp.x * c - tmp.y * s; out.y = K.pel.y + tmp.x * s + tmp.y * c;
    return out;
  }
  function headPt(x, y, out) {
    // head units: (0, 0) sits 114 head units above the neck pivot, scaled by HS
    const c = Math.cos(K.headRot), s = Math.sin(K.headRot), hx = x * HS, hy = (y - 114) * HS;
    out.x = K.head.x + hx * c - hy * s; out.y = K.head.y + hx * s + hy * c;
    return out;
  }
  function capPt(x, y, out) {
    const cx = S.capX.x + TURN * 8, cy = -114 - S.capLift.x, r = K.capRot;
    const c = Math.cos(r), s = Math.sin(r);
    return headPt(cx + x * c - y * s, cy + x * s + y * c, out);
  }
  // two link IK: both elbow solutions
  function ik(Sp, T, L1, L2) {
    const dx = T.x - Sp.x, dy = T.y - Sp.y, d0 = Math.hypot(dx, dy);
    const d = U.clamp(d0, Math.abs(L1 - L2) + 2, L1 + L2 - 0.01);
    const a = Math.atan2(dy, dx), cb = U.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), off = Math.acos(cb);
    const out = [];
    for (const sg of [1, -1]) {
      const ua = a + sg * off, E = V(Sp.x + Math.cos(ua) * L1, Sp.y + Math.sin(ua) * L1);
      const la = Math.atan2(T.y - E.y, T.x - E.x);
      out.push({ ua, e: wrap(la - ua), E, sg });
    }
    return out;
  }
  function legSolve(Q, H, side) {
    const tk = X.tuck;
    const T = V(Q.x * (1 - tk * 0.12), Q.y - 44 - tk * 36);
    const [r1, r2] = ik(H, T, 100, 88);
    // knees out, like the whole figure painter
    const r = Math.abs(r1.E.x - K.pel.x) > Math.abs(r2.E.x - K.pel.x) ? r1 : r2;
    const la = r.ua + r.e;
    const W = V(r.E.x + Math.cos(la) * 88, r.E.y + Math.sin(la) * 88);
    return { H, Kn: r.E, W, F: V(W.x, W.y + 44), ta: r.ua, sa: la, rot: (Q.rot || 0) * 0.6 + tk * side * 0.25 };
  }
  // where a hand wants to be: torso space, or blended toward head space when it holds the head or cap
  function handTarget(Q, out) {
    const tt = torsoPtRaw(Q.x, Q.y);
    if (!Q.att) { out.x = tt.x; out.y = tt.y; return out; }
    const th = headPt(Q.hx, Q.hy, V(0, 0));
    out.x = U.lerp(tt.x, th.x, Q.att); out.y = U.lerp(tt.y, th.y, Q.att);
    return out;
  }
  // hand targets live in the torso frame without the mesh bend, like the painter
  function torsoPtRaw(x, y) {
    const c = Math.cos(K.lean), s = Math.sin(K.lean);
    return V(K.pel.x + x * c - y * s, K.pel.y + x * s + y * c);
  }
  function inertia(ang, L, a, gain) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const ax = U.clamp(a.x, -14000, 14000), ay = U.clamp(a.y, -14000, 14000);
    return -(1.5 / L) * (ux * ay - uy * ax) * gain;
  }
  const HT = V(0, 0);
  function stepArm(a, h, first) {
    const Q = P[a.name], ph = PHY;
    spring(a.st, Q.stretch || 1, ph.st[0], ph.st[1], 0, h);
    const st = a.st.x, L1 = 150 * st, L2 = 136 * st;
    const Sp = a.name === 'A' ? K.shA : K.shB;
    handTarget(Q, HT);
    const br = ik(Sp, HT, L1, L2);
    // every key pose says which way its elbows bend (always outward for this round man); when a move crosses from
    // one bend to the other the springs swing the elbow over instead of snapping it
    a.br = (Q.bend == null ? 1 : Q.bend) >= 0 ? 0 : 1;
    if (!S.init || first === 'snap') { a.ua.x = br[a.br].ua; a.e.x = br[a.br].e; a.ua.v = a.e.v = 0; a.hr.x = (Q.hr || 0) * a.side; a.hr.v = 0; }
    const b = br[a.br];
    const g = (G.reduced ? 0.35 : 1) * ph.armG;
    const accU = springA(a.ua, b.ua, ph.ua[0], ph.ua[1], inertia(a.ua.x, L1, a.aS, g), h);
    const accE = springA(a.e, b.e, ph.e[0], ph.e[1], inertia(a.ua.x + a.e.x, L2, a.aE, g) - accU * ph.foreWhip, h);
    springA(a.hr, (Q.hr || 0) * a.side, ph.hr[0], ph.hr[1], -(accU + accE) * ph.handWhip, h);
  }
  function fkArm(a) {
    const st = a.st.x, L1 = 150 * st, L2 = 136 * st;
    const Sp = a.name === 'A' ? K.shA : K.shB;
    const ua = a.ua.x, la = ua + a.e.x;
    a.S = Sp; a.E = V(Sp.x + Math.cos(ua) * L1, Sp.y + Math.sin(ua) * L1);
    a.W = V(a.E.x + Math.cos(la) * L2, a.E.y + Math.sin(la) * L2);
    a.la = la; a.dir = la + a.hr.x;
  }
  // torso joints from the current physics state
  function joints() {
    K.pel.x = S.shift.x; K.pel.y = -226 + S.hip.x; K.lean = S.lean.x;
    TM.br = S.breathe.x; TM.sh = S.shrug.x; TM.bj = S.belly.x; TM.sq = S.squash.x;
    torsoPt(RJ.shA, K.shA); torsoPt(RJ.shB, K.shB); torsoPt(RJ.neck, K.neck);
    K.head.x = K.neck.x + S.headX.x; K.head.y = K.neck.y + S.headY.x + S.shrug.x * 14;
    K.headRot = S.headRot.x;
    K.capRot = S.capRot.x;
  }
  const T = {};
  function targets() {
    const t = G.time, calm = busy && busy.isActive() ? 0.45 : 1, amp = G.reduced ? 0.3 : 1;
    T.hip = P.hipDrop + X.crouch;
    T.shift = P.hipShift + Math.sin(t * 0.83) * 5 * calm * amp;
    T.lean = P.lean + Math.sin(t * 0.83 + 0.7) * 0.008 * calm * amp;
    T.breathe = P.breathe + (0.3 + 0.3 * Math.sin(t * 1.65)) * amp;
    T.shrug = P.shrug;
    T.headRot = P.head.rot + (Math.sin(t * 0.61) * 0.02 + Math.sin(t * 1.37 + 1) * 0.008) * calm * amp;
  }
  function stepBody(h, first) {
    const ph = PHY;
    spring(S.hip, T.hip, ph.hip[0], ph.hip[1], 0, h);
    spring(S.shift, T.shift, ph.shift[0], ph.shift[1], 0, h);
    spring(S.lean, T.lean, ph.lean[0], ph.lean[1], 0, h);
    spring(S.squash, 0, ph.squash[0], ph.squash[1], 0, h);
    spring(S.belly, 0, ph.belly[0], ph.belly[1], -ACC.pel.a.y * ph.bellyG, h);
    spring(S.breathe, T.breathe, ph.breathe[0], ph.breathe[1], 0, h);
    spring(S.shrug, T.shrug, ph.shrug[0], ph.shrug[1], 0, h);
    spring(S.headX, P.head.x, ph.headPos[0], ph.headPos[1], -ACC.neck.a.x * ph.headG, h);
    spring(S.headY, P.head.y, ph.headPos[0], ph.headPos[1], -ACC.neck.a.y * ph.headG, h);
    springA(S.headRot, T.headRot + S.lean.x * 0.45, ph.headRot[0], ph.headRot[1], -(1.5 / 200) * ACC.neck.a.x * ph.headRG, h);
    // the cap rides loose on the head: it lags the head's jumps and turns and bounces when he lands
    spring(S.capLift, P.cap.lift, ph.capLift[0], ph.capLift[1], ACC.head.a.y * ph.capG, h);
    if (S.capLift.x < -5) { S.capLift.x = -5; if (S.capLift.v < 0) S.capLift.v *= -0.3; }
    spring(S.capX, P.cap.x, ph.capLift[0], ph.capLift[1], -ACC.head.a.x * ph.capG * 0.5, h);
    springA(S.capRot, P.cap.rot, ph.capRot[0], ph.capRot[1], -ACC.head.ar * ph.capRG, h);
    spring(S.stache, 0, ph.stache[0], ph.stache[1], -ACC.head.a.y * ph.stacheG, h);
    joints();
    stepArm(ARM.A, h, first); stepArm(ARM.B, h, first);
  }
  // touchdown: the legs, the belly, the cap and the torso take the hit
  function impact(vy) {
    const k = U.clamp(vy / 1400, 0, 1.6) * (G.reduced ? 0.35 : 1);
    if (k > 0.35 && typeof Audio2 !== 'undefined') Audio2.play('step');
    S.hip.v += 430 * k; S.squash.v += 7 * k; S.belly.v += 10 * k; S.capLift.v += 240 * k; S.stache.v -= 6 * k;
    ARM.A.ua.v += 2.2 * k * -ARM.A.side * 0.3; ARM.B.ua.v += 2.2 * k * -ARM.B.side * 0.3;
  }
  function launch(vy) {
    const k = U.clamp(vy / 1400, 0, 1.6) * (G.reduced ? 0.35 : 1);
    S.squash.v -= 5 * k; S.belly.v -= 6 * k;
  }

  // ---------- per frame ----------
  function update(dt) {
    const sec = Math.min(0.05, Math.max(0.0005, dt / 1000));
    if (!R.root || !built) return;
    // blink now and then, only from the plain bead eyes
    blinkT -= sec;
    if (blinkT <= 0 && P.face.eyes === 'bead' && !blinkOn) {
      blinkOn = true; P.face.eyes = 'closed';
      setTimeout(() => { if (P.face.eyes === 'closed') P.face.eyes = 'bead'; blinkOn = false; }, 120);
      blinkT = Math.random() < 0.2 ? 0.28 : U.rand(2.2, 5.5);
    }
    trackBirds(sec);
    if (P.prop.pennant >= 0.5) P.prop.flag = (P.prop.flag + sec * 9) % (Math.PI * 2);
    // root motion: touchdown and takeoff kick the springs
    const ry = M.y;
    const vy = (ry - S.ry) / sec;
    if (S.init) {
      if (S.ry > 1 && ry <= 1 && S.rvy < -250) impact(-S.rvy);
      else if (S.ry <= 1 && ry > 1 && vy > 250) launch(vy);
    }
    S.ry = ry; S.rvy = vy;
    targets();
    const n = Math.max(1, Math.ceil(sec / 0.0084)), h = sec / n;
    if (!S.init) {
      S.hip.x = T.hip; S.shift.x = T.shift; S.lean.x = T.lean; S.breathe.x = T.breathe; S.shrug.x = T.shrug;
      S.headX.x = P.head.x; S.headY.x = P.head.y; S.headRot.x = T.headRot; S.capLift.x = P.cap.lift; S.capRot.x = P.cap.rot; S.capX.x = P.cap.x;
      joints(); stepArm(ARM.A, 0, 'snap'); stepArm(ARM.B, 0, 'snap');
      S.init = true;
    }
    for (let i = 0; i < n; i++) stepBody(h, i === 0);
    joints();
    fkArm(ARM.A); fkArm(ARM.B);
    K.legA = legSolve(P.legA, V(K.pel.x - 64, K.pel.y + 4), -1);
    K.legB = legSolve(P.legB, V(K.pel.x + 64, K.pel.y + 4), 1);
    // measure accelerations in root space (the jump included) for the next frame's forces
    const ox = M.x, oy = -M.y;
    track(ACC.pel, V(K.pel.x + ox, K.pel.y + oy), sec);
    track(ACC.neck, V(K.neck.x + ox, K.neck.y + oy), sec);
    track(ACC.head, V(K.head.x + ox, K.head.y + oy), sec);
    const vr = (K.headRot - ACC.head.pr) / sec; ACC.head.ar = U.lerp(ACC.head.ar, U.clamp((vr - ACC.head.vr) / sec, -400, 400), 0.5); ACC.head.vr = vr; ACC.head.pr = K.headRot;
    for (const a of [ARM.A, ARM.B]) {
      const sp = { p: a.pS, v: a.vS, a: a.aS }; track(sp, V(a.S.x + ox, a.S.y + oy), sec); a.pS = sp.p;
      const ep = { p: a.pE, v: a.vE, a: a.aE }; track(ep, V(a.E.x + ox, a.E.y + oy), sec); a.pE = ep.p;
    }
    draw();
    repaintPlates(false);
    // the other outfit's parts bake a few at a time in the background, so the Race Day change never hitches
    if (otherT > 0) { otherT -= sec; if (otherT <= 0) { const o2 = outfit === 'race' ? 'base' : 'race'; if (!TX[o2] && !bg) { const set = {}; bg = { fit: o2, set, gen: bakeGen(o2, set), s: texS }; } } }
    bgStep(2.5);
    updatePet(sec);
  }

  // ---------- drawing the puppet from the joints ----------
  const SH = V(0.7071, 0.7071); // the shadow side of a sleeve faces down and right, away from the light
  function placeSeg(s, x, y, ang) { s.x = x; s.y = y; s.rotation = ang; }
  function drawArm(a, Lr) {
    const set = TX[outfit];
    const want = a.name === 'A' ? 'A' : 'B';
    const hp = P[a.name].hand || 'relax';
    if (Lr._hand !== hp) { setTex(Lr.hand, set['hand' + want + hp] || set['hand' + want + 'relax']); Lr._hand = hp; }
    const st = a.st.x;
    if (!Lr._set || Lr._set !== set) {
      Lr._set = set;
      for (const [s, k] of [[Lr.inkU, 'upper' + want + 'Ink'], [Lr.inkF, 'fore' + want + 'Ink'], [Lr.pUN, 'upper' + want + 'N'], [Lr.pUP, 'upper' + want + 'P'], [Lr.pFN, 'fore' + want + 'N'], [Lr.pFP, 'fore' + want + 'P']]) s._t = set[k];
    }
    for (const s of [Lr.inkU, Lr.pUN, Lr.pUP]) { setSeg(s, s._t, 'upper', st); placeSeg(s, a.S.x, a.S.y, a.ua.x); }
    for (const s of [Lr.inkF, Lr.pFN, Lr.pFP]) { setSeg(s, s._t, 'fore', st); placeSeg(s, a.E.x, a.E.y, a.la); }
    // shading follows the light: blend the two baked plates by which side of the sleeve faces away from it
    const wU = sm(((-Math.sin(a.ua.x)) * SH.x + Math.cos(a.ua.x) * SH.y + 0.35) / 0.7);
    const wF = sm(((-Math.sin(a.la)) * SH.x + Math.cos(a.la) * SH.y + 0.35) / 0.7);
    Lr.pUP.alpha = wU; Lr.pFP.alpha = wF;
    Lr.hand.x = a.W.x; Lr.hand.y = a.W.y; Lr.hand.rotation = a.dir;
    const slot = [L.arm0, L.arm1, L.arm2][U.clamp(P[a.name].z | 0, 0, 2)];
    if (Lr.C.parent !== slot) slot.addChild(Lr.C);
  }
  function drawLeg(g, k) {
    g.shoe.x = k.F.x; g.shoe.y = k.F.y; g.shoe.rotation = k.rot;
    placeSeg(g.inkT, k.H.x, k.H.y, k.ta); placeSeg(g.pT, k.H.x, k.H.y, k.ta);
    placeSeg(g.inkS, k.Kn.x, k.Kn.y, k.sa); placeSeg(g.pS, k.Kn.x, k.Kn.y, k.sa);
  }
  const mp = V(0, 0);
  function drawTorso() {
    const set = TX[outfit], t = set.torso, m = L.mesh;
    L.torso.x = K.pel.x; L.torso.y = K.pel.y; L.torso.rotation = K.lean;
    const pos = m.geometry.positions;
    if (!L.meshRest || L.meshRest.length !== pos.length) {
      // the plane's rest grid, straight from its size, never from a frame that was already bent
      const gx = m.geometry.verticesX, gy = m.geometry.verticesY, w = m.geometry.width, hh = m.geometry.height;
      L.meshRest = new Float32Array(pos.length);
      for (let i = 0; i < gx * gy; i++) { L.meshRest[i * 2] = (i % gx) * (w / (gx - 1)); L.meshRest[i * 2 + 1] = ((i / gx) | 0) * (hh / (gy - 1)); }
    }
    const rp = L.meshRest, b = t.box, s = t.s;
    for (let i = 0; i < rp.length; i += 2) {
      tmap(b[0] + rp[i] / s, b[2] + rp[i + 1] / s, mp);
      pos[i] = (mp.x - b[0]) * s; pos[i + 1] = (mp.y - b[2]) * s;
    }
    m.geometry.attributes.aPosition.buffer.update();
    // the medal hangs at the collar and rides the chest
    L.medal.visible = P.prop.medal >= 0.5;
    if (L.medal.visible) { tmap(TURN * 46, -300, mp); L.medal.x = mp.x - TURN * 46; L.medal.y = mp.y + 300; }
    if (outfit === 'race') {
      L.epC.x = K.pel.x; L.epC.y = K.pel.y; L.epC.rotation = K.lean;
      tmap(0, -294, mp); L.epaul.x = mp.x; L.epaul.y = mp.y + 294;
      L.epaul.scale.set((1 / set.epaul.s) * (1 + TM.br * 0.035 + TM.sq * 0.06), 1 / set.epaul.s);
    }
  }
  function drawHead() {
    L.head.x = K.head.x; L.head.y = K.head.y; L.head.rotation = K.headRot; L.head.scale.set(HS);
    L.capC.x = S.capX.x + TURN * 8; L.capC.y = -114 - S.capLift.x; L.capC.rotation = S.capRot.x;
    // the moustache bounces on its roots
    const st = U.clamp(S.stache.x, -1.2, 1.2);
    L.hStache.y = st * 5; L.hStache.scale.y = (1 / plates.stache.s) * (1 + st * 0.06);
    L.binC.visible = P.prop.binos >= 0.5;
    if (L.binC.visible) { L.binC.x = K.head.x; L.binC.y = K.head.y; L.binC.rotation = K.headRot; L.binC.scale.set(HS); }
    capPt(TURN * 12, -124, K.capTop);
    headPt(TURN * 40 + 10, 92, K.mouth);
  }
  const C1 = V(0, 0), C2 = V(0, 0), CH = V(0, 0);
  function drawWhistle() {
    const w = P.prop.whistle, on = outfit === 'base' || w > 0.02;
    L.cord.visible = L.whistle.visible = on;
    if (!on) return;
    const front = w >= 0.5, host = front ? L.whFront : L.whBack;
    if (L.cord.parent !== host) { host.addChild(L.cord); host.addChild(L.whistle); }
    torsoPt(RJ.cordA, C1); torsoPt(RJ.cordB, C2); torsoPt(RJ.chest, CH);
    const at = V(U.lerp(CH.x, K.mouth.x, w), U.lerp(CH.y, K.mouth.y, w)), sag = 34 * (1 - w);
    const lw = lwPx() / texS, g = L.cord;
    g.clear();
    const path = () => {
      g.moveTo(C1.x, C1.y).quadraticCurveTo((C1.x + at.x) / 2 - 8, (C1.y + at.y) / 2 + sag, at.x - 8, at.y - 4);
      g.moveTo(C2.x, C2.y).quadraticCurveTo((C2.x + at.x) / 2 + 8, (C2.y + at.y) / 2 + sag, at.x + 6, at.y - 6);
    };
    path(); g.stroke({ width: lw * 2.4, color: 0x1B1622, cap: 'round' });
    path(); g.stroke({ width: lw * 1.1, color: outfit === 'base' ? 0xFF6A2B : 0xFFD23F, cap: 'round' });
    L.whistle.x = at.x; L.whistle.y = at.y; L.whistle.rotation = (w > 0.5 ? -0.5 : 0.35) + K.lean;
  }
  function drawProps() {
    const set = TX[outfit], b = ARM.B;
    L.trophy.visible = P.prop.trophy >= 0.5;
    if (L.trophy.visible) { L.trophy.x = b.W.x + 6; L.trophy.y = b.W.y - 26; L.trophy.rotation = 0.12 + K.lean; }
    L.pennant.visible = P.prop.pennant >= 0.5;
    if (L.pennant.visible) {
      const k = Math.floor(((P.prop.flag || 0) / (Math.PI * 2)) * 8 + 8) % 8;
      if (L.pennant._k !== k) { L.pennant._k = k; L.pennant.texture = set.pennant[k].tex; }
      L.pennant.x = b.W.x; L.pennant.y = b.W.y; L.pennant.rotation = b.dir;
    }
  }
  function draw() {
    R.body.x = M.x; R.body.y = -M.y; R.body.rotation = M.rot;
    drawTorso();
    drawLeg(L.legA, K.legA); drawLeg(L.legB, K.legB);
    drawHead();
    drawArm(ARM.A, L.A); drawArm(ARM.B, L.B);
    drawWhistle();
    drawProps();
    // the shadow stays on the ground and shrinks and fades as he rises
    const fx = (K.legA.F.x + K.legB.F.x) / 2, spread = (200 + Math.abs(K.legB.F.x - K.legA.F.x) * 0.2) / 200, up = 1 / (1 + Math.max(0, M.y) / 320);
    R.shadow.x = M.x + fx; R.shadow.y = 8; R.shadow.scale.set(spread * up, up); R.shadow.alpha = up;
  }

  // his eyes follow his racers while they are in the air
  function trackBirds(sec) {
    if (lookOwner || P.face.eyes !== 'bead' || typeof Flight === 'undefined') return;
    let tx = 0, ty = 0, on = false;
    if (Flight.count > 0) {
      let sx = 0, sy = 0, n = 0;
      for (const b of Flight.birds.values()) if (b.c && !b.c.destroyed) { const p = b.c.getGlobalPosition(); sx += p.x; sy += p.y; n++; }
      if (n) {
        const hp = headGlobal(); const dx = sx / n - hp.x, dy = sy / n - hp.y, d = Math.hypot(dx, dy) || 1;
        tx = dx / d; ty = dy / d; on = true;
      }
    }
    trackK = U.clamp(trackK + (on ? sec * 3 : -sec * 2), 0, 1);
    if (!on && trackK <= 0) return;
    const k = Math.min(1, sec * 5);
    const nx = U.lerp(P.face.lookX, on ? tx : 0, k), ny = U.lerp(P.face.lookY, on ? ty : 0, k);
    if (Math.abs(nx - P.face.lookX) + Math.abs(ny - P.face.lookY) > 0.03) { P.face.lookX = +nx.toFixed(2); P.face.lookY = +ny.toFixed(2); }
  }

  // ---------- the pet pigeon ----------
  function rootOf(q) { return { x: M.x + q.x, y: -M.y + q.y }; }
  function perchPos(name) {
    if (name === 'cap') return rootOf(K.capTop);
    const b = ARM.B;
    if (name === 'trophy') return rootOf({ x: b.W.x + 10, y: b.W.y - 186 });
    return rootOf({ x: U.lerp(b.E.x, b.W.x, 0.42), y: U.lerp(b.E.y, b.W.y, 0.42) - 44 });
  }
  function petTo(name, delay) {
    if (pet.call) { pet.call.kill(); pet.call = null; }
    if (pet.perch === name && !pet.hop) return;
    const go = () => {
      pet.call = null;
      if (pet.perch === name && !pet.hop) return;
      const from = { x: R.pet.x, y: R.pet.y };
      pet.hop = { from, to: name, t: 0, dur: 0.34 };
      if (Math.random() < 0.5 && typeof Audio2 !== 'undefined') Audio2.play('flap');
    };
    // on game time, so slow motion and a new act both reach it
    if (delay) pet.call = gsap.delayedCall(delay, go); else go();
  }
  function setPetTex(k) { if (pet.pose !== k) { pet.pose = k; R.pet.texture = pet.tex[k]; } }
  function updatePet(sec) {
    pet.flapT += sec;
    const flap = Math.floor(pet.flapT * 14) % 2 ? 'flap2' : 'flap';
    if (pet.hop) {
      const h = pet.hop; h.t += sec / h.dur;
      const t = Math.min(1, h.t), to = perchPos(h.to);
      const e = t * t * (3 - 2 * t);
      R.pet.x = U.lerp(h.from.x, to.x, e);
      R.pet.y = U.lerp(h.from.y, to.y, e) - Math.sin(t * Math.PI) * 150;
      R.pet.rotation = Math.sin(t * Math.PI) * -0.3;
      setPetTex(flap);
      if (t >= 1) { pet.hop = null; pet.perch = h.to; pet.squash = 0.72; setPetTex('sit'); }
    } else if (pet.perch === 'cap' && S.capLift.x > 60) {
      // the cap flew off with her on it: she flaps above it until it comes back down
      if (!pet.air) pet.air = { y: R.pet.y };
      const top = perchPos('cap');
      pet.air.y = U.lerp(pet.air.y, top.y - 130 + Math.sin(G.time * 9) * 10, Math.min(1, sec * 6));
      R.pet.x = U.lerp(R.pet.x, top.x, Math.min(1, sec * 6)); R.pet.y = pet.air.y;
      R.pet.rotation = Math.sin(G.time * 7) * 0.12;
      setPetTex(pet.flapT % 1.2 < 0.25 ? 'startle' : flap);
    } else {
      if (pet.air) { pet.air = null; pet.squash = 0.72; setPetTex('sit'); }
      const p = perchPos(pet.perch);
      // she holds on when her perch jolts: a hard jolt makes her flap
      const jolt = pet.perch === 'cap' ? Math.hypot(ACC.head.a.x, ACC.head.a.y) : Math.hypot(ARM.B.aE.x, ARM.B.aE.y);
      if (jolt > 9000 && pet.flapT > 0.3) { pet.flapT = 0; pet.squash = 0.8; }
      const flapping = pet.flapT < 0.22;
      R.pet.x = p.x; R.pet.y = p.y - (flapping ? 10 : 0);
      R.pet.rotation = pet.perch === 'cap' ? (K.headRot + K.capRot) * 0.8 : U.clamp(ARM.B.la + Math.PI, -0.5, 0.5) * 0.2;
      if (flapping) setPetTex(flap);
      else {
        pet.bobT -= sec;
        if (pet.bobT <= 0 || pet.pose === 'flap' || pet.pose === 'flap2') {
          pet.bobT = U.rand(0.5, 1.8);
          setPetTex(pet.pose === 'bob' ? 'sit' : (Math.random() < 0.6 ? 'bob' : 'sit'));
          if (Math.random() < 0.12) pet.flip = !pet.flip;
        }
      }
    }
    // keep her on screen when the cap flies high or the layout is tight
    const topY = (R.root.toLocal(new PIXI.Point(0, 16)).y) + 210 * PET_K;
    if (R.pet.y < topY) R.pet.y = topY;
    pet.squash = U.lerp(pet.squash, 1, Math.min(1, sec * 9));
    const k = PET_K / (texS * PET_K);
    R.pet.scale.set(k * (pet.flip ? -1 : 1) * (2 - pet.squash), k * pet.squash);
  }

  // ---------- acts ----------
  // room above his cap on screen right now, in rig units: jumps and cap throws are trimmed to stay in view
  const CAP_TOP = 990;
  function roomNow() {
    if (!R.root || !R.root.parent) return 600;
    const top = R.root.toGlobal(new PIXI.Point(0, -CAP_TOP));
    return Math.max(80, (top.y - 10) / Math.max(0.01, R.scale * (G.layers && G.layers.cam ? G.layers.cam.scale.y : 1)));
  }
  // split the room between his jump and the cap's flight: the jump keeps at least its share
  function flight(jumpH, capH) {
    const room = roomNow() - 40, need = jumpH + capH;
    if (need <= room) return [jumpH, capH];
    const k = Math.max(0.3, room / need);
    return [jumpH * Math.max(k, 0.6), Math.max(0, room - jumpH * Math.max(k, 0.6))];
  }
  function newTl(loop) { const t = gsap.timeline(loop ? { repeat: -1 } : {}); t.timeScale(G.turbo ? 1.45 : 1); return t; }
  function clearAct() {
    if (busy) { busy.kill(); busy = null; }
    if (pet.call) { pet.call.kill(); pet.call = null; }
    gsap.killTweensOf(M); gsap.killTweensOf(X); gsap.killTweensOf(P.cap); gsap.killTweensOf(P.head); gsap.killTweensOf(P.face); gsap.killTweensOf(P.A); gsap.killTweensOf(P.B); gsap.killTweensOf(P);
    lookOwner = null;
  }
  function stopAct() {
    clearAct();
    P.prop.binos = 0; P.prop.whistle = 0; P.prop.pennant = 0; P.prop.trophy = 0; P.prop.medal = 0; P.face.sweat = 0;
    busy = rest(0.4);
  }
  // a real jump: a crouch to load the legs, a push, a ballistic flight with the feet tucked, and a landing the
  // springs absorb. Returns the touchdown time.
  function jump(t, at, h, o) {
    o = o || {};
    if (G.reduced) h *= 0.35;
    const up = Math.sqrt((2 * h) / GRAV), pre = o.pre == null ? 0.1 : o.pre, dip = o.dip == null ? 22 + h * 0.16 : o.dip;
    t.to(X, { crouch: dip, duration: pre, ease: 'power2.in' }, at);
    t.to(X, { crouch: -12, duration: Math.min(0.1, up * 0.5), ease: 'power2.out' }, at + pre);
    t.to(M, { y: h, duration: up, ease: 'power1.out' }, at + pre);
    t.to(M, { y: 0, duration: up, ease: 'power1.in' }, at + pre + up);
    t.to(X, { crouch: 0, duration: up * 0.6, ease: 'sine.inOut' }, at + pre + Math.min(0.1, up * 0.5));
    t.to(X, { tuck: o.tuck == null ? U.clamp(h / 110, 0.25, 1) : o.tuck, duration: up * 0.7, ease: 'power2.out' }, at + pre + 0.03);
    t.to(X, { tuck: 0, duration: up * 0.8, ease: 'power2.in' }, at + pre + up * 0.9);
    return at + pre + up * 2;
  }
  function capFly(t, at, h, spin, x) {
    const up = Math.sqrt((2 * h) / (GRAV * 0.8));
    t.to(P.cap, { lift: h, rot: spin, x: x || 0, duration: up, ease: 'power1.out' }, at);
    t.to(P.cap, { lift: 0, rot: 0, x: 0, duration: up, ease: 'power1.in' }, at + up);
    return at + up * 2;
  }
  // the held celebrations under a big win run until the show ends, so he never freezes mid party
  function loopTl() { const t = gsap.timeline({ repeat: -1 }); t.timeScale(G.turbo ? 1.45 : 1); return t; }
  function holdLoop(fn) { return () => { const t = loopTl(); fn(t); busy = t; }; }
  function pumps(t, y0, y1) {
    t.to(P.A, { y: y1, duration: 0.15, ease: 'power2.out' }, 0).to(P.A, { y: y0, duration: 0.19, ease: 'power2.in' }, 0.15);
    t.to(P.B, { y: y1, duration: 0.15, ease: 'power2.out' }, 0.33).to(P.B, { y: y0, duration: 0.19, ease: 'power2.in' }, 0.48);
    t.to(X, { crouch: 16, duration: 0.14, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.02);
    t.to(X, { crouch: 16, duration: 0.14, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.35);
    t.to({}, { duration: 0.66 }, 0);
  }
  const ACTS = {
    nod(t) {
      t.to(P.head, { y: 10, rot: 0.05, duration: 0.1, ease: 'power2.out' }).to(P.head, { y: 0, rot: 0, duration: 0.32, ease: 'power2.inOut' });
      t.to(P.face, { lid: Math.min(1, P.face.lid + 0.2), duration: 0.1, yoyo: true, repeat: 1 }, 0);
    },
    point(t) {
      lookOwner = 'act';
      t.to(P, { lean: P.lean + 0.035, duration: 0.09, ease: 'power2.out' }, 0);
      t.add(poseTo('point', 0.2, 'power3.out', null, 0.15), 0.08);
      t.to(X, { crouch: 12, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.1);
      t.to({}, { duration: 0.6 }); t.add(rest(0.42));
    },
    smallWin(t) {
      t.to(X, { crouch: 16, duration: 0.08, ease: 'power2.in' }, 0);
      t.add(poseTo('smallWin', 0.16, 'power3.out', null, 0.1), 0.05);
      t.to(X, { crouch: 0, duration: 0.2, ease: 'power2.out' }, 0.13);
      t.to(P.A, { y: -300, duration: 0.11, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 0.26);
      t.to({}, { duration: 0.38 }); t.add(rest(0.38));
    },
    cheer(t) {
      petTo('cap');
      t.add(poseTo(target('idle', { face: { eyes: 'happy', mouth: 'grin', smile: 1, lid: 0 }, A: { x: -150, y: -40 }, B: { x: 150, y: -40 } }), 0.1, 'power2.in', null, 0), 0);
      const land = jump(t, 0, flight(92, 34)[0]);
      t.add(poseTo('cheer', 0.2, 'power3.out', null, 0, 0.06), 0.12);
      const land2 = jump(t, land + 0.12, 34, { pre: 0.07 });
      t.to(P.A, { y: -560, duration: 0.13, yoyo: true, repeat: 3, ease: 'sine.inOut' }, land2 - 0.05);
      t.to(P.B, { y: -560, duration: 0.13, yoyo: true, repeat: 3, ease: 'sine.inOut' }, land2 + 0.08);
      t.add(rest(0.46), land2 + 0.62);
    },
    gasp(t) {
      if (pet.perch === 'arm') { pet.squash = 0.6; petTo('cap'); }
      t.to(P, { lean: 0.07, duration: 0.07, ease: 'power3.out' }, 0);
      t.add(poseTo('gasp', 0.12, 'power3.out', null, 0.05, 0.04), 0.02);
      t.to(X, { crouch: -10, duration: 0.07, ease: 'power2.out' }, 0.02).to(X, { crouch: 8, duration: 0.3, ease: 'power2.inOut' });
      t.to(P, { lean: 0, duration: 0.5, ease: 'power2.inOut' }, 0.3);
      t.to({}, { duration: 0.42 }); t.add(rest(0.44));
    },
    binos(t) {
      petTo('cap');
      t.add(poseTo('anticip', 0.34, 'power2.inOut', null, 0.25, 0.05), 0.1);
      t.add(() => {
        const tr = gsap.timeline({ repeat: -1 });
        tr.to(P, { lean: -0.065, duration: 0.07, ease: 'sine.inOut' }).to(P, { lean: -0.04, duration: 0.07, ease: 'sine.inOut' });
        tr.to(P.face, { sweat: 1, duration: 0.6, ease: 'power1.in' }, 0).set(P.face, { sweat: 0.3 });
        busy = tr;
      });
    },
    shrug(t) {
      petTo('cap');
      t.add(poseTo('shrug', 0.22, 'power3.out', null, 0.2, 0.05), 0.1);
      t.to(X, { crouch: -6, duration: 0.14, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.1);
      t.to({}, { duration: 0.5 });
      t.add(poseTo(restName(), 0.3, 'power2.in', null, 0.4, 0.04));
      t.to(X, { crouch: 10, duration: 0.1, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      t.add(() => petTo(homePerch(), 0.1));
    },
    pet(t) {
      t.add(poseTo(target('idle', { A: { x: 40, y: -214, att: 0, hand: 'relax', hr: -0.4, z: 2 }, face: { eyes: 'closed', smile: 0.5, mouth: 'smile' } }), 0.32, 'power2.out'));
      t.to(P.A, { x: 70, duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      t.add(() => { setPetTex('bob'); if (typeof Audio2 !== 'undefined') Audio2.play('coo', { pitch: 1 }); });
      t.add(rest(0.38));
    },
    capTip(t) {
      t.add(poseTo('capTip', 0.28, 'power3.out'));
      t.to(P.cap, { rot: -0.22, lift: 16, duration: 0.15, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.26);
      t.to(P.head, { rot: 0.06, duration: 0.15, yoyo: true, repeat: 1 }, 0.26);
      t.to({}, { duration: 0.32 }); t.add(rest(0.38));
    },
    sky(t) {
      lookOwner = 'act';
      t.add(poseTo('sky', 0.36, 'power2.inOut'));
      t.to(P.head, { rot: 0.04, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      t.add(rest(0.4));
    },
    whistle(t) {
      petTo('cap');
      t.add(poseTo('whistle', 0.18, 'power3.out', null, 0.2), 0.1);
      t.to(P.face, { puff: 0.7, duration: 0.08, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.3);
      t.to(X, { crouch: 5, duration: 0.08, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.3);
      t.to(P, { lean: 0.07, duration: 0.3, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.3);
      t.to({}, { duration: 0.15 }); t.add(rest(0.38));
    },
    wave(t) {
      petTo('cap');
      t.add(poseTo('wave', 0.26, 'power3.out', null, 0.1), 0.1);
      t.to(P.B, { x: 150, duration: 0.24, yoyo: true, repeat: 7, ease: 'sine.inOut' });
      t.to(P, { hipShift: 12, duration: 0.24, yoyo: true, repeat: 7, ease: 'sine.inOut' }, '<');
      t.add(rest(0.44));
    },
    dance(t) {
      petTo('cap');
      t.add(poseTo('danceA', 0.16, 'power2.out', null, 0.1, 0.04), 0);
      t.to(M, { y: 26, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.16);
      t.add(poseTo('danceB', 0.16, 'power2.out', null, 0.1, -0.04), 0.4);
      t.to(M, { y: 26, duration: 0.1, yoyo: true, repeat: 1, ease: 'power1.out' }, 0.56);
    },
    bigV(t) {
      petTo('cap');
      t.add(poseTo(target('idle', { face: { eyes: 'happy', mouth: 'grin', smile: 1, lid: 0 }, A: { x: -170, y: -30 }, B: { x: 170, y: -30 } }), 0.1, 'power2.in', null, 0), 0);
      const [hj, hc] = flight(150, 260);
      const land = jump(t, 0, hj, { pre: 0.12 });
      t.add(poseTo('bigV', 0.2, 'power3.out', null, 0, 0.06), 0.14);
      capFly(t, 0.2, hc, -2.6);
      t.to(P.A, { y: -520, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, land);
      t.to(P.B, { y: -520, duration: 0.15, yoyo: true, repeat: 3, ease: 'sine.inOut' }, land + 0.08);
      const end = jump(t, land + 0.42, 40, { pre: 0.08 });
      t.add(holdLoop((l) => pumps(l, -610, -470)), end + 0.1);
    },
    trophy(t) {
      t.add(() => { pet.hop = null; petTo('trophy', 0.2); });
      t.to(X, { crouch: 24, duration: 0.12, ease: 'power2.in' }, 0);
      t.add(poseTo('trophy', 0.32, 'power3.out', null, 0, 0.08), 0.1);
      t.to(X, { crouch: -8, duration: 0.22, ease: 'power2.out' }, 0.12).to(X, { crouch: 0, duration: 0.3 });
      t.add(holdLoop((l) => {
        l.to(X, { crouch: 14, duration: 0.24, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
        l.to(P.head, { rot: 0.16, duration: 0.24, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
        l.to(P.B, { y: -660, duration: 0.24, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0.06);
        l.to(P, { lean: 0.09, duration: 0.48, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
      }), 0.7);
    },
    roar(t) {
      petTo('cap');
      t.add(poseTo(target(restName(), { hipDrop: 30, face: { eyes: 'squeeze', mouth: 'grin', smile: 1 } }), 0.14, 'power2.in', null, 0), 0);
      const [hj, hc] = flight(70, 300);
      const land = jump(t, 0.04, hj, { pre: 0.12 });
      t.add(poseTo('roar', 0.2, 'power3.out', null, 0, 0.05), 0.18);
      capFly(t, 0.22, hc, 3.4, 60);
      t.to(M, { rot: 0.014, duration: 0.05, yoyo: true, repeat: 11, ease: 'sine.inOut' }, land + 0.05);
      t.add(poseTo('number1', 0.28, 'power3.out', null, 0.2, 0.05), land + 0.75);
      t.add(holdLoop((l) => {
        l.to(P.B, { y: -720, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
        l.to(X, { crouch: 18, duration: 0.18, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
        l.to(P.head, { rot: 0.08, duration: 0.36, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
      }), land + 1.1);
    }
  };
  // looping acts keep going until stopAct
  const LOOPS = { dance: true, binos: false, bigV: false, trophy: false, roar: false };
  function act(name) {
    const fn = ACTS[name];
    if (!fn) return null;
    clearAct();
    P.prop.binos = 0; P.prop.whistle = 0; P.prop.pennant = 0; P.prop.trophy = 0; P.prop.medal = 0; P.face.sweat = 0;
    const t = newTl(!!LOOPS[name]);
    fn(t);
    busy = t;
    return t;
  }
  // the big win show: one act per tier, held until stopAct
  function bigWin(tier) {
    const name = ['bigV', 'dance', 'trophy', 'roar'][U.clamp(tier, 0, 3)];
    return act(name);
  }

  // ---------- walk in for the intro ----------
  function walkIn(fromX, dur) {
    clearAct();
    const toX = R.baseX;
    R.root.x = fromX;
    pet.perch = 'cap'; pet.hop = null;
    lookOwner = 'walk';
    const st = { t: 0 };
    const base = target(restName());
    return new Promise((res) => {
      gsap.to(R.root, { x: toX, duration: dur, ease: 'power1.out' });
      gsap.to(st, {
        t: 1, duration: dur, ease: 'none',
        onUpdate: () => {
          const steps = 3.5 * (dur / 1.4), ph = st.t * Math.PI * 2 * steps, k = 1 - Math.pow(st.t, 5);
          const s1 = Math.sin(ph), c1 = Math.cos(ph);
          mixInto(P, P, base, 0.2, 1);
          P.legA.x = -78 + s1 * 36 * k; P.legA.y = -Math.max(0, -c1) * 46 * k;
          P.legB.x = 78 - s1 * 36 * k; P.legB.y = -Math.max(0, c1) * 46 * k;
          P.A.x = -200 - s1 * 46 * k; P.A.y = -70 + Math.abs(s1) * 12; P.A.hand = 'relax';
          P.B.x = 200 + s1 * 46 * k; P.B.y = -70 + Math.abs(s1) * 12; P.B.hand = 'relax'; P.B.z = 1; P.B.att = 0;
          P.hipDrop = 8 - Math.abs(c1) * 16 * k;
          P.lean = -0.06 * k; P.face.lookX = -0.5 * k;
          if (Math.abs(c1) > 0.97 && st.t < 0.95) { if (!st.lock) { st.lock = true; if (typeof Audio2 !== 'undefined') Audio2.play('step'); } } else st.lock = false;
        },
        onComplete: () => { lookOwner = null; busy = rest(0.34); res(); }
      });
    });
  }

  // ---------- small API used by the game ----------
  function setFace(o) { Object.assign(P.face, o); }
  function look(x, y) {
    const hp = headGlobal(); const dx = x - hp.x, dy = y - hp.y, d = Math.hypot(dx, dy) || 1;
    P.face.lookX = +(dx / d).toFixed(2); P.face.lookY = +(dy / d).toFixed(2);
  }
  function headGlobal() {
    const p = rootOf(built ? headPt(0, 0, V(0, 0)) : V(0, -700));
    return R.root.toGlobal(new PIXI.Point(p.x, p.y));
  }
  function setOutfit(name) {
    outfit = name === 'race' ? 'race' : 'base';
    P.outfit = outfit;
    if (built) {
      if (bg && bg.fit === outfit) bgStep(1e9);
      if (!TX[outfit]) TX[outfit] = bakeSet(outfit);
      applySet();
      for (const k in plates) plates[k].sig = '';
    }
    if (!busy || !busy.isActive()) { busy = rest(0.01); }
  }
  function bounds() {
    const top = R.root.toGlobal(new PIXI.Point(0, built ? rootOf(K.capTop).y : -1000)), foot = R.root.toGlobal(new PIXI.Point(0, 0));
    const w = 420 * R.scale;
    return new PIXI.Rectangle(foot.x - w, top.y, w * 2, foot.y - top.y);
  }
  // In portrait only his head shows below the loft; for the big win show he steps up so his acting is seen.
  // In portrait he leans over the loft roof; for the big win show he climbs up a little, as far as the corner
  // buttons allow, so more of his acting clears the roof.
  let staged = false;
  function stageRise() {
    const top = R.root.toGlobal(new PIXI.Point(0, -CAP_TOP)).y;
    return U.clamp(top - 70, 0, R.h * 0.16);
  }
  function stage(on) {
    staged = !!on;
    gsap.killTweensOf(R.root, 'y');
    if (!G.portrait) { R.root.y = R.baseY; return; }
    gsap.to(R.root, { y: on ? R.baseY - stageRise() : R.baseY, duration: on ? 0.5 : 0.45, ease: on ? 'back.out(1.6)' : 'power2.inOut' });
  }
  function actIfIdle(name) { if (busy && busy.isActive()) return null; return act(name); }
  function idleVariety() {
    if (busy && busy.isActive()) return;
    const r = Math.random();
    if (outfit === 'race') { if (r < 0.5) act('capTip'); else act('nod'); return; }
    // behind the loft in portrait only his head and raised hands show, so he keeps to acts up there
    if (G.portrait) { if (r < 0.4) act('sky'); else if (r < 0.75) act('capTip'); else act('nod'); return; }
    if (r < 0.3) act('sky'); else if (r < 0.55) act('pet'); else if (r < 0.75) act('capTip'); else act('nod');
  }

  return { build, layout, update, act, actIfIdle, stage, stopAct, bigWin, setFace, look, walkIn, bounds, headGlobal, setOutfit, idleVariety, R, get P() { return P; }, get paintMs() { return paintMs; }, petTo, get K() { return K; }, get S() { return S; }, _tx: () => TX[outfit], _pose(name) { clearAct(); mixInto(P, clone(P), target(name), 1, 0); } };
})();

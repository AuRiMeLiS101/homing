/* Gennady runtime. Pose tweens drive a skeleton and the painter draws the whole figure in one pass into a canvas
   texture, only when something changed and at a rate the device can afford. Jumps, squash and breathing ride on
   the sprite transform at full frame rate. Springs add follow through to the belly, moustache and cap. His pet
   pigeon is a separate little sprite that perches on his forearm or his cap and hops between them. */
const Gennady = (function () {
  const Gn = HomingGennady;
  const BOX = { x0: -620, x1: 620, y0: -1330, y1: 80 }; // rig units covered by the character texture
  const PBOX = { x0: -130, x1: 130, y0: -220, y1: 30 }; // pet texture box, pet units
  const PET_K = 0.92;                                    // pet units to rig units
  const R = { scale: 0.5 };
  const P = Gn.makePose('idle');
  const M = { x: 0, y: 0, sx: 1, sy: 1, rot: 0 };       // root motion, y up in rig units
  let outfit = 'base';
  let busy = null, cv = null, ctx = null, tex = null, texS = 0, res = 1;
  let lastSig = '', paintMs = 8, sincePaint = 999, boilF = 0, boilT = 0, lastNow = 0;
  let cache = {};
  const spr = { belly: { x: 0, v: 0 }, stache: { x: 0, v: 0 }, cap: { x: 0, v: 0 } };
  let prevY = 0, prevVy = 0, prevHY = 0, prevHR = 0;
  let blinkT = 2.5, blinkOn = false, lookOwner = null, trackK = 0;
  const pet = { tex: {}, perch: 'arm', pose: 'sit', hop: null, air: null, bobT: 1, squash: 1, flip: false, flapT: 0 };

  // ---------- pose plumbing ----------
  // gsap tags tweened objects with _gsap; skip it when copying or fingerprinting a pose
  function clone(o) {
    if (!o || typeof o !== 'object') return o;
    const out = Array.isArray(o) ? [] : {};
    for (const k in o) if (k !== '_gsap') out[k] = clone(o[k]);
    return out;
  }
  function sig(o, acc) {
    for (const k in o) {
      if (k === '_gsap') continue;
      const v = o[k];
      if (typeof v === 'number') acc.push(Math.round(v * 200));
      else if (v && typeof v === 'object') sig(v, acc);
      else acc.push(v);
    }
    return acc;
  }
  // write a blend of two poses into P in place, so direct tweens on P's fields keep working
  function mixInto(dst, a, b, t, snap) {
    for (const k in b) {
      if (k === 'fx') continue;
      const x = a[k], y = b[k];
      if (typeof y === 'number' && typeof x === 'number') dst[k] = x + (y - x) * t;
      else if (y && typeof y === 'object') { if (!dst[k] || typeof dst[k] !== 'object') dst[k] = {}; mixInto(dst[k], x || {}, y, t, snap); }
      else dst[k] = t >= snap ? y : x;
    }
  }
  function target(name, extra) {
    const T = Gn.makePose(name, extra);
    T.outfit = outfit;
    return T;
  }
  // morph to a key pose; the start is captured when the tween begins, so it chains cleanly in timelines
  function poseTo(name, dur, ease, extra, snap) {
    const st = { t: 0 };
    let from = null, to = null;
    return gsap.to(st, {
      t: 1, duration: dur, ease: ease || 'power2.inOut',
      onStart() { from = clone(P); to = typeof name === 'string' ? target(name, extra) : name; },
      onUpdate() { if (from) mixInto(P, from, to, st.t, snap == null ? 0.3 : snap); }
    });
  }
  function restName() { return outfit === 'race' ? 'proud' : 'idle'; }
  // in portrait only his head and shoulders show, so the pet keeps to the cap where she is visible
  function homePerch() { return outfit === 'race' || G.portrait ? 'cap' : 'arm'; }
  function rest(d) {
    const t = gsap.timeline();
    t.add(poseTo(restName(), d || 0.38, 'power2.inOut', null, 0.4), 0);
    t.to(M, { y: 0, sx: 1, sy: 1, rot: 0, duration: d || 0.38, ease: 'power2.inOut' }, 0);
    t.add(() => { petTo(homePerch(), 0.12); });
    return t;
  }

  // ---------- canvas and texture ----------
  function makeCanvas(s) {
    texS = s;
    cv = document.createElement('canvas');
    cv.width = Math.ceil((BOX.x1 - BOX.x0) * s); cv.height = Math.ceil((BOX.y1 - BOX.y0) * s);
    ctx = cv.getContext('2d');
    const old = tex;
    tex = texFrom(cv, false);
    R.sprite.texture = tex;
    if (old) old.destroy(true);
    R.sprite.anchor.set(-BOX.x0 / (BOX.x1 - BOX.x0), -BOX.y0 / (BOX.y1 - BOX.y0));
    R.sprite.scale.set(1 / s);
    cache = {};
    paintPetTextures();
    lastSig = '';
  }
  function lwPx() { return U.clamp(5.6 * R.scale, 1.6, 3.6) * res; }
  function misPx() { return U.clamp(4.2 * R.scale, 1.2, 2.6) * res; }
  function paintNow() {
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(texS, 0, 0, texS, -BOX.x0 * texS, -BOX.y0 * texS);
    Gn.paint(ctx, P, { s: texS, lw: lwPx(), mis: misPx(), cache, boil: G.reduced ? null : boilF, boilAmp: 0.55 * res, dotScale: res });
    tex.source.update();
    paintMs = paintMs * 0.8 + (performance.now() - t0) * 0.2;
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

  // ---------- build and layout ----------
  function build(parent) {
    R.root = new PIXI.Container(); parent.addChild(R.root);
    // a seed crate under his feet when the spin button would otherwise cover them
    R.crate = new PIXI.Sprite(G.tex.crate); R.crate.anchor.set(0.5, 0.03); R.crate.visible = false; R.root.addChild(R.crate);
    R.body = new PIXI.Container(); R.root.addChild(R.body);
    R.sprite = new PIXI.Sprite(PIXI.Texture.EMPTY); R.body.addChild(R.sprite);
    R.pet = new PIXI.Sprite(PIXI.Texture.EMPTY); R.root.addChild(R.pet);
    P.outfit = outfit;
  }
  function layout(x, y, h, o) {
    o = o || {};
    const hadCrate = R.crate.visible, fromY = R.root.y;
    R.baseX = x; R.baseY = y; R.h = h;
    R.root.x = x; R.root.y = staged && G.portrait ? y - h * 0.42 : y;
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
        // the crate keeps its place on the roof while he rises onto it
        const hold = () => { R.crate.y = (y - R.root.y) / R.scale; };
        hold();
        gsap.to(R.root, { y, duration: 0.42, delay: 0.12, ease: 'back.out(2.2)', onStart: () => Audio2.play('step'), onUpdate: hold, onComplete: () => { R.crate.y = 0; } });
        gsap.timeline({ delay: 0.12 })
          .to(M, { y: 60, sy: 1.08, sx: 0.95, duration: 0.2, ease: 'power2.out' })
          .to(M, { y: 0, sy: 0.9, sx: 1.07, duration: 0.16, ease: 'power2.in' })
          .to(M, { sy: 1, sx: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' });
      }
    }
    res = Math.min(window.devicePixelRatio || 1, 1.5);
    const want = R.scale * res;
    if (!texS || Math.abs(want - texS) / texS > 0.08) makeCanvas(want);
  }

  // ---------- per frame ----------
  function spring(s, k, c, f, sec) { s.v += (-k * s.x - c * s.v + f) * sec; s.x += s.v * sec; if (Math.abs(s.x) < 0.002 && Math.abs(s.v) < 0.01) { s.x = 0; s.v = 0; } }
  function update(dt) {
    const sec = Math.min(0.05, dt / 1000);
    if (!R.root || !cv) return;
    // follow through: the belly lags the body's vertical motion, the moustache the head, the cap the head's turn
    const by = M.y - P.hipDrop * 0.6, vy = (by - prevY) / Math.max(sec, 0.001), ay = (vy - prevVy) / Math.max(sec, 0.001);
    prevY = by; prevVy = vy;
    spring(spr.belly, 160, 9, U.clamp(-ay * 0.0016, -40, 40), sec);
    const K = Gn.anchors(P), hy = K.head.y, hr = P.head.rot + P.lean;
    const hv = (hy - prevHY) / Math.max(sec, 0.001), rv = (hr - prevHR) / Math.max(sec, 0.001);
    prevHY = hy; prevHR = hr;
    spring(spr.stache, 220, 11, U.clamp(-hv * 0.06, -30, 30), sec);
    spring(spr.cap, 140, 7, U.clamp(-rv * 0.9, -14, 14), sec);
    P.fx.belly = U.clamp(spr.belly.x, -1.2, 1.2); P.fx.stache = U.clamp(spr.stache.x, -1, 1); P.fx.capWob = U.clamp(spr.cap.x * 0.6, -0.35, 0.35);
    // blink now and then, only from the plain bead eyes
    blinkT -= sec;
    if (blinkT <= 0 && P.face.eyes === 'bead' && !blinkOn) {
      blinkOn = true; P.face.eyes = 'closed';
      setTimeout(() => { if (P.face.eyes === 'closed') P.face.eyes = 'bead'; blinkOn = false; }, 120);
      blinkT = Math.random() < 0.2 ? 0.28 : U.rand(2.2, 5.5);
    }
    trackBirds(sec);
    // flag flutter while the pennant is out
    if (P.prop.pennant >= 0.5) P.prop.flag = (P.prop.flag + sec * 9) % (Math.PI * 2);
    // boil: a slow coherent wobble while he stands still
    boilT += sec;
    if (boilT > 0.2) { boilT = 0; if (!busy || !busy.isActive()) boilF = (boilF + 1) % 3; }
    // breathing rides the sprite, so idle costs no repaints
    const br = Math.sin(G.time * 1.7) * 0.006;
    R.body.x = M.x; R.body.y = -M.y; R.body.rotation = M.rot;
    R.body.scale.set(M.sx * (1 - br * 0.5), M.sy * (1 + br));
    updatePet(sec, K);
    // repaint when the pose changed, no faster than the measured paint cost allows (about a third of the frame
    // budget). Real time, so slow motion beats do not change the cadence. Software test renderers get a wider gap.
    const now = performance.now();
    sincePaint += lastNow ? now - lastNow : dt;
    lastNow = now;
    const s = sig(P, []).join(',') + '|' + boilF;
    if (s !== lastSig) {
      const gap = U.clamp(paintMs / 0.32, 15, G.fastTest ? 450 : 120);
      if (sincePaint >= gap) { paintNow(); lastSig = s; sincePaint = 0; }
    }
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
  function rootOf(q) { return { x: M.x + q.x * M.sx, y: -M.y + q.y * M.sy }; }
  function perchPos(name, K) {
    if (name === 'cap') return rootOf(K.capTop);
    if (name === 'trophy') return rootOf({ x: K.handB.x + 10, y: K.handB.y - 186 });
    return rootOf(K.arm);
  }
  function petTo(name, delay) {
    if (pet.perch === name && !pet.hop) return;
    const go = () => {
      const from = { x: R.pet.x, y: R.pet.y };
      pet.hop = { from, to: name, t: 0, dur: 0.34 };
      if (Math.random() < 0.5 && typeof Audio2 !== 'undefined') Audio2.play('flap');
    };
    if (delay) setTimeout(go, delay * 1000); else go();
  }
  function setPetTex(k) { if (pet.pose !== k) { pet.pose = k; R.pet.texture = pet.tex[k]; } }
  function updatePet(sec, K) {
    pet.flapT += sec;
    const flap = Math.floor(pet.flapT * 14) % 2 ? 'flap2' : 'flap';
    if (pet.hop) {
      const h = pet.hop; h.t += sec / h.dur;
      const t = Math.min(1, h.t), to = perchPos(h.to, K);
      const e = t * t * (3 - 2 * t);
      R.pet.x = U.lerp(h.from.x, to.x, e);
      R.pet.y = U.lerp(h.from.y, to.y, e) - Math.sin(t * Math.PI) * 150;
      R.pet.rotation = Math.sin(t * Math.PI) * -0.3;
      setPetTex(flap);
      if (t >= 1) { pet.hop = null; pet.perch = h.to; pet.squash = 0.72; setPetTex('sit'); }
    } else if (pet.perch === 'cap' && P.cap.lift > 60) {
      // the cap flew off with her on it: she flaps above it until it comes back down
      if (!pet.air) pet.air = { y: R.pet.y };
      const top = perchPos('cap', K);
      pet.air.y = U.lerp(pet.air.y, top.y - 130 + Math.sin(G.time * 9) * 10, Math.min(1, sec * 6));
      R.pet.x = U.lerp(R.pet.x, top.x, Math.min(1, sec * 6)); R.pet.y = pet.air.y;
      R.pet.rotation = Math.sin(G.time * 7) * 0.12;
      setPetTex(pet.flapT % 1.2 < 0.25 ? 'startle' : flap);
    } else {
      if (pet.air) { pet.air = null; pet.squash = 0.72; setPetTex('sit'); }
      const p = perchPos(pet.perch, K);
      R.pet.x = p.x; R.pet.y = p.y;
      R.pet.rotation = pet.perch === 'cap' ? K.capRot * 0.8 : 0;
      pet.bobT -= sec;
      if (pet.bobT <= 0) {
        pet.bobT = U.rand(0.5, 1.8);
        setPetTex(pet.pose === 'bob' ? 'sit' : (Math.random() < 0.6 ? 'bob' : 'sit'));
        if (Math.random() < 0.12) pet.flip = !pet.flip;
      }
    }
    pet.squash = U.lerp(pet.squash, 1, Math.min(1, sec * 9));
    const k = PET_K / (texS * PET_K);
    R.pet.scale.set(k * (pet.flip ? -1 : 1) * (2 - pet.squash), k * pet.squash);
  }

  // ---------- acts ----------
  function newTl(loop) { const t = gsap.timeline(loop ? { repeat: -1 } : {}); t.timeScale(G.turbo ? 1.45 : 1); return t; }
  function clearAct() {
    if (busy) { busy.kill(); busy = null; }
    gsap.killTweensOf(M); gsap.killTweensOf(P.cap); gsap.killTweensOf(P.head); gsap.killTweensOf(P.face); gsap.killTweensOf(P.A); gsap.killTweensOf(P.B); gsap.killTweensOf(P);
    lookOwner = null;
  }
  function stopAct() {
    clearAct();
    P.prop.binos = 0; P.prop.whistle = 0; P.prop.pennant = 0; P.prop.trophy = 0; P.prop.medal = 0; P.face.sweat = 0;
    busy = rest(0.34);
  }
  function hop(t, at, h, up, down) {
    t.to(M, { y: h, sy: 1.08, sx: 0.95, duration: up, ease: 'power2.out' }, at);
    t.to(M, { y: 0, sy: 1, sx: 1, duration: down, ease: 'power2.in' }, at + up);
    t.to(M, { sy: 0.9, sx: 1.07, duration: 0.06, ease: 'power1.out' }, at + up + down);
    t.to(M, { sy: 1, sx: 1, duration: 0.3, ease: 'elastic.out(1, 0.45)' }, at + up + down + 0.06);
  }
  function capFly(t, at, h, spin) {
    t.to(P.cap, { lift: h, rot: spin, duration: 0.42, ease: 'power2.out' }, at);
    t.to(P.cap, { lift: 0, rot: 0, duration: 0.4, ease: 'bounce.out' }, at + 0.42);
  }
  const ACTS = {
    nod(t) {
      t.to(P.head, { y: 8, duration: 0.09, ease: 'power2.out' }).to(P.head, { y: 0, duration: 0.24, ease: 'power2.inOut' });
      t.to(P.face, { lid: Math.min(1, P.face.lid + 0.18), duration: 0.09, yoyo: true, repeat: 1 }, 0);
    },
    point(t) {
      lookOwner = 'act';
      t.add(poseTo('point', 0.2, 'back.out(1.8)', null, 0.15));
      t.to(M, { sy: 1.04, duration: 0.1, yoyo: true, repeat: 1 }, 0.05);
      t.to({}, { duration: 0.55 }); t.add(rest(0.38));
    },
    smallWin(t) {
      t.add(poseTo('smallWin', 0.13, 'back.out(2)', null, 0.1));
      t.to(M, { sy: 0.97, duration: 0.07, yoyo: true, repeat: 1 }, 0);
      t.to(P.A, { y: P.A.y - 30, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' }, 0.18);
      t.to({}, { duration: 0.4 }); t.add(rest(0.32));
    },
    cheer(t) {
      petTo('cap');
      t.add(poseTo(target('idle', { hipDrop: 34, face: { eyes: 'happy', mouth: 'grin', smile: 1, lid: 0 } }), 0.12, 'power2.in', null, 0), 0.08);
      t.add(poseTo('cheer', 0.16, 'back.out(1.6)', null, 0), 0.2);
      hop(t, 0.2, 70, 0.18, 0.16);
      hop(t, 0.62, 28, 0.13, 0.12);
      t.to(P.A, { y: -600, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.95);
      t.to(P.B, { y: -600, duration: 0.12, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 1.0);
      t.add(rest(0.42), 1.5);
    },
    gasp(t) {
      if (pet.perch === 'arm') { pet.squash = 0.6; petTo('cap'); }
      t.add(poseTo('gasp', 0.09, 'power3.out', null, 0.05), 0.04);
      t.to(M, { sy: 1.08, sx: 0.95, duration: 0.09, ease: 'power2.out' }, 0.04).to(M, { sy: 1, sx: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
      t.to({}, { duration: 0.5 }); t.add(rest(0.4));
    },
    binos(t) {
      petTo('cap');
      t.add(poseTo('anticip', 0.32, 'power2.inOut', null, 0.25), 0.1);
      t.add(() => {
        const tr = gsap.timeline({ repeat: -1 });
        tr.to(P, { lean: -0.065, duration: 0.07, ease: 'sine.inOut' }).to(P, { lean: -0.04, duration: 0.07, ease: 'sine.inOut' });
        tr.to(P.face, { sweat: 1, duration: 0.6, ease: 'power1.in' }, 0).set(P.face, { sweat: 0.3 });
        busy = tr;
      });
    },
    shrug(t) {
      petTo('cap');
      t.add(poseTo('shrug', 0.2, 'back.out(1.6)', null, 0.2), 0.12);
      t.to(M, { sy: 1.03, duration: 0.12, yoyo: true, repeat: 1 }, 0.12);
      t.to({}, { duration: 0.55 }); t.add(rest(0.36));
    },
    pet(t) {
      t.add(poseTo(target('idle', { A: { x: 40, y: -214, att: 0, hand: 'relax', hr: -0.4, z: 2 }, face: { eyes: 'closed', smile: 0.5, mouth: 'smile' } }), 0.28, 'power2.out'));
      t.to(P.A, { x: 70, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' });
      t.add(() => { setPetTex('bob'); if (typeof Audio2 !== 'undefined') Audio2.play('coo', { pitch: 1 }); });
      t.add(rest(0.34));
    },
    capTip(t) {
      t.add(poseTo('capTip', 0.26, 'back.out(1.4)'));
      t.to(P.cap, { rot: -0.2, lift: 14, duration: 0.14, yoyo: true, repeat: 1 }, 0.26);
      t.to({}, { duration: 0.35 }); t.add(rest(0.34));
    },
    sky(t) {
      lookOwner = 'act';
      t.add(poseTo('sky', 0.32, 'power2.inOut'));
      t.to(P.head, { rot: 0.04, duration: 0.6, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      t.add(rest(0.36));
    },
    whistle(t) {
      petTo('cap');
      t.add(poseTo('whistle', 0.16, 'power2.out', null, 0.2), 0.12);
      t.to(P.face, { puff: 0.7, duration: 0.08, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0.3);
      t.to(M, { sx: 1.03, sy: 0.98, duration: 0.08, yoyo: true, repeat: 7 }, 0.3);
      t.to({}, { duration: 0.15 }); t.add(rest(0.34));
    },
    wave(t) {
      petTo('cap');
      t.add(poseTo('wave', 0.25, 'back.out(1.6)', null, 0.1), 0.1);
      t.to(P.B, { x: 140, duration: 0.22, yoyo: true, repeat: 7, ease: 'sine.inOut' });
      t.add(rest(0.4));
    },
    dance(t) {
      petTo('cap');
      t.add(poseTo('danceA', 0.16, 'power2.out', null, 0.1), 0);
      t.to(M, { y: 26, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.16);
      t.add(poseTo('danceB', 0.16, 'power2.out', null, 0.1), 0.4);
      t.to(M, { y: 26, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.56);
    },
    bigV(t) {
      petTo('cap');
      t.add(poseTo(target('idle', { hipDrop: 40, face: { eyes: 'happy', mouth: 'grin', smile: 1, lid: 0 } }), 0.12, 'power2.in', null, 0), 0.06);
      t.add(poseTo('bigV', 0.16, 'back.out(1.5)', null, 0), 0.18);
      hop(t, 0.18, 150, 0.24, 0.2);
      capFly(t, 0.2, 280, -2.6);
      t.to(P.A, { y: -560, duration: 0.14, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.7);
      t.to(P.B, { y: -560, duration: 0.14, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0.76);
      hop(t, 0.9, 40, 0.13, 0.12);
    },
    trophy(t) {
      t.add(() => { pet.hop = null; petTo('trophy', 0.2); });
      t.add(poseTo('trophy', 0.3, 'back.out(1.5)', null, 0), 0);
      t.to(M, { y: 18, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.3);
      t.to(P.head, { rot: 0.16, duration: 0.2, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.3);
    },
    roar(t) {
      petTo('cap');
      t.add(poseTo(target(restName(), { hipDrop: 46, face: { eyes: 'squeeze', mouth: 'grin', smile: 1 } }), 0.14, 'power2.in', null, 0), 0.06);
      t.add(poseTo('roar', 0.18, 'back.out(1.4)', null, 0), 0.2);
      hop(t, 0.2, 60, 0.18, 0.16);
      t.to(P.cap, { lift: 320, rot: 3.4, x: 60, duration: 0.5, ease: 'power2.out' }, 0.22);
      t.to(M, { rot: 0.012, duration: 0.05, yoyo: true, repeat: 11 }, 0.6);
      t.add(poseTo('number1', 0.26, 'back.out(1.6)', null, 0.2), 1.3);
      t.to(P.cap, { lift: 0, rot: 0, x: 0, duration: 0.45, ease: 'bounce.out' }, 1.3);
      t.to(P.B, { y: -700, duration: 0.18, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 1.7);
    }
  };
  // looping acts keep going until stopAct
  const LOOPS = { dance: true, binos: false, bigV: false, trophy: false, roar: false };
  function act(name) {
    const fn = ACTS[name] || (name === 'nod' ? ACTS.nod : null);
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
          P.legA.x = -78 + s1 * 34 * k; P.legA.y = -Math.max(0, -c1) * 44 * k;
          P.legB.x = 78 - s1 * 34 * k; P.legB.y = -Math.max(0, c1) * 44 * k;
          P.A.x = -200 - s1 * 40 * k; P.A.y = -70 + Math.abs(s1) * 10; P.A.hand = 'relax';
          P.B.x = 200 + s1 * 40 * k; P.B.y = -70 + Math.abs(s1) * 10; P.B.hand = 'relax'; P.B.z = 1; P.B.att = 0;
          P.hipDrop = 6 - Math.abs(c1) * 14 * k;
          P.lean = -0.06 * k; P.face.lookX = -0.5 * k;
          if (Math.abs(c1) > 0.97 && st.t < 0.95) { if (!st.lock) { st.lock = true; if (typeof Audio2 !== 'undefined') Audio2.play('step'); } } else st.lock = false;
        },
        onComplete: () => { lookOwner = null; busy = rest(0.3); res(); }
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
    const a = Gn.anchors(P); const p = rootOf(a.head);
    return R.root.toGlobal(new PIXI.Point(p.x, p.y));
  }
  function setOutfit(name) {
    outfit = name === 'race' ? 'race' : 'base';
    P.outfit = outfit;
    if (!busy || !busy.isActive()) { busy = rest(0.01); }
  }
  function bounds() {
    const a = Gn.anchors(P); const top = R.root.toGlobal(new PIXI.Point(0, a.capTop.y)), foot = R.root.toGlobal(new PIXI.Point(0, 0));
    const w = 420 * R.scale;
    return new PIXI.Rectangle(foot.x - w, top.y, w * 2, foot.y - top.y);
  }
  // In portrait only his head shows below the loft; for the big win show he steps up so his acting is seen.
  let staged = false;
  function stage(on) {
    staged = !!on;
    gsap.killTweensOf(R.root, 'y');
    if (!G.portrait) { R.root.y = R.baseY; return; }
    gsap.to(R.root, { y: on ? R.baseY - R.h * 0.42 : R.baseY, duration: on ? 0.55 : 0.45, ease: on ? 'back.out(1.5)' : 'power2.inOut' });
  }
  function actIfIdle(name) { if (busy && busy.isActive()) return null; return act(name); }
  function idleVariety() {
    if (busy && busy.isActive()) return;
    const r = Math.random();
    if (outfit === 'race') { if (r < 0.5) act('capTip'); else act('nod'); return; }
    if (r < 0.3) act('sky'); else if (r < 0.55) act('pet'); else if (r < 0.75) act('capTip'); else act('nod');
  }

  return { build, layout, update, act, actIfIdle, stage, stopAct, bigWin, setFace, look, walkIn, bounds, headGlobal, setOutfit, idleVariety, R, get P() { return P; }, get paintMs() { return paintMs; }, petTo };
})();

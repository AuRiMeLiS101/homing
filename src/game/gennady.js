/* Gennady: cut-out rig with two-bone arm IK, line boil, expressions and acted moments. */
const Gennady = (function () {
  const R = {};
  const P = {
    hipY: 0, lean: 0, headRot: 0, breathe: 0, jump: 0,
    lHand: { x: -74, y: -378 }, rHand: { x: 78, y: -372 },
    legL: 0.02, legR: -0.02, x: 0,
    petUp: 0 // 0 = the pet pigeon is held at his belly, 1 = it has hopped up onto his head
  };
  const face = { eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk', lookX: 0, lookY: 0, cheeks: false };
  let blinkT = 2.5, boilT = 0, bobT = 0, busy = null, idleOn = true;
  const L1 = 192, L2 = 176;
  const HIP_Y = -228;

  function part(name) {
    const d = G.tex.gena[name];
    const s = new PIXI.Sprite(d.tex[0]);
    s.anchor.set(d.ax / d.w, d.ay / d.h);
    s._part = name; s._bo = U.randInt(0, 2);
    return s;
  }

  function build(parent) {
    R.root = new PIXI.Container(); parent.addChild(R.root);
    R.legL = part('legL'); R.legR = part('legR');
    R.slipL = part('slipper'); R.slipR = part('slipper'); R.slipL.scale.x = -1;
    R.upL = part('armUpper'); R.upR = part('armUpper');
    R.torso = part('torso');
    R.head = new PIXI.Container();
    R.headS = part('head'); R.head.addChild(R.headS);
    R.face = new PIXI.Graphics(); R.head.addChild(R.face);
    R.binos = part('binos'); R.binos.visible = false; R.binos.y = -150; R.head.addChild(R.binos);
    R.whistle = part('whistle'); R.whistle.visible = false; R.whistle.x = 8; R.whistle.y = -34; R.head.addChild(R.whistle);
    R.pet = new PIXI.Sprite(G.tex.perch.white[0]); R.pet.anchor.set(0.5, 0.85); R.pet.scale.set(1.15);
    R.loL = part('armLower'); R.loR = part('armLower');
    R.handL = part('handOpen'); R.handR = part('handOpen'); R.handR.scale.x = -1;
    R.pennant = part('pennant'); R.pennant.visible = false;
    R.shadow = new PIXI.Graphics().ellipse(0, 0, 150, 18).fill({ color: 0x000000, alpha: 0.28 });
    [R.shadow, R.legL, R.legR, R.slipL, R.slipR, R.upL, R.upR, R.torso, R.head, R.pet, R.loL, R.loR, R.handL, R.handR, R.pennant].forEach((p) => R.root.addChild(p));
    drawFace();
  }

  function layout(x, y, h) {
    R.root.x = x; R.root.y = y;
    R.scale = h / 980;
    R.root.scale.set(R.scale);
  }

  function ik(S, T, bend) {
    const dx = T.x - S.x, dy = T.y - S.y;
    let d = Math.hypot(dx, dy);
    d = U.clamp(d, 20, L1 + L2 - 0.5);
    const a = Math.atan2(dy, dx);
    const cb = U.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
    const ua = a + bend * Math.acos(cb);
    const E = { x: S.x + Math.cos(ua) * L1, y: S.y + Math.sin(ua) * L1 };
    const la = Math.atan2(T.y - E.y, T.x - E.x);
    return { ua, la, E };
  }

  function rot(px, py, a) { const c = Math.cos(a), s = Math.sin(a); return { x: px * c - py * s, y: px * s + py * c }; }

  function pose() {
    const hipY = HIP_Y + P.hipY - P.jump;
    const breathe = 1 + P.breathe;
    const lean = P.lean + (idleOn ? Math.sin(G.time * 0.5) * 0.012 : 0);
    // legs
    R.legL.x = -40; R.legL.y = hipY + 4; R.legL.rotation = P.legL;
    R.legR.x = 40; R.legR.y = hipY + 4; R.legR.rotation = P.legR;
    const fl = rot(0, 216, P.legL), fr = rot(0, 216, P.legR);
    R.slipL.x = -40 + fl.x - 18; R.slipL.y = hipY + 4 + fl.y + 10; R.slipL.rotation = P.legL * 0.6;
    R.slipR.x = 40 + fr.x + 18; R.slipR.y = hipY + 4 + fr.y + 10; R.slipR.rotation = P.legR * 0.6;
    R.shadow.y = 6; R.shadow.scale.set(1 - P.jump / 400, 1);
    // torso
    R.torso.x = 0; R.torso.y = hipY + 10; R.torso.rotation = lean; R.torso.scale.set(1, breathe);
    const tp = (lx, ly) => { const r = rot(lx, ly * breathe, lean); return { x: r.x, y: hipY + 10 + r.y }; };
    const neck = tp(0, -398);
    R.head.x = neck.x; R.head.y = neck.y; R.head.rotation = lean * 0.6 + P.headRot;
    const SL = tp(-126, -360), SR = tp(126, -360);
    const tl = { x: P.lHand.x, y: P.lHand.y - P.jump + P.hipY }, tr = { x: P.rHand.x, y: P.rHand.y - P.jump + P.hipY };
    const a = ik(SL, tl, 1), b = ik(SR, tr, -1);
    R.upL.x = SL.x; R.upL.y = SL.y; R.upL.rotation = a.ua - Math.PI / 2;
    R.loL.x = a.E.x; R.loL.y = a.E.y; R.loL.rotation = a.la - Math.PI / 2;
    R.upR.x = SR.x; R.upR.y = SR.y; R.upR.rotation = b.ua - Math.PI / 2;
    R.loR.x = b.E.x; R.loR.y = b.E.y; R.loR.rotation = b.la - Math.PI / 2;
    const wl = { x: a.E.x + Math.cos(a.la) * (L2 - 6), y: a.E.y + Math.sin(a.la) * (L2 - 6) };
    const wr = { x: b.E.x + Math.cos(b.la) * (L2 - 6), y: b.E.y + Math.sin(b.la) * (L2 - 6) };
    R.handL.x = wl.x; R.handL.y = wl.y; R.handL.rotation = a.la - Math.PI / 2;
    R.handR.x = wr.x; R.handR.y = wr.y; R.handR.rotation = b.la - Math.PI / 2;
    // pet bird sits between the hands, or hops up onto his head when he needs both hands
    if (R.pet.visible) {
      const belly = tp(6, -150);
      const ht = rot(14, -296, R.head.rotation), top = { x: R.head.x + ht.x, y: R.head.y + ht.y };
      const k = U.clamp(P.petUp, 0, 1);
      R.pet.x = U.lerp(belly.x, top.x, k);
      R.pet.y = U.lerp(belly.y, top.y, k) - Math.sin(k * Math.PI) * 150;
      R.pet.rotation = R.head.rotation * k;
    }
    if (R.pennant.visible) { R.pennant.x = wr.x + 10; R.pennant.y = wr.y - 150; R.pennant.rotation = Math.sin(G.time * 9) * 0.1; R.pennant.skew.y = Math.sin(G.time * 11) * 0.08; }
  }

  function drawFace() {
    const g = R.face; g.clear();
    const ex = 48, ey = -142;
    const lx = face.lookX * 6, ly = face.lookY * 4;
    // eyes
    if (face.eyes === 'open' || face.eyes === 'wide') {
      const r = face.eyes === 'wide' ? 13 : 9.5;
      if (face.eyes === 'wide') { g.circle(-ex, ey, 20).fill({ color: COL.PAPER }); g.circle(ex, ey, 20).fill({ color: COL.PAPER }); }
      g.circle(-ex + lx, ey + ly, r).fill({ color: COL.INK }); g.circle(ex + lx, ey + ly, r).fill({ color: COL.INK });
      g.circle(-ex + lx - 3, ey + ly - 4, 3).fill({ color: COL.PAPER }); g.circle(ex + lx - 3, ey + ly - 4, 3).fill({ color: COL.PAPER });
    } else if (face.eyes === 'closed') {
      g.moveTo(-ex - 14, ey).quadraticCurveTo(-ex, ey + 8, -ex + 14, ey).stroke({ width: 6, color: COL.INK, cap: 'round' });
      g.moveTo(ex - 14, ey).quadraticCurveTo(ex, ey + 8, ex + 14, ey).stroke({ width: 6, color: COL.INK, cap: 'round' });
    } else if (face.eyes === 'happy') {
      g.moveTo(-ex - 15, ey + 4).quadraticCurveTo(-ex, ey - 12, -ex + 15, ey + 4).stroke({ width: 7, color: COL.INK, cap: 'round' });
      g.moveTo(ex - 15, ey + 4).quadraticCurveTo(ex, ey - 12, ex + 15, ey + 4).stroke({ width: 7, color: COL.INK, cap: 'round' });
    }
    // glasses
    if (!R.binos || !R.binos.visible) {
      for (const sx of [-1, 1]) g.roundRect(sx * ex - 42, ey - 32, 84, 64, 16).fill({ color: COL.PAPER, alpha: 0.16 }).stroke({ width: 10, color: COL.INK });
      g.moveTo(-6, ey - 4).lineTo(6, ey - 4).stroke({ width: 9, color: COL.INK });
      g.moveTo(-ex - 42, ey - 10).lineTo(-112, ey - 14).stroke({ width: 8, color: COL.INK });
      g.moveTo(ex + 42, ey - 10).lineTo(112, ey - 14).stroke({ width: 8, color: COL.INK });
      g.poly([-ex - 30, ey - 22, -ex - 18, ey - 24, -ex - 30, ey + 10, -ex - 36, ey + 8]).fill({ color: COL.PAPER, alpha: 0.55 });
      g.poly([ex - 30, ey - 22, ex - 18, ey - 24, ex - 30, ey + 10, ex - 36, ey + 8]).fill({ color: COL.PAPER, alpha: 0.55 });
    }
    // brows: bushy, two layer
    const by = ey - 52 - face.brow * 16, t = face.tilt;
    for (const sx of [-1, 1]) {
      const x0 = sx * (ex + 40), x1 = sx * 14;
      const y0 = by + t * 6, y1 = by - t * 10;
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 28, color: COL.INK, cap: 'round' });
      g.moveTo(x0, y0).lineTo(x1, y1).stroke({ width: 17, color: 0xE4DDD0, cap: 'round' });
      g.moveTo(x0 * 0.9, y0 - 6).lineTo(x1, y1 - 7).stroke({ width: 4, color: 0xFFFFFF, cap: 'round', alpha: 0.6 });
    }
    // cheeks
    if (face.cheeks) { g.circle(-70, -78, 30).fill({ color: COL.ORANGE, alpha: 0.45 }); g.circle(70, -78, 30).fill({ color: COL.ORANGE, alpha: 0.45 }); }
    // mouth
    const my = -30;
    switch (face.mouth) {
      case 'smirk': g.moveTo(-40, my - 2).quadraticCurveTo(0, my + 12, 40, my - 8).stroke({ width: 8, color: COL.INK, cap: 'round' }); break;
      case 'flat': g.moveTo(-30, my).lineTo(30, my).stroke({ width: 8, color: COL.INK, cap: 'round' }); break;
      case 'grin':
        g.moveTo(-50, my - 12).quadraticCurveTo(0, my + 44, 50, my - 12).closePath().fill({ color: COL.INK });
        g.moveTo(-42, my - 9).lineTo(42, my - 9).lineTo(38, my + 2).lineTo(-38, my + 2).closePath().fill({ color: COL.PAPER });
        break;
      case 'o': g.ellipse(0, my + 4, 14, 17).fill({ color: COL.INK }); break;
      case 'shout':
        g.ellipse(0, my + 8, 34, 30).fill({ color: COL.INK });
        g.ellipse(0, my + 22, 20, 10).fill({ color: COL.CORAL });
        break;
      default: break;
    }
  }

  function setFace(o) { Object.assign(face, o); drawFace(); }

  function update(dt) {
    const sec = dt / 1000;
    boilT += dt;
    if (boilT > 125) {
      boilT = 0;
      for (const s of R.root.children.concat(R.head.children)) if (s._part) { const d = G.tex.gena[s._part]; s.texture = d.tex[(G.boil + s._bo) % 3]; }
    }
    if (idleOn) {
      P.breathe = Math.sin(G.time * 1.7) * 0.014;
      P.headRot = Math.sin(G.time * 0.6) * 0.035;
    }
    blinkT -= sec;
    if (blinkT <= 0 && (face.eyes === 'open')) {
      face.eyes = 'closed'; drawFace();
      setTimeout(() => { if (face.eyes === 'closed') { face.eyes = 'open'; drawFace(); } }, 110);
      blinkT = U.rand(2.2, 5.5);
    }
    bobT -= sec;
    if (bobT <= 0 && R.pet.visible) { bobT = U.rand(0.5, 1.6); R.pet.texture = G.tex.perch.white[R.pet.texture === G.tex.perch.white[0] ? 1 : 0]; }
    trackBirds(sec);
    pose();
  }

  // his eyes follow his racers while they circle
  let trackK = 0;
  function trackBirds(sec) {
    if (face.eyes !== 'open' || typeof Flight === 'undefined') return;
    let tx = 0, ty = 0, on = false;
    if (Flight.count > 0) {
      let sx = 0, sy = 0, n = 0;
      for (const b of Flight.birds.values()) { if (b.c && !b.c.destroyed) { const p = b.c.getGlobalPosition(); sx += p.x; sy += p.y; n++; } }
      if (n) {
        const hp = R.head.toGlobal(new PIXI.Point(0, -140));
        const dx = sx / n - hp.x, dy = sy / n - hp.y, d = Math.hypot(dx, dy) || 1;
        tx = dx / d; ty = dy / d; on = true;
      }
    }
    trackK = U.clamp(trackK + (on ? sec * 3 : -sec * 2), 0, 1);
    if (!on && trackK <= 0) return;
    const nx = U.lerp(face.lookX, on ? tx : 0, Math.min(1, sec * 5));
    const ny = U.lerp(face.lookY, on ? ty : 0, Math.min(1, sec * 5));
    if (Math.abs(nx - face.lookX) + Math.abs(ny - face.lookY) > 0.02) { face.lookX = nx; face.lookY = ny; drawFace(); }
  }

  function look(x, y) {
    // x,y global; convert to direction
    const gp = R.head.toGlobal(new PIXI.Point(0, -140));
    const dx = x - gp.x, dy = y - gp.y, d = Math.hypot(dx, dy) || 1;
    face.lookX = dx / d; face.lookY = dy / d; drawFace();
  }

  function rest(d) {
    return gsap.timeline()
      .to(P.lHand, { x: -74, y: -378, duration: d || 0.35, ease: 'power2.inOut' }, 0)
      .to(P.rHand, { x: 78, y: -372, duration: d || 0.35, ease: 'power2.inOut' }, 0)
      .to(P, { hipY: 0, lean: 0, jump: 0, legL: 0.02, legR: -0.02, duration: d || 0.35, ease: 'power2.inOut' }, 0)
      .to(P, { petUp: 0, duration: 0.32, ease: 'power1.inOut' }, (d || 0.35) * 0.4);
  }
  // the pet hops onto his head before his hands leave it
  function petHop() {
    if (P.petUp > 0.95) return;
    gsap.to(P, { petUp: 1, duration: 0.3, ease: 'power1.inOut' });
    if (Math.random() < 0.6) setTimeout(() => Audio2.play('coo', { pitch: 3 }), 120);
  }

  function stopAct() {
    if (busy) { busy.kill(); busy = null; }
    R.binos.visible = false; R.whistle.visible = false; R.pennant.visible = false; R.pet.visible = true;
    idleOn = true;
    setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk', cheeks: false });
    rest(0.3);
  }

  function act(name) {
    if (busy) { busy.kill(); busy = null; }
    R.binos.visible = false; R.whistle.visible = false; R.pennant.visible = false; R.pet.visible = true;
    idleOn = true;
    let tl = gsap.timeline();
    if (name === 'nod' || name === 'gasp') tl.add(rest(0.25), 0);
    switch (name) {
      case 'nod':
        tl.to(P, { headRot: 0.12, duration: 0.12, yoyo: true, repeat: 1 }, 0);
        break;
      case 'point':
        setFace({ eyes: 'wide', brow: 1, tilt: 0.3, mouth: 'o' });
        tl.to(P.rHand, { x: 230, y: -790, duration: 0.22, ease: 'back.out(2)' })
          .to(P, { lean: -0.08, duration: 0.22 }, 0)
          .to({}, { duration: 0.6 })
          .add(() => setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }))
          .add(rest(0.3));
        break;
      case 'cheer':
        setFace({ eyes: 'happy', brow: 1, tilt: 0, mouth: 'grin' });
        petHop();
        tl.to(P.lHand, { x: -200, y: -820, duration: 0.2, ease: 'back.out(2)' })
          .to(P.rHand, { x: 200, y: -820, duration: 0.2, ease: 'back.out(2)' }, 0)
          .to(P, { jump: 46, duration: 0.18, yoyo: true, repeat: 3, ease: 'power2.out' }, 0)
          .to({}, { duration: 0.35 })
          .add(() => setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }))
          .add(rest(0.3));
        break;
      case 'gasp':
        setFace({ eyes: 'wide', brow: 1.4, tilt: 0.5, mouth: 'shout' });
        tl.to(P, { lean: -0.06, jump: 24, duration: 0.12, yoyo: true, repeat: 1 }, 0)
          .to({}, { duration: 0.8 })
          .add(() => setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }));
        break;
      case 'binos':
        R.binos.visible = true; setFace({ eyes: 'closed', brow: 0.6, tilt: -0.2, mouth: 'flat' });
        R.face.clear();
        drawFace();
        petHop();
        tl.to(P.lHand, { x: -66, y: -720, duration: 0.25, ease: 'power2.out' })
          .to(P.rHand, { x: 66, y: -720, duration: 0.25, ease: 'power2.out' }, 0)
          .to(P, { lean: 0.04, duration: 0.25 }, 0);
        break;
      case 'shrug':
        setFace({ eyes: 'open', brow: 0.9, tilt: -0.35, mouth: 'flat' });
        petHop();
        tl.to(P.lHand, { x: -205, y: -470, duration: 0.22, ease: 'back.out(1.6)' })
          .to(P.rHand, { x: 205, y: -470, duration: 0.22, ease: 'back.out(1.6)' }, 0)
          .to(P, { headRot: -0.14, hipY: -10, duration: 0.22 }, 0)
          .to({}, { duration: 0.5 })
          .add(() => setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }))
          .add(rest(0.32))
          .to(P, { headRot: 0, duration: 0.3 }, '<');
        break;
      case 'pet':
        setFace({ eyes: 'happy', brow: 0.4, tilt: 0, mouth: 'smirk' });
        tl.to(P.lHand, { x: -20, y: -470, duration: 0.25, ease: 'power2.out' })
          .to(P.lHand, { y: -405, duration: 0.22, yoyo: true, repeat: 3, ease: 'sine.inOut' })
          .add(() => { Audio2.play('coo', { pitch: 1 }); setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }); })
          .add(rest(0.3));
        break;
      case 'whistle':
        R.whistle.visible = true; setFace({ eyes: 'closed', brow: 1, tilt: -0.4, mouth: 'o', cheeks: true });
        tl.to(P.rHand, { x: 32, y: -610, duration: 0.18, ease: 'power2.out' })
          .to(P, { lean: -0.05, jump: 12, duration: 0.16 }, 0)
          .to(P, { headRot: 0.05, duration: 0.05, yoyo: true, repeat: 9 })
          .add(() => { R.whistle.visible = false; setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk', cheeks: false }); })
          .add(rest(0.3));
        break;
      case 'wave':
        R.pennant.visible = true; setFace({ eyes: 'happy', brow: 1, tilt: 0, mouth: 'grin' });
        tl.to(P.rHand, { x: 230, y: -760, duration: 0.25, ease: 'back.out(2)' });
        tl.to(P.rHand, { x: 150, y: -800, duration: 0.22, yoyo: true, repeat: 7, ease: 'sine.inOut' });
        tl.add(() => { R.pennant.visible = false; setFace({ eyes: 'open', brow: 0, tilt: 0, mouth: 'smirk' }); }).add(rest(0.3));
        break;
      case 'dance': {
        setFace({ eyes: 'happy', brow: 1.2, tilt: 0, mouth: 'grin' });
        petHop();
        idleOn = false;
        tl = gsap.timeline({ repeat: -1 });
        tl.to(P.lHand, { x: 70, y: -430, duration: 0.15 }, 0).to(P.rHand, { x: -70, y: -440, duration: 0.15 }, 0)
          .to(P, { hipY: 90, legL: 0.75, legR: -0.75, duration: 0.16, ease: 'power2.in' }, 0)
          .to(P, { hipY: 30, legL: 1.35, legR: -0.2, jump: 20, duration: 0.14, ease: 'power2.out' })
          .to(P, { hipY: 90, legL: 0.75, legR: -0.75, jump: 0, duration: 0.14, ease: 'power2.in' })
          .to(P, { hipY: 30, legL: 0.2, legR: -1.35, jump: 20, duration: 0.14, ease: 'power2.out' })
          .to(P, { hipY: 90, legL: 0.75, legR: -0.75, jump: 0, duration: 0.14, ease: 'power2.in' })
          .to(P, { hipY: -20, legL: 0.05, legR: -0.05, jump: 90, duration: 0.2, ease: 'power2.out' })
          .to(P, { jump: 0, duration: 0.18, ease: 'power2.in' })
          .to(P, { headRot: 0.15, duration: 0.1, yoyo: true, repeat: 1 }, '<');
        break;
      }
      default: break;
    }
    busy = tl;
    return tl;
  }

  // shuffle in from off screen: cut-out walk with leg swing, bob and a lean into the step
  function walkIn(fromX, dur) {
    const toX = R.root.x;
    R.root.x = fromX;
    const st = { t: 0 };
    idleOn = false;
    setFace({ eyes: 'open', brow: 0.3, tilt: 0, mouth: 'smirk', lookX: -0.6, lookY: 0 });
    return new Promise((res) => {
      gsap.to(R.root, { x: toX, duration: dur, ease: 'power1.out' });
      gsap.to(st, {
        t: 1, duration: dur, ease: 'none',
        onUpdate: () => {
          const ph = st.t * Math.PI * 2 * 3.5 * (dur / 1.4);
          const amp = 0.38 * (1 - Math.pow(st.t, 4));
          P.legL = Math.sin(ph) * amp + 0.02; P.legR = -Math.sin(ph) * amp - 0.02;
          P.jump = Math.abs(Math.cos(ph)) * 16 * (1 - st.t);
          P.lean = (fromX > toX ? -0.07 : 0.07) * (1 - st.t);
          P.lHand.x = -74 + Math.sin(ph) * 14; P.rHand.x = 78 + Math.sin(ph) * 14;
          if (Math.abs(Math.cos(ph)) > 0.97 && st.t < 0.95) { if (!st.lock) { st.lock = true; Audio2.play('step'); } } else st.lock = false;
        },
        onComplete: () => { idleOn = true; setFace({ lookX: 0, lookY: 0 }); rest(0.2); res(); }
      });
    });
  }

  function bounds() { return R.root.getBounds(); }
  function headGlobal() { return R.head.toGlobal(new PIXI.Point(0, -150)); }

  return { build, layout, update, act, stopAct, setFace, look, walkIn, bounds, headGlobal, R, P };
})();

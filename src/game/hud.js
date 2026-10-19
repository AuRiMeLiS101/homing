/* HUD inside the canvas: the win ticket, the chain rosette, the Race Day board and the big win show. */
const Hud = (function () {
  const C = {};
  let fontsOk = false;
  let winVal = 0;

  function installFonts() {
    try {
      PIXI.BitmapFont.install({ name: 'HNum', style: { fontFamily: 'IBM Plex Mono', fontWeight: '700', fontSize: 84, fill: '#F6ECD8', stroke: { color: '#1B1622', width: 12, join: 'round' } }, chars: [['0', '9'], ',.+×x '], resolution: 1.5, padding: 6 });
      PIXI.BitmapFont.install({ name: 'HNumY', style: { fontFamily: 'IBM Plex Mono', fontWeight: '700', fontSize: 96, fill: '#FFD23F', stroke: { color: '#1B1622', width: 14, join: 'round' } }, chars: [['0', '9'], ',.+×x '], resolution: 1.5, padding: 6 });
      fontsOk = true;
    } catch (e) { fontsOk = false; }
  }
  function num(str, yellow, size) {
    if (fontsOk) {
      const t = new PIXI.BitmapText({ text: str, style: { fontFamily: yellow ? 'HNumY' : 'HNum', fontSize: size } });
      t.anchor.set(0.5);
      return t;
    }
    return monoText(str, size, yellow ? '#FFD23F' : '#F6ECD8', { stroke: '#1B1622', strokeW: size * 0.14 });
  }

  function build(parent) {
    installFonts();
    C.root = new PIXI.Container(); parent.addChild(C.root);
    // win ticket: C.win holds position and fit, C.winPulse takes the slams and thumps
    C.win = new PIXI.Container(); C.root.addChild(C.win);
    C.winPulse = new PIXI.Container(); C.win.addChild(C.winPulse);
    C.winBanner = sprite(G.tex.bannerPink); C.winPulse.addChild(C.winBanner);
    C.winLabel = labelText('WIN', 20, '#1B1622'); C.winPulse.addChild(C.winLabel);
    C.winNum = num('0.00', false, 64); C.winPulse.addChild(C.winNum);
    C.win.visible = false;
    // chain rosette
    C.chain = new PIXI.Container(); C.root.addChild(C.chain); C.chain.visible = false;
    C.chainPulse = new PIXI.Container(); C.chain.addChild(C.chainPulse);
    C.chainRos = sprite(G.tex.rosette[0]); C.chainPulse.addChild(C.chainRos);
    C.chainLabel = labelText('CHAIN', 17, '#F6ECD8'); C.chainLabel.y = -42; C.chainPulse.addChild(C.chainLabel);
    C.chainNum = num('2', true, 84); C.chainNum.y = 10; C.chainPulse.addChild(C.chainNum);
    C.chainWord = new PIXI.Container(); C.chainWord.y = 122; C.chainPulse.addChild(C.chainWord);
    // race board
    C.race = new PIXI.Container(); C.root.addChild(C.race); C.race.visible = false;
    C.medal = sprite(G.tex.medal); C.race.addChild(C.medal);
    C.loftLabel = labelText('LOFT', 22, '#F6ECD8'); C.loftLabel.y = -62; C.race.addChild(C.loftLabel);
    C.mult = num('×1', true, 92); C.mult.y = 6; C.race.addChild(C.mult);
    C.spins = new PIXI.Container(); C.race.addChild(C.spins);
    C.spinsBanner = sprite(G.tex.bannerYellow); C.spins.addChild(C.spinsBanner);
    C.spinsText = stampText('SPIN 1 OF 10', 40, '#1B1622', { shadow: false });
    C.spinsText.style.stroke = { color: '#FFD23F', width: 1 };
    C.spins.addChild(C.spinsText);
    C.spins.y = 175;
    C.raceWinPlate = new PIXI.Graphics(); C.raceWinPlate.y = 238; C.race.addChild(C.raceWinPlate);
    C.raceWinText = labelText('RACE WIN 0.00', 22, '#F6ECD8'); C.raceWinText.y = 238; C.race.addChild(C.raceWinText);
    drawRaceWinPlate();
    // big win overlay
    C.big = new PIXI.Container(); G.layers.overlay.addChild(C.big); C.big.visible = false;
  }

  function layout() {
    const u = G.unit;
    // win ticket: pinned over the LOFT №9 sign in the gable, right above the grid
    const ls = G.loftScale;
    C.winBaseScale = Math.max(0.42, ls * 1.45);
    C.win.x = G.loftX;
    C.win.y = G.groundY - (HomingWorld.LOFT.h - 6 - 160) * ls;
    C.win.rotation = -0.035;
    C.winMaxW = G.loftW * 0.74;
    C.winBanner.width = 340; C.winBanner.height = 96;
    C.winLabel.x = -118; C.winLabel.y = 0; C.winLabel.rotation = -Math.PI / 2;
    C.winNum.x = 22; C.winNum.y = 2;
    fitTicket();
    // chain rosette: on the left slope of the roof, or top left in portrait
    if (G.portrait) { C.chainBase = Math.max(0.36, u * 0.5); C.chain.x = 16 + 112 * C.chainBase; C.chain.y = G.holdArea.y + G.holdArea.h * 0.62; }
    else {
      // just outside the left eave, level with the ticket, so the two never collide however long the number gets
      C.chainBase = Math.max(0.42, ls * 0.95);
      C.chain.x = G.loftX - G.loftW / 2 - 118 * C.chainBase; C.chain.y = C.win.y - 30 * ls;
    }
    C.chain.scale.set(C.chainBase);
    C.chainRos.width = C.chainRos.height = 220;
    // race board
    if (G.portrait) {
      // phones held upright: a row in the free strip under the loft, where the buy button sits outside Race Day.
      // The medal on the left, the spin count and the race win beside it, clear of Gennady's head on the right.
      C.spins.x = 350; C.spins.y = -46; C.spinsBase = 1.15; C.spins.scale.set(1.15);
      C.raceWinPlate.x = C.raceWinText.x = 350; C.raceWinPlate.y = C.raceWinText.y = 54; C.raceWinText.scale.set(1.35);
      const room = G.playH - G.groundY;
      const s = U.clamp(Math.min((G.W * 0.6 - 24) / 690, (room - 14) / 310), 0.24, 0.5);
      C.race.scale.set(s);
      C.race.x = 14 + 150 * s; C.race.y = G.groundY + room / 2 + 2;
    } else {
      C.spins.x = 0; C.spins.y = 175; C.spinsBase = 1; C.spins.scale.set(1);
      C.raceWinPlate.x = C.raceWinText.x = 0; C.raceWinPlate.y = C.raceWinText.y = 238; C.raceWinText.scale.set(1);
      // left of the loft, clear of the logo above and of the chain rosette by the eave (the two show together in a
      // Race Day cascade): try beside it, then under it, shrinking the board until one of them fits
      const cb = C.chainBase, rose = { l: C.chain.x - 190 * cb, r: C.chain.x + 190 * cb, t: C.chain.y - 112 * cb, b: C.chain.y + 160 * cb };
      const logoB = 18 + Math.min(120, G.H * 0.11);
      const box = (x, y, k) => ({ l: x - 160 * k, r: x + 160 * k, t: y - 150 * k, b: y + 262 * k });
      const hit = (q) => q.l < rose.r && q.r > rose.l && q.t < rose.b && q.b > rose.t;
      let k = Math.max(0.42, u * 0.85), x = 0, y = 0;
      for (let i = 0; i < 8; i++) {
        x = Math.max(14 + 160 * k, Math.min((G.loftX - G.loftW / 2) / 2, rose.l - 160 * k - 8));
        y = Math.max(logoB + 150 * k + 6, G.playH * 0.42);
        if (!hit(box(x, y, k)) && y + 262 * k <= G.playH - 6) break;
        const under = Math.max(y, rose.b + 150 * k + 8);
        if (under + 262 * k <= G.playH - 6 && !hit(box(x, under, k))) { y = under; break; }
        k *= 0.9;
      }
      C.race.scale.set(k); C.race.x = x; C.race.y = y;
    }
    C.medal.width = C.medal.height = 300;
    C.spinsBanner.width = 300; C.spinsBanner.height = 80;
    drawRaceWinPlate();
  }

  // ---------- win ticket ----------
  const roll = { v: 0, tw: null };
  function fitTicket() {
    const w = Math.max(180, C.winNum.width + 70);
    C.winBanner.width = w + 70; C.winLabel.x = -C.winBanner.width / 2 + 34;
    C.winNum.x = 22;
    // keep the ticket inside the gable: shrink it when the number grows
    const fit = Math.min(1, C.winMaxW / (C.winBanner.width * C.winBaseScale));
    C.win.scale.set(C.winBaseScale * fit);
  }
  function showVal(v) {
    C.winNum.text = U.fmt(v);
    fitTicket();
    UI.setWin(Math.round(v), true);
  }
  // the ticket drops in like a stamped stub the first time a round pays
  function slamIn() {
    C.win.visible = true; C.win.alpha = 1;
    gsap.killTweensOf(C.winPulse); gsap.killTweensOf(C.winPulse.scale);
    C.winPulse.scale.set(2.3); C.winPulse.rotation = -0.42; C.winPulse.alpha = 0;
    gsap.to(C.winPulse, { alpha: 1, duration: 0.05 });
    gsap.to(C.winPulse, { rotation: 0, duration: U.T(0.5), ease: 'elastic.out(1, 0.45)' });
    gsap.to(C.winPulse.scale, { x: 1, y: 1, duration: U.T(0.24), ease: 'power3.in', onComplete: () => {
      FX.shake(7, 0.84); FX.dust(C.win.x, C.win.y + 30 * C.win.scale.y, 10); Audio2.play('ticketSlam');
      gsap.fromTo(C.winPulse.scale, { x: 1.12, y: 0.86 }, { x: 1, y: 1, duration: 0.4, ease: 'elastic.out(1.1, 0.4)' });
    } });
  }
  function thump(big) {
    gsap.killTweensOf(C.winPulse.scale);
    const k = big ? 1.32 : 1.2;
    gsap.fromTo(C.winPulse.scale, { x: k, y: k }, { x: 1, y: 1, duration: 0.42, ease: 'back.out(3)' });
    const gp = C.win.toGlobal(new PIXI.Point(0, 0));
    FX.sparks(gp.x, gp.y, big ? 16 : 7, COL.YELLOW, big ? 0.9 : 0.5);
  }
  // Rolls the number up to the new total. Every value comes from the round result; only the counting is animated.
  // o: { dur, delay, big }
  function setWin(cents, pulse, o) {
    o = o || {};
    winVal = cents;
    if (!C.win.visible && cents > 0) slamIn();
    if (roll.tw) { roll.tw.kill(); roll.tw = null; }
    const from = roll.v, delta = cents - from;
    const bet = UI.bet();
    const dur = o.dur != null ? o.dur : (pulse && delta > 0 ? U.clamp(0.22 + 0.16 * Math.log2(1 + delta / bet), 0.22, 1.2) : 0);
    if (dur <= 0 || delta <= 0) { roll.v = cents; showVal(cents); if (pulse && cents > 0) thump(o.big); return; }
    let lastTick = 0;
    roll.tw = gsap.to(roll, {
      v: cents, duration: o.dur != null ? dur : U.T(dur), delay: o.delay || 0, ease: o.dur != null ? 'power1.out' : 'power2.out',
      onUpdate: () => {
        showVal(roll.v);
        const now = performance.now();
        if (now - lastTick > 60) { lastTick = now; Audio2.play('coinTick', { k: (roll.v - from) / delta }); }
      },
      onComplete: () => { roll.tw = null; roll.v = cents; showVal(cents); if (pulse) thump(o.big); }
    });
  }
  function hideWin() {
    if (roll.tw) { roll.tw.kill(); roll.tw = null; }
    roll.v = 0; winVal = 0;
    if (C.win.visible) gsap.to(C.win, { alpha: 0, duration: 0.2, onComplete: () => { C.win.visible = false; } });
  }
  function winPos() { return { x: C.win.x, y: C.win.y }; }

  // ---------- chain rosette ----------
  // Each cascade step in one spin climbs a rung: a new colour, a bigger slam, a louder chord.
  const WORDS = { 3: 'FLURRY', 4: 'FEATHER STORM', 5: 'ROOF RAISER', 6: 'BLOCK PARTY' };
  let chainN = 0;
  function chain(step) {
    if (step < 2) return;
    chainN = step;
    const B = C.chain, Pp = C.chainPulse;
    C.chainRos.texture = G.tex.rosette[Math.min(G.tex.rosette.length - 1, step - 2)];
    C.chainNum.text = String(step);
    C.chainWord.removeChildren().forEach((d) => d.destroy({ children: true }));
    const word = WORDS[Math.min(6, step)];
    if (word) {
      const ban = sprite(G.tex.bannerYellow); C.chainWord.addChild(ban);
      const t = stampText(word, 40, '#1B1622', { shadow: false }); t.style.stroke = { color: '#FFD23F', width: 1 };
      C.chainWord.addChild(t); ban.width = t.width + 50; ban.height = 66;
      C.chainWord.rotation = U.rand(-0.08, 0.08);
      gsap.fromTo(C.chainWord.scale, { x: 0, y: 0 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)', delay: 0.08 });
    }
    const first = !B.visible;
    B.visible = true; B.alpha = 1;
    gsap.killTweensOf(Pp.scale); gsap.killTweensOf(Pp);
    const k = 1 + Math.min(0.5, (step - 2) * 0.09);
    Pp.scale.set(first ? 0.2 : k * 1.7); Pp.rotation = U.rand(-0.5, 0.5);
    gsap.to(Pp.scale, { x: k, y: k, duration: 0.32, ease: 'back.out(2.6)' });
    gsap.to(Pp, { rotation: U.rand(-0.06, 0.06), duration: 0.5, ease: 'elastic.out(1, 0.4)' });
    const gp = B.toGlobal(new PIXI.Point(0, 0));
    FX.sparks(gp.x, gp.y, 8 + step * 3, step >= 4 ? COL.PINK : COL.YELLOW, 0.6 + step * 0.1);
    if (step >= 3) FX.feathers(gp.x, gp.y, 2 + step, { scale: G.unit + 0.1, power: 0.8 });
    FX.punch(Math.min(0.05, 0.006 + step * 0.006));
    Audio2.play('chain', { step });
  }
  function chainEnd() {
    if (!C.chain.visible) return;
    chainN = 0;
    const Pp = C.chainPulse;
    gsap.killTweensOf(Pp.scale);
    gsap.to(Pp.scale, { x: 0, y: 0, duration: 0.28, ease: 'back.in(2.4)', delay: 0.25, onComplete: () => { C.chain.visible = false; } });
  }

  // ---------- race board ----------
  function showRace(on) {
    if (on) {
      C.race.visible = true; C.race.alpha = 0;
      const s = C.race.scale.x;
      C.race.scale.set(s * 2);
      gsap.to(C.race, { alpha: 1, duration: 0.2 });
      gsap.to(C.race.scale, { x: s, y: s, duration: 0.5, ease: 'back.out(2)' });
    } else gsap.to(C.race, { alpha: 0, duration: 0.3, onComplete: () => { C.race.visible = false; } });
  }
  function setLoft(m, pop) {
    C.mult.text = '×' + Math.max(1, m);
    if (pop) {
      const s = C.medal.scale.x;
      gsap.fromTo(C.medal.scale, { x: s * 1.3, y: s * 1.3 }, { x: s, y: s, duration: 0.45, ease: 'elastic.out(1, 0.4)' });
      gsap.fromTo(C.mult.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.4, ease: 'back.out(3)' });
      const gp = C.race.toGlobal(new PIXI.Point(0, 0));
      FX.sparks(gp.x, gp.y, 18, COL.YELLOW, 1);
      FX.splat(gp.x, gp.y, COL.YELLOW, 1.4);
      FX.punch(0.02);
    }
  }
  function multPos() { return C.race.toGlobal(new PIXI.Point(0, 0)); }
  function setSpins(i, n) {
    C.spinsText.text = `SPIN ${i} OF ${n}`;
    C.spinsBanner.width = C.spinsText.width + 60;
    const b = C.spinsBase || 1;
    gsap.fromTo(C.spins.scale, { x: b * 1.2, y: b * 1.2 }, { x: b, y: b, duration: 0.3, ease: 'back.out(3)' });
  }
  function drawRaceWinPlate() {
    const w = C.raceWinText.width + 40, h = C.raceWinText.height + 16;
    C.raceWinPlate.clear()
      .roundRect(-w / 2 + 5, -h / 2 + 5, w, h, 10).fill({ color: COL.INK, alpha: 0.9 })
      .roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: COL.VIOLETD }).stroke({ width: 3, color: COL.INK });
  }
  function setRaceWin(c) { C.raceWinText.text = 'RACE WIN ' + U.fmt(c); drawRaceWinPlate(); }

  // ---------- big win show ----------
  const TIERS = [
    { x: 15, name: 'BIG WIN', color: '#FFD23F', burst: [0xFF4FA3, 0xFF6A2B] },
    { x: 50, name: 'HUGE WIN', color: '#FF4FA3', burst: [0xFFD23F, 0xFF4FA3] },
    { x: 150, name: 'LOFT LEGEND', color: '#46B9B1', burst: [0x46B9B1, 0xFFD23F] },
    { x: 500, name: 'CHAMPION OF THE BLOCK', color: '#FF6A2B', burst: [0xFF4FA3, 0xFFD23F, 0x46B9B1, 0xFF6A2B, 0x8C72C9] }
  ];
  let bigTier = -1;
  function tierFor(x) { let t = -1; TIERS.forEach((tt, i) => { if (x >= tt.x) t = i; }); return t; }

  // The beat before the show: time slows, the band drops under water, a heartbeat, then the slam.
  async function beat() {
    if (G.reduced) return;
    Audio2.slowmo(true);
    Gennady.act('gasp');
    FX.zoomBlur(G.W / 2, (G.playH || G.H) * 0.45, 0.09, 0.8);
    FX.adjust(true, { saturation: 0.3, brightness: 0.82, contrast: 1.15 });
    await FX.slowmo(0.62, 0.14);
    FX.adjust(false);
    Audio2.slowmo(false);
  }

  function bigWin(cents, bet, title) {
    const x = cents / bet;
    const top = tierFor(x);
    if (top < 0 && !title) return Promise.resolve(false);
    return beat().then(() => show(cents, bet, title, top));
  }

  function show(cents, bet, title, top) {
    return new Promise((resolve) => {
      const B = C.big; B.visible = true; B.removeChildren().forEach((d) => d.destroy({ children: true }));
      B.alpha = 1;
      UI.showtime(true);
      const W = G.W, H = G.H, PH = G.playH || H;
      FX.flash(COL.PAPER, 0.55, 0.35);
      FX.shock(W / 2, PH * 0.45, { amp: 40, wave: 260, dur: 1.1 });
      FX.shake(18, 0.86);
      const dim = new PIXI.Graphics().rect(-40, -40, W + 80, H + 80).fill({ color: 0x120C1E, alpha: 0.62 });
      B.addChild(dim); dim.alpha = 0; gsap.to(dim, { alpha: 1, duration: 0.25 });
      const cx = W / 2, cy = H * (G.portrait ? 0.36 : 0.42);
      const burstC = new PIXI.Container(); B.addChild(burstC);
      let sb = FX.sunburst(burstC, cx, cy, Math.hypot(W, H) * 0.7, TIERS[Math.max(0, top)].burst, 28, 0.35);
      burstC.alpha = 0; gsap.to(burstC, { alpha: 0.5, duration: 0.5 });
      const fxL = new PIXI.Container(); B.addChild(fxL);
      // Gennady acts above the dim so his show is not lost in the shade
      const gl = G.layers.gennady, gParent = gl.parent, gIdx = gParent.getChildIndex(gl);
      B.addChild(gl);
      Gennady.stage(true);
      const value = num('0.00', true, 150);
      const vBase = Math.max(0.5, G.unit * 0.9);
      value.x = cx; value.y = cy + 120 * G.unit; value.scale.set(vBase);
      B.addChild(value);
      // the hint sits on an ink pill so it reads over the busiest moment
      const hintC = new PIXI.Container(); hintC.x = cx; hintC.y = Math.min(PH - 30, cy + 250 * G.unit); B.addChild(hintC);
      const hintBg = new PIXI.Graphics(); hintC.addChild(hintBg);
      const hint = labelText('TAP TO SKIP', 15, '#F6ECD8'); hintC.addChild(hint);
      const setHint = (t) => { hint.text = t; const w = hint.width + 34, h = 34; hintBg.clear().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: COL.INK, alpha: 0.82 }).stroke({ width: 2, color: COL.PAPER, alpha: 0.5 }); };
      setHint('TAP TO SKIP');
      hintC.scale.set(Math.max(0.8, G.unit));
      Audio2.victoryLevel(0);
      Audio2.music('victory');
      let tierShown = -2, titleC = null;
      bigTier = -1;
      const timers = [];
      const later = (ms, fn) => timers.push(setTimeout(fn, ms));
      const showTier = (i, name, color) => {
        bigTier = i;
        if (titleC) { const old = titleC; gsap.to(old, { alpha: 0, duration: 0.15, onComplete: () => old.destroy({ children: true }) }); }
        titleC = new PIXI.Container(); titleC.x = cx; titleC.y = cy - 40 * G.unit; B.addChild(titleC);
        const ban = sprite(G.tex.bannerPaper); titleC.addChild(ban);
        const t = stampText(name, 150, color, {});
        const maxW = W * 0.9;
        const sc = Math.min(Math.max(0.42, G.unit * (0.9 + Math.max(0, i) * 0.06)), maxW / (t.width + 120));
        titleC.addChild(t);
        ban.width = t.width + 100; ban.height = t.height * 1.0;
        titleC.scale.set(sc * 2.8); titleC.rotation = U.rand(-0.06, 0.06);
        gsap.to(titleC.scale, { x: sc, y: sc, duration: 0.34, ease: 'back.out(2.2)' });
        // the number grows a step with each tier
        gsap.to(value.scale, { x: vBase * (1 + Math.max(0, i) * 0.12), y: vBase * (1 + Math.max(0, i) * 0.12), duration: 0.4, ease: 'back.out(3)' });
        if (i >= 0) { sb.destroy(); sb = FX.sunburst(burstC, cx, cy, Math.hypot(W, H) * 0.7, TIERS[i].burst, 28, 0.35 + i * 0.12); }
        FX.impact(cx, cy, 1.3 + Math.max(0, i) * 0.2);
        FX.punch(0.05 + Math.max(0, i) * 0.025);
        FX.confetti(cx, cy, 40 + Math.max(0, i) * 20, null, 1.2, fxL);
        FX.feathers(cx, cy, 18 + Math.max(0, i) * 6, { scale: G.unit + 0.4, power: 1.6, layer: fxL });
        FX.coinFountain(cx, value.y, 10 + Math.max(0, i) * 8, 1 + Math.max(0, i) * 0.1, fxL);
        Audio2.play('tierUp', { tier: Math.max(0, i) });
        Audio2.victoryLevel(Math.max(0, i));
        if (i >= 0) Gennady.bigWin(i);
        // HUGE: confetti cannons from both bottom corners, the neighbours lean out
        if (i >= 1) {
          FX.cannon(-10, PH + 10, -Math.PI * 0.32, 46 + i * 8, 1.05, fxL);
          FX.cannon(W + 10, PH + 10, -Math.PI * 0.68, 46 + i * 8, 1.05, fxL);
          World.cheer(true, 8);
          Audio2.play('crowd');
        }
        // LOFT LEGEND: the whole flock sweeps across, birds shave the lens, the camera pushes in
        if (i >= 2) {
          Flight.flockPass(fxL, { n: 14 + (i - 2) * 8, dir: Math.random() < 0.5 ? 1 : -1 });
          for (let k = 0; k < i; k++) later(300 + k * 220, () => Flight.nearMiss({ dir: k % 2 ? -1 : 1, silent: k > 0 }));
          FX.camTo(1.05, U.rand(-0.012, 0.012), 1.6, 'power1.out');
        }
        // CHAMPION OF THE BLOCK: speed lines, every window lit, a firework barrage and the block chanting
        if (i === 3) { FX.speed(true); World.lightsUp(true); Audio2.play('chant'); }
      };
      Audio2.play('fanfare');
      const dur = [2.6, 3.8, 5.0, 6.4][Math.max(0, top)] / (G.turbo ? 1.6 : 1);
      const st = { v: 0 };
      let skipped = false, done = false, tickAcc = 0;
      // showers that scale with the tier on screen
      const rain = setInterval(() => {
        const t = Math.max(0, tierShown);
        FX.coinRain(1 + t, null, fxL);
        if (Math.random() < 0.18 + t * 0.14) FX.rocket(U.rand(0.1, 0.9) * W, U.rand(0.08, 0.36) * PH, U.pick([COL.PINK, COL.YELLOW, COL.TEALL, COL.ORANGE]), U.pick(['ring', 'palm', 'crackle']), fxL);
      }, 150);
      const finish = () => {
        if (done) return; done = true;
        clearInterval(rain);
        value.text = U.fmt(cents);
        setHint('TAP TO COLLECT');
        gsap.fromTo(hintC.scale, { x: hintC.scale.x * 1.3, y: hintC.scale.y * 1.3 }, { x: hintC.scale.x, y: hintC.scale.y, duration: 0.4, ease: 'back.out(3)' });
        Audio2.play('collect');
        gsap.fromTo(value.scale, { x: value.scale.x * 1.25, y: value.scale.y * 1.25 }, { x: value.scale.x, y: value.scale.y, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
        let ended = false;
        const end = () => {
          if (ended) return; ended = true;
          window.removeEventListener('pointerdown', end);
          timers.forEach(clearTimeout);
          FX.speed(false); FX.camReset(0.6); World.lightsUp(false);
          // coins pour from the total into the ticket on the gable
          const wp = winPos();
          for (let k = 0; k < 10; k++) FX.coinFly(value.x + U.rand(-80, 80) * G.unit, value.y, wp.x, wp.y, { delay: k * 0.04, dur: U.rand(0.45, 0.6), layer: G.layers.overlay, onArrive: k === 9 ? () => Audio2.play('kaching') : null });
          // Gennady goes back to his own layer straight away, the shade fades on its own
          gParent.addChildAt(gl, Math.min(gIdx, gParent.children.length));
          gsap.to(B, { alpha: 0, duration: 0.35, onComplete: () => {
            sb.destroy();
            FX.dropLayer(fxL); Flight.dropLayer(fxL);
            B.removeChildren().forEach((d) => d.destroy({ children: true })); B.visible = false;
          } });
          // after the race winnings the base track comes back, otherwise whatever was playing before the show
          Audio2.music(G.mode === 'race' && !title ? 'race' : 'base');
          Gennady.stopAct();
          Gennady.stage(false);
          UI.showtime(false);
          World.cheer(true, 3.2);
          resolve(true);
        };
        later(skipped ? 900 : 1700, end);
        setTimeout(() => window.addEventListener('pointerdown', end), 350);
      };
      const onTap = () => {
        if (!skipped && !done) {
          skipped = true; window.removeEventListener('pointerdown', onTap);
          gsap.killTweensOf(st); st.v = cents; upd();
          if (top > tierShown) { showTier(top, title || TIERS[top].name, TIERS[top].color); tierShown = top; }
          finish();
        }
      };
      const upd = () => {
        value.text = U.fmt(st.v);
        const t = tierFor(st.v / bet);
        if (t > tierShown && t >= 0) { tierShown = t; showTier(t, TIERS[t].name, TIERS[t].color); }
        tickAcc++;
        if (tickAcc % 2 === 0) Audio2.play('count', { k: st.v / Math.max(1, cents) });
      };
      if (title) { showTier(Math.max(0, top), title, '#FFD23F'); tierShown = Math.max(0, top); }
      setTimeout(() => { if (!done) window.addEventListener('pointerdown', onTap); }, 250);
      gsap.to(st, { v: cents, duration: dur, ease: 'power1.inOut', onUpdate: upd, onComplete: () => { window.removeEventListener('pointerdown', onTap); finish(); } });
    });
  }

  return { build, layout, setWin, hideWin, winPos, chain, chainEnd, showRace, setLoft, setSpins, setRaceWin, multPos, bigWin, tierFor, C, get winVal() { return winVal; }, get chainN() { return chainN; }, get bigTier() { return bigTier; } };
})();

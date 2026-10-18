/* HUD inside the canvas: win meter, Race Day board, big win show. */
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
    // win meter
    C.win = new PIXI.Container(); C.root.addChild(C.win);
    C.winBanner = sprite(G.tex.bannerPink); C.win.addChild(C.winBanner);
    C.winLabel = labelText('WIN', 20, '#1B1622'); C.win.addChild(C.winLabel);
    C.winNum = num('0.00', false, 64); C.win.addChild(C.winNum);
    C.win.visible = false;
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
    // win meter: a ticket pinned over the LOFT №9 sign in the gable, right above the grid
    const ls = G.loftScale;
    C.winBaseScale = Math.max(0.42, ls * 1.45);
    C.win.scale.set(C.winBaseScale);
    C.win.x = G.loftX;
    C.win.y = G.groundY - (HomingWorld.LOFT.h - 6 - 160) * ls;
    C.win.rotation = -0.035;
    C.winMaxW = G.loftW * 0.74;
    C.winBanner.width = 340; C.winBanner.height = 96;
    C.winLabel.x = -118; C.winLabel.y = 0; C.winLabel.rotation = -Math.PI / 2;
    C.winNum.x = 22; C.winNum.y = 2;
    // race board
    if (G.portrait) { C.race.scale.set(Math.max(0.42, u * 0.62)); C.race.x = G.W - 96 * C.race.scale.x - 10; C.race.y = G.holdArea.y + G.holdArea.h * 0.48; C.spins.visible = true; }
    else { C.race.scale.set(Math.max(0.5, u * 0.85)); C.race.x = Math.max(150 * C.race.scale.x, (G.loftX - G.loftW / 2) / 2); C.race.y = G.playH * 0.42; }
    C.medal.width = C.medal.height = 300;
    C.spinsBanner.width = 300; C.spinsBanner.height = 80;
  }

  function setWin(cents, pulse) {
    winVal = cents;
    C.winNum.text = U.fmt(cents);
    const w = Math.max(180, C.winNum.width + 70);
    C.winBanner.width = w + 70; C.winLabel.x = -C.winBanner.width / 2 + 34;
    C.winNum.x = 22;
    // keep the ticket inside the gable: shrink it when the number grows
    const fit = Math.min(1, C.winMaxW / (C.winBanner.width * C.winBaseScale));
    gsap.killTweensOf(C.win.scale);
    C.win.scale.set(C.winBaseScale * fit);
    if (!C.win.visible && cents > 0) {
      C.win.visible = true; C.win.alpha = 0;
      gsap.to(C.win, { alpha: 1, duration: 0.15 });
      gsap.fromTo(C.win, { rotation: -0.3 }, { rotation: -0.035, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    }
    if (pulse) { const s = C.win.scale.x; gsap.fromTo(C.win.scale, { x: s * 1.18, y: s * 1.18 }, { x: s, y: s, duration: 0.35, ease: 'back.out(3)' }); }
    UI.setWin(cents, true);
  }
  function hideWin() { if (C.win.visible) gsap.to(C.win, { alpha: 0, duration: 0.2, onComplete: () => { C.win.visible = false; } }); winVal = 0; }
  function winPos() { return { x: C.win.x, y: C.win.y }; }

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
    }
  }
  function multPos() { return C.race.toGlobal(new PIXI.Point(0, 0)); }
  function setSpins(i, n) {
    C.spinsText.text = `SPIN ${i} OF ${n}`;
    C.spinsBanner.width = C.spinsText.width + 60;
    gsap.fromTo(C.spins.scale, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
  }
  function drawRaceWinPlate() {
    const w = C.raceWinText.width + 40, h = C.raceWinText.height + 16;
    C.raceWinPlate.clear()
      .roundRect(-w / 2 + 5, -h / 2 + 5, w, h, 10).fill({ color: COL.INK, alpha: 0.9 })
      .roundRect(-w / 2, -h / 2, w, h, 10).fill({ color: COL.VIOLETD }).stroke({ width: 3, color: COL.INK });
  }
  function setRaceWin(c) { C.raceWinText.text = 'RACE WIN ' + U.fmt(c); drawRaceWinPlate(); }

  // ---------- big win ----------
  const TIERS = [
    { x: 15, name: 'BIG WIN', color: '#FFD23F' },
    { x: 50, name: 'HUGE WIN', color: '#FF4FA3' },
    { x: 150, name: 'LOFT LEGEND', color: '#46B9B1' },
    { x: 500, name: 'CHAMPION OF THE BLOCK', color: '#FF6A2B' }
  ];
  function tierFor(x) { let t = -1; TIERS.forEach((tt, i) => { if (x >= tt.x) t = i; }); return t; }

  function bigWin(cents, bet, title) {
    const x = cents / bet;
    const top = tierFor(x);
    if (top < 0 && !title) return Promise.resolve(false);
    return new Promise((resolve) => {
      const B = C.big; B.visible = true; B.removeChildren().forEach((d) => d.destroy({ children: true }));
      B.alpha = 1;
      const dim = new PIXI.Graphics().rect(0, 0, G.W, G.H).fill({ color: 0x120C1E, alpha: 0.72 });
      B.addChild(dim); dim.alpha = 0; gsap.to(dim, { alpha: 1, duration: 0.3 });
      const cx = G.W / 2, cy = G.H * (G.portrait ? 0.4 : 0.44);
      const burstC = new PIXI.Container(); B.addChild(burstC);
      const sb = FX.sunburst(burstC, cx, cy, Math.hypot(G.W, G.H) * 0.7, [0xFF4FA3, 0xFF6A2B], 28, 0.35);
      burstC.alpha = 0; gsap.to(burstC, { alpha: 0.55, duration: 0.5 });
      const value = num('0.00', true, 150);
      value.x = cx; value.y = cy + 120 * G.unit; value.scale.set(Math.max(0.5, G.unit * 0.9));
      B.addChild(value);
      const hint = labelText('TAP TO SKIP', 16, '#F6ECD8'); hint.x = cx; hint.y = Math.min(G.playH - 30, cy + 240 * G.unit); B.addChild(hint);
      hint.alpha = 0.7;
      let tierShown = -2, titleC = null;
      const showTier = (i, name, color) => {
        if (titleC) { const old = titleC; gsap.to(old, { alpha: 0, duration: 0.15, onComplete: () => old.destroy({ children: true }) }); }
        titleC = new PIXI.Container(); titleC.x = cx; titleC.y = cy - 40 * G.unit; B.addChild(titleC);
        const ban = sprite(G.tex.bannerPaper); titleC.addChild(ban);
        const t = stampText(name, 150, color, {});
        const maxW = G.W * 0.9;
        const sc = Math.min(Math.max(0.42, G.unit * 0.9), maxW / (t.width + 120));
        titleC.addChild(t);
        ban.width = t.width + 100; ban.height = t.height * 1.0;
        titleC.scale.set(sc * 2.6); titleC.rotation = U.rand(-0.06, 0.06);
        gsap.to(titleC.scale, { x: sc, y: sc, duration: 0.35, ease: 'back.out(2.2)' });
        FX.impact(cx, cy, 1.4);
        FX.confetti(cx, cy, 60, null, 1.2);
        FX.feathers(cx, cy, 30, { scale: G.unit + 0.4, power: 1.6 });
        Audio2.play(i >= 1 ? 'stampMajor' : 'stamp');
        if (i >= 0) Gennady.bigWin(i);
        if (i === 3) FX.speed(true);
      };
      Audio2.duck(0.12);
      Audio2.play('fanfare');
      const dur = [2.6, 3.8, 5.0, 6.4][Math.max(0, top)] / (G.turbo ? 1.6 : 1);
      const st = { v: 0 };
      let skipped = false, done = false, tickAcc = 0;
      const rain = setInterval(() => { FX.coinRain(3); }, 140);
      const finish = () => {
        if (done) return; done = true;
        clearInterval(rain);
        value.text = U.fmt(cents);
        hint.text = 'TAP TO COLLECT';
        Audio2.play('collect');
        const end = () => {
          window.removeEventListener('pointerdown', onTap);
          FX.speed(false);
          gsap.to(B, { alpha: 0, duration: 0.35, onComplete: () => { sb.destroy(); B.removeChildren().forEach((d) => d.destroy({ children: true })); B.visible = false; } });
          Audio2.unduck();
          Gennady.stopAct();
          World.cheer(true, 3.2);
          resolve(true);
        };
        setTimeout(end, skipped ? 900 : 1600);
      };
      const onTap = () => {
        if (!skipped && !done) { skipped = true; gsap.killTweensOf(st); st.v = cents; upd(); if (top > tierShown) { showTier(top, title || TIERS[top].name, TIERS[top].color); tierShown = top; } finish(); }
      };
      const upd = () => {
        value.text = U.fmt(st.v);
        const t = tierFor(st.v / bet);
        if (t > tierShown && t >= 0) { tierShown = t; showTier(t, TIERS[t].name, TIERS[t].color); }
        tickAcc++;
        if (tickAcc % 2 === 0) Audio2.play('count', { k: st.v / Math.max(1, cents) });
      };
      if (title) { showTier(Math.max(0, top), title, '#FFD23F'); tierShown = Math.max(0, top); }
      setTimeout(() => window.addEventListener('pointerdown', onTap), 250);
      gsap.to(st, { v: cents, duration: dur, ease: 'power1.inOut', onUpdate: upd, onComplete: finish });
    });
  }

  return { build, layout, setWin, hideWin, winPos, showRace, setLoft, setSpins, setRaceWin, multPos, bigWin, tierFor, C, get winVal() { return winVal; } };
})();

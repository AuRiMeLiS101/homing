/* Homing: boot, layout and the game flow. */
(function () {
  const L = HomingWorld.LOFT;
  const STATS = [
    ['95.9%', 'Return to player, base game (30M simulated spins)'],
    ['96.3%', 'Return to player, bonus buy (2M simulated bonuses)'],
    ['1 in 2.9', 'Spins with a win'],
    ['1 in 194', 'Spins that start Race Day'],
    ['66×', 'Average Race Day pay'],
    ['5,000×', 'Max win per round'],
    ['High', 'Volatility']
  ];
  let engine = null;
  const S = { balance: 100000, busy: false, auto: 0, round: 0, autoRules: { win: 50, loss: 0 }, autoFrom: 0 };
  let logo = null;

  // ---------- layout ----------
  function layout() {
    const W = window.innerWidth, H = window.innerHeight;
    G.W = W; G.H = H;
    const bar = document.getElementById('bar');
    const wasHidden = bar.hidden;
    if (wasHidden) { bar.style.visibility = 'hidden'; bar.hidden = false; }
    G.uiH = bar.getBoundingClientRect().height;
    if (wasHidden) { bar.hidden = true; bar.style.visibility = ''; }
    G.playH = H - G.uiH;
    G.portrait = W / H < 1.15;
    G.unit = U.clamp(Math.min(W, H) / 900, 0.42, 1.3);
    if (!G.portrait) {
      const holdH = G.playH * 0.2;
      G.loftScale = Math.min((G.playH - holdH) / L.h, (W * 0.48) / L.w);
      G.loftW = L.w * G.loftScale;
      G.loftX = W * 0.5;
      G.groundY = G.playH - 2;
      // racers circle above the ridge, clear of the win ticket on the gable
      const hy = Math.min(26, G.playH * 0.03);
      G.holdArea = { x: G.loftX - G.loftW * 0.62, y: hy, w: G.loftW * 1.24, h: Math.max(holdH, G.groundY - L.h * G.loftScale - hy + 40 * G.loftScale) };
      G.horizonY = G.groundY - G.playH * 0.22;
      // he needs about 0.36 of his height either side of his centre once his arms go out. On squarer screens the
      // loft slides left first (never under the buy badge), and only then does he get smaller
      const HALF = 0.36, need = (h) => h * HALF * 2 + 18;
      let gh = G.playH * 0.66, space = W - (G.loftX + G.loftW / 2);
      if (space < need(gh)) {
        const buy = document.getElementById('buy').getBoundingClientRect();
        const reserve = (buy.width ? buy.right : 140) + 16;
        const slide = Math.max(0, Math.min(G.loftX - G.loftW / 2 - reserve, need(gh) - space));
        G.loftX -= slide; space += slide;
        G.holdArea.x = G.loftX - G.loftW * 0.62;
        if (space < need(gh)) gh = Math.max(G.playH * 0.4, (space - 18) / (HALF * 2));
      }
      const right = G.loftX + G.loftW / 2;
      const gx = right + space * 0.5;
      G.genSpan = { x0: gx - gh * HALF, x1: gx + gh * HALF };
      // the round spin button rises above the strip; if it would cover his slippers he steps up onto a seed crate
      // measured against the strip itself, so its slide in animation does not hide the overlap
      const sr = document.getElementById('spin').getBoundingClientRect(), brt = bar.getBoundingClientRect().top;
      const rise = brt - sr.top;
      const lift = sr.width && rise > 0 && gx + gh * 0.24 > sr.left ? rise + 6 : 0;
      // without a crate he stands on the roof line with his slippers in view (soles reach 26 rig units below the origin)
      Gennady.layout(gx, lift ? G.groundY + 4 - lift : G.groundY + 2 - gh * 0.026, gh, { crate: lift, animate: G.camReady });
    } else {
      const top = Math.max(60, G.playH * 0.085);
      const holdH = Math.max(90, G.playH * 0.15);
      const minBelow = Math.max(110, G.playH * 0.16);
      G.loftScale = Math.min((W * 0.98) / L.w, (G.playH - top - holdH - minBelow) / L.h);
      G.loftW = L.w * G.loftScale;
      G.loftX = W / 2;
      // the loft sits as low as the space under it allows, so any height to spare goes to the sky above the roof,
      // where Gennady leans over it and the racers circle
      G.groundY = Math.max(top + holdH + L.h * G.loftScale, G.playH - minBelow);
      G.holdArea = { x: 0, y: top - 10, w: W, h: G.groundY - L.h * G.loftScale - top + 10 + 50 * G.loftScale };
      G.horizonY = G.groundY - G.playH * 0.16;
      // he stands behind his loft and leans over the roof: head and shoulders show above the right slope, and
      // whatever he raises or throws. The loft hides the rest of him, so nothing is cut by the strip or the edges
      const loftTop = G.groundY - L.h * G.loftScale, lx0 = G.loftX - G.loftW / 2;
      const X = (x) => lx0 + x * G.loftScale, Y = (y) => loftTop + y * G.loftScale;
      const xl = L.w * 0.8, roofY = Y(6 + (xl - 561) * (208 / 565));
      // as tall as the loft suggests, with his cap clear of the buttons in the corner
      const tb = document.getElementById('topbtns').getBoundingClientRect();
      const capLimit = (tb.height ? tb.bottom : 58) + 8;
      const sc = Math.max(0.1, Math.min((L.h * G.loftScale * 0.8) / 980, (roofY - capLimit) / 520));
      G.genSpan = null;
      Gennady.layout(X(xl), roofY + 470 * sc, sc * 980, {
        occlude: [-400, -3000, W + 400, -3000, W + 400, G.H + 400, X(L.w + 4), G.H + 400, X(L.w + 4), Y(214), X(561), Y(6), X(-4), Y(214), X(-4), G.H + 400, -400, G.H + 400]
      });
    }
    World.layout();
    Loft.layout();
    Hud.layout();
    Flight.relayout();
    if (logo) {
      const sz = G.portrait ? Math.min(60, W * 0.13) : Math.min(120, G.H * 0.11);
      logo.scale.set((sz * 3.05) / logo.texture.width);
      logo.x = (G.portrait ? 10 : 14) + logo.width / 2; logo.y = 6 + logo.height / 2;
    }
  }

  // ---------- boot ----------
  async function boot() {
    const startBig = document.getElementById('startBig'), startSmall = document.getElementById('startSmall'), startBtn = document.getElementById('startBtn');
    const fontsP = Promise.race([
      Promise.all(['900 40px "Big Shoulders Stencil"', '800 20px "Archivo"', '700 20px "IBM Plex Mono"'].map((f) => document.fonts.load(f))),
      U.waitReal(3500)
    ]).catch(() => {});
    await fontsP;
    gsap.registerPlugin(MotionPathPlugin);
    const app = new PIXI.Application();
    await app.init({ resizeTo: window, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio || 1, 2), background: '#241D45', preference: 'webgl' });
    G.app = app;
    document.getElementById('stage').appendChild(app.canvas);
    let cardsDone = false;
    await buildTextures((p) => {
      startSmall.textContent = Math.round(p * 100) + '%';
      const sc = G.tex.symCanvas;
      if (!cardsDone && sc && sc.CLOCK && sc.GENA && sc.BIRD) {
        cardsDone = true;
        [['cardBird', 'BIRD'], ['cardClock', 'CLOCK'], ['cardGena', 'GENA']].forEach(([id, k], i) => {
          const img = document.getElementById(id);
          if (!img) return;
          img.src = sc[k].toDataURL('image/png');
          setTimeout(() => img.classList.add('ready'), 120 * i);
        });
      }
    });
    // layers
    const root = new PIXI.Container(); app.stage.addChild(root);
    const cam = new PIXI.Container(); root.addChild(cam);
    const world = new PIXI.Container(); cam.addChild(world);
    const loftL = new PIXI.Container(); cam.addChild(loftL);
    const genL = new PIXI.Container(); cam.addChild(genL);
    const flyers = new PIXI.Container(); cam.addChild(flyers);
    const flightL = new PIXI.Container(); cam.addChild(flightL);
    const fx = new PIXI.Container(); cam.addChild(fx);
    const hud = new PIXI.Container(); cam.addChild(hud);
    const overlay = new PIXI.Container(); app.stage.addChild(overlay);
    G.layers = { root, cam, world, loft: loftL, gennady: genL, flyers, flight: flightL, fx, hud, overlay };
    World.build(world);
    FX.init(root, fx, G.layers.fxBack);
    Loft.build(loftL);
    Gennady.build(genL);
    Flight.build(flightL);
    Hud.build(hud);
    // the painted lockup, drawn at the screen's density and mipmapped for the small corner size
    logo = new PIXI.Sprite(texFrom(HomingWorld.logo(Math.min(2, window.devicePixelRatio || 1) * 0.5), true));
    logo.anchor.set(0.5);
    hud.addChild(logo); logo.visible = false;
    const qs = new URLSearchParams(location.search);
    // test harness only: slow software renderers would otherwise stretch every tween by gsap's lag smoothing
    if (qs.get('fast')) { gsap.ticker.lagSmoothing(0); G.fastTest = true; }
    if (qs.get('test') === 'birds') { HOMING_CONFIG.weights.base.BIRD = 8; HOMING_CONFIG.flockChance = 0.25; }
    if (qs.get('test') === 'race') { HOMING_CONFIG.weights.base.CLOCK = 30; }
    G.test = qs.get('test');
    engine = HomingEngine.createEngine(HOMING_CONFIG, HomingEngine.secureRng());
    // test harness only: lets a script reach the round state (for example to bring birds home on the next spin)
    if (G.fastTest) window.__homing = { engine, S, setEngine: (e) => { engine = e; window.__homing.engine = e; } };
    UI.init({ spin: onSpinButton, buy: () => run(() => playRound({ buy: true })), autoStart, autoStop, turbo: (on) => { G.turbo = on; G.speed = on ? 2.4 : 1; }, refill, sound: (on) => { Audio2.setMuted(!on); try { localStorage.setItem('homing-sound', on ? '1' : '0'); } catch (e) { /* storage unavailable */ } }, betChanged: () => {} });
    UI.buildInfo(STATS);
    let soundOn = true;
    try { soundOn = localStorage.getItem('homing-sound') !== '0'; } catch (e) { /* storage unavailable */ }
    document.getElementById('soundBtn').setAttribute('aria-pressed', soundOn);
    // restore after a republish
    const hot = window.claude && window.claude.hot;
    const restore = (data) => {
      if (data && typeof data.balance === 'number') { S.balance = data.balance; if (data.betIdx != null) UI.S.betIdx = data.betIdx; if (data.engine) engine.setState(data.engine); }
    };
    if (hot && hot.ready) hot.ready((d) => restore(d)); else restore(hot && hot.data);
    if (hot && hot.snapshot) { try { hot.snapshot(() => ({ balance: S.balance, betIdx: UI.S.betIdx, engine: engine.getState() })); } catch (e) { /* ignore */ } }
    UI.setBalance(S.balance);
    layout();
    const first = HomingEngine.createEngine(HOMING_CONFIG, HomingEngine.secureRng());
    Loft.setGrid(firstGrid(first));
    const tick = (deltaMS) => {
      const real = Math.min(G.fastTest ? 400 : 50, deltaMS);
      // slow motion beats scale game time; gsap follows inside FX.timeTick
      FX.timeTick(real);
      const dt = real * G.timeScale;
      G.ftEma = G.ftEma ? G.ftEma * 0.95 + deltaMS * 0.05 : deltaMS;
      window.__homingFps = Math.round(1000 / G.ftEma);
      G.time += dt / 1000; G.dtLast = dt;
      G.boilT = (G.boilT || 0) + dt;
      if (G.boilT > 130) { G.boilT = 0; G.boil = (G.boil + 1) % 3; }
      World.update(dt); FX.update(dt); Loft.boilTick(dt); Gennady.update(dt); Flight.update(); Intro.update();
      idle(dt);
    };
    app.ticker.add((t) => tick(t.deltaMS));
    // test harness only: step a frozen game by hand, so a fleeting moment can be framed exactly
    if (G.fastTest) G.step = (sec, fps) => { const n = Math.max(1, Math.round(sec * (fps || 30))), d = sec / n; for (let i = 0; i < n; i++) { gsap.globalTimeline.time(gsap.globalTimeline.time() + d * G.timeScale, false); tick(d * 1000); } app.render(); };
    window.addEventListener('resize', () => { layout(); });
    app.canvas.addEventListener('pointerdown', () => { if (S.busy) G.hurry = true; });
    startBig.textContent = 'PUNCH YOUR TICKET';
    startSmall.textContent = 'TAP TO START · SOUND ON';
    startBtn.disabled = false;
    startBtn.focus({ preventScroll: true });
    await new Promise((res) => startBtn.addEventListener('click', res, { once: true }));
    startBtn.disabled = true;
    try { await Audio2.init(); } catch (e) { /* no audio */ }
    Audio2.setMuted(!soundOn);
    Audio2.play('punch');
    const st = document.getElementById('start');
    st.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.08)' }], { duration: 450, easing: 'ease-in' }).onfinish = () => { st.hidden = true; };
    await U.waitReal(250);
    layout();
    if (engine.state.flight.length) Flight.syncFromState(engine.state.flight);
    await Intro.play();
    G.camReady = true;
    logo.visible = true; logo.alpha = 0; gsap.to(logo, { alpha: 1, duration: 0.4 });
    UI.showBar();
    layout();
    Audio2.music('base');
    Audio2.ambience(0.35);
    window.__homingReady = true;
  }

  function firstGrid(eng) {
    const r = eng.playRound(100);
    const d = r.events.find((e) => e.t === 'drop');
    return d ? d.grid.map((col) => col.map((s) => (s === 'BIRD' || s === 'CLOCK' ? 'T' : s))) : null;
  }

  let idleT = 4;
  function idle(dt) {
    idleT -= dt / 1000;
    if (idleT > 0 || S.busy) return;
    idleT = U.rand(5, 10);
    const r = Math.random();
    if (r < 0.04) Flight.nearMiss();
    else if (r < 0.35) Audio2.play('coo', { pitch: U.randInt(0, 3) });
    else if (r < 0.6 && World.flock.length) { const b = U.pick(World.flock); Gennady.look(b.s.x, b.s.y); setTimeout(() => Gennady.setFace({ lookX: 0, lookY: 0 }), 1500); }
    else Gennady.idleVariety();
  }

  // ---------- controls ----------
  function onSpinButton() {
    if (S.auto > 0) { autoStop(); return; }
    if (S.busy) { G.hurry = true; return; }
    run(() => playRound({}));
  }
  // autoplay: n spins, stopping on a big enough single win, a big enough fall in the balance, or Race Day
  function autoStart(n, rules) {
    S.auto = n; S.autoRules = rules || S.autoRules; S.autoFrom = S.balance;
    UI.setAuto(n); UI.toast(`Autoplay: ${n} spins`);
    if (!S.busy) run(() => playRound({}));
  }
  function autoCheck(round, bet) {
    if (S.auto <= 0) return;
    const R = S.autoRules;
    if (R.win && round.win >= bet * R.win) { S.auto = 0; UI.setAuto(0); UI.toast(`Autoplay stopped: a win of ${R.win}× or more`); return; }
    if (R.loss && S.autoFrom - S.balance >= bet * R.loss) { S.auto = 0; UI.setAuto(0); UI.toast(`Autoplay stopped: balance down ${R.loss}× the bet`); }
  }
  function autoStop() { S.auto = 0; UI.setAuto(0); UI.toast('Autoplay stopped'); }
  function refill() { S.balance += 100000; UI.setBalance(S.balance); UI.toast('Topped up 1,000.00 FUN of play money'); }

  async function run(fn) {
    if (S.busy) return;
    S.busy = true; UI.setBusy(true);
    try { await fn(); } catch (e) { console.error(e); }
    S.busy = false; G.hurry = false; UI.setBusy(false);
    if (S.auto > 0) {
      S.auto--; UI.setAuto(S.auto);
      if (S.auto > 0) setTimeout(() => { if (!S.busy && S.auto > 0) run(() => playRound({})); }, U.T(0.35) * 1000);
    }
  }

  // ---------- round ----------
  async function playRound(opts) {
    const bet = UI.bet();
    const cost = opts.buy ? UI.cost() : bet;
    if (S.balance < cost) { S.auto = 0; UI.setAuto(0); Audio2.play('no'); UI.open('emptyModal'); return; }
    S.balance -= cost; UI.setBalance(S.balance);
    UI.setWin(0); Hud.hideWin();
    const round = engine.playRound(bet, opts);
    const ctx = { bet, shown: 0, mode: 'base', race: null };
    Gennady.act('nod');
    await playEvents(round.events, ctx);
    Hud.chainEnd(); Audio2.intensity(0);
    if (round.race) {
      S.auto = round.trigger && !opts.buy ? 0 : S.auto; UI.setAuto(S.auto);
      await playRace(round, ctx);
    }
    // settle: the engine's total is credited now; the balance counts up once any big win show has been collected
    S.balance += round.win;
    // the ticket and the strip both end on the engine's total, whatever the roll up was doing
    Hud.setWin(round.win, false);
    UI.announce(round.win > 0 ? `You won ${U.fmt(round.win)} FUN` : 'No win');
    autoCheck(round, bet);
    const show = !round.race && round.win >= bet * 15;
    if (!show) UI.setBalance(S.balance, true);
    if (show) {
      await Hud.bigWin(round.win, bet);
      UI.setBalance(S.balance, true);
    } else if (!round.race && round.win > 0) {
      if (round.win >= bet * 3) { Gennady.act('cheer'); World.cheer(true, 2.4); } else Gennady.act('smallWin');
    } else if (!round.race && round.win === 0 && !Flight.count && Math.random() < 0.22) {
      Gennady.act('shrug');
    }
    if (round.capped) UI.toast('Max win reached: 5,000× the bet');
  }

  // the third race clock lands: time nearly stops, the bell hits, then everything snaps back
  function thirdClock(c, r) {
    G.thirdClocks = (G.thirdClocks || 0) + 1;
    const gp = Loft.globalOf(c, r);
    Audio2.play('clockHit');
    FX.slowmo(0.5, 0.18);
    FX.zoomBlur(gp.x, gp.y, 0.08, 0.55);
    FX.flash(COL.YELLOW, 0.28, 0.4);
    FX.punch(0.05, 0.6);
    FX.sparks(gp.x, gp.y, 24, COL.YELLOW, 1.1);
    Gennady.act('gasp');
  }

  function anticipation(grid) {
    let n = 0;
    for (let c = 0; c < 6; c++) {
      if (grid[c].indexOf('CLOCK') !== -1) n++;
      if (n >= 2 && c < 5) return c + 1;
    }
    return null;
  }

  async function playEvents(events, ctx) {
    for (const e of events) {
      switch (e.t) {
        case 'tick': Flight.tick(e.flight); break;
        case 'drop': {
          // anticipation only ever follows two real clocks already on the grid; the third one, if it lands, gets a
          // slow motion beat
          // at the Race Day spin cap three clocks add nothing, so nothing builds them up
          const canScatter = ctx.mode !== 'race' || ctx.of < HOMING_CONFIG.maxRaceSpins;
          const ant = canScatter ? anticipation(e.grid) : null;
          let heart = null, seen = canScatter ? 0 : -99;
          if (ant != null) for (let c = 0; c < ant; c++) if (e.grid[c].indexOf('CLOCK') !== -1) seen++;
          await Loft.spinDrop(e.grid, {
            anticipateFrom: ant,
            onAnticipate: () => { Gennady.act('binos'); Audio2.play('riser', { dur: 0.85 * (6 - ant) / G.speed }); heart = setInterval(() => Audio2.play('heart'), 520); const gb = Loft.bounds().grid; FX.zoomBlur(gb.x + gb.w / 2, gb.y + gb.h / 2, 0.07, 1.0); Loft.pulseKind('CLOCK'); },
            onColumn: (c) => {
              FX.shake(6, 0.85);
              if (e.grid[c].indexOf('CLOCK') !== -1 && ++seen === 3) thirdClock(c, e.grid[c].indexOf('CLOCK'));
            }
          });
          if (heart) { clearInterval(heart); Gennady.stopAct(); Audio2.play('riserStop'); }
          break;
        }
        case 'land': await playLand(e, ctx); break;
        case 'takeoff': await playTakeoff(e); break;
        case 'fall': await Loft.fall(e.drops); Loft.sync(e.grid); break;
        case 'win': {
          // the ticket total is the simulator's running sum; coins and the roll up only animate the way there
          let total;
          if (ctx.mode === 'race') { ctx.spinSym = (ctx.spinSym || 0) + e.amt; total = ctx.raceTotal + ctx.spinSym; }
          else { ctx.shown += e.amt; total = ctx.shown; }
          Hud.chain(e.step);
          Audio2.intensity(e.step);
          if (e.step === 3) Gennady.act('smallWin');
          else if (e.step >= 4 && e.step % 2 === 0) Gennady.act('cheer');
          await Loft.showWins(e, ctx.bet, { onCoins: (first, span) => Hud.setWin(total, true, { delay: first, dur: span + 0.12, big: e.amt >= ctx.bet * 5 }) });
          break;
        }
        case 'scatter': await playScatter(e, ctx); break;
        case 'apply': await playApply(e, ctx); break;
        case 'buy': break;
        default: break;
      }
    }
  }

  async function playTakeoff(e) {
    if (e.items.length) { Gennady.act('point'); if (Math.random() < 0.3) setTimeout(() => Flight.nearMiss(), 260); }
    const ps = [];
    for (let i = 0; i < e.items.length; i++) {
      const it = e.items[i];
      const gp = Loft.take(it.c, it.r);
      ps.push(Flight.launch(it.id, it.band, gp.x, gp.y));
      await U.wait(120);
    }
    for (const it of e.instant) { const gp = Loft.take(it.c, it.r); FX.feathers(gp.x, gp.y, 8, { scale: G.unit + 0.2 }); }
    await Promise.all(ps);
  }

  async function playLand(e, ctx) {
    if (e.reason === 'raceCall') {
      await FX.stamp('EVERYONE HOME!', G.W / 2, G.playH * 0.3, { size: 90 * G.unit + 30, color: '#FFD23F', banner: G.tex.bannerPaper, hold: 0.5, sound: 'stamp' });
    }
    if (e.reason === 'final') {
      await FX.stamp('HOMECOMING!', G.W / 2, G.playH * 0.3, { size: 90 * G.unit + 30, color: '#FF4FA3', banner: G.tex.bannerPaper, hold: 0.5, sound: 'stamp' });
    }
    for (const it of e.items) {
      const gp = Loft.globalOf(it.c, it.r);
      const pending = Flight.land(it.id, gp.x, gp.y);
      await pending;
      const cap = Loft.capsule(it.c, it.r, it.cap);
      Audio2.play('capsule');
      FX.splat(gp.x, gp.y, it.cap.k === 'mult' ? COL.VIOLETL : COL.YELLOW, 1.0 * G.loftScale * 1.8);
      if (it.cap.k === 'coin') {
        if (it.cap.v >= 10) { Gennady.act('gasp'); FX.impact(gp.x, gp.y, 0.8); }
        await U.wait(380);
        const wp = Hud.winPos();
        await new Promise((res) => Loft.flyOut(cap, wp.x, wp.y, res));
        if (ctx.mode === 'race') { ctx.callCoins = (ctx.callCoins || 0) + it.cap.amt; Hud.setWin(ctx.raceTotal + ctx.callCoins, true); }
        else { ctx.shown += it.cap.amt; Hud.setWin(ctx.shown, true); }
        const cn = ctx.coinN || 0; ctx.coinN = cn + 1;
        Audio2.play('kaching', { n: cn, big: it.cap.v >= 10 });
      } else if (it.cap.k === 'mult') {
        if (it.cap.m >= 25) { Gennady.act('gasp'); FX.impact(gp.x, gp.y, 1.2); }
        await U.wait(330);
        const mp = Hud.multPos();
        await new Promise((res) => Loft.flyOut(cap, mp.x, mp.y, res));
        ctx.loft = (ctx.loft || 0) + it.cap.m;
        Hud.setLoft(ctx.loft, true);
        Audio2.play('mult', { m: it.cap.m });
      } else if (it.cap.k === 'flock') {
        Gennady.act('whistle'); Audio2.play('whistle');
        await FX.stamp('FLOCK CALL!', G.W / 2, G.playH * 0.3, { size: 80 * G.unit + 30, color: '#FFD23F', banner: G.tex.bannerPink, hold: 0.4, sound: 'stamp' });
        gsap.to(cap, { alpha: 0, duration: 0.3, onComplete: () => cap.destroy({ children: true }) });
      }
    }
  }

  async function playScatter(e, ctx) {
    Loft.clocksRing(e.cells);
    Loft.bump(0.065);
    Audio2.play('bell');
    Gennady.act('gasp');
    FX.impact(G.loftX, G.groundY - G.loftW * 0.5, 1.0);
    if (e.retrigger) {
      ctx.of += e.spins;
      await FX.stamp('+' + e.spins + ' SPINS', G.W / 2, G.playH * 0.35, { size: 110 * G.unit + 30, color: '#FFD23F', banner: G.tex.bannerPink, hold: 0.6, sound: 'stampMajor' });
      Hud.setSpins(ctx.spinIndex, ctx.of);
    } else {
      await U.wait(900);
    }
  }

  async function playApply(e, ctx) {
    if (e.loft > 1) {
      const txt = `${U.fmt(e.base)} × ${e.loft}`;
      await FX.stamp(txt, G.W / 2, G.playH * 0.42, { size: 70 * G.unit + 24, color: '#FFD23F', banner: G.tex.bannerPaper, hold: 0.35, power: 0.8, sound: 'stamp' });
    }
    Audio2.play('coin');
  }

  // ---------- Race Day ----------
  async function raceIntro(trigger, bought) {
    Audio2.duck(0.05);
    Audio2.play('roll', { dur: 1.2 });
    const wipe = FX.dotWipe(COL.YELLOW);
    await wipe.covered;
    World.setMode('race', 0.05);
    G.mode = 'race';
    Gennady.setOutfit('race');
    UI.showBuy(false);
    Hud.showRace(true); Hud.setLoft(1, false); Hud.setSpins(1, trigger.spins); Hud.setRaceWin(0);
    Audio2.music('race');
    await wipe.reveal();
    Audio2.play('raceHit'); Audio2.play('crowd');
    const sbC = new PIXI.Container(); G.layers.overlay.addChild(sbC);
    const sb = FX.sunburst(sbC, G.W / 2, G.playH * 0.38, Math.hypot(G.W, G.H) * 0.7, [0xFFD23F, 0xFF6A2B], 24, 0.5);
    sbC.alpha = 0; gsap.to(sbC, { alpha: 0.45, duration: 0.3 });
    Gennady.act('whistle'); Audio2.play('whistle');
    FX.zoomBlur(G.W / 2, G.playH * 0.38, 0.1, 0.7);
    for (let i = 0; i < 4; i++) setTimeout(() => FX.rocket(U.rand(0.1, 0.9) * G.W, U.rand(0.1, 0.4) * G.playH, U.pick([COL.PINK, COL.YELLOW, COL.TEALL]), U.pick(['ring', 'palm', 'crackle'])), i * 160);
    for (let i = 0; i < 4; i++) setTimeout(() => Flight.nearMiss({ dir: i % 2 ? -1 : 1, y: 0.1 + i * 0.07, silent: i > 0 }), 120 + i * 140);
    // the whole loft takes to the sky and both corners fire confetti as the stamp lands
    Flight.flockPass(G.layers.overlay, { n: 16, dir: Math.random() < 0.5 ? 1 : -1, y: 0.2, dur: 2.4 });
    setTimeout(() => { FX.cannon(-10, G.playH + 10, -Math.PI * 0.3, 40, 1); FX.cannon(G.W + 10, G.playH + 10, -Math.PI * 0.7, 40, 1); }, 180);
    await FX.stamp('RACE DAY', G.W / 2, G.playH * 0.32, { size: Math.min(220, G.W * 0.2), color: '#FF4FA3', banner: G.tex.bannerPaper, hold: 0.7, power: 1.6 });
    await FX.stamp(`${trigger.spins} FREE SPINS`, G.W / 2, G.playH * 0.46, { size: Math.min(110, G.W * 0.1), color: '#FFD23F', banner: G.tex.bannerPink, hold: 0.7, power: 1 });
    gsap.to(sbC, { alpha: 0, duration: 0.4, onComplete: () => { sb.destroy(); sbC.destroy(); } });
    Gennady.act('wave');
    Audio2.unduck();
    void bought;
  }

  async function raceOutro(raceWin, bet) {
    await U.wait(400);
    if (raceWin >= bet * 15) await Hud.bigWin(raceWin, bet, 'RACE WINNINGS');
    else await FX.stamp('RACE WIN ' + U.fmt(raceWin), G.W / 2, G.playH * 0.36, { size: Math.min(110, G.W * 0.09), color: '#FFD23F', banner: G.tex.bannerPink, hold: 1.2, power: 1, sound: 'stampMajor' });
    const wipe = FX.dotWipe(COL.VIOLET);
    await wipe.covered;
    World.setMode('base', 0.05);
    G.mode = 'base';
    Gennady.setOutfit('base');
    Hud.showRace(false);
    Audio2.music('base');
    await wipe.reveal();
    UI.showBuy(true);
  }

  async function playRace(round, ctx) {
    const race = round.race;
    const bet = round.bet;
    await raceIntro(round.trigger, !!round.trigger.bought);
    ctx.mode = 'race'; ctx.loft = 0; ctx.raceTotal = 0; ctx.callCoins = 0; ctx.of = round.trigger.spins;
    if (race.pre.length) { await playEvents(race.pre, ctx); ctx.raceTotal += ctx.callCoins; ctx.callCoins = 0; Hud.setRaceWin(ctx.raceTotal); }
    for (let i = 0; i < race.spins.length; i++) {
      const sev = race.spins[i];
      ctx.spinIndex = i + 1; ctx.spinSym = 0;
      const end = sev.find((x) => x.t === 'end');
      Hud.setSpins(i + 1, ctx.of);
      await playEvents(sev, ctx);
      Hud.chainEnd(); Audio2.intensity(0);
      if (end) {
        ctx.raceTotal += end.win;
        Hud.setRaceWin(ctx.raceTotal);
        Hud.setWin(ctx.raceTotal, end.win > 0);
        if (end.of !== ctx.of) { ctx.of = end.of; Hud.setSpins(i + 1, ctx.of); }
        if (end.win >= bet * 20) Gennady.act('cheer');
        if (end.capped) UI.toast('Max win reached: 5,000× the bet');
      }
      await U.wait(260);
    }
    await raceOutro(ctx.raceTotal, bet);
  }

  window.addEventListener('error', () => { /* keep calm */ });
  boot();
})();

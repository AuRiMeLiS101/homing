/* Title and intro. The title is the real evening seen from high above the roofs: the logo hangs in the sky and a
   pigeon flies in and lands on its race clock. Punching the ticket starts one unbroken camera move down through
   the city, past the flock, to the roof, where Gennady lowers his binoculars and waves, the loft fills and the
   logo settles into its corner. A tap skips straight to the game. */
const Intro = (function () {
  let L = null, stack = null, frames = null, landed = false, flying = false;
  const POSES = ['flap0', 'flap1', 'flap2', 'flap3', 'flap4', 'flap5', 'flap6', 'flap7', 'flap8', 'flap9', 'flare', 'land'];
  const motionOk = () => !G.reduced;

  // ---------- the title logo ----------
  // painted as soon as the fonts are in, so the loading screen already carries it
  function titleLogo() {
    stack = document.getElementById('logoStack');
    if (!stack || !window.HomingLogo) return;
    const css = Math.max(360, Math.min(760, stack.getBoundingClientRect().width || 600));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = (css * dpr * 1.15) / HomingLogo.measure().w;
    L = HomingLogo.layers({ s });
    stack.style.aspectRatio = L.meta.w + ' / ' + L.meta.h;
    ['block', 'birdRims', 'face', 'hand', 'birdArt', 'plaque'].forEach((k) => {
      const c = L[k];
      if (!c) return;
      c.className = 'lg lg-' + k;
      c.setAttribute('aria-hidden', 'true');
      stack.appendChild(c);
    });
    // now and then a glint of light runs across the letter faces
    if (motionOk()) {
      try {
        const url = 'url(' + L.face.toDataURL('image/png') + ')';
        const sh = document.createElement('div');
        sh.className = 'lg lg-shine';
        sh.style.webkitMaskImage = url; sh.style.maskImage = url;
        stack.insertBefore(sh, L.hand);
      } catch (e) { /* no glint */ }
    }
    // the race clock runs until the pigeon is home
    L.hand.style.transformOrigin = (L.meta.clock.x / L.meta.w) * 100 + '% ' + (L.meta.clock.y / L.meta.h) * 100 + '%';
    runHand();
    showLanded(false);
    stack.classList.add('in');
    // the flight frames paint in small slices while the loft loads, so the pigeon is ready when the sky is
    setTimeout(paintFrames, 30);
  }
  function showLanded(on) {
    landed = on;
    if (!L) return;
    L.birdRims.style.visibility = on ? '' : 'hidden';
    L.birdArt.style.visibility = on ? '' : 'hidden';
    if (on) stopHand();
  }
  // the sweep hand: one turn every 1.6 seconds while the bird is out, then it stops dead at the clocking.
  // It runs on gsap's clock like the rest of the game, so a test can step it frame by frame.
  const HAND = { deg: 0, tw: null, stopped: false };
  const restDeg = () => (L ? L.meta.handAngle * 180 / Math.PI : 35);
  const setHand = () => { if (L) L.hand.style.transform = 'rotate(' + HAND.deg.toFixed(2) + 'deg)'; };
  function runHand() {
    if (!motionOk()) { stopHand(true); return; }
    HAND.stopped = false;
    HAND.tw = gsap.to(HAND, { deg: '+=360', duration: 1.6, ease: 'none', repeat: -1, onUpdate: setHand });
  }
  function stopHand(instant) {
    if (!L || HAND.stopped) return;
    HAND.stopped = true;
    if (HAND.tw) HAND.tw.kill();
    // on round to the clocking mark, with a little kick as it stops
    const now = ((HAND.deg % 360) + 360) % 360;
    let to = restDeg();
    while (to < now) to += 360;
    HAND.deg = now;
    if (instant || to - now > 300) { HAND.deg = restDeg(); setHand(); return; }
    gsap.to(HAND, { deg: to, duration: 0.24, ease: 'back.out(3)', onUpdate: setHand });
  }
  // the flight frames, painted a few at a time while the loft loads
  function paintFrames() {
    if (!L || frames) return Promise.resolve();
    frames = {};
    return new Promise((res) => {
      let i = 0;
      const step = () => {
        const t0 = performance.now();
        while (i < POSES.length && performance.now() - t0 < 12) { frames[POSES[i]] = L.frame(POSES[i]); i++; }
        if (i < POSES.length) setTimeout(step, 0); else res();
      };
      step();
    });
  }

  // ---------- the pigeon lands on the clock ----------
  let flyTw = null;
  function birdLands() {
    if (!L || landed) return Promise.resolve();
    const fly = document.getElementById('birdFly');
    if (!motionOk() || !fly) { showLanded(true); return Promise.resolve(); }
    return paintFrames().then(() => new Promise((res) => {
      if (landed) { res(); return; }
      const f0 = frames.flap0.canvas;
      fly.width = f0.width; fly.height = f0.height;
      const fx = fly.getContext('2d');
      fly.hidden = false;
      const vw = window.innerWidth, st = { t: 0 }, DUR = 1.45;
      const draw = () => {
        const r = stack.getBoundingClientRect(), d = r.width / L.meta.w;
        // the landed frame's top left on the page
        const lx = r.left + L.landAt.x * d, ly = r.top + L.landAt.y * d;
        const t = st.t;
        // in from the left above the H, a long swoop down onto the crown, slowing as it lands
        const e = 1 - Math.pow(1 - t, 2.2);
        const p0 = { x: -0.25 * vw - lx, y: -r.height * 0.9 }, p1 = { x: -r.width * 0.42, y: -r.height * 0.95 };
        const u = 1 - e;
        const ox = u * u * p0.x + 2 * u * e * p1.x, oy = u * u * p0.y + 2 * u * e * p1.y;
        const pose = t >= 1 ? 'land' : t > 0.8 ? 'flare' : 'flap' + (Math.floor((t * DUR) / 0.034) % 10);
        const fr = frames[pose];
        fx.clearRect(0, 0, fly.width, fly.height);
        fx.drawImage(fr.canvas, 0, 0);
        const tilt = t < 0.8 ? -0.12 + 0.2 * t : 0;
        fly.style.width = (fly.width * d) + 'px'; fly.style.height = (fly.height * d) + 'px';
        fly.style.transform = `translate(${lx + fr.ox * d + ox}px, ${ly + fr.oy * d + oy}px) rotate(${tilt}rad)`;
      };
      flying = true;
      flyTw = gsap.to(st, {
        t: 1, duration: DUR, ease: 'none', onUpdate: draw,
        onComplete: () => {
          flying = false;
          fly.hidden = true;
          showLanded(true);
          stack.classList.remove('settle'); void stack.offsetWidth; stack.classList.add('settle');
          res();
        }
      });
      draw();
    }));
  }

  // ---------- the camera move ----------
  // corner: { rect: {x, y, w, h} of the corner logo on the page, meta: its painted word box }
  function play(o) {
    o = o || {};
    const start = document.getElementById('start');
    const tl = gsap.timeline({ paused: true });
    let done = false, dropped = false, barUp = false;
    const cr = { k: 1 };
    const D = World.craneDistance();
    World.crane(1, D);
    if (flyTw) flyTw.kill();
    showLanded(true);
    if (stack) stack.classList.remove('in', 'settle');
    const flyEl = document.getElementById('birdFly'); if (flyEl) flyEl.hidden = true;
    const hint = document.getElementById('skipHint') || { hidden: true };

    // the logo glides from the title into its corner: the word box maps onto the corner logo's word box
    const flip = () => {
      if (!o.corner || !stack || !L) return null;
      const r = stack.getBoundingClientRect(), d1 = r.width / L.meta.w;
      const wt = { x: r.left + L.meta.word.x * d1, y: r.top + L.meta.word.y * d1, w: L.meta.word.w * d1 };
      const c = o.corner, d2 = c.rect.w / c.meta.w;
      const wc = { x: c.rect.x + c.meta.word.x * d2, y: c.rect.y + c.meta.word.y * d2, w: c.meta.word.w * d2 };
      const k = wc.w / wt.w;
      return { k, tx: wc.x - r.left - (wt.x - r.left) * k, ty: wc.y - r.top - (wt.y - r.top) * k };
    };
    const showBar = () => { if (!barUp) { barUp = true; UI.showBar(); } };
    const drop = () => {
      if (dropped) return Promise.resolve();
      dropped = true;
      Loft.C.sym.visible = true;
      return o.grid ? Loft.spinDrop(o.grid) : Promise.resolve();
    };
    const handOff = () => {
      if (o.onLogo) o.onLogo();
      start.hidden = true;
    };

    return new Promise((resolve) => {
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener('pointerdown', onTap);
        window.removeEventListener('keydown', onKey, true);
        tl.kill();
        gsap.killTweensOf(cr);
        World.crane(0, D);
        if (!dropped) { dropped = true; Loft.C.sym.visible = true; if (o.grid) Loft.setGrid(o.grid); }
        handOff();
        showBar();
        hint.hidden = true;
        resolve();
      };
      const onTap = () => { if (!done) { if (dropped) finish(); else { Gennady.stopAct(); finish(); } } };
      // a key skips too, and is spent on the skip: it must not also spin the first round
      const onKey = (e) => { if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); onTap(); } };
      setTimeout(() => { if (!done) { window.addEventListener('pointerdown', onTap); window.addEventListener('keydown', onKey, true); } }, 350);

      Audio2.play('punch');
      document.getElementById('startBtn').classList.add('punched');
      start.classList.add('go');
      hint.hidden = !motionOk();

      if (!motionOk()) {
        // calm screen: no flight through the city, the game simply fades up
        World.crane(0, D);
        gsap.to(start, { opacity: 0, duration: 0.5, delay: 0.3, onComplete: () => finish() });
        return;
      }

      Gennady.act('watch');
      tl.call(() => { Audio2.accordionIntro(); Audio2.ambience(0.55); }, null, 0.12);
      tl.to(cr, { k: 0, duration: 3.15, ease: 'power2.inOut', onUpdate: () => World.crane(cr.k, D) }, 0.3);
      // the whole loft sweeps across the sky as we come down, and one bird cuts right past the lens
      tl.call(() => Flight.flockPass(G.layers.flyers, { n: 12, dir: 1, y: 0.34, dur: 3.2 }), null, 0.55);
      tl.call(() => Audio2.play('tram'), null, 1.2);
      tl.call(() => Flight.nearMiss({ dir: -1, y: 0.4, big: 1.6, dur: 0.62 }), null, 1.7);
      // the logo heads for its corner; its ticket plaque comes off on the way
      const fl = flip();
      if (fl && stack) {
        const pq = L.plaque;
        tl.to(stack, { x: fl.tx, y: fl.ty, scale: fl.k, transformOrigin: '0 0', duration: 2.5, ease: 'power3.inOut' }, 0.55);
        if (pq) tl.to(pq, { opacity: 0, duration: 0.45, ease: 'power1.in' }, 0.6);
      }
      // he hears us arrive: binoculars down, a wave of the club pennant
      tl.call(() => { Gennady.act('greet'); Audio2.play('coo', { pitch: 2 }); }, null, 2.9);
      tl.call(() => { handOff(); }, null, 3.12);
      tl.call(() => { drop().then(() => { if (!done) { showBar(); setTimeout(finish, 350); } }); }, null, 3.2);
      tl.call(showBar, null, 3.9);
      tl.play(0);
    });
  }

  function update() { /* the intro runs on its own timeline */ }

  return { titleLogo, birdLands, paintFrames, play, update, get layers() { return L; }, get flying() { return flying; }, get landed() { return landed; } };
})();

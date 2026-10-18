/* Our racing birds. Each one flies with simple steering: it chases its slot in a slowly turning holding
   pattern, keeps its distance from the others, banks into turns, flaps harder when it climbs and glides
   when it can. They burst out of the nest boxes, dive home with a flare and a squashy touchdown, and now
   and then a bird from the flock shaves right past the camera. */
const Flight = (function () {
  let layer;
  const birds = new Map(); // id -> bird
  const BREEDS = ['grey', 'white', 'red', 'dark', 'pied'];
  const BODY = 282; // bird units from beak to tail
  let anchorX = 0.556, anchorY = 0.537;

  function build(parent) {
    layer = new PIXI.Container(); parent.addChild(layer);
    const Bx = HomingBirds.BOX;
    anchorX = -Bx.x0 / (Bx.x1 - Bx.x0); anchorY = -Bx.y0 / (Bx.y1 - Bx.y0);
  }
  // sprite scale for a bird whose body is px long on screen
  function kFor(px) { return px / (BODY * G.tex.birdS); }
  function bodyPx() { return Math.max(46, 104 * G.unit); }
  function tagScale() { return Math.max(0.5, G.unit * 0.66); }

  function laneFree() {
    const used = new Set([...birds.values()].map((b) => b.lane));
    for (let i = 0; i < 24; i++) if (!used.has(i)) return i;
    return birds.size;
  }
  // the slot each bird chases: two rings over the loft that slowly turn
  function lanePos(b, t) {
    const A = G.holdArea;
    const ring = b.lane < 6 ? 0 : 1;
    const n = ring ? 10 : 6;
    const idx = ring ? b.lane - 6 : b.lane;
    const a = b.ph0 + (idx / n) * Math.PI * 2 + t * b.spd * (ring ? -1 : 1);
    const rx = A.w * (ring ? 0.46 : 0.34), ry = A.h * (ring ? 0.4 : 0.28);
    return { x: A.x + A.w / 2 + Math.cos(a) * rx, y: A.y + A.h / 2 + Math.sin(a) * ry + Math.sin(t * 1.7 + b.ph0 * 3) * A.h * 0.07 };
  }

  function makeTag(band) {
    const c = new PIXI.Container();
    const g = new PIXI.Graphics();
    c.addChild(g);
    const t = monoText(String(band), 30, '#1B1622');
    c.addChild(t);
    c._g = g; c._t = t;
    drawTag(c, band);
    return c;
  }
  function drawTag(c, band) {
    const g = c._g; g.clear();
    const home = band <= 0;
    g.roundRect(-26, -21, 52, 42, 10).fill({ color: home ? COL.PINK : COL.YELLOW }).stroke({ width: 4, color: COL.INK });
    c._t.text = home ? 'HOME' : String(band);
    c._t.style.fontSize = home ? 15 : 30;
  }

  function sprite(breed) {
    const s = new PIXI.Sprite(G.tex.bird[breed].flap0);
    s.anchor.set(anchorX, anchorY);
    return s;
  }
  function add(id, band, x, y) {
    const breed = BREEDS[id % BREEDS.length];
    const b = {
      id, band, breed, lane: laneFree(), ph0: Math.random() * 0.6, spd: 0.3 + Math.random() * 0.08,
      x, y, vx: 0, vy: 0, mode: 'hold', ph: Math.random(), glide: 0, flaps: U.randInt(4, 9), face: 1, faceT: 1,
      head: 0, bank: 0, mul: 1, frame: 'flap0', squash: 1, age: 0
    };
    b.s = sprite(breed);
    b.tag = makeTag(band);
    b.c = new PIXI.Container(); b.c.addChild(b.s); b.c.addChild(b.tag);
    layer.addChild(b.c);
    birds.set(id, b);
    b.c.x = x; b.c.y = y;
    b.tag.scale.set(tagScale());
    return b;
  }
  function setFrame(b, name) { if (b.frame !== name) { b.frame = name; b.s.texture = G.tex.bird[b.breed][name]; } }

  // Bird bursts out of its nest box and climbs into the holding pattern.
  function launch(id, band, x, y) {
    const b = add(id, band, x, y);
    b.mode = 'launch'; b.age = 0; b.mul = 0.5;
    b.vx = U.rand(-90, 90) * G.unit; b.vy = -520 * G.unit;
    b.face = b.faceT = Math.random() < 0.5 ? 1 : -1;
    b.tag.scale.set(0);
    setFrame(b, 'takeoff');
    Audio2.play('flap'); Audio2.play('coo', { pitch: id });
    FX.feathers(x, y, 12, { scale: G.unit + 0.2, power: 1.2 });
    FX.pop(U.pick(['FLAP!', 'WHOOSH', 'COO!', 'FLAP FLAP']), x + U.rand(-40, 40) * G.unit, y - 50 * G.unit, '#FFD23F');
    gsap.to(b, { mul: 1, duration: U.T(0.4), ease: 'back.out(2)' });
    return new Promise((res) => {
      gsap.delayedCall(U.T(0.95), () => {
        if (!birds.has(id)) return res();
        b.mode = 'hold';
        gsap.fromTo(b.tag.scale, { x: 0, y: 0 }, { x: tagScale(), y: tagScale(), duration: U.T(0.3), ease: 'back.out(3)' });
        Audio2.play('tag');
        res();
      });
    });
  }

  function tick(view) {
    if (!view) return;
    for (const v of view) {
      const b = birds.get(v.id); if (!b) continue;
      if (b.band !== v.band) {
        b.band = v.band;
        drawTag(b.tag, v.band);
        const k = tagScale();
        gsap.fromTo(b.tag.scale, { x: k * 1.6, y: k * 1.6 }, { x: k, y: k, duration: 0.3, ease: 'back.out(3)' });
      }
    }
    if (view.length) Audio2.play('tick');
  }

  // Bird comes home: a curving dive, a flare with wings up and tail fanned, a squashy touchdown, then into the box.
  // Resolves at touchdown.
  function land(id, tx, ty) {
    let b = birds.get(id);
    if (!b) { b = add(id, 0, tx + U.rand(-300, 300) * G.unit, -120); }
    b.mode = 'land';
    gsap.killTweensOf(b);
    const p0 = { x: b.c.x, y: b.c.y }, p2 = { x: tx, y: ty - 26 * G.unit };
    const p1 = { x: (p0.x + p2.x) / 2 + U.rand(-170, 170) * G.unit, y: Math.min(p0.y, p2.y) - 150 * G.unit };
    gsap.to(b.tag, { alpha: 0, duration: 0.2 });
    Audio2.play('dive');
    const st = { t: 0 };
    return new Promise((res) => {
      gsap.to(b, { mul: 1.3, duration: U.T(0.6), ease: 'power1.in' });
      gsap.to(st, {
        t: 1, duration: U.T(0.78), ease: 'power1.in',
        onUpdate: () => {
          const t = st.t, u = 1 - t;
          const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
          const dt = Math.max(1e-3, (G.dtLast || 16) / 1000);
          b.vx = (x - b.c.x) / dt; b.vy = (y - b.c.y) / dt;
          b.c.x = x; b.c.y = y; b.x = x; b.y = y;
          b.landT = t;
        },
        onComplete: () => {
          b.mode = 'perched'; b.vx = 0; b.vy = 0;
          setFrame(b, 'land'); b.s.rotation = 0;
          b.squash = 0.6;
          FX.dust(tx, ty + 40 * G.unit, 12);
          FX.feathers(tx, ty, 8, { scale: G.unit + 0.2, power: 0.7 });
          Audio2.play('land');
          gsap.to(b.c, { y: ty, duration: 0.1 });
          gsap.timeline({ onComplete: () => remove(id) })
            .add(() => setFrame(b, 'perch'), 0.12)
            .add(() => setFrame(b, 'perchBob'), 0.3)
            .to(b, { mul: 0, duration: U.T(0.24), ease: 'back.in(2)' }, 0.42);
          res();
        }
      });
    });
  }

  function remove(id) { const b = birds.get(id); if (!b) return; gsap.killTweensOf(b); b.c.destroy({ children: true }); birds.delete(id); }
  function clear() { for (const id of [...birds.keys()]) remove(id); }

  // ---------- per frame ----------
  function steer(b, dt, t) {
    let tx, ty;
    if (b.mode === 'launch') {
      const A = G.holdArea, k = U.clamp(b.age / 0.5, 0, 1);
      const L = lanePos(b, t + 0.5);
      tx = U.lerp(b.x + b.vx * 0.2, L.x, k); ty = U.lerp(A.y + A.h * 0.25, L.y, k);
    } else { const L = lanePos(b, t + 0.45); tx = L.x; ty = L.y; }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy) || 1;
    const base = 230 * G.unit + 60;
    const sp = base * U.clamp(0.55 + d / (260 * G.unit + 80), 0.55, b.mode === 'launch' ? 2.4 : 1.7);
    let ax = dx / d * sp, ay = dy / d * sp;
    // keep a little air between birds
    for (const o of birds.values()) {
      if (o === b || o.mode === 'perched') continue;
      const ox = b.x - o.x, oy = b.y - o.y, o2 = ox * ox + oy * oy, R = 80 * G.unit + 30;
      if (o2 > 0 && o2 < R * R) { const od = Math.sqrt(o2); ax += ox / od * (R - od) * 3.2; ay += oy / od * (R - od) * 3.2; }
    }
    const k = Math.min(1, dt * (b.mode === 'launch' ? 3.2 : 2.1));
    b.vx += (ax - b.vx) * k; b.vy += (ay - b.vy) * k;
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.c.x = b.x; b.c.y = b.y;
  }
  function animate(b, dt) {
    const sp = Math.hypot(b.vx, b.vy) + 1e-3;
    // facing flips through a squash, as if the bird turns toward us
    if (Math.abs(b.vx) > 45 * G.unit) b.face = b.vx >= 0 ? 1 : -1;
    b.faceT = U.lerp(b.faceT, b.face, Math.min(1, dt * 7));
    // bank into turns
    const head = Math.atan2(b.vy, b.vx);
    let dh = head - b.head; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    b.head = head;
    const omega = dh / Math.max(dt, 1e-3);
    b.bank = U.lerp(b.bank, U.clamp(omega * 0.12, -0.5, 0.5), Math.min(1, dt * 5));
    // pitch with the climb or the dive
    const pitch = U.clamp(Math.atan2(b.vy, Math.abs(b.vx) + sp * 0.35), -0.7, 0.8);
    const climb = -b.vy / sp;
    if (b.mode === 'land') {
      const t = b.landT || 0;
      if (t > 0.7) setFrame(b, 'flare');
      else if (b.vy > sp * 0.5) setFrame(b, 'dive');
      else flap(b, dt, 4.2);
      b.s.rotation = b.frame === 'flare' ? -0.18 * Math.sign(b.faceT) : pitch * 0.55 * Math.sign(b.faceT);
    } else if (b.mode === 'launch' && b.age < 0.12) {
      setFrame(b, 'takeoff'); b.s.rotation = -0.2 * Math.sign(b.faceT);
    } else if (b.mode !== 'perched') {
      if (b.glide > 0 && climb < 0.35) { b.glide -= dt; setFrame(b, 'glide'); }
      else flap(b, dt, (b.mode === 'launch' ? 4.6 : 2.5) + Math.max(0, climb) * 2.4);
      b.s.rotation = (pitch * 0.55 + b.bank * 0.55) * Math.sign(b.faceT);
    }
    b.squash = U.lerp(b.squash, 1, Math.min(1, dt * 7));
    const k = kFor(bodyPx()) * b.mul;
    const roll = 1 - Math.abs(b.bank) * 0.28;
    b.s.scale.set(k * b.faceT * (2 - b.squash), k * roll * b.squash);
    b.tag.y = bodyPx() * 0.62 * b.mul; b.tag.x = 0;
    if (b.band <= 1 && b.mode === 'hold') b.tag.rotation = Math.sin(G.time * 14 + b.id) * 0.12; else b.tag.rotation = 0;
  }
  function flap(b, dt, rate) {
    const before = Math.floor(b.ph);
    b.ph += dt * rate;
    if (Math.floor(b.ph) !== before) {
      b.flaps--;
      if (b.flaps <= 0 && b.mode === 'hold') { b.glide = U.rand(0.35, 0.95); b.flaps = U.randInt(4, 10); }
    }
    setFrame(b, 'flap' + (Math.floor((b.ph % 1) * HomingBirds.FLAP_N) % HomingBirds.FLAP_N));
  }
  function update() {
    const dt = Math.min(0.05, (G.dtLast || 16) / 1000);
    const t = G.time;
    for (const b of birds.values()) {
      b.age += dt;
      if (b.mode === 'hold' || b.mode === 'launch') steer(b, dt, t);
      animate(b, dt);
    }
    updateMisses(dt);
  }

  // ---------- near misses: a bird cuts right past the lens ----------
  const misses = [];
  function nearMiss(o) {
    o = o || {};
    if (G.reduced || !G.layers.overlay) return;
    const breed = o.breed || U.pick(BREEDS);
    const s = sprite(breed); s.anchor.set(anchorX, anchorY);
    const dir = o.dir || (Math.random() < 0.5 ? 1 : -1);
    const W = G.W, H = G.playH || G.H;
    const y0 = (o.y == null ? U.rand(0.08, 0.34) : o.y) * H;
    const m = { s, dir, t: 0, dur: o.dur || U.rand(0.5, 0.7), x0: dir > 0 ? -0.15 * W : 1.15 * W, x1: dir > 0 ? 1.2 * W : -0.2 * W, y0, y1: y0 + U.rand(-0.12, 0.28) * H, ph: Math.random(), breed, big: o.big || U.rand(5, 8) };
    try { if (PIXI.filters && PIXI.filters.MotionBlurFilter) s.filters = [new PIXI.filters.MotionBlurFilter({ velocity: { x: dir * 26, y: 4 }, kernelSize: 9 })]; } catch (e) { /* plain sprite */ }
    G.layers.overlay.addChild(s);
    misses.push(m);
    if (!o.silent) setTimeout(() => Audio2.play('whoosh'), m.dur * 380);
  }
  function updateMisses(dt) {
    for (let i = misses.length - 1; i >= 0; i--) {
      const m = misses[i];
      m.t += dt / m.dur;
      const t = Math.min(1, m.t), e = t * t * (3 - 2 * t);
      const x = U.lerp(m.x0, m.x1, e), y = U.lerp(m.y0, m.y1, e) - Math.sin(t * Math.PI) * G.playH * 0.05;
      // it swells as it nears the lens, peaking a little past the middle
      const near = Math.pow(Math.sin(Math.min(1, t * 1.08) * Math.PI), 2.4);
      const k = kFor(bodyPx() * (1.2 + near * m.big));
      m.ph += dt * 6.5;
      m.s.texture = G.tex.bird[m.breed]['flap' + (Math.floor((m.ph % 1) * HomingBirds.FLAP_N) % HomingBirds.FLAP_N)];
      m.s.x = x; m.s.y = y; m.s.rotation = m.dir * -0.12 + Math.sin(t * Math.PI) * 0.1 * m.dir;
      m.s.scale.set(k * m.dir, k);
      m.s.alpha = t > 0.92 ? (1 - t) / 0.08 : 1;
      if (!m.shook && t > 0.48) { m.shook = true; FX.shake(5, 0.5); FX.feathers(x, y, 6, { scale: G.unit + 0.8, power: 1.6 }); }
      if (t >= 1) { m.s.destroy(); misses.splice(i, 1); }
    }
  }

  function syncFromState(flight) {
    // used when resuming: put birds in the air without animation
    clear();
    for (const f of flight) {
      const b = add(f.id, f.band, G.W / 2, G.holdArea.y);
      b.mode = 'hold';
    }
  }
  function relayout() { for (const b of birds.values()) b.tag.scale.set(tagScale()); }

  return { build, launch, land, tick, update, clear, remove, syncFromState, relayout, nearMiss, kFor, birds, BREEDS, get count() { return birds.size; } };
})();

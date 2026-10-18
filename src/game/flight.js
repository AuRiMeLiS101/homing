/* Our racing birds: circle above the loft with their countdown bands, then dive home. */
const Flight = (function () {
  let layer;
  const birds = new Map(); // id -> bird
  const SCHEMES = ['grey', 'white', 'red', 'dark', 'grey', 'white'];

  function build(parent) { layer = new PIXI.Container(); parent.addChild(layer); }

  function laneFree() {
    const used = new Set([...birds.values()].map((b) => b.lane));
    for (let i = 0; i < 24; i++) if (!used.has(i)) return i;
    return birds.size;
  }

  function lanePos(b, t) {
    const A = G.holdArea;
    const ring = b.lane < 6 ? 0 : 1;
    const n = ring ? 10 : 6;
    const idx = ring ? b.lane - 6 : b.lane;
    const a = b.ph + (idx / n) * Math.PI * 2 + t * b.spd;
    const rx = A.w * (ring ? 0.47 : 0.36), ry = A.h * (ring ? 0.42 : 0.3);
    return { x: A.x + A.w / 2 + Math.cos(a) * rx, y: A.y + A.h / 2 + Math.sin(a) * ry + Math.sin(t * 2.3 + b.ph) * A.h * 0.05 };
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

  function scale() { return Math.max(0.32, G.unit * 0.62); }

  function add(id, band, x, y) {
    const b = { id, band, lane: laneFree(), ph: Math.random() * 0.6, spd: 0.32 + Math.random() * 0.08, scripted: true, x, y, vx: 0 };
    const sc = SCHEMES[id % SCHEMES.length];
    b.s = new PIXI.AnimatedSprite(G.tex.fly[sc]); b.s.anchor.set(0.5); b.s.animationSpeed = 0.42; b.s.play();
    b.tag = makeTag(band);
    b.c = new PIXI.Container(); b.c.addChild(b.s); b.c.addChild(b.tag);
    b.tag.x = 0; b.tag.y = 58;
    layer.addChild(b.c);
    birds.set(id, b);
    b.c.x = x; b.c.y = y;
    b.c.scale.set(scale() * 0.6);
    return b;
  }

  // Bird leaves its nest box and joins the holding pattern.
  function launch(id, band, x, y) {
    const b = add(id, band, x, y);
    b.tag.scale.set(0);
    Audio2.play('flap'); Audio2.play('coo', { pitch: id });
    FX.feathers(x, y, 10, { scale: G.unit + 0.2 });
    FX.pop(U.pick(['FLAP!', 'WHOOSH', 'COO!', 'FLAP FLAP']), x + U.rand(-40, 40) * G.unit, y - 50 * G.unit, '#FFD23F');
    const tgt = lanePos(b, G.time + 1.0);
    return new Promise((res) => {
      gsap.to(b.c.scale, { x: scale() * 1.25, y: scale() * 1.25, duration: U.T(0.35), ease: 'back.out(2)' });
      gsap.to(b, {
        motionPath: { path: [{ x, y }, { x: x + U.rand(-120, 120) * G.unit, y: y - 220 * G.unit }, { x: tgt.x, y: tgt.y }], curviness: 1.4 },
        duration: U.T(1.0), ease: 'power1.inOut',
        onUpdate: () => { b.c.x = b.x; b.c.y = b.y; },
        onComplete: () => {
          b.scripted = false;
          gsap.to(b.c.scale, { x: scale(), y: scale(), duration: 0.3 });
          gsap.to(b.tag.scale, { x: 1, y: 1, duration: U.T(0.3), ease: 'back.out(3)' });
          Audio2.play('tag');
          res();
        }
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
        gsap.fromTo(b.tag.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.3, ease: 'back.out(3)' });
      }
    }
    if (view.length) Audio2.play('tick');
  }

  // Bird dives to a nest box. Resolves when it arrives.
  function land(id, tx, ty) {
    let b = birds.get(id);
    if (!b) {
      // bird not on screen (e.g. instant landing): spawn it high above
      b = add(id, 0, tx + U.rand(-300, 300) * G.unit, -100);
      b.scripted = true;
    }
    b.scripted = true;
    gsap.killTweensOf(b);
    const sx = b.c.x, sy = b.c.y;
    b.x = sx; b.y = sy;
    gsap.to(b.tag, { alpha: 0, duration: 0.2 });
    Audio2.play('dive');
    return new Promise((res) => {
      gsap.to(b.c.scale, { x: scale() * 1.5, y: scale() * 1.5, duration: U.T(0.5) });
      b.s.animationSpeed = 0.7;
      gsap.to(b, {
        motionPath: { path: [{ x: sx, y: sy }, { x: (sx + tx) / 2 + U.rand(-160, 160) * G.unit, y: Math.min(sy, ty) - 120 * G.unit }, { x: tx, y: ty - 40 * G.unit }], curviness: 1.25 },
        duration: U.T(0.7), ease: 'power2.in',
        onUpdate: () => { b.c.x = b.x; b.c.y = b.y; },
        onComplete: () => {
          b.s.stop();
          b.s.textures = G.tex.perch[SCHEMES[b.id % SCHEMES.length]];
          b.s.gotoAndStop(0);
          FX.dust(tx, ty + 40 * G.unit, 10);
          FX.feathers(tx, ty, 6, { scale: G.unit + 0.2, power: 0.6 });
          Audio2.play('land');
          gsap.to(b.c, { y: ty, duration: 0.12 });
          gsap.timeline({ onComplete: () => { remove(id); } })
            .to(b.c, { y: ty - 8, duration: 0.08, yoyo: true, repeat: 1 })
            .add(() => b.s.gotoAndStop(1))
            .to(b.c.scale, { x: 0, y: 0, duration: U.T(0.25), ease: 'back.in(2)' }, '+=0.25');
          res();
        }
      });
    });
  }

  function remove(id) { const b = birds.get(id); if (!b) return; b.c.destroy({ children: true }); birds.delete(id); }
  function clear() { for (const id of [...birds.keys()]) remove(id); }

  function update() {
    const t = G.time;
    for (const b of birds.values()) {
      if (b.scripted) {
        const dx = b.c.x - (b._px || b.c.x); b._px = b.c.x;
        if (Math.abs(dx) > 0.5) b.s.scale.x = dx >= 0 ? 1 : -1;
        continue;
      }
      const p = lanePos(b, t);
      const dx = p.x - b.c.x;
      b.c.x = p.x; b.c.y = p.y;
      if (Math.abs(dx) > 0.1) b.s.scale.x = dx >= 0 ? 1 : -1;
      b.tag.x = 0; b.tag.y = 58;
      if (b.band <= 1) b.tag.rotation = Math.sin(t * 14 + b.id) * 0.12; else b.tag.rotation = 0;
    }
  }

  function syncFromState(flight) {
    // used when resuming: put birds in the air without animation
    clear();
    for (const f of flight) {
      const b = add(f.id, f.band, G.W / 2, G.holdArea.y);
      b.scripted = false; b.c.scale.set(scale());
    }
  }

  function relayout() { for (const b of birds.values()) if (!b.scripted) b.c.scale.set(scale()); }

  return { build, launch, land, tick, update, clear, remove, syncFromState, relayout, birds, get count() { return birds.size; } };
})();

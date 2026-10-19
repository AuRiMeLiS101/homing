/* Homing game core: shared state, helpers, texture building. */
const G = {
  app: null, W: 0, H: 0, portrait: false, uiH: 90,
  speed: 1, hurry: false, turbo: false, reduced: false,
  tex: {}, boil: 0, time: 0, timeScale: 1, camReady: false,
  layers: {},
  mode: 'base'
};
// reduced: the OS asks for less motion, or the player switched on the calm screen in settings
G.osReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
G.reduced = G.osReduced;

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  // duration helper respecting turbo and hurry
  T(d) { return d / (G.hurry ? Math.max(4, G.speed * 2.5) : G.speed); },
  wait(ms) { return new Promise((r) => setTimeout(r, U.T(ms / 1000) * 1000)); },
  waitReal(ms) { return new Promise((r) => setTimeout(r, ms)); },
  frame() { return new Promise((r) => requestAnimationFrame(() => r())); },
  fmt(cents) {
    const v = Math.round(cents) / 100;
    return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  hex(c) { return typeof c === 'number' ? c : parseInt(c.replace('#', ''), 16); },
  mixColor(a, b, t) {
    a = U.hex(a); b = U.hex(b);
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
  },
  tl(vars) { return gsap.timeline(vars); },
  promise(tween) { return new Promise((r) => { if (!tween) return r(); tween.eventCallback ? tween.eventCallback('onComplete', r) : r(); }); }
};

const COL = {
  INK: 0x1B1622, PAPER: 0xF6ECD8, PAPER2: 0xE8D8B8, TEAL: 0x00838A, TEALD: 0x0A4F5C, TEALL: 0x46B9B1,
  ORANGE: 0xFF6A2B, YELLOW: 0xFFD23F, PINK: 0xFF4FA3, VIOLET: 0x5B3E96, VIOLETD: 0x33225E, VIOLETL: 0x8C72C9,
  CORAL: 0xF2675E, BLUE: 0x2C6BD8, NIGHT: 0x241D45, WOOD: 0xB9773F, BOX: 0x2A1E2B
};

// ---------- texture building ----------
function texFrom(canvas, mip) {
  try {
    const src = new PIXI.CanvasSource({ resource: canvas, autoGenerateMipmaps: !!mip });
    return new PIXI.Texture({ source: src });
  } catch (e) {
    return PIXI.Texture.from(canvas);
  }
}

async function buildTextures(progress) {
  const T = G.tex;
  const S = HomingSymbols, B = HomingBirds, W = HomingWorld;
  const jobs = [];
  const kinds = ['A', 'K', 'Q', 'J', 'T', 'TEA', 'RAD', 'SEED', 'BINO', 'CHAMP', 'GENA', 'BIRD', 'CLOCK'];
  T.sym = {}; T.symCanvas = {};
  for (const k of kinds) jobs.push(() => {
    T.sym[k] = [1, 2, 3].map((seed) => {
      const c = W.sticker(S.paintSymbol(k, 1, seed), 12);
      if (seed === 1) T.symCanvas[k] = c;
      return texFrom(c, true);
    });
  });
  T.cap = {};
  for (const k of ['COIN', 'MULT', 'FLOCK']) jobs.push(() => { T.cap[k] = texFrom(W.sticker(S.paintSymbol('CAP_' + k, 1, 2), 10), true); });
  // birds: every breed gets the whole frame set, each frame painted whole
  const bs = 0.42 * Math.min(1.5, Math.max(1, window.devicePixelRatio || 1));
  T.birdS = bs; T.bird = {}; T.fly = {}; T.perch = {};
  for (const br of B.ORDER) jobs.push(() => {
    const set = {};
    for (const n of B.frameNames()) set[n] = texFrom(B.frameCanvas(n, br, bs, { cache: {} }), true);
    T.bird[br] = set;
    T.fly[br] = Array.from({ length: B.FLAP_N }, (_, i) => set['flap' + i]);
    T.perch[br] = [set.perch, set.perchBob];
  });
  // close ups for near misses: big flap frames for two breeds, magnified on screen so no mipmaps
  jobs.push(() => {
    const ns = 0.95 * Math.min(1.4, Math.max(1, window.devicePixelRatio || 1));
    T.nearS = ns; T.near = {};
    for (const br of ['grey', 'white']) T.near[br] = [0, 2, 4, 6, 8].map((i) => texFrom(B.frameCanvas('flap' + i, br, ns, { cache: {} }), false));
  });
  jobs.push(() => {
    T.silS = 0.16;
    T.sil = Array.from({ length: B.FLAP_N }, (_, i) => texFrom(B.silhouette('flap' + i, '#FFFFFF', T.silS), true));
    T.silGlide = texFrom(B.silhouette('glide', '#FFFFFF', T.silS), true);
  });
  jobs.push(() => { const s = Math.min(1.5, Math.max(1, (window.devicePixelRatio || 1) * 0.75)); T.loftScale = s; T.loft = texFrom(W.paintLoft(s, 4), true); });
  jobs.push(() => { T.cloud = [0, 1, 2].map((v) => texFrom(W.cloud(v, '#F7B3BF', '#E07A9C'), true)); T.cloudB = [0, 1, 2].map((v) => texFrom(W.cloud(v, '#FFC27A', '#F2675E'), true)); });
  jobs.push(() => { T.tram = texFrom(W.tram(), true); T.dish = texFrom(W.dish(), true); T.vent = texFrom(W.vent(), true); T.laundry = [0, 1, 2, 3].map((k) => texFrom(W.laundry(k), true)); });
  jobs.push(() => {
    T.feather = [texFrom(W.feather('#D2DCE0'), true), texFrom(W.feather('#F6ECD8'), true), texFrom(W.feather('#9FB0B8'), true)];
    T.splat = [texFrom(W.splat(1, '#FFFFFF'), true), texFrom(W.splat(2, '#FFFFFF'), true), texFrom(W.splat(3, '#FFFFFF'), true)];
    T.sparkle = texFrom(W.sparkle('#FFFFFF'), true);
    T.dot = texFrom(W.dotTex(14, 32), true);
    T.soft = texFrom(W.softDot(128), true);
    T.dotTile = [texFrom(W.dotTex(5, 14)), texFrom(W.dotTex(3, 14)), texFrom(W.dotTex(1.6, 14))];
  });
  jobs.push(() => {
    const cols = ['#F2675E', '#2C6BD8', '#00838A', '#FFD23F', '#8C72C9', '#FF6A2B'];
    T.neigh = cols.map((c) => [texFrom(W.neighbour(c, false), true), texFrom(W.neighbour(c, true), true)]);
    T.medal = texFrom(W.medallion(), true);
    T.bannerPink = texFrom(W.banner(620, 150, '#FF4FA3'), true);
    T.bannerPaper = texFrom(W.banner(620, 150, '#F6ECD8'), true);
    T.bannerYellow = texFrom(W.banner(620, 150, '#FFD23F'), true);
  });
  jobs.push(() => {
    T.coin = texFrom(W.coin(), true); T.coinEdge = texFrom(W.coinEdge(), true);
    T.pennant = ['#FF4FA3', '#FFD23F', '#46B9B1', '#FF6A2B', '#F6ECD8', '#8C72C9'].map((c) => texFrom(W.pennant(c), true));
    T.bulb = texFrom(W.bulb(), true);
    T.rosette = ['#F6ECD8', '#FFD23F', '#FF4FA3', '#FF6A2B', '#46B9B1', '#8C72C9'].map((c) => texFrom(W.rosette(c), true));
    T.streak = texFrom(W.streak(), true); T.plane = texFrom(W.plane(), true); T.crate = texFrom(W.crate(), true);
  });
  // white pixel for rects
  jobs.push(() => { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); T.white = texFrom(c); });
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]();
    if (progress) progress((i + 1) / jobs.length);
    await U.frame();
  }
}

function sprite(tex, ax, ay) {
  const s = new PIXI.Sprite(tex);
  s.anchor.set(ax == null ? 0.5 : ax, ay == null ? (ax == null ? 0.5 : ax) : ay);
  return s;
}

// Text helpers. Display face for stamps; mono for numbers.
function stampText(str, size, fill, opts) {
  opts = opts || {};
  const t = new PIXI.Text({
    text: str,
    style: {
      fontFamily: '"Big Shoulders Stencil", "Arial Narrow", Impact, sans-serif',
      fontWeight: '900', fontSize: size, fill: fill || '#F6ECD8',
      stroke: { color: '#1B1622', width: Math.max(4, size * 0.09), join: 'round' },
      dropShadow: opts.shadow === false ? false : { color: opts.shadowColor || '#1B1622', alpha: 1, angle: Math.PI / 4, distance: Math.max(3, size * 0.06), blur: 0 },
      letterSpacing: opts.letterSpacing || 0,
      align: 'center', padding: 12
    }
  });
  t.anchor.set(0.5);
  return t;
}
function monoText(str, size, fill, opts) {
  opts = opts || {};
  const t = new PIXI.Text({
    text: str,
    style: {
      fontFamily: '"IBM Plex Mono", ui-monospace, Menlo, monospace', fontWeight: '700', fontSize: size, fill: fill || '#1B1622',
      stroke: opts.stroke ? { color: opts.stroke, width: opts.strokeW || 6, join: 'round' } : undefined,
      dropShadow: opts.shadow ? { color: '#1B1622', alpha: 1, angle: Math.PI / 4, distance: Math.max(2, size * 0.06), blur: 0 } : false,
      padding: 8
    }
  });
  t.anchor.set(0.5);
  return t;
}
function labelText(str, size, fill) {
  const t = new PIXI.Text({ text: str, style: { fontFamily: '"Archivo", Arial, sans-serif', fontWeight: '800', fontSize: size, fill: fill || '#1B1622', letterSpacing: size * 0.18, padding: 6 } });
  t.anchor.set(0.5);
  return t;
}

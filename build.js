// Build Homing into single pages.
//   node build.js
//   dist/index.html   the deployed game: libraries and fonts self hosted from dist/vendor and dist/fonts
//   dist/dev.html     same page, used by the headless tests (test/play.js)
//   dist/homing.html  artifact page: libraries from jsDelivr, fonts from Google Fonts (claude.ai artifacts allow these CDNs only)
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, p), 'utf8');
const D = (p) => path.join(__dirname, 'dist', p);

const order = [
  'src/engine.js', 'src/config.js',
  'src/art_core.js', 'src/art_symbols.js', 'src/art_birds.js', 'src/art_gennady.js', 'src/art_world.js', 'src/art_logo.js',
  'src/game/core.js', 'src/game/fx.js', 'src/game/audio.js', 'src/game/world.js', 'src/game/loft.js', 'src/game/flight.js',
  'src/game/gennady.js', 'src/game/hud.js', 'src/game/intro.js', 'src/game/ui.js', 'src/game/main.js'
];
const app = order.map((f) => `/* ---- ${f} ---- */\n` + R(f)).join('\n');
const tpl = R('src/index.html');

// [package file, published name, CDN url]
const LIBS = [
  ['pixi.js/dist/pixi.min.js', 'pixi.min.js', 'https://cdn.jsdelivr.net/npm/pixi.js@8.20.1/dist/pixi.min.js'],
  ['pixi-filters/dist/pixi-filters.js', 'pixi-filters.js', 'https://cdn.jsdelivr.net/npm/pixi-filters@6.1.5/dist/pixi-filters.js'],
  ['gsap/dist/gsap.min.js', 'gsap.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js'],
  ['gsap/dist/MotionPathPlugin.min.js', 'MotionPathPlugin.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/MotionPathPlugin.min.js'],
  ['gsap/dist/CustomEase.min.js', 'CustomEase.min.js', 'https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/CustomEase.min.js'],
  ['tone/build/Tone.js', 'Tone.js', 'https://cdn.jsdelivr.net/npm/tone@15.1.22/build/Tone.js']
];
// [family, weight, fontsource package]
const FONTS = [
  ['Big Shoulders Stencil', 700, 'big-shoulders-stencil'], ['Big Shoulders Stencil', 800, 'big-shoulders-stencil'], ['Big Shoulders Stencil', 900, 'big-shoulders-stencil'],
  ['Archivo', 400, 'archivo'], ['Archivo', 600, 'archivo'], ['Archivo', 700, 'archivo'], ['Archivo', 800, 'archivo'], ['Archivo', 900, 'archivo'],
  ['IBM Plex Mono', 500, 'ibm-plex-mono'], ['IBM Plex Mono', 700, 'ibm-plex-mono']
];
const googleFonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;700;800;900&family=Big+Shoulders+Stencil:wght@700;800;900&family=IBM+Plex+Mono:wght@500;700&display=swap">';

fs.mkdirSync(D('vendor'), { recursive: true });
fs.mkdirSync(D('fonts'), { recursive: true });
for (const [src, name] of LIBS) fs.copyFileSync(path.join(__dirname, 'node_modules', src), D('vendor/' + name));
let css = '';
for (const [family, weight, pkg] of FONTS) {
  const file = `${pkg}-latin-${weight}-normal.woff2`;
  fs.copyFileSync(path.join(__dirname, 'node_modules/@fontsource', pkg, 'files', file), D('fonts/' + file));
  css += `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(${file}) format("woff2")}\n`;
}
fs.writeFileSync(D('fonts/fonts.css'), css);
const preload = ['big-shoulders-stencil-latin-900-normal.woff2', 'archivo-latin-800-normal.woff2', 'archivo-latin-900-normal.woff2', 'ibm-plex-mono-latin-700-normal.woff2']
  .map((f) => `<link rel="preload" href="fonts/${f}" as="font" type="font/woff2" crossorigin>`).join('\n');
const localFonts = preload + '\n<link rel="stylesheet" href="fonts/fonts.css">';

const fill = (libs, fontsTag) => tpl
  .replace('{{FONTS}}', fontsTag)
  .replace('{{LIBS}}', libs.map((u) => `<script src="${u}"></script>`).join('\n'))
  .replace('{{APP}}', () => app.replace(/<\/script>/g, '<\\/script>'));

const head = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<meta name="theme-color" content="#241D45"><meta name="description" content="HOMING: rooftop pigeon racing slot. Play money only, FUN credits have no cash value.">'
  + '<style>[hidden]{display:none!important}</style></head><body>';
const local = head + fill(LIBS.map((l) => 'vendor/' + l[1]), localFonts) + '</body></html>';

fs.writeFileSync(D('index.html'), local);
fs.writeFileSync(D('dev.html'), local);
fs.writeFileSync(D('homing.html'), fill(LIBS.map((l) => l[2]), googleFonts));

const kb = (f) => (fs.statSync(D(f)).size / 1024).toFixed(1) + ' KB';
console.log('dist/index.html', kb('index.html'), '| dist/homing.html', kb('homing.html'), '| vendor', LIBS.length, 'libs | fonts', FONTS.length);

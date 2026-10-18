# Homing

Original browser slot game, play money only (FUN credits, no cash value). Gennady, a retired tram driver, races pigeons from a loft on the roof of a nine storey panel block. Risograph print look, synthesized score.

## Run it

```
npm install
node build.js        # writes dist/index.html (the deployed game), dist/dev.html (same page, for tests), dist/homing.html (artifact page)
npx serve dist       # or any static server, then open /index.html
```

`dist/index.html` is self hosted: build.js copies the pinned libraries into `dist/vendor/` (pixi.js 8.20.1, pixi-filters 6.1.5, gsap 3.15.0 with MotionPathPlugin and CustomEase, tone 15.1.22) and the fonts into `dist/fonts/` (Big Shoulders Stencil, Archivo, IBM Plex Mono from @fontsource). `dist/homing.html` loads the same versions from jsDelivr and Google Fonts for publishing as a claude.ai artifact.

## Deploy

Vercel builds every push to `main` (see `vercel.json`: install `npm ci`, build `node build.js`, output `dist`). Pull requests and other branches get preview URLs.

## Layout

- `src/engine.js` math engine (UMD). `createEngine(cfg, rng).playRound(bet, {buy})` returns `{win, events, race, trigger, capped}`. Amounts in integer cents.
- `src/config.js` paytable, weights, bands, coins, multipliers, max win 5,000x, buy price 67x.
- `sim/run.js` simulator: `node sim/run.js 30000000 1` and `node sim/run.js 2000000 1 --buy`. Current results: base RTP 95.9%, buy RTP 96.3%, hit 1 in 2.9, Race Day 1 in 194, avg race 66x. Any math change means re running the sim and updating STATS in `src/game/main.js` and the rules copy in `src/index.html`.
- `src/art_*.js` procedural canvas painting (symbols, birds, Gennady parts, loft, world props). Line boil uses 3 displaced variants.
- `src/game/` runtime: `core.js` (globals, textures), `fx.js` (particles, shake, RGB split, shockwave, zoom blur, stamps, wipes), `audio.js` (Tone.js mix: music, sfx, ambience buses), `world.js` (sky, city, tram, flock, neighbours), `loft.js` (grid, drops, tumbles, capsules), `flight.js` (birds in the air), `gennady.js` (cut out IK rig, faces, acts), `hud.js` (win ticket, Race Day board, big win show), `intro.js`, `ui.js` (HTML control strip and modals), `main.js` (layout and game flow).
- `src/index.html` page template, CSS, start splash with three feature cards.
- `build.js` concatenates everything in a fixed order.

## Testing

- `node test/play.js test/out/prefix 1440 900 "test=race&fast=1" start ready spin wait:3000 shot:a until-idle shot:z` serves `dist/` over HTTP and drives headless Chromium (SwiftShader, slow). Needs Playwright (`npm i -g playwright`). `test=birds` and `test=race` boost those symbols, `fast=1` disables gsap lag smoothing so tests run in wall time.
- `node test/audio_qa.js && python3 test/audio_report.py` renders every sound and both tracks and prints peak and LUFS. Current targets: music around -24 LUFS, coins -28 to -23, stamps around -20, no clipping.

## Rules of the project

Original only: no existing characters, studio mechanic names or UI shells. Every number shown to players comes from the simulator. Play money labeled on screen. Never fake near misses; anticipation only when the result really holds two clocks early.

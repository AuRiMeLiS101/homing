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

Live at https://homing-three.vercel.app. Vercel builds every push to `main` (see `vercel.json`: install `npm ci`, build `node build.js`, output `dist`). Pull requests and other branches get preview URLs.

## Layout

- `src/engine.js` math engine (UMD). `createEngine(cfg, rng).playRound(bet, {buy})` returns `{win, events, race, trigger, capped}`. Amounts in integer cents.
- `src/config.js` paytable, weights, bands, coins, multipliers, max win 5,000x, buy price 67x.
- `sim/run.js` simulator: `node sim/run.js 30000000 1` and `node sim/run.js 2000000 1 --buy`. Current results: base RTP 95.9%, buy RTP 96.3%, hit 1 in 2.9, Race Day 1 in 194, avg race 66x. Any math change means re running the sim and updating STATS in `src/game/main.js` and the rules copy in `src/index.html`.
- `src/art_core.js` print toolkit: misregistered colour plates, halftone shading, merged ink outlines (`Ink` groups), smooth noise boil.
- `src/art_gennady.js` Gennady painted whole for every pose (two outfits, key poses, the pet pigeon). `test/gena_sheet.html` renders the character sheet.
- `src/art_birds.js` parametric pigeons in five breeds: 3D wings seen from a raised camera, a 10 frame flap cycle, glide, bank, dive, flare, takeoff and perched frames. `test/bird_sheet.html?s=1&b=grey,red&f=flap0,glide` renders any subset.
- `src/art_symbols.js`, `src/art_world.js` symbols, loft, props, coins, festoons, crate.
- `src/game/` runtime: `core.js` (globals, textures), `fx.js` (particles with a frame time budget, shake, RGB split, shockwave, zoom blur, camera punches, slow motion, coin flights, confetti cannons, rockets, stamps, wipes), `audio.js` (Tone.js mix: music, sfx and ambience buses with their own switches; base track and Race Day polka with layers that join as a cascade climbs; the Champion's Polka for big wins; stingers), `world.js` (sky, city, tram, flock, neighbours, parallax, gusts, drizzle, the passing plane, Race Day festoons), `loft.js` (grid, drops, tumbles, capsules, coins to the ticket), `flight.js` (steering flight, landings, near misses past the lens, flock passes), `gennady.js` (adaptive repaint, springs, acts, pet perches, crate), `hud.js` (rolling win ticket, chain rosette, Race Day board, tiered big win show), `intro.js`, `ui.js` (the ticket strip, paper sheets with tabs, autoplay rules, bet picker, settings), `main.js` (layout and game flow).
- `src/index.html` page template, CSS, start splash with three feature cards.
- `build.js` concatenates everything in a fixed order.

## Testing

- `node test/play.js test/out/prefix 1440 900 "test=race&fast=1" start ready spin wait:3000 shot:a until-idle shot:z` serves `dist/` over HTTP and drives headless Chromium (SwiftShader, slow). Needs Playwright (`npm i -g playwright`). `test=birds` and `test=race` boost those symbols, `fast=1` disables gsap lag smoothing so tests run in wall time and exposes `window.__homing` (engine and state).
- Steps worth knowing: `until:<js>` waits for a condition, `freeze` stops the game clock and `step:<seconds>` advances it by hand so a fleeting moment can be framed exactly, `thaw` resumes, `settle` waits for page animations, `evalfile:test/targets.js` audits touch targets (every control 44 by 44 or larger). A seeded engine replays a known round: `eval:__homing.setEngine(HomingEngine.createEngine(HOMING_CONFIG, HomingEngine.seededRng(1429))),1` then `spin` gives a six step cascade; seed 72 starts Race Day with three clocks, seed 154 a big Race Day.
- `node test/audio_qa.js && python3 test/audio_report.py` renders every sound, the three tracks with their layers and the slow motion beat, and prints peak and LUFS. Targets: base music around minus 24 LUFS, race and victory around minus 21, coins minus 28 to minus 21, stamps and tier hits around minus 20, no clipping.
- `node test/audio_stress.js` fires every sound alone, every pair in one frame, and random storms over all three tracks with slow motion, then reports sounds the mixer had to swallow (Tone refuses a voice scheduled out of order). Expect 0.

## Rules of the project

Original only: no existing characters, studio mechanic names or UI shells. Every number shown to players comes from the simulator. Play money labeled on screen. Never fake near misses; anticipation only when the result really holds two clocks early.

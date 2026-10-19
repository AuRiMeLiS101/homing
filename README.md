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
- `src/art_gennady.js` Gennady's painter: the whole figure for any pose (two outfits, key poses, the pet pigeon; `test/gena_sheet.html` renders the character sheet), and `parts`, the same drawing split into the plates the runtime puppet uses (limb segments as ink and paint plates, hands per pose, torso, head layers, cap, props).
- `src/art_birds.js` parametric pigeons in five breeds: 3D wings seen from a raised camera, a 10 frame flap cycle, glide, bank, dive, flare, takeoff and perched frames. `test/bird_sheet.html?s=1&b=grey,red&f=flap0,glide` renders any subset.
- `src/art_symbols.js`, `src/art_world.js` symbols, loft, props, coins, festoons, crate.
- `src/art_logo.js` the HOMING logo: custom lettering built from geometry on a bridge with a racing slant, the O as the race clock with a pigeon landing on its crown, a tram ticket plaque; layered like a printed sticker (cast shadow, extrusion with an outer keyline, orange rim, ink keyline, cream face with a cut bevel and one gloss pass). `paint()` gives one canvas at any scale, `layers()` the same lockup split into registered canvases plus flight frames for the bird, `measure()` its size before painting. `test/logo.html` renders it big, at the corner sizes and in grayscale.
- `src/game/` runtime: `core.js` (globals, textures), `fx.js` (particles with a frame time budget, shake, RGB split, shockwave, zoom blur, camera punches, slow motion, coin flights, confetti cannons, rockets, stamps, wipes), `audio.js` (Tone.js mix: music, sfx and ambience buses with their own switches; base track and Race Day polka with layers that join as a cascade climbs; the Champion's Polka for big wins; stingers), `world.js` (sky, city, tram, flock, neighbours, parallax, gusts, drizzle, the passing plane, Race Day festoons), `loft.js` (grid, drops, tumbles, capsules, coins to the ticket), `flight.js` (steering flight, landings, near misses past the lens, flock passes), `gennady.js` (the puppet: parts on the GPU every frame, a torso mesh that breathes and squashes, head plates repainted only when his face changes; a physics layer of joint springs pushed by the body's own accelerations, elbow bends from the key poses, hands that sweep round the shoulder, ballistic jumps with crouch and landing; acts, pet perches, the crate, the portrait mask that hides him behind the loft), `hud.js` (rolling win ticket, chain rosette, Race Day board, tiered big win show), `intro.js` (the title is the live evening seen from high above the roofs, the logo in the sky and a pigeon landing on its clock; punching the ticket starts one camera move down through the city's depth layers past the flock to the roof, where Gennady lowers his binoculars and waves, the loft fills and the logo glides into its corner; a tap skips), `ui.js` (the ticket strip, paper sheets with tabs, autoplay rules, bet picker, settings), `main.js` (layout and game flow).
- `src/index.html` page template, CSS, the title (the painted logo stack, three feature cards, the ticket to punch) laid over the live world.
- `build.js` concatenates everything in a fixed order.

## Testing

- `node test/play.js test/out/prefix 1440 900 "test=race&fast=1" start ready spin wait:3000 shot:a until-idle shot:z` serves `dist/` over HTTP and drives headless Chromium (SwiftShader, slow). Needs Playwright (`npm i -g playwright`). `test=birds` and `test=race` boost those symbols, `fast=1` disables gsap lag smoothing so tests run in wall time and exposes `window.__homing` (engine and state).
- Steps worth knowing: `until:<js>` waits for a condition, `freeze` stops the game clock and `step:<seconds>` advances it by hand so a fleeting moment can be framed exactly, `thaw` resumes, `settle` waits for page animations, `evalfile:test/targets.js` audits touch targets (every control 44 by 44 or larger). A seeded engine replays a known round: `eval:__homing.setEngine(HomingEngine.createEngine(HOMING_CONFIG, HomingEngine.seededRng(1429))),1` then `spin` gives a six step cascade; seed 72 starts Race Day with three clocks, seed 154 a big Race Day.
- Gennady on his own: `node test/rig_motion.js test/out/rig cheer,bigV,roar 60` records each act frame by frame (1/30 s) on a bare stage (`test/gena_rig.html`, seconds per act instead of minutes) and writes an mp4 per act; `poses:idle+cheer+gasp` settles into key poses, `parts` dumps every baked plate on one sheet. `node test/motion.js 1440 900 cheer,bigV 60` records the same inside the game.
- Crops: `node test/sizes.js test/out/sz/idle 1440x900,390x844,667x375,820x1180` screenshots one page load at many sizes (it resizes between shots), optionally after an eval.
- `test/logo.html` renders the logo lockup big, at the desktop and phone corner sizes, on a retina corner and in grayscale (`node test/shot.js test/logo.html test/out/logo.png 1600 1000`). The intro can be framed exactly: `click:#startBtn "until:document.getElementById('start').classList.contains('go')" freeze step:0.5 shot:a ...` steps its camera move, and `node test/intro_rec.js test/out/rec 1280 800 2.4 5.4` records the title (the pigeon landing on the clock) and the whole intro one 1/30 s step at a time into an mp4.
- `node test/audio_qa.js && python3 test/audio_report.py` renders every sound, the three tracks with their layers and the slow motion beat, and prints peak and LUFS. Targets: base music around minus 24 LUFS, race and victory around minus 21, coins minus 28 to minus 21, stamps and tier hits around minus 20, no clipping.
- `node test/audio_stress.js` fires every sound alone, every pair in one frame and random storms over all three tracks, then replays the real sequences (the Race Day intro, Race Day spins under fireworks, a full big win show) in a fresh page. It reports errors the mixer swallowed (expect 0) and notes each voice pool had to skip because all its voices were booked: the storms skip plenty by design, the real sequences should skip only firework sparkle.

## Rules of the project

Original only: no existing characters, studio mechanic names or UI shells. Every number shown to players comes from the simulator. Play money labeled on screen. Never fake near misses; anticipation only when the result really holds two clocks early.

/* Homing sound: synthesized score and sound design on Tone.js.
   Buses: music, sfx, ambience -> compressor -> limiter. Reverb as a send. */
const Audio2 = (function () {
  let ready = false, muted = false;
  let T, master, musicBus, musicLP, sfxBus, ambBus, reverb, delay;
  const I = {}; // instruments
  const parts = { base: [], race: [], victory: [] };
  let track = null, wind = null, hum = null, raceLoop = 0;
  // intensity: how far the current cascade has climbed (layers join the band); vLevel: big win tier on screen
  let iLevel = 0, vLevel = 0;
  let rainN = null, rainG = null, crowdN = null, crowdG = null;
  const last = {};
  let tPrev = 0;
  // sound errors are swallowed so they never break a round, but counted so the tests can see them
  const errs = { n: 0, last: '' };
  function noteErr(name, e) { errs.n++; errs.last = name + ': ' + (e && e.message ? e.message : e); }
  const busOn = { music: true, sfx: true, amb: true }, onG = {}, sendR = {}, sendD = {};
  function setBus(name, on) {
    busOn[name] = !!on;
    if (!ready || !onG[name]) return;
    [onG[name], sendR[name], sendD[name]].forEach((g) => g && g.gain.rampTo(on ? 1 : 0, 0.25));
  }

  // A small pool of identical monophonic voices. Tone sources must be scheduled in time order per voice, so each
  // trigger takes a voice that is free at that time, or else restarts the one closest to finishing; it never lands
  // behind a note already pending on a voice (which Tone refuses). Same interface as the voices it stands in for.
  function pool(Ctor, opts, n, noise) {
    const inst = [], end = [], start = [], rel = [];
    for (let i = 0; i < n; i++) { const v = new Ctor(opts); inst.push(v); end.push(0); start.push(-1); rel.push(T.Time(v.envelope.release).toSeconds()); }
    let rr = 0;
    const P = {
      inst,
      volume: { get value() { return inst[0].volume.value; }, set value(x) { inst.forEach((v) => { v.volume.value = x; }); } },
      connect(node) { inst.forEach((v) => v.connect(node)); return P; },
      // noise voices take (duration, time, velocity), tonal ones (note, duration, time, velocity)
      triggerAttackRelease(a, b, c, d) {
        const dur = T.Time(noise ? a : b).toSeconds(), t = T.Time(noise ? b : c).toSeconds();
        let k = -1;
        for (let j = 0; j < n && k < 0; j++) { const i = (rr + j) % n; if (end[i] <= t) k = i; }
        if (k < 0) for (let i = 0; i < n; i++) if (start[i] < t && (k < 0 || end[i] < end[k])) k = i;
        if (k < 0) return P;
        rr = (k + 1) % n; start[k] = t; end[k] = t + dur + rel[k];
        if (noise) inst[k].triggerAttackRelease(dur, t, c); else inst[k].triggerAttackRelease(a, dur, t, d);
        return P;
      }
    };
    return P;
  }

  function route(node, bus, send, dly) {
    node.connect(bus);
    // reverb and echo sends go through the bus's own send gain, so switching a bus off also silences its tails
    const k = bus === musicBus ? 'music' : bus === ambBus ? 'amb' : 'sfx';
    if (send) { const g = new T.Gain(send); node.connect(g); g.connect(sendR[k]); }
    if (dly) { const g2 = new T.Gain(dly); node.connect(g2); g2.connect(sendD[k]); }
    return node;
  }

  async function init() {
    if (ready || typeof Tone === 'undefined') return;
    T = Tone;
    await T.start();
    const ctx = T.getContext();
    try { ctx.lookAhead = 0.05; } catch (e) { /* older */ }
    const limiter = new T.Limiter(-1).toDestination();
    const comp = new T.Compressor({ threshold: -18, ratio: 3, attack: 0.004, release: 0.18 }).connect(limiter);
    master = new T.Gain(0.92).connect(comp);
    // the band runs through a low pass so slow motion beats can pull it under water
    musicLP = new T.Filter({ frequency: 18000, type: 'lowpass', rolloff: -24 }).connect(master);
    // each bus has its own on/off gain, so ducks and fades never fight the player's settings
    onG.music = new T.Gain(busOn.music ? 1 : 0).connect(musicLP);
    onG.sfx = new T.Gain(busOn.sfx ? 1 : 0).connect(master);
    onG.amb = new T.Gain(busOn.amb ? 1 : 0).connect(master);
    musicBus = new T.Gain(0.5).connect(onG.music);
    sfxBus = new T.Gain(0.85).connect(onG.sfx);
    ambBus = new T.Gain(0.4).connect(onG.amb);
    reverb = new T.Reverb({ decay: 2.6, preDelay: 0.02 });
    reverb.wet.value = 1;
    reverb.connect(master);
    delay = new T.FeedbackDelay('8n.', 0.28);
    delay.wet.value = 1;
    delay.connect(master);
    for (const k of ['music', 'sfx', 'amb']) { sendR[k] = new T.Gain(busOn[k] ? 1 : 0).connect(reverb); sendD[k] = new T.Gain(busOn[k] ? 1 : 0).connect(delay); }
    try { await reverb.generate(); } catch (e) { /* ignore */ }

    // ---------- music instruments ----------
    const accFilter = new T.Filter(2300, 'lowpass');
    const accTrem = new T.Tremolo(5.6, 0.22).start();
    I.acc = new T.PolySynth(T.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 22 }, envelope: { attack: 0.035, decay: 0.2, sustain: 0.72, release: 0.28 } });
    I.acc.volume.value = -19;
    I.acc.chain(accFilter, accTrem);
    route(accTrem, musicBus, 0.22);

    I.bass = new T.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.004, decay: 0.32, sustain: 0.18, release: 0.2 }, filter: { Q: 1, type: 'lowpass', rolloff: -24 }, filterEnvelope: { attack: 0.002, decay: 0.16, sustain: 0.2, baseFrequency: 160, octaves: 2.6 } });
    I.bass.volume.value = -7;
    route(I.bass, musicBus, 0.04);

    I.tuba = new T.MonoSynth({ oscillator: { type: 'square' }, envelope: { attack: 0.02, decay: 0.18, sustain: 0.5, release: 0.12 }, filter: { Q: 1.5, type: 'lowpass', rolloff: -24 }, filterEnvelope: { attack: 0.02, decay: 0.14, sustain: 0.35, baseFrequency: 110, octaves: 2.4 } });
    I.tuba.volume.value = -9;
    route(I.tuba, musicBus, 0.05);

    I.keys = new T.PolySynth(T.FMSynth, { harmonicity: 3, modulationIndex: 2.4, envelope: { attack: 0.004, decay: 0.55, sustain: 0.08, release: 0.7 }, modulationEnvelope: { attack: 0.004, decay: 0.28, sustain: 0, release: 0.3 } });
    I.keys.volume.value = -23;
    route(I.keys, musicBus, 0.25);

    const brassVib = new T.Vibrato(5.4, 0.08);
    I.brass = new T.PolySynth(T.MonoSynth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.03, decay: 0.15, sustain: 0.8, release: 0.12 }, filter: { Q: 1, type: 'lowpass', rolloff: -24 }, filterEnvelope: { attack: 0.035, decay: 0.2, sustain: 0.55, baseFrequency: 420, octaves: 2.6 } });
    I.brass.volume.value = -17;
    I.brass.connect(brassVib);
    route(brassVib, musicBus, 0.2, 0.08);

    const clarF = new T.Filter(1500, 'lowpass');
    I.clar = new T.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.25 } });
    I.clar.volume.value = -27;
    I.clar.connect(clarF);
    route(clarF, musicBus, 0.3);

    I.glock = new T.PolySynth(T.FMSynth, { harmonicity: 5.07, modulationIndex: 8, envelope: { attack: 0.001, decay: 1.1, sustain: 0, release: 1 }, modulationEnvelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.2 } });
    I.glock.volume.value = -17;
    route(I.glock, musicBus, 0.3);
    // the same bell voice for sound effects, on the sfx bus so music ducks never swallow it
    I.sglock = new T.PolySynth(T.FMSynth, { harmonicity: 5.07, modulationIndex: 8, envelope: { attack: 0.001, decay: 1.0, sustain: 0, release: 0.9 }, modulationEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.2 } });
    I.sglock.maxPolyphony = 24;
    I.sglock.volume.value = -9;
    route(I.sglock, sfxBus, 0.28, 0.06);
    // solo accordion for the cold open, louder than the band version
    const soloF = new T.Filter(2600, 'lowpass');
    const soloTrem = new T.Tremolo(5.2, 0.28).start();
    I.accSolo = new T.PolySynth(T.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 26 }, envelope: { attack: 0.06, decay: 0.25, sustain: 0.75, release: 0.6 } });
    I.accSolo.volume.value = -8;
    I.accSolo.chain(soloF, soloTrem);
    route(soloTrem, sfxBus, 0.42, 0.1);

    I.kick = pool(T.MembraneSynth, { pitchDecay: 0.035, octaves: 5, envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 } }, 2, false);
    I.kick.volume.value = -9;
    route(I.kick, musicBus, 0.02);
    const snF = new T.Filter(1400, 'highpass');
    I.snare = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.3 } }, 3, true);
    I.snare.volume.value = -17; I.snare.connect(snF); route(snF, musicBus, 0.12);
    const brF = new T.Filter(3200, 'bandpass');
    I.brush = new T.NoiseSynth({ noise: { type: 'pink' }, envelope: { attack: 0.012, decay: 0.22, sustain: 0 } });
    I.brush.volume.value = -21; I.brush.connect(brF); route(brF, musicBus, 0.1);
    const hhF = new T.Filter(8200, 'highpass');
    I.hat = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 } });
    I.hat.volume.value = -27; I.hat.connect(hhF); route(hhF, musicBus, 0.04);
    const cyF = new T.Filter(5000, 'highpass');
    I.cym = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.002, decay: 1.4, sustain: 0, release: 0.6 } }, 3, true);
    I.cym.volume.value = -22; I.cym.connect(cyF); route(cyF, musicBus, 0.25);

    // ---------- sfx instruments ----------
    I.thunk = pool(T.MembraneSynth, { pitchDecay: 0.02, octaves: 2.4, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 } }, 2, false);
    I.thunk.volume.value = -9; route(I.thunk, sfxBus, 0.05);
    const clkF = new T.Filter(2600, 'highpass');
    I.click = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.018, sustain: 0, release: 0.05 } }, 3, true);
    I.click.volume.value = -18; I.click.connect(clkF); route(clkF, sfxBus);
    I.whF = new T.Filter(500, 'bandpass'); I.whF.Q.value = 0.7;
    I.whoosh = pool(T.NoiseSynth, { noise: { type: 'pink' }, envelope: { attack: 0.05, decay: 0.32, sustain: 0 } }, 2, true);
    I.whoosh.volume.value = 1; I.whoosh.connect(I.whF); route(I.whF, sfxBus, 0.15);
    I.flF = new T.Filter(720, 'bandpass'); I.flF.Q.value = 0.75;
    I.flap = pool(T.NoiseSynth, { noise: { type: 'brown' }, envelope: { attack: 0.002, decay: 0.075, sustain: 0, release: 0.06 } }, 2, true);
    I.flap.volume.value = 7; I.flap.connect(I.flF); route(I.flF, sfxBus, 0.1);
    const cooVib = new T.Vibrato(13, 0.22);
    const cooF = new T.Filter(900, 'lowpass');
    I.coo = new T.MonoSynth({ oscillator: { type: 'sine' }, portamento: 0.07, envelope: { attack: 0.04, decay: 0.08, sustain: 0.75, release: 0.12 }, filter: { type: 'lowpass', Q: 2 }, filterEnvelope: { baseFrequency: 320, octaves: 1.4, attack: 0.05, decay: 0.2, sustain: 0.5 } });
    I.coo.volume.value = -18;
    I.coo.chain(cooVib, cooF);
    route(cooF, sfxBus, 0.18);
    const whTrem = new T.Tremolo(36, 0.85).start();
    I.whistle = pool(T.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.008, decay: 0, sustain: 1, release: 0.05 } }, 3, false);
    I.whistle.volume.value = -19; I.whistle.connect(whTrem); route(whTrem, sfxBus, 0.25);
    I.bell = new T.PolySynth(T.FMSynth, { harmonicity: 3.72, modulationIndex: 12, envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 1.2 }, modulationEnvelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.4 } });
    I.bell.volume.value = -7; route(I.bell, sfxBus, 0.45);
    I.chime = new T.PolySynth(T.FMSynth, { harmonicity: 4.01, modulationIndex: 6, envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.6 }, modulationEnvelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 } });
    I.chime.maxPolyphony = 16;
    I.chime.volume.value = -5; route(I.chime, sfxBus, 0.3);
    I.blip = pool(T.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.03 } }, 3, false);
    I.blip.volume.value = -12; route(I.blip, sfxBus);
    I.popF = new T.Filter(800, 'bandpass'); I.popF.Q.value = 2;
    I.pop = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.1 } }, 2, true);
    I.pop.volume.value = -2; I.pop.connect(I.popF); route(I.popF, sfxBus, 0.08);
    I.drop = new T.MonoSynth({ oscillator: { type: 'sine' }, portamento: 0.06, envelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 } });
    I.drop.volume.value = -3; route(I.drop, sfxBus, 0.12);
    I.slapF = new T.Filter(3200, 'lowpass');
    I.slap = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.2 } }, 3, true);
    I.slap.volume.value = -9; I.slap.connect(I.slapF); route(I.slapF, sfxBus, 0.2);
    I.boom = pool(T.MembraneSynth, { pitchDecay: 0.06, octaves: 6, envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.3 } }, 3, false);
    I.boom.volume.value = -4; route(I.boom, sfxBus, 0.15);
    I.hit = new T.PolySynth(T.Synth, { oscillator: { type: 'fatsawtooth', count: 3, spread: 30 }, envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.4 } });
    I.hit.volume.value = -14; route(I.hit, sfxBus, 0.5);
    I.rsF = new T.Filter(300, 'bandpass'); I.rsF.Q.value = 3;
    I.riser = new T.Noise('white');
    I.riserG = new T.Gain(0); I.riser.connect(I.rsF); I.rsF.connect(I.riserG); route(I.riserG, sfxBus, 0.3);
    I.riser.start();
    I.crowd = [600, 1400, 2600].map((f) => {
      const fl = new T.Filter(f, 'bandpass'); fl.Q.value = 2.2;
      const n = pool(T.NoiseSynth, { noise: { type: 'pink' }, envelope: { attack: 0.35, decay: 1.6, sustain: 0.2, release: 1 } }, 2, true);
      n.volume.value = -5; n.connect(fl); route(fl, sfxBus, 0.35);
      return n;
    });
    I.fwF = new T.Filter(2200, 'lowpass');
    I.fw = pool(T.NoiseSynth, { noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 } }, 2, true);
    I.fw.volume.value = -6; I.fw.connect(I.fwF); route(I.fwF, sfxBus, 0.4);

    // shaker for the cascade layers, crowd shouts, the slow motion drone
    const shF = new T.Filter(6500, 'highpass');
    I.shaker = new T.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.004, decay: 0.05, sustain: 0 } });
    I.shaker.volume.value = -24; I.shaker.connect(shF); route(shF, musicBus, 0.06);
    I.hey = [[950, 1.3, 2], [2300, 2.2, -6]].map(([f, q, v]) => {
      const fl = new T.Filter(f, 'bandpass'); fl.Q.value = q;
      const n = pool(T.NoiseSynth, { noise: { type: 'pink' }, envelope: { attack: 0.012, decay: 0.16, sustain: 0.05, release: 0.08 } }, 2, true);
      n.volume.value = v; n.connect(fl); route(fl, sfxBus, 0.3);
      return n;
    });
    I.drone = new T.Synth({ oscillator: { type: 'fatsawtooth', count: 3, spread: 40 }, envelope: { attack: 0.25, decay: 0.2, sustain: 0.9, release: 0.4 } });
    const droneF = new T.Filter(420, 'lowpass');
    I.drone.volume.value = -20; I.drone.connect(droneF); route(droneF, sfxBus, 0.5);
    I.timp = pool(T.MembraneSynth, { pitchDecay: 0.08, octaves: 3, envelope: { attack: 0.002, decay: 0.9, sustain: 0, release: 0.4 } }, 2, false);
    I.timp.volume.value = -6; route(I.timp, musicBus, 0.25);

    // ---------- ambience ----------
    const windF = new T.AutoFilter({ frequency: 0.07, baseFrequency: 180, octaves: 2.6 }).start();
    wind = new T.Noise('brown'); wind.volume.value = -14; wind.connect(windF); windF.connect(ambBus); wind.start();
    const humF = new T.Filter(320, 'lowpass');
    hum = new T.Noise('pink'); hum.volume.value = -30; hum.connect(humF); humF.connect(ambBus); hum.start();
    // drizzle: a soft high hiss that comes and goes
    const rainF = new T.Filter(3800, 'highpass');
    const rainAM = new T.AutoFilter({ frequency: 0.3, baseFrequency: 2600, octaves: 1.5 }).start();
    rainG = new T.Gain(0);
    rainN = new T.Noise('pink'); rainN.volume.value = -12; rainN.chain(rainF, rainAM, rainG); rainG.connect(ambBus); rainN.start();
    // Race Day crowd: a murmur on the balconies that swells and settles
    const crF = new T.Filter(900, 'bandpass'); crF.Q.value = 0.8;
    const crAM = new T.Tremolo(0.35, 0.5).start();
    crowdG = new T.Gain(0);
    crowdN = new T.Noise('pink'); crowdN.volume.value = -10; crowdN.chain(crF, crAM, crowdG); crowdG.connect(ambBus); crowdN.start();

    buildMusic();
    ready = true;
    setMuted(muted);
  }

  // ---------- music ----------
  const q2t = (q) => { const bar = Math.floor(q / 4), beat = Math.floor(q % 4), six = Math.round(((q % 4) - beat) * 4); return `${bar}:${beat}:${six}`; };
  const qd = (d) => Tone.Time('4n').toSeconds() * d;

  const MEL_A = [[0, 'E4', 1], [1, 'A4', 0.5], [1.5, 'B4', 0.5], [2, 'C5', 1], [3, 'B4', 0.5], [3.5, 'A4', 0.5], [4, 'G#4', 1.5], [5.5, 'A4', 0.5], [6, 'B4', 2],
    [8, 'F4', 1], [9, 'A4', 0.5], [9.5, 'D5', 0.5], [10, 'F5', 1], [11, 'E5', 0.5], [11.5, 'D5', 0.5], [12, 'C5', 1.5], [13.5, 'D5', 0.5], [14, 'A4', 2],
    [16, 'B4', 1], [17, 'G#4', 0.5], [17.5, 'B4', 0.5], [18, 'D5', 1], [19, 'C5', 0.5], [19.5, 'B4', 0.5], [20, 'G#4', 1], [21, 'E4', 1], [22, 'F4', 0.5], [22.5, 'G#4', 0.5], [23, 'B4', 1],
    [24, 'A4', 0.5], [24.5, 'C5', 0.5], [25, 'E5', 1], [26, 'D5', 0.5], [26.5, 'C5', 0.5], [27, 'B4', 1], [28, 'A4', 2], [30, 'G#4', 1], [31, 'E4', 1]];
  const MEL_B = [[32, 'A4', 1], [33, 'C5', 0.5], [33.5, 'F5', 0.5], [34, 'E5', 1], [35, 'C5', 1], [36, 'D5', 1], [37, 'B4', 0.5], [37.5, 'G4', 0.5], [38, 'B4', 1], [39, 'D5', 1],
    [40, 'E5', 1.5], [41.5, 'D5', 0.5], [42, 'C5', 1], [43, 'G4', 1], [44, 'A4', 1], [45, 'C5', 1], [46, 'E5', 2],
    [48, 'F5', 1], [49, 'E5', 0.5], [49.5, 'D5', 0.5], [50, 'C5', 1], [51, 'A4', 1], [52, 'B4', 1], [53, 'G#4', 0.5], [53.5, 'A4', 0.5], [54, 'B4', 1], [55, 'D5', 1],
    [56, 'C5', 1], [57, 'B4', 0.5], [57.5, 'A4', 0.5], [58, 'G#4', 1], [59, 'B4', 1], [60, 'A4', 3]];
  const CLAR = [[32, 'C4', 4], [36, 'D4', 4], [40, 'E4', 4], [44, 'C4', 4], [48, 'D4', 4], [52, 'E4', 2], [54, 'D4', 2], [56, 'C4', 2], [58, 'B3', 2], [60, 'A3', 4]];
  const CH = { Am: ['A3', 'C4', 'E4'], Dm: ['D4', 'F4', 'A4'], E7: ['G#3', 'B3', 'D4', 'E4'], F: ['F3', 'A3', 'C4'], G: ['G3', 'B3', 'D4'], C: ['C4', 'E4', 'G4'] };
  const BASS = { Am: ['A2', 'E3', 'A2', 'C3'], Dm: ['D3', 'A2', 'D3', 'F3'], E7: ['E2', 'B2', 'E2', 'G#2'], F: ['F2', 'C3', 'F2', 'A2'], G: ['G2', 'D3', 'G2', 'B2'], C: ['C3', 'G2', 'C3', 'E3'] };
  const PROG = ['Am', 'Am', 'Dm', 'Dm', 'E7', 'E7', 'Am', 'E7', 'F', 'G', 'C', 'Am', 'Dm', 'E7', 'Am', 'Am'];

  const RP = ['Dm', 'A7', 'A7', 'Dm', 'Dm', 'Gm', 'A7', 'Dm'];
  const RCH = { Dm: ['D4', 'F4', 'A4'], A7: ['C#4', 'E4', 'G4'], Gm: ['D4', 'G4', 'A#4'] };
  const RB = { Dm: ['D2', 'A2'], A7: ['A2', 'E2'], Gm: ['G2', 'D2'] };
  const RMEL = [
    ['D5', 'F5', 'A5', 'F5', 'D5', 'A4', 'D5', 'F5'], ['E5', 'C#5', 'A4', 'C#5', 'E5', 'G5', 'F5', 'E5'], ['C#5', 'E5', 'A5', 'G5', 'F5', 'E5', 'D5', 'C#5'], ['D5', null, 'A4', null, 'D5', null, null, null],
    ['F5', 'E5', 'D5', 'F5', 'A5', 'G5', 'F5', 'A5'], ['A#5', 'A5', 'G5', 'A#4', 'D5', 'G5', 'A#5', 'G5'], ['A5', 'G5', 'F5', 'E5', 'C#5', 'E5', 'G5', 'E5'], ['D5', null, 'A4', 'D5', 'D5', null, null, null]];

  function mkPart(events, fn, loopEnd) {
    const p = new T.Part((time, e) => { try { fn(time, e); } catch (err) { noteErr('music', err); } }, events);
    p.loop = true; p.loopEnd = loopEnd;
    return p;
  }

  function buildMusic() {
    // ---- base: "Dusk on the Roof", swung accordion waltz-of-sorts in A minor
    const mel = MEL_A.concat(MEL_B).map(([q, n, d]) => ({ time: q2t(q), n, d }));
    parts.base.push(mkPart(mel, (t, e) => I.acc.triggerAttackRelease(e.n, qd(e.d) * 0.92, t, 0.8), '16m'));
    parts.base.push(mkPart(CLAR.map(([q, n, d]) => ({ time: q2t(q), n, d })), (t, e) => I.clar.triggerAttackRelease(e.n, qd(e.d) * 0.95, t, 0.6), '16m'));
    const bassEv = [], keyEv = [], drumEv = [];
    PROG.forEach((ch, bar) => {
      BASS[ch].forEach((n, i) => bassEv.push({ time: `${bar}:${i}:0`, n }));
      keyEv.push({ time: `${bar}:1:2`, ch }); keyEv.push({ time: `${bar}:3:2`, ch });
      drumEv.push({ time: `${bar}:0:0`, k: 'kick' }); drumEv.push({ time: `${bar}:2:0`, k: 'kick' });
      drumEv.push({ time: `${bar}:1:0`, k: 'brush' }); drumEv.push({ time: `${bar}:3:0`, k: 'brush' });
      for (let i = 0; i < 8; i++) drumEv.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, k: 'hat', v: i % 2 ? 0.5 : 0.85 });
      if (bar === 7 || bar === 15) { drumEv.push({ time: `${bar}:3:2`, k: 'brush' }); drumEv.push({ time: `${bar}:2:2`, k: 'brush' }); }
    });
    parts.base.push(mkPart(bassEv, (t, e) => I.bass.triggerAttackRelease(e.n, qd(0.85), t, 0.9), '16m'));
    parts.base.push(mkPart(keyEv, (t, e) => I.keys.triggerAttackRelease(CH[e.ch], qd(0.4), t, 0.7), '16m'));
    parts.base.push(mkPart(drumEv, (t, e) => {
      if (e.k === 'kick') I.kick.triggerAttackRelease('C1', '8n', t, 0.55);
      else if (e.k === 'brush') I.brush.triggerAttackRelease('8n', t, 0.9);
      else I.hat.triggerAttackRelease('32n', t, e.v * 0.6);
    }, '16m'));

    // ---- race: "Race Day Polka", D minor oom-pah with brass
    const rb = [], rc = [], rd = [], rl = [], rg = [];
    RP.forEach((ch, bar) => {
      rb.push({ time: `${bar}:0:0`, n: RB[ch][0] }); rb.push({ time: `${bar}:2:0`, n: RB[ch][1] });
      rc.push({ time: `${bar}:1:0`, ch }); rc.push({ time: `${bar}:3:0`, ch });
      rd.push({ time: `${bar}:0:0`, k: 'kick' }); rd.push({ time: `${bar}:2:0`, k: 'kick' });
      rd.push({ time: `${bar}:1:0`, k: 'snare' }); rd.push({ time: `${bar}:3:0`, k: 'snare' });
      for (let i = 0; i < 8; i++) rd.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, k: 'hat' });
      RMEL[bar].forEach((n, i) => { if (n) { rl.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, n }); if (i % 2 === 0) rg.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, n: Tone.Frequency(n).transpose(12).toNote() }); } });
    });
    rd.push({ time: '7:3:0', k: 'snare' }); rd.push({ time: '7:3:2', k: 'snare' });
    parts.race.push(mkPart(rb, (t, e) => I.tuba.triggerAttackRelease(e.n, qd(0.7), t, 1), '8m'));
    parts.race.push(mkPart(rc, (t, e) => I.acc.triggerAttackRelease(RCH[e.ch], qd(0.28), t, 0.9), '8m'));
    parts.race.push(mkPart(rd, (t, e) => {
      if (e.k === 'kick') I.kick.triggerAttackRelease('C1', '8n', t, 0.85);
      else if (e.k === 'snare') I.snare.triggerAttackRelease('16n', t, 0.8);
      else I.hat.triggerAttackRelease('32n', t, 0.5);
    }, '8m'));
    parts.race.push(mkPart(rl, (t, e) => I.brass.triggerAttackRelease(e.n, qd(0.42), t, 0.85), '8m'));
    parts.race.push(mkPart(rg, (t, e) => { if (raceLoop % 2 === 1) I.glock.triggerAttackRelease(e.n, qd(0.4), t, 0.5); }, '8m'));
    const counter = new T.Loop(() => { raceLoop++; }, '8m');
    parts.race.push(counter);

    // ---- cascade layers on the base track: each rung of a chain brings in another player
    const shk = [], arp = [], stab = [], oct = [];
    PROG.forEach((ch, bar) => {
      for (let i = 0; i < 16; i++) shk.push({ time: `${bar}:${Math.floor(i / 4)}:${i % 4}`, v: i % 4 === 0 ? 1 : i % 2 ? 0.45 : 0.7 });
      const tones = CH[ch].map((n) => Tone.Frequency(n).transpose(24).toNote());
      for (let i = 0; i < 8; i++) arp.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, n: tones[(i + (i > 3 ? 1 : 0)) % tones.length] });
      stab.push({ time: `${bar}:1:2`, ch }); stab.push({ time: `${bar}:3:2`, ch });
      BASS[ch].forEach((n, i) => oct.push({ time: `${bar}:${i}:0`, n: Tone.Frequency(n).transpose(12).toNote() }));
    });
    parts.base.push(mkPart(shk, (t, e) => { if (iLevel >= 2) I.shaker.triggerAttackRelease('32n', t, e.v); }, '16m'));
    parts.base.push(mkPart(arp, (t, e) => { if (iLevel >= 3) I.glock.triggerAttackRelease(e.n, qd(0.3), t, 0.42); }, '16m'));
    parts.base.push(mkPart(stab, (t, e) => { if (iLevel >= 4) I.brass.triggerAttackRelease(CH[e.ch].map((n) => Tone.Frequency(n).transpose(12).toNote()), qd(0.18), t, 0.55); }, '16m'));
    parts.base.push(mkPart(oct, (t, e) => { if (iLevel >= 5) I.tuba.triggerAttackRelease(e.n, qd(0.5), t, 0.6); }, '16m'));
    // ---- cascade layers on the race polka
    const rfill = [], rharm = [];
    RP.forEach((ch, bar) => {
      for (let i = 1; i < 4; i++) rfill.push({ time: `${bar}:3:${i}` });
      RMEL[bar].forEach((n, i) => { if (n) rharm.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, n: Tone.Frequency(n).transpose(-5).toNote() }); });
    });
    parts.race.push(mkPart(rfill, (t) => { if (iLevel >= 2) I.snare.triggerAttackRelease('32n', t, 0.45); }, '8m'));
    parts.race.push(mkPart(rharm, (t, e) => { if (iLevel >= 4) I.brass.triggerAttackRelease(e.n, qd(0.4), t, 0.5); }, '8m'));
    parts.race.push(mkPart(rg.map((e) => ({ time: e.time, n: e.n })), (t, e) => { if (iLevel >= 3 && raceLoop % 2 === 0) I.glock.triggerAttackRelease(e.n, qd(0.4), t, 0.45); }, '8m'));

    // ---- "Champion's Polka": the big win show. A major, oom-pah under it all, more of the band with every tier
    const VP = ['A', 'A', 'D', 'E', 'A', 'D', 'E', 'A'];
    const VCH = { A: ['A3', 'C#4', 'E4'], D: ['D4', 'F#4', 'A4'], E: ['D4', 'E4', 'G#4', 'B4'] };
    const VB = { A: ['A2', 'E2'], D: ['D2', 'A2'], E: ['E2', 'B2'] };
    const VMEL = [
      [[0, 'E5', 1], [1, 'C#5', 0.5], [1.5, 'E5', 0.5], [2, 'A5', 1], [3, 'E5', 1]],
      [[0, 'F#5', 0.5], [0.5, 'E5', 0.5], [1, 'C#5', 0.5], [1.5, 'E5', 0.5], [2, 'A4', 2]],
      [[0, 'F#5', 1], [1, 'A5', 0.5], [1.5, 'F#5', 0.5], [2, 'D5', 1], [3, 'F#5', 1]],
      [[0, 'E5', 0.5], [0.5, 'D5', 0.5], [1, 'B4', 0.5], [1.5, 'G#4', 0.5], [2, 'E4', 2]],
      [[0, 'C#5', 1], [1, 'E5', 0.5], [1.5, 'A5', 0.5], [2, 'C#6', 1], [3, 'A5', 1]],
      [[0, 'B5', 0.5], [0.5, 'A5', 0.5], [1, 'F#5', 0.5], [1.5, 'D5', 0.5], [2, 'A5', 2]],
      [[0, 'G#5', 0.5], [0.5, 'A5', 0.5], [1, 'B5', 0.5], [1.5, 'G#5', 0.5], [2, 'E5', 1], [3, 'D5', 1]],
      [[0, 'C#5', 1], [1, 'E5', 1], [2, 'A5', 2]]];
    const vb = [], vc = [], vd = [], vm = [], vg = [], vh = [];
    VP.forEach((ch, bar) => {
      vb.push({ time: `${bar}:0:0`, n: VB[ch][0] }); vb.push({ time: `${bar}:2:0`, n: VB[ch][1] });
      vc.push({ time: `${bar}:1:0`, ch }); vc.push({ time: `${bar}:3:0`, ch });
      vd.push({ time: `${bar}:0:0`, k: 'kick' }); vd.push({ time: `${bar}:2:0`, k: 'kick' }); vd.push({ time: `${bar}:1:0`, k: 'snare' }); vd.push({ time: `${bar}:3:0`, k: 'snare' });
      for (let i = 0; i < 8; i++) vd.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, k: 'hat' });
      if (bar % 2 === 1) { for (let i = 1; i < 4; i++) vd.push({ time: `${bar}:3:${i}`, k: 'roll' }); vd.push({ time: `${bar}:0:0`, k: 'crash' }); }
      VMEL[bar].forEach(([q, n, d]) => { const b = Math.floor(q), s = Math.round((q - b) * 4); vm.push({ time: `${bar}:${b}:${s}`, n, d }); });
      const tones = VCH[ch].map((n) => Tone.Frequency(n).transpose(24).toNote());
      for (let i = 0; i < 8; i++) vg.push({ time: `${bar}:${Math.floor(i / 2)}:${(i % 2) * 2}`, n: tones[i % tones.length] });
      if (bar % 2 === 1) vh.push({ time: `${bar}:3:0` });
    });
    parts.victory.push(mkPart(vb, (t, e) => I.tuba.triggerAttackRelease(e.n, qd(0.6), t, 1), '8m'));
    parts.victory.push(mkPart(vc, (t, e) => I.acc.triggerAttackRelease(VCH[e.ch], qd(0.3), t, 0.9), '8m'));
    parts.victory.push(mkPart(vd, (t, e) => {
      if (e.k === 'kick') I.kick.triggerAttackRelease('C1', '8n', t, 0.85);
      else if (e.k === 'snare') I.snare.triggerAttackRelease('16n', t, 0.75);
      else if (e.k === 'hat') { if (vLevel >= 1) I.hat.triggerAttackRelease('32n', t, 0.5); }
      else if (e.k === 'roll') { if (vLevel >= 2) I.snare.triggerAttackRelease('32n', t, 0.55); }
      else if (e.k === 'crash') { if (vLevel >= 3) I.cym.triggerAttackRelease(1.2, t, 0.55); }
    }, '8m'));
    parts.victory.push(mkPart(vm, (t, e) => { if (vLevel >= 1) I.brass.triggerAttackRelease(e.n, qd(e.d) * 0.9, t, 0.85); else I.acc.triggerAttackRelease(e.n, qd(e.d) * 0.9, t, 0.55); }, '8m'));
    parts.victory.push(mkPart(vg, (t, e) => { if (vLevel >= 2) I.glock.triggerAttackRelease(e.n, qd(0.3), t, 0.45); }, '8m'));
    parts.victory.push(mkPart(vh, (t) => { if (vLevel >= 3) heyAt(t, 2); }, '8m'));
  }
  function heyAt(t, n) { for (let i = 0; i < n; i++) I.hey.forEach((h) => h.triggerAttackRelease(0.14, t + i * qd(0.5), 0.9)); }

  const LEVEL = { base: 0.6, race: 0.5, victory: 0.62 };
  const BPM = { base: 104, race: 168, victory: 152 };
  let musicLevel = 0.5, pending = null;
  function music(name) {
    if (!ready) return;
    if (track === name && !pending) return;
    const tr = T.getTransport();
    const fadeTo = (v, d) => musicBus.gain.rampTo(v, d);
    const start = () => {
      pending = null;
      tr.stop(); tr.cancel(0); tr.position = 0;
      parts.base.concat(parts.race, parts.victory).forEach((p) => { try { p.stop(); } catch (e) { /* not started */ } });
      track = name;
      if (!name) return;
      tr.bpm.cancelScheduledValues(0); tr.bpm.value = BPM[name];
      if (name === 'base') { tr.swing = 0.32; tr.swingSubdivision = '8n'; parts.base.forEach((p) => p.start(0)); }
      if (name === 'race') { tr.swing = 0; raceLoop = 0; parts.race.forEach((p) => p.start(0)); }
      if (name === 'victory') { tr.swing = 0; parts.victory.forEach((p) => p.start(0)); }
      tr.start('+0.05');
      musicLevel = LEVEL[name] || 0.5;
      fadeTo(musicLevel, name === 'victory' ? 0.08 : 0.4);
    };
    clearTimeout(pending);
    // the victory band cuts straight in on the slam; other changes cross fade
    if (track && name !== 'victory') { fadeTo(0, 0.25); pending = setTimeout(start, 260); } else start();
  }
  function intensity(n) { iLevel = n || 0; }
  function victoryLevel(n) { vLevel = n || 0; }
  // slow motion: the band sinks under water and drags its tempo; a drone and a heartbeat sit under the pause
  function slowmo(on) {
    if (!ready) return;
    const now = T.now(), tr = T.getTransport();
    if (on) {
      musicLP.frequency.cancelScheduledValues(now); musicLP.frequency.setValueAtTime(musicLP.frequency.value, now); musicLP.frequency.exponentialRampToValueAtTime(380, now + 0.18);
      if (track) { tr.bpm.cancelScheduledValues(now); tr.bpm.rampTo(BPM[track] * 0.42, 0.18); }
      if (!muted) { I.drone.triggerAttack('A1', now, 0.7); I.boom.triggerAttackRelease('A0', 0.5, now, 0.8); I.boom.triggerAttackRelease('A0', 0.4, now + 0.34, 0.6); }
    } else {
      musicLP.frequency.cancelScheduledValues(now); musicLP.frequency.setValueAtTime(400, now); musicLP.frequency.exponentialRampToValueAtTime(18000, now + 0.08);
      if (track) { tr.bpm.cancelScheduledValues(now); tr.bpm.rampTo(BPM[track], 0.06); }
      I.drone.triggerRelease(now);
    }
  }
  function rain(on) { if (ready) rainG.gain.rampTo(on ? 0.5 : 0, on ? 3 : 2.5); }
  function crowdLoop(on) { if (ready) crowdG.gain.rampTo(on ? 0.6 : 0, on ? 1.2 : 0.8); }

  function duck(level, time) {
    if (!ready) return;
    musicBus.gain.rampTo(level == null ? 0.18 : level, 0.15);
    if (time) setTimeout(() => musicBus.gain.rampTo(musicLevel, 0.6), time);
  }
  function unduck() { if (ready) musicBus.gain.rampTo(musicLevel, 0.6); }

  const PENTA = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7', 'E7', 'G7', 'A7'];

  // one flap voice: a new burst that lands inside a running one carries on after it instead of colliding
  let flapUntil = 0;
  function flapBurst(t, n, v) {
    const t0 = Math.max(t, flapUntil + 0.02);
    if (t0 - t > 0.5) return;
    for (let i = 0; i < n; i++) I.flap.triggerAttackRelease(0.04, t0 + i * 0.075 + Math.random() * 0.012, v * (1 - i / (n + 2)));
    flapUntil = t0 + (n - 1) * 0.075 + 0.012;
  }

  function play(name, o) {
    if (!ready || muted) return;
    o = o || {};
    let now = T.now() + 0.01;
    // rate limit identical sounds
    const lim = { thunk: 0.03, tick: 0.05, pop: 0.05, flap: 0.05, count: 0.03, firework: 0.2, coo: 0.9, whoosh: 0.08, land: 0.06, click: 0.02, step: 0.12,
      coinTick: 0.05, coinIn: 0.03, kaching: 0.04, chain: 0.05, crackle: 0.2, cannon: 0.06, chant: 0.5, gust: 1, flockPass: 0.5, ticketSlam: 0.1, tierUp: 0.2 }[name] || 0;
    if (lim && last[name] && now - last[name] < lim) return;
    // two sounds in the same frame must not start a monophonic voice at the same instant (Tone throws)
    if (now <= tPrev) now = tPrev + 0.003;
    tPrev = now;
    last[name] = now;
    try {
      switch (name) {
        case 'click': I.click.triggerAttackRelease(0.02, now, 0.7); I.blip.triggerAttackRelease('A5', 0.03, now, 0.3); break;
        case 'punch':
          I.boom.triggerAttackRelease('A1', 0.3, now, 0.8); I.slap.triggerAttackRelease(0.1, now, 1); I.click.triggerAttackRelease(0.03, now + 0.01, 1);
          I.bell.triggerAttackRelease(['G5'], 0.6, now + 0.05, 0.5);
          break;
        case 'thunk': {
          const notes = ['G2', 'A2', 'C3', 'D3', 'E3', 'G3'];
          I.thunk.triggerAttackRelease(notes[(o.col || 0) % 6], 0.08, now, o.soft ? 0.45 : 0.75);
          I.click.triggerAttackRelease(0.015, now, o.soft ? 0.25 : 0.4);
          break;
        }
        case 'thunkBig':
          I.boom.triggerAttackRelease(['D1', 'E1', 'G1', 'A1', 'C2', 'D2'][(o.col || 0) % 6], 0.4, now, 0.8);
          I.slap.triggerAttackRelease(0.1, now, 0.6);
          break;
        case 'whoosh':
          I.whF.frequency.cancelScheduledValues(now); I.whF.frequency.setValueAtTime(380, now); I.whF.frequency.exponentialRampToValueAtTime(2600, now + 0.22);
          I.whoosh.triggerAttackRelease(0.25, now, 0.8);
          break;
        case 'flap': flapBurst(now, 9, 0.9); break;
        case 'coo': {
          const p = [0, 2, -1, 3][(o.pitch || 0) % 4];
          const n = (s) => Tone.Frequency(s).transpose(p).toNote();
          I.coo.triggerAttack(n('A3'), now, 0.7); I.coo.setNote(n('F#3'), now + 0.13); I.coo.triggerRelease(now + 0.38);
          I.coo.triggerAttack(n('A3'), now + 0.5, 0.6); I.coo.setNote(n('G3'), now + 0.58); I.coo.triggerRelease(now + 0.85);
          break;
        }
        case 'tag': I.chime.triggerAttackRelease(['E6'], 0.2, now, 0.32); I.blip.triggerAttackRelease('B6', 0.03, now + 0.06, 0.25); break;
        case 'tick': I.blip.triggerAttackRelease('C6', 0.02, now, 0.5); I.click.triggerAttackRelease(0.015, now, 0.5); break;
        case 'dive':
          I.whF.frequency.cancelScheduledValues(now); I.whF.frequency.setValueAtTime(3200, now); I.whF.frequency.exponentialRampToValueAtTime(500, now + 0.6);
          I.whoosh.triggerAttackRelease(0.5, now, 1);
          I.drop.triggerAttack('G5', now, 0.25); I.drop.setNote('C4', now + 0.5); I.drop.triggerRelease(now + 0.6);
          break;
        case 'land': I.thunk.triggerAttackRelease('C3', 0.08, now, 0.6); flapBurst(now, 4, 0.7); break;
        case 'step': I.thunk.triggerAttackRelease('A1', 0.05, now, 0.3); I.slap.triggerAttackRelease(0.04, now + 0.005, 0.14); break;
        case 'capsule':
          I.popF.frequency.cancelScheduledValues(now); I.popF.frequency.setValueAtTime(700, now); I.popF.frequency.exponentialRampToValueAtTime(2600, now + 0.05);
          I.pop.triggerAttackRelease(0.06, now, 1);
          I.chime.triggerAttackRelease(['E6', 'B6'], 0.4, now + 0.04, 0.48);
          break;
        case 'coin': {
          // each coin in a round climbs one step of the scale, so a run of coins sings upward
          const k = Math.min(6, o.n || 0);
          const base = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7'][k];
          const tr = (nn, s) => Tone.Frequency(nn).transpose(s).toNote();
          [base, tr(base, 4), tr(base, 7), tr(base, 12)].forEach((n, i) => I.sglock.triggerAttackRelease(n, 0.4, now + i * 0.045, 0.75 - i * 0.08));
          I.click.triggerAttackRelease(0.015, now, 0.5);
          if (o.big) { I.boom.triggerAttackRelease('C2', 0.3, now, 0.5); I.cym.triggerAttackRelease(0.9, now + 0.02, 0.5); }
          break;
        }
        case 'mult': {
          const m = o.m || 2;
          I.hit.triggerAttackRelease(['D4', 'F#4', 'A4', 'D5'], 0.3, now, 0.6);
          ['A6', 'D7', 'F#7'].forEach((n, i) => I.sglock.triggerAttackRelease(n, 0.5, now + i * 0.05, 0.8));
          I.boom.triggerAttackRelease('D1', 0.3, now, 0.6);
          if (m >= 10) { I.cym.triggerAttackRelease(1.1, now, 0.75); I.hit.triggerAttackRelease(['A4', 'D5', 'F#5'], 0.5, now + 0.12, 0.6); }
          if (m >= 25) { I.boom.triggerAttackRelease('D0', 0.8, now + 0.1, 1); ['D7', 'F#7', 'A7'].forEach((n, i) => I.sglock.triggerAttackRelease(n, 0.6, now + 0.18 + i * 0.05, 0.7)); }
          break;
        }
        case 'win': {
          const st = Math.min(PENTA.length - 3, (o.step || 1) - 1);
          I.chime.triggerAttackRelease([PENTA[st], PENTA[st + 2]], 0.6, now, 0.7);
          I.sglock.triggerAttackRelease(PENTA[st + 1], 0.5, now + 0.07, 0.6);
          I.thunk.triggerAttackRelease(['C3', 'D3', 'E3', 'G3', 'A3'][Math.min(4, st)], 0.08, now, 0.45);
          break;
        }
        case 'pop':
          I.popF.frequency.cancelScheduledValues(now); I.popF.frequency.setValueAtTime(1800, now); I.popF.frequency.exponentialRampToValueAtTime(500, now + 0.08);
          I.pop.triggerAttackRelease(0.08, now, 0.9);
          I.slap.triggerAttackRelease(0.05, now, 0.25);
          break;
        case 'stamp':
          I.boom.triggerAttackRelease('A0', 0.6, now, 1); I.slap.triggerAttackRelease(0.14, now, 1);
          I.hit.triggerAttackRelease(o.chord || ['A3', 'C4', 'E4', 'A4'], 0.4, now, 0.8);
          break;
        case 'stampMajor':
          I.boom.triggerAttackRelease('A0', 0.6, now, 1); I.slap.triggerAttackRelease(0.14, now, 1);
          I.hit.triggerAttackRelease(['A3', 'C#4', 'E4', 'A4'], 0.5, now, 0.85); I.cym.triggerAttackRelease(1.2, now, 0.7);
          break;
        case 'whistle':
          I.whistle.triggerAttackRelease(2750, 0.22, now, 0.8);
          I.whistle.triggerAttackRelease(2750, 0.55, now + 0.32, 0.9);
          break;
        case 'bell': I.bell.triggerAttackRelease(['G5', 'D6'], 1.2, now, 0.6); I.bell.triggerAttackRelease(['G5', 'D6'], 1.2, now + 0.32, 0.6); break;
        case 'tram':
          I.bell.triggerAttackRelease(['A5'], 1.0, now + 0.4, 0.3); I.bell.triggerAttackRelease(['A5'], 1.0, now + 0.68, 0.3);
          break;
        case 'riser': {
          const d = o.dur || 2;
          I.rsF.frequency.cancelScheduledValues(now); I.rsF.frequency.setValueAtTime(250, now); I.rsF.frequency.exponentialRampToValueAtTime(5200, now + d);
          I.riserG.gain.cancelScheduledValues(now); I.riserG.gain.setValueAtTime(0, now); I.riserG.gain.linearRampToValueAtTime(0.32, now + d); I.riserG.gain.linearRampToValueAtTime(0, now + d + 0.08);
          break;
        }
        case 'riserStop': I.riserG.gain.cancelScheduledValues(now); I.riserG.gain.rampTo(0, 0.1); break;
        case 'heart': I.boom.triggerAttackRelease('E1', 0.2, now, 0.55); I.boom.triggerAttackRelease('E1', 0.2, now + 0.18, 0.4); break;
        case 'count': {
          const f = 600 + Math.min(1, o.k || 0) * 900;
          I.blip.triggerAttackRelease(f, 0.02, now, 0.6);
          break;
        }
        case 'crowd': {
          I.crowd.forEach((n, i) => n.triggerAttackRelease(2.2, now + i * 0.05, 0.9));
          const ts = Array.from({ length: 6 }, () => 0.3 + Math.random() * 1.2).sort((a, b) => a - b);
          ts.forEach((dt) => I.whistle.triggerAttackRelease(2200 + Math.random() * 1200, 0.08, now + dt, 0.25));
          break;
        }
        case 'firework': {
          I.fw.triggerAttackRelease(0.5, now, 0.7);
          const ts = Array.from({ length: 7 }, () => 0.25 + Math.random() * 0.5).sort((a, b) => a - b);
          ts.forEach((dt) => I.click.triggerAttackRelease(0.01, now + dt, 0.5));
          break;
        }
        case 'roll': for (let i = 0; i < 24; i++) I.snare.triggerAttackRelease('32n', now + i * (o.dur || 1.4) / 24, 0.2 + 0.7 * i / 24); break;
        case 'fanfare': {
          const seq = [['A4', 0], ['C#5', 0.14], ['E5', 0.28], ['A5', 0.42]];
          seq.forEach(([n, d]) => I.brass.triggerAttackRelease(n, 0.18, now + d, 0.9));
          I.brass.triggerAttackRelease(['A4', 'C#5', 'E5', 'A5'], 0.9, now + 0.6, 1);
          I.boom.triggerAttackRelease('A1', 0.5, now + 0.6, 0.9); I.cym.triggerAttackRelease(1.4, now + 0.6, 0.9);
          ['A6', 'C#7', 'E7', 'A7'].forEach((n, i) => I.sglock.triggerAttackRelease(n, 0.6, now + 0.6 + i * 0.07, 0.6));
          break;
        }
        case 'raceHit':
          I.boom.triggerAttackRelease('D1', 0.8, now, 1); I.slap.triggerAttackRelease(0.14, now, 1);
          I.hit.triggerAttackRelease(['D3', 'F3', 'A3', 'D4', 'A4'], 0.6, now, 0.9); I.cym.triggerAttackRelease(1.6, now, 1);
          break;
        case 'logo':
          I.boom.triggerAttackRelease('A0', 1.2, now, 1); I.slap.triggerAttackRelease(0.2, now, 1);
          I.hit.triggerAttackRelease(['A2', 'E3', 'A3', 'C4', 'E4'], 1.1, now, 1); I.cym.triggerAttackRelease(2, now, 1);
          break;
        case 'collect': ['C6', 'E6', 'G6', 'C7'].forEach((n, i) => I.chime.triggerAttackRelease(n, 0.5, now + i * 0.05, 0.6)); break;
        // ---- win feedback
        case 'ticketSlam':
          I.boom.triggerAttackRelease('E1', 0.22, now, 0.45); I.slap.triggerAttackRelease(0.07, now, 0.6);
          I.thunk.triggerAttackRelease('E2', 0.08, now, 0.55); I.click.triggerAttackRelease(0.02, now, 0.7);
          break;
        case 'coinTick': I.blip.triggerAttackRelease(900 + Math.min(1, o.k || 0) * 1100, 0.015, now, 0.28); break;
        case 'coinIn': {
          const n = PENTA[2 + ((o.n || 0) % 6)];
          I.sglock.triggerAttackRelease(n, 0.12, now, 0.5); I.click.triggerAttackRelease(0.012, now, 0.4);
          break;
        }
        case 'kaching': {
          // the till: a mechanical clack, the bell, then loose change settling
          const k = Math.min(6, o.n || 0);
          const base = ['C6', 'D6', 'E6', 'G6', 'A6', 'C7', 'D7'][k];
          const tr = (nn, s) => Tone.Frequency(nn).transpose(s).toNote();
          I.click.triggerAttackRelease(0.02, now, 0.9); I.slap.triggerAttackRelease(0.05, now + 0.005, 0.32);
          I.thunk.triggerAttackRelease('G3', 0.05, now, 0.4);
          I.chime.triggerAttackRelease([base, tr(base, 7)], 0.55, now + 0.06, 0.72);
          I.sglock.triggerAttackRelease(tr(base, 12), 0.6, now + 0.1, 0.55);
          [0, 4, 7, 12, 16].forEach((s, i) => I.sglock.triggerAttackRelease(tr(base, 12 + s), 0.08, now + 0.15 + i * 0.034 + Math.random() * 0.01, 0.2));
          if (o.big) { I.boom.triggerAttackRelease('C2', 0.3, now, 0.6); I.cym.triggerAttackRelease(0.9, now + 0.02, 0.5); }
          break;
        }
        case 'chain': {
          // each rung of a cascade climbs the A minor pentatonic: a stab, a bell, a drum flam, brass from the third
          const s = Math.max(2, o.step || 2);
          const roots = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5'];
          const r = roots[Math.min(roots.length - 1, s - 2)];
          const tr = (nn, k) => Tone.Frequency(nn).transpose(k).toNote();
          const ch = [r, tr(r, 7), tr(r, 12)];
          I.hit.triggerAttackRelease(ch, 0.35, now, Math.min(1, 0.55 + s * 0.05));
          I.sglock.triggerAttackRelease([tr(r, 24), tr(r, 31)], 0.5, now + 0.03, 0.5);
          I.timp.triggerAttackRelease(tr(r, -12), 0.4, now, Math.min(1, 0.55 + s * 0.06));
          I.snare.triggerAttackRelease('32n', now, 0.45); I.snare.triggerAttackRelease('32n', now + 0.045, 0.7);
          if (s >= 3) I.brass.triggerAttackRelease(ch.map((n) => tr(n, 12)), 0.24, now + 0.02, 0.6);
          if (s >= 5) I.cym.triggerAttackRelease(0.8, now, 0.55);
          break;
        }
        case 'clockHit':
          I.bell.triggerAttackRelease(['G5', 'D6', 'G6'], 2.2, now, 0.85);
          I.boom.triggerAttackRelease('G0', 1.2, now, 1); I.slap.triggerAttackRelease(0.16, now, 0.9);
          I.cym.triggerAttackRelease(1.8, now + 0.02, 0.7);
          break;
        // ---- big win show
        case 'tierUp': {
          // the same A major chord climbing an inversion per tier, timpani under it
          const t = Math.min(3, o.tier || 0);
          const keys = [['A3', 'C#4', 'E4', 'A4'], ['C#4', 'E4', 'A4', 'C#5'], ['E4', 'A4', 'C#5', 'E5'], ['A4', 'C#5', 'E5', 'A5']][t];
          const tr = (nn, k) => Tone.Frequency(nn).transpose(k).toNote();
          I.boom.triggerAttackRelease('A0', 0.9, now, 1); I.slap.triggerAttackRelease(0.14, now, 1);
          for (let i = 0; i < 6; i++) I.timp.triggerAttackRelease('A1', 0.2, now + i * 0.03, 0.3 + i * 0.1);
          I.hit.triggerAttackRelease(keys, 0.7, now + 0.17, 0.9);
          I.brass.triggerAttackRelease(keys.map((n) => tr(n, 12)), 0.6, now + 0.18, 0.9);
          I.cym.triggerAttackRelease(1.6, now + 0.17, 0.9);
          for (let i = 0; i < 3 + t * 2; i++) I.sglock.triggerAttackRelease(tr(keys[i % 4], 24), 0.3, now + 0.25 + i * 0.05, 0.5);
          break;
        }
        case 'chant': heyAt(now, 3); I.crowd.forEach((n, i) => n.triggerAttackRelease(2.6, now + i * 0.05, 1)); break;
        case 'cannon':
          I.boom.triggerAttackRelease('C1', 0.25, now, 0.9); I.slap.triggerAttackRelease(0.08, now, 0.9);
          I.whF.frequency.cancelScheduledValues(now); I.whF.frequency.setValueAtTime(700, now); I.whF.frequency.exponentialRampToValueAtTime(3800, now + 0.18);
          I.whoosh.triggerAttackRelease(0.2, now, 0.7);
          break;
        case 'crackle': {
          // a monophonic voice needs its hits in order
          const ts = Array.from({ length: 14 }, () => Math.random() * 0.55).sort((a, b) => a - b);
          ts.forEach((t, i) => I.click.triggerAttackRelease(0.008, now + t + i * 0.002, 0.35 + Math.random() * 0.55));
          break;
        }
        case 'flockPass': flapBurst(now, 8, 0.8); flapBurst(now + 0.66, 8, 0.6); play('coo', { pitch: 1 }); break;
        // ---- weather
        case 'gust':
          wind.volume.cancelScheduledValues(now); wind.volume.rampTo(-3, 0.8); wind.volume.rampTo(-14, 2.4, now + 1.2);
          I.whF.frequency.cancelScheduledValues(now); I.whF.frequency.setValueAtTime(260, now); I.whF.frequency.exponentialRampToValueAtTime(900, now + 1.4);
          I.whoosh.triggerAttackRelease(1.3, now, 0.45);
          break;
        case 'no': I.blip.triggerAttackRelease('E3', 0.08, now, 1); I.blip.triggerAttackRelease('C3', 0.12, now + 0.09, 1); break;
        default: break;
      }
    } catch (e) { noteErr(name, e); /* never let sound break the game */ }
  }

  function accordionIntro() {
    if (!ready || muted) return;
    const now = T.now() + 0.05;
    // slow rubato statement of the first phrase
    const ph = [['E4', 0, 0.6], ['A4', 0.6, 0.35], ['B4', 0.95, 0.35], ['C5', 1.3, 0.9], ['B4', 2.2, 0.35], ['A4', 2.55, 0.35], ['G#4', 2.9, 1.1]];
    ph.forEach(([n, t, d]) => I.accSolo.triggerAttackRelease(n, d, now + t, 0.75));
    I.accSolo.triggerAttackRelease(['A3', 'E4'], 3.6, now, 0.3);
    I.accSolo.triggerAttackRelease(['G#3', 'E4'], 1.4, now + 2.9, 0.28);
  }

  function setMuted(m) {
    muted = !!m;
    if (!ready) return;
    try { Tone.getDestination().mute = muted; } catch (e) { /* ignore */ }
  }

  function ambience(level) { if (ready) ambBus.gain.rampTo(level, 1); }

  return { init, play, music, duck, unduck, setMuted, setBus, accordionIntro, ambience, intensity, victoryLevel, slowmo, rain, crowdLoop,
    get ready() { return ready; }, get muted() { return muted; }, get track() { return track; }, get errors() { return errs; } };
})();

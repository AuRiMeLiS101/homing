// Homing simulator. Usage: node sim/run.js [rounds] [seed] [--buy] [--cfg path.json]
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const path = require('path');
const E = require('../src/engine.js');

function loadCfg(p) {
  const base = require('../src/config.js');
  if (!p) return base;
  const over = require(path.resolve(p));
  return Object.assign({}, base, over, { weights: Object.assign({}, base.weights, over.weights || {}) });
}

function simulate({ rounds, seed, buy, cfgPath }) {
  const cfg = loadCfg(cfgPath);
  const rng = E.seededRng(seed);
  const eng = E.createEngine(cfg, rng);
  const bet = 100;
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const edges = [0, 1, 5, 20, 100, 1000, 5000, 1e12];
  let cost = 0, win = 0, sym = 0, coin = 0, raceW = 0, hits = 0, triggers = 0, raceSpins = 0, capHits = 0, maxWin = 0;
  let mean = 0, m2 = 0, n = 0, raceRounds = 0, raceSum = 0, raceSum2 = 0, birdsReleased = 0, loftSum = 0;
  for (let i = 0; i < rounds; i++) {
    const r = eng.playRound(bet, { buy });
    cost += r.cost; win += r.win;
    sym += r.parts.sym; coin += r.parts.coin; raceW += r.parts.race;
    if (r.win > 0) hits++;
    if (r.trigger) { triggers++; raceSpins += r.race ? r.race.played : 0; raceRounds++; const x = r.parts.race / bet; raceSum += x; raceSum2 += x * x; loftSum += r.race ? r.race.loft : 0; }
    if (r.capped) capHits++;
    const x = r.win / r.cost;
    if (r.win > maxWin) maxWin = r.win;
    n++; const d = x - mean; mean += d / n; m2 += d * (x - mean);
    const wx = r.win / bet;
    if (wx === 0) buckets[0]++;
    else { for (let k = 0; k < edges.length - 1; k++) if (wx > edges[k] && wx <= edges[k + 1]) { buckets[k + 1]++; break; } }
    for (const e of r.events) if (e.t === 'takeoff') birdsReleased += e.items.length + e.instant.length;
  }
  return { rounds, cost, win, sym, coin, raceW, hits, triggers, raceSpins, capHits, maxWin, mean, m2, n, buckets, raceRounds, raceSum, raceSum2, birdsReleased, loftSum };
}

if (!isMainThread) {
  parentPort.postMessage(simulate(workerData));
} else {
  const args = process.argv.slice(2);
  const rounds = parseInt(args[0] || '2000000', 10);
  const seed = parseInt(args[1] || '12345', 10);
  const buy = args.includes('--buy');
  const ci = args.indexOf('--cfg');
  const cfgPath = ci >= 0 ? args[ci + 1] : null;
  const threads = 2;
  const per = Math.ceil(rounds / threads);
  const t0 = Date.now();
  Promise.all(Array.from({ length: threads }, (_, k) => new Promise((res, rej) => {
    const w = new Worker(__filename, { workerData: { rounds: per, seed: seed + k * 7919, buy, cfgPath } });
    w.on('message', res); w.on('error', rej);
  }))).then((parts) => {
    const a = parts.reduce((acc, p) => {
      for (const k of Object.keys(p)) {
        if (k === 'buckets') acc.buckets = (acc.buckets || p.buckets.map(() => 0)).map((v, i) => v + p.buckets[i]);
        else if (k === 'maxWin') acc.maxWin = Math.max(acc.maxWin || 0, p.maxWin);
        else if (k === 'mean' || k === 'm2' || k === 'n') continue;
        else acc[k] = (acc[k] || 0) + p[k];
      }
      // combine variance (parallel algorithm)
      if (!acc._n) { acc._n = p.n; acc._mean = p.mean; acc._m2 = p.m2; }
      else { const nA = acc._n, nB = p.n, d = p.mean - acc._mean, nn = nA + nB; acc._mean = acc._mean + d * nB / nn; acc._m2 = acc._m2 + p.m2 + d * d * nA * nB / nn; acc._n = nn; }
      return acc;
    }, {});
    const sd = Math.sqrt(a._m2 / (a._n - 1));
    const rtp = a.win / a.cost;
    const se = sd / Math.sqrt(a._n);
    const out = {
      mode: buy ? 'bonus buy' : 'base play',
      rounds: a.rounds,
      seconds: ((Date.now() - t0) / 1000).toFixed(1),
      rtp: +(rtp * 100).toFixed(3),
      rtpStdErr: +(se * 100).toFixed(3),
      symbolRtp: +(a.sym / a.cost * 100).toFixed(3),
      coinRtp: +(a.coin / a.cost * 100).toFixed(3),
      raceRtp: +(a.raceW / a.cost * 100).toFixed(3),
      hitRate: +(a.hits / a.rounds * 100).toFixed(2),
      triggerOneIn: a.triggers ? +(a.rounds / a.triggers).toFixed(1) : null,
      avgRaceX: a.raceRounds ? +(a.raceSum / a.raceRounds).toFixed(2) : null,
      raceSdX: a.raceRounds ? +Math.sqrt(a.raceSum2 / a.raceRounds - (a.raceSum / a.raceRounds) ** 2).toFixed(1) : null,
      avgRaceSpins: a.triggers ? +(a.raceSpins / a.triggers).toFixed(2) : null,
      avgFinalLoft: a.raceRounds ? +(a.loftSum / a.raceRounds).toFixed(2) : null,
      birdsPerRound: +(a.birdsReleased / a.rounds).toFixed(3),
      volatilitySd: +sd.toFixed(2),
      maxWinX: +(a.maxWin / 100).toFixed(1),
      capHits: a.capHits,
      dist: { zero: a.buckets[0], '0-1x': a.buckets[1], '1-5x': a.buckets[2], '5-20x': a.buckets[3], '20-100x': a.buckets[4], '100-1000x': a.buckets[5], '1000-5000x': a.buckets[6], '5000x+': a.buckets[7] }
    };
    console.log(JSON.stringify(out, null, 1));
  });
}

// Explore symbol weight profiles for hit rate and symbol RTP (pay scale applied after).
const E = require('../src/engine.js');
const base = require('../src/config.js');

function run(weights, pays, rounds, seed) {
  const cfg = Object.assign({}, base, { paytable: pays, weights: { base: weights, race: weights }, coins: [[0, 1]] });
  const eng = E.createEngine(cfg, E.seededRng(seed));
  let win = 0, hits = 0, sq = 0;
  for (let i = 0; i < rounds; i++) {
    const r = eng.playRound(100);
    win += r.parts.sym; if (r.parts.sym > 0) hits++;
  }
  return { rtp: win / (rounds * 100), hit: hits / rounds };
}

const order = ['T', 'J', 'Q', 'K', 'A', 'BINO', 'SEED', 'TEA', 'RAD', 'CHAMP', 'GENA'];
const args = process.argv.slice(2);
const ratio = parseFloat(args[0] || '0.85');
const top = parseFloat(args[1] || '30');
const w = {};
let v = top;
for (const s of order) { w[s] = +v.toFixed(2); v *= ratio; }
w.BIRD = 0; w.CLOCK = 0;
const res = run(w, base.paytable, 200000, 7);
console.log(JSON.stringify({ ratio, weights: w, rtp: +(res.rtp * 100).toFixed(2), hit: +(res.hit * 100).toFixed(2) }));

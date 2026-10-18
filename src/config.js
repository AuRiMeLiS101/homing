/* Homing game configuration. Every number here is tuned by sim/run.js. */
(function (root) {
  const HOMING_CONFIG = {
    cols: 6,
    rows: 5,
    minPay: 8,
    // pays in x total bet for counts 8-9, 10-11, 12+
    paytable: {
      GENA: [35, 100, 300],
      CHAMP: [14, 35, 140],
      RAD: [8, 20, 70],
      TEA: [6, 14, 56],
      SEED: [4, 11, 42],
      BINO: [3.5, 8.5, 35],
      A: [2, 5.5, 21],
      K: [1.7, 4.2, 17],
      Q: [1.4, 3.5, 14],
      J: [1.1, 2.8, 11],
      T: [0.7, 2, 8]
    },
    weights: {
      base: { T: 30, J: 25.5, Q: 21.7, K: 18.4, A: 15.7, BINO: 13.3, SEED: 11.3, TEA: 9.6, RAD: 8.2, CHAMP: 6.9, GENA: 5.9, BIRD: 0.6, CLOCK: 2.1 },
      race: { T: 30, J: 25.5, Q: 21.7, K: 18.4, A: 15.7, BINO: 13.3, SEED: 11.3, TEA: 9.6, RAD: 8.2, CHAMP: 6.9, GENA: 5.9, BIRD: 2.2, CLOCK: 1.6 }
    },
    bands: [[1, 30], [2, 30], [3, 25], [4, 15]],
    maxFlight: 6,
    coins: [[0.2,  45],  [0.5,  28],  [1,  14],  [2,  7.6],  [5,  4.2],  [10,  1.5],  [25,  0.5],  [50,  0.15],  [100,  0.03]],
    flockChance: 0.05,
    raceSpins: { 3: 10, 4: 12, 5: 15, 6: 15 },
    retrigger: 5,
    maxRaceSpins: 50,
    mults: [[2, 40], [3, 25], [5, 18], [10, 10], [25, 4.5], [50, 2], [100, 0.5]],
    maxWin: 5000,
    buyPrice: 67
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = HOMING_CONFIG;
  else root.HOMING_CONFIG = HOMING_CONFIG;
})(typeof self !== 'undefined' ? self : this);

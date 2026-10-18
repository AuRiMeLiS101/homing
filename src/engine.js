/* Homing math engine. Pure logic: no DOM, no timers, no Math.random.
   Works in Node (simulation) and in the browser (window.HomingEngine). */
(function (root) {
  'use strict';

  // ---------- RNG ----------
  function sfc32(a, b, c, d) {
    function next() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    }
    for (let i = 0; i < 15; i++) next();
    return { float: next, int: (n) => Math.floor(next() * n) };
  }
  function seededRng(seed) {
    let s = (seed >>> 0) || 1;
    const m = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0); };
    return sfc32(m(), m(), m(), m());
  }
  function secureRng() {
    const buf = new Uint32Array(256); let i = 256;
    const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto : null;
    function next() {
      if (i >= 256) { if (g) g.getRandomValues(buf); else for (let k = 0; k < 256; k++) buf[k] = (Math.random() * 4294967296) >>> 0; i = 0; }
      return buf[i++] / 4294967296;
    }
    return { float: next, int: (n) => Math.floor(next() * n) };
  }

  // ---------- weighted tables ----------
  function table(entries) {
    const items = [], cum = []; let total = 0;
    for (const [v, w] of entries) { if (w <= 0) continue; total += w; items.push(v); cum.push(total); }
    return {
      items, total,
      pick(rng) {
        const r = rng.float() * total;
        let lo = 0, hi = cum.length - 1;
        while (lo < hi) { const mid = (lo + hi) >> 1; if (r < cum[mid]) hi = mid; else lo = mid + 1; }
        return items[lo];
      }
    };
  }

  const PAYING = ['GENA', 'CHAMP', 'RAD', 'TEA', 'SEED', 'BINO', 'A', 'K', 'Q', 'J', 'T'];

  function compile(cfg) {
    const c = JSON.parse(JSON.stringify(cfg));
    c.baseTable = table(Object.entries(c.weights.base));
    c.raceTable = table(Object.entries(c.weights.race));
    c.bandTable = table(c.bands);
    c.coinTable = table(c.coins);
    c.multTable = table(c.mults);
    c.buyTable = c.buyMults ? table(c.buyMults) : c.multTable;
    return c;
  }

  // ---------- engine ----------
  function createEngine(cfgIn, rng) {
    const cfg = compile(cfgIn);
    const COLS = cfg.cols, ROWS = cfg.rows;
    const state = { flight: [], nextId: 1 };

    function newSym(tab, col) {
      let s = tab.pick(rng);
      if (s === 'CLOCK' && col && col.indexOf('CLOCK') !== -1) { while (s === 'CLOCK') s = tab.pick(rng); }
      return s;
    }
    function dropGrid(tab) {
      const g = [];
      for (let x = 0; x < COLS; x++) { const col = []; for (let y = 0; y < ROWS; y++) col.push(newSym(tab, col)); g.push(col); }
      return g;
    }
    function cloneGrid(g) { return g.map((col) => col.slice()); }

    // Remove marked cells, apply gravity, refill from the top. Returns drops for animation.
    function collapse(grid, removeSet, tab) {
      const drops = [];
      for (let x = 0; x < COLS; x++) {
        const survivors = [];
        for (let y = 0; y < ROWS; y++) if (!removeSet.has(x * 10 + y)) survivors.push({ s: grid[x][y], from: y });
        const n = ROWS - survivors.length;
        if (n === 0) continue;
        const col = [];
        for (let i = 0; i < n; i++) col.push(null);
        for (let i = 0; i < survivors.length; i++) col.push(survivors[i].s);
        // fill new from the bottom-most empty upward so CLOCK limit sees survivors
        const existing = survivors.map((v) => v.s);
        for (let i = n - 1; i >= 0; i--) { const s = newSym(tab, existing); col[i] = s; existing.push(s); }
        for (let i = 0; i < survivors.length; i++) {
          const to = n + i;
          if (survivors[i].from !== to) drops.push({ c: x, from: survivors[i].from, to, s: survivors[i].s });
        }
        for (let i = 0; i < n; i++) drops.push({ c: x, from: i - n, to: i, s: col[i], fresh: true });
        grid[x] = col;
      }
      return drops;
    }

    function randomCell() { return { c: rng.int(COLS), r: rng.int(ROWS) }; }

    // Birds on the grid fly off. Returns events (takeoff + fall), repeating while refills bring new birds.
    function handleTakeoffs(grid, tab, ctx, ev) {
      let guard = 0;
      for (;;) {
        const rem = new Set(); const items = []; const instant = [];
        for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (grid[x][y] === 'BIRD') {
          rem.add(x * 10 + y);
          const id = state.nextId++;
          if (ctx.mode === 'race') {
            const b = { id, band: 1, bet: ctx.bet, race: true };
            ctx.raceFlight.push(b);
            items.push({ id, c: x, r: y, band: 1 });
          } else if (state.flight.length < cfg.maxFlight) {
            const band = cfg.bandTable.pick(rng);
            state.flight.push({ id, band, bet: ctx.bet });
            items.push({ id, c: x, r: y, band });
          } else {
            const v = cfg.coinTable.pick(rng);
            const amt = Math.round(v * ctx.bet);
            ctx.coin += amt;
            instant.push({ id, c: x, r: y, cap: { k: 'coin', v, amt } });
          }
        }
        if (!rem.size) break;
        const drops = collapse(grid, rem, tab);
        ev.push({ t: 'takeoff', items, instant, flight: flightView(ctx) });
        if (instant.length) ev.push({ t: 'land', items: instant, instant: true });
        ev.push({ t: 'fall', drops, grid: cloneGrid(grid) });
        if (++guard > 20) break;
      }
    }

    function flightView(ctx) {
      if (ctx && ctx.mode === 'race') return ctx.raceFlight.map((b) => ({ id: b.id, band: b.band }));
      return state.flight.map((b) => ({ id: b.id, band: b.band }));
    }

    // Land base birds (coins / flock call). list = bird objects already removed from flight.
    function landBaseBirds(list, ctx, ev, reason) {
      const items = [];
      let queue = list.slice();
      while (queue.length) {
        const b = queue.shift();
        const cell = randomCell();
        if (rng.float() < cfg.flockChance && state.flight.length > 0) {
          items.push({ id: b.id, c: cell.c, r: cell.r, cap: { k: 'flock' } });
          const rest = state.flight.splice(0, state.flight.length);
          queue = queue.concat(rest);
        } else {
          const v = cfg.coinTable.pick(rng);
          const amt = Math.round(v * b.bet);
          ctx.coin += amt;
          items.push({ id: b.id, c: cell.c, r: cell.r, cap: { k: 'coin', v, amt } });
        }
      }
      if (items.length) ev.push({ t: 'land', items, reason: reason || 'home', flight: flightView(ctx) });
    }

    function landRaceBirds(list, ctx, ev, reason, multTab) {
      const items = [];
      for (const b of list) {
        const cell = randomCell();
        const m = (multTab || cfg.multTable).pick(rng);
        ctx.loft += m;
        items.push({ id: b.id, c: cell.c, r: cell.r, cap: { k: 'mult', m } });
      }
      if (items.length) ev.push({ t: 'land', items, reason: reason || 'home', loft: ctx.loft, flight: flightView(ctx) });
    }

    function evaluate(grid) {
      const counts = {}; const cells = {};
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
        const s = grid[x][y];
        if (!cfg.paytable[s]) continue;
        counts[s] = (counts[s] || 0) + 1;
        (cells[s] || (cells[s] = [])).push([x, y]);
      }
      const wins = [];
      for (const s of PAYING) {
        const n = counts[s] || 0;
        if (n < cfg.minPay) continue;
        const band = n >= 12 ? 2 : (n >= 10 ? 1 : 0);
        wins.push({ s, n, cells: cells[s], mult: cfg.paytable[s][band] });
      }
      return wins;
    }

    function countClocks(grid) {
      const cells = [];
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if (grid[x][y] === 'CLOCK') cells.push([x, y]);
      return cells;
    }

    // One tumble sequence on a grid. Returns symbol win (currency).
    function tumble(grid, tab, ctx, ev) {
      let sum = 0, step = 0;
      for (;;) {
        const wins = evaluate(grid);
        if (!wins.length) break;
        let amt = 0;
        const rem = new Set();
        for (const w of wins) {
          w.amt = Math.round(w.mult * ctx.bet);
          amt += w.amt;
          for (const [x, y] of w.cells) rem.add(x * 10 + y);
        }
        sum += amt; step++;
        ev.push({ t: 'win', wins, amt, sum, step });
        const drops = collapse(grid, rem, tab);
        ev.push({ t: 'fall', drops, grid: cloneGrid(grid) });
        handleTakeoffs(grid, tab, ctx, ev);
        if (step > 60) break;
      }
      return sum;
    }

    function capLeft(ctx) { return ctx.cap - ctx.total; }

    // ---------- base spin ----------
    function baseSpin(bet, ctx, ev) {
      ctx.mode = 'base';
      // bands tick down
      for (const b of state.flight) b.band -= 1;
      ev.push({ t: 'tick', flight: state.flight.map((b) => ({ id: b.id, band: b.band })) });
      const grid = dropGrid(cfg.baseTable);
      ev.push({ t: 'drop', grid: cloneGrid(grid), clocks: countClocks(grid).length });
      const landing = state.flight.filter((b) => b.band <= 0);
      state.flight = state.flight.filter((b) => b.band > 0);
      if (landing.length) landBaseBirds(landing, ctx, ev, 'home');
      handleTakeoffs(grid, cfg.baseTable, ctx, ev);
      const sym = tumble(grid, cfg.baseTable, ctx, ev);
      ctx.sym += sym;
      const clocks = countClocks(grid);
      return { grid, clocks };
    }

    // ---------- race ----------
    function race(bet, spins, ctx, ev, opts) {
      ctx.mode = 'race';
      ctx.loft = 0; ctx.raceFlight = [];
      const multTab = opts && opts.bought ? cfg.buyTable : cfg.multTable;
      const raceEv = [];
      // Everyone in the air comes home for Race Day (base coins).
      if (state.flight.length) {
        const all = state.flight.splice(0, state.flight.length);
        ctx.mode = 'base';
        landBaseBirds(all, ctx, raceEv, 'raceCall');
        ctx.mode = 'race';
      }
      let total = spins, i = 0;
      const spinsOut = [];
      let raceWin = 0;
      while (i < total) {
        i++;
        const sev = [];
        const last = i === total;
        for (const b of ctx.raceFlight) b.band -= 1;
        sev.push({ t: 'tick', flight: ctx.raceFlight.map((b) => ({ id: b.id, band: b.band })) });
        const grid = dropGrid(cfg.raceTable);
        sev.push({ t: 'drop', grid: cloneGrid(grid), clocks: countClocks(grid).length });
        const landing = ctx.raceFlight.filter((b) => b.band <= 0);
        ctx.raceFlight = ctx.raceFlight.filter((b) => b.band > 0);
        if (landing.length) landRaceBirds(landing, ctx, sev, 'home', multTab);
        handleTakeoffs(grid, cfg.raceTable, ctx, sev);
        const symBefore = ctx.coin; // coins do not happen in race, kept for safety
        const sym = tumble(grid, cfg.raceTable, ctx, sev);
        void symBefore;
        const clocks = countClocks(grid);
        let added = 0;
        if (clocks.length >= 3 && total < cfg.maxRaceSpins) {
          added = Math.min(cfg.retrigger, cfg.maxRaceSpins - total);
          total += added;
          sev.push({ t: 'scatter', cells: clocks, count: clocks.length, spins: added, retrigger: true });
        }
        const isLast = i === total;
        if (isLast && ctx.raceFlight.length) {
          const all = ctx.raceFlight.splice(0, ctx.raceFlight.length);
          landRaceBirds(all, ctx, sev, 'final', multTab);
        }
        const m = Math.max(1, ctx.loft);
        let amt = sym > 0 ? Math.round(sym * m) : 0;
        const left = capLeft(ctx);
        let capped = false;
        if (amt >= left) { amt = left; capped = true; }
        ctx.total += amt; raceWin += amt; ctx.raceSym += sym;
        if (sym > 0) sev.push({ t: 'apply', base: sym, loft: m, amt, raceWin });
        sev.push({ t: 'end', win: amt, raceWin, spin: i, of: total, loft: ctx.loft, capped });
        spinsOut.push(sev);
        if (capped) break;
        if (last && i === total) break;
      }
      ctx.mode = 'base';
      return { pre: raceEv, spins: spinsOut, raceWin, loft: ctx.loft, played: spinsOut.length };
    }

    // ---------- public: play one round ----------
    function playRound(bet, opts) {
      opts = opts || {};
      const ctx = { bet, coin: 0, sym: 0, total: 0, cap: Math.round(cfg.maxWin * bet), loft: 0, raceFlight: [], raceSym: 0, mode: 'base' };
      const ev = [];
      let trigger = null, raceRes = null;
      let cost = bet;
      if (opts.buy) {
        cost = Math.round(cfg.buyPrice * bet);
        trigger = { count: 0, spins: cfg.raceSpins[3], bought: true };
        ev.push({ t: 'buy', spins: trigger.spins });
      } else {
        const res = baseSpin(bet, ctx, ev);
        // base win is credited before the race
        let baseWin = ctx.sym + ctx.coin;
        if (baseWin > ctx.cap) baseWin = ctx.cap;
        ctx.total = baseWin;
        if (res.clocks.length >= 3) {
          const spins = cfg.raceSpins[Math.min(res.clocks.length, 6)];
          trigger = { count: res.clocks.length, spins, cells: res.clocks };
          ev.push({ t: 'scatter', cells: res.clocks, count: res.clocks.length, spins });
        }
        ev.push({ t: 'end', win: baseWin, base: true });
      }
      if (trigger && ctx.total < ctx.cap) {
        const coinBefore = ctx.coin;
        raceRes = race(bet, trigger.spins, ctx, ev, opts);
        // call-home coins are added to total here (capped)
        const callCoins = ctx.coin - coinBefore;
        if (callCoins) { ctx.total = Math.min(ctx.cap, ctx.total + callCoins); }
      }
      const win = Math.min(ctx.total, ctx.cap);
      return {
        bet, cost, win, events: ev, race: raceRes, trigger,
        capped: win >= ctx.cap,
        parts: { sym: ctx.sym, coin: ctx.coin, race: raceRes ? raceRes.raceWin : 0 },
        flight: state.flight.map((b) => ({ id: b.id, band: b.band, bet: b.bet }))
      };
    }

    return {
      playRound,
      state,
      cfg,
      setState(s) { if (s && Array.isArray(s.flight)) { state.flight = s.flight.map((b) => ({ id: b.id, band: b.band, bet: b.bet })); state.nextId = s.nextId || (Math.max(0, ...state.flight.map((b) => b.id)) + 1); } },
      getState() { return { flight: state.flight.map((b) => ({ id: b.id, band: b.band, bet: b.bet })), nextId: state.nextId }; }
    };
  }

  const api = { createEngine, seededRng, secureRng, table, PAYING };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HomingEngine = api;
})(typeof self !== 'undefined' ? self : this);

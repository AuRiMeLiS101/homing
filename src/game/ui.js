/* HTML shell: the ticket strip, paper sheets, rules and settings. One set of states for every control. */
const UI = (function () {
  const $ = (id) => document.getElementById(id);
  const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const S = { betIdx: 3, balance: 100000, shown: 100000, busy: false, auto: 0, cb: {}, autoN: 25, autoWin: 50, autoLoss: 0, show: false };
  let balRoll = 0;
  const SET = { music: true, sfx: true, amb: true, calm: false };
  let toastT = null, lastFocus = null, openId = null;
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function init(cb) {
    S.cb = cb;
    loadSettings();
    $('spin').addEventListener('click', () => { Audio2.play('click'); cb.spin(); });
    $('betUp').addEventListener('click', () => stepBet(1));
    $('betDown').addEventListener('click', () => stepBet(-1));
    $('betValue').addEventListener('click', () => { if (S.busy) return; Audio2.play('click'); buildBets(); open('betModal'); });
    $('betChoices').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]'); if (!b) return;
      S.betIdx = +b.getAttribute('data-i'); Audio2.play('click'); render(); cb.betChanged && cb.betChanged(); close('betModal');
    });
    $('turboBtn').addEventListener('click', () => { const on = $('turboBtn').getAttribute('aria-pressed') !== 'true'; $('turboBtn').setAttribute('aria-pressed', on); Audio2.play('click'); cb.turbo(on); });
    $('autoBtn').addEventListener('click', () => {
      Audio2.play('click');
      if (S.auto > 0) { cb.autoStop(); return; }
      syncAuto(); open('autoModal');
    });
    segGroup('autoChoices', 'n', (v) => { S.autoN = v; syncAuto(); });
    segGroup('autoWin', 'x', (v) => { S.autoWin = v; });
    segGroup('autoLoss', 'x', (v) => { S.autoLoss = v; });
    $('autoGo').addEventListener('click', () => { close('autoModal'); cb.autoStart(S.autoN, { win: S.autoWin, loss: S.autoLoss }); });
    $('buy').addEventListener('click', () => { Audio2.play('click'); if (S.busy) return; $('buyCost').textContent = U.fmt(cost()); open('buyModal'); });
    $('buyConfirm').addEventListener('click', () => { close('buyModal'); cb.buy(); });
    $('refill').addEventListener('click', () => { close('emptyModal'); cb.refill(); });
    $('infoBtn').addEventListener('click', () => { Audio2.play('click'); open('infoModal'); });
    $('infoBtn2').addEventListener('click', () => { Audio2.play('click'); open('infoModal'); });
    $('soundBtn').addEventListener('click', () => {
      const on = $('soundBtn').getAttribute('aria-pressed') !== 'true';
      $('soundBtn').setAttribute('aria-pressed', on); cb.sound(on);
    });
    // tabs: click or arrow keys, roving tab index
    const tabs = [...document.querySelectorAll('#infoModal .tab')];
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => { selectTab(t); Audio2.play('click'); });
      t.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        selectTab(n); n.focus();
      });
    });
    // settings switches
    [['setMusic', 'music'], ['setSfx', 'sfx'], ['setAmb', 'amb'], ['setCalm', 'calm']].forEach(([id, k]) => {
      $(id).addEventListener('click', () => { SET[k] = !SET[k]; applySettings(); saveSettings(); Audio2.play('click'); });
    });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { Audio2.play('click'); close(b.closest('.modal').id); }));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) close(m.id); }));
    window.addEventListener('keydown', (e) => {
      const o = openId && $(openId);
      if (e.key === 'Escape' && o) { close(openId); return; }
      // keep focus inside an open sheet
      if (e.key === 'Tab' && o) {
        const f = [...o.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if ((e.code === 'Space' || e.key === ' ') && !o && !$('bar').hidden) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT') return;
        e.preventDefault(); cb.spin();
      }
    });
    applySettings();
    render();
  }

  function segGroup(id, attr, fn) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button[data-' + attr + ']'); if (!b) return;
      $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
      Audio2.play('click');
      fn(+b.getAttribute('data-' + attr));
    });
  }
  function syncAuto() { $('autoGoN').textContent = S.autoN; }
  function selectTab(t) {
    document.querySelectorAll('#infoModal .tab').forEach((x) => {
      const on = x === t;
      x.setAttribute('aria-selected', on ? 'true' : 'false'); x.tabIndex = on ? 0 : -1;
      $(x.getAttribute('aria-controls')).hidden = !on;
    });
    const body = document.querySelector('#infoModal .sheet-body'); if (body) body.scrollTop = 0;
  }
  function buildBets() {
    $('betChoices').innerHTML = BETS.map((b, i) => `<button data-i="${i}" aria-pressed="${i === S.betIdx}"${S.balance < b ? ' disabled' : ''}>${U.fmt(b)}</button>`).join('');
  }
  function stepBet(d) {
    const n = S.betIdx + d;
    if (n < 0 || n >= BETS.length || S.busy) return;
    S.betIdx = n; Audio2.play('click'); render(); S.cb.betChanged && S.cb.betChanged();
    const v = $('betValue');
    if (!reduceMotion && v.animate) v.animate([{ transform: `translateY(${d > 0 ? 8 : -8}px)`, opacity: 0.2 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 180, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }

  // ---------- sheets: the backdrop fades, the paper drops in with a little spring, focus moves inside ----------
  function open(id) {
    if (openId && openId !== id) close(openId, true);
    lastFocus = document.activeElement;
    const m = $(id); m.hidden = false; openId = id;
    const sh = m.querySelector('.sheet');
    if (!reduceMotion && m.animate) {
      m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: 'ease-out' });
      if (sh) sh.animate([{ transform: 'translateY(26px) rotate(-1.2deg) scale(0.96)', opacity: 0 }, { transform: 'translateY(0) rotate(0) scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.2,1.35,.4,1)' });
    }
    const f = m.querySelector('[aria-pressed="true"], .tab[aria-selected="true"], .cta:not(.ghost), button');
    if (f) f.focus({ preventScroll: true });
  }
  function close(id, quick) {
    const m = $(id); if (!m || m.hidden) return;
    if (openId === id) openId = null;
    // a sheet reopened during its own exit must stay open
    const done = () => { if (openId !== id) m.hidden = true; };
    if (!quick && !reduceMotion && m.animate) {
      const sh = m.querySelector('.sheet');
      if (sh) sh.animate([{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(16px) scale(0.98)', opacity: 0 }], { duration: 140, easing: 'ease-in' });
      m.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease-in' }).onfinish = done;
    } else done();
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function bet() { return BETS[S.betIdx]; }
  function cost() { return Math.round(HOMING_CONFIG.buyPrice * bet()); }

  function render() {
    $('balance').innerHTML = U.fmt(S.shown) + '<small>FUN</small>';
    $('betValue').innerHTML = U.fmt(bet()) + '<small>FUN</small>';
    $('buyPrice').textContent = U.fmt(cost());
    $('betUp').disabled = S.busy || S.betIdx >= BETS.length - 1;
    $('betDown').disabled = S.busy || S.betIdx <= 0;
    $('betValue').disabled = S.busy;
    $('buy').disabled = S.busy || S.balance < cost();
    $('autoBtn').setAttribute('aria-pressed', S.auto > 0 ? 'true' : 'false');
    $('autoBtn').innerHTML = S.auto > 0 ? 'AUTO<span class="count">' + S.auto + '</span>' : 'AUTO';
    const sp = $('spin');
    sp.classList.toggle('stop', S.auto > 0);
    sp.classList.toggle('busy', S.busy && S.auto <= 0);
    $('spinCount').textContent = S.auto > 0 ? S.auto + ' LEFT' : 'AUTO';
    sp.setAttribute('aria-label', S.auto > 0 ? 'Stop autoplay' : (S.busy ? 'Hurry up' : 'Spin'));
  }

  // the balance counts up when a win is credited; any other change (a bet, a top up) shows at once
  function setBalance(c, roll) {
    S.balance = c;
    cancelAnimationFrame(balRoll);
    if (!roll || c <= S.shown || reduceMotion) { S.shown = c; render(); return; }
    const from = S.shown, t0 = performance.now(), dur = Math.min(900, 280 + 120 * Math.log2(1 + (c - from) / Math.max(1, BETS[S.betIdx])));
    const el = $('balance');
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      S.shown = Math.round(from + (c - from) * e);
      el.innerHTML = U.fmt(S.shown) + '<small>FUN</small>';
      if (k < 1) balRoll = requestAnimationFrame(step); else { S.shown = c; render(); }
    };
    balRoll = requestAnimationFrame(step);
  }
  function setWin(c, hot) {
    $('winValue').textContent = U.fmt(c);
    $('winValue').classList.toggle('hot', !!hot && c > 0);
  }
  function setBusy(b) { S.busy = b; render(); }
  function showBuy(on) {
    const b = $('buy');
    if (on && b.hidden) { b.hidden = false; if (!reduceMotion) b.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1) rotate(0)' }], { duration: 420, easing: 'cubic-bezier(.2,1.5,.4,1)' }); }
    else if (!on) b.hidden = true;
  }
  function setAuto(n) { S.auto = n; render(); }
  // the big win show owns the screen: the strip steps back until it ends
  function showtime(on) { S.show = !!on; document.body.classList.toggle('showtime', S.show); }
  function announce(msg) { $('live').textContent = msg; }

  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    if (!reduceMotion && t.animate) t.animate([{ transform: 'translate(-50%, -16px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.4,.4,1)' });
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2200);
  }

  function showBar() {
    const bar = $('bar'); bar.hidden = false;
    $('topbtns').hidden = false;
    if (!reduceMotion) bar.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }

  function buildInfo(stats) {
    const img = (k) => G.tex.symCanvas[k] ? G.tex.symCanvas[k].toDataURL('image/png') : '';
    $('imgBird').src = img('BIRD'); $('imgClock').src = img('CLOCK');
    const names = { GENA: 'Gennady', CHAMP: 'Marshal', RAD: 'Radio', TEA: 'Thermos', SEED: 'Seed sack', BINO: 'Binoculars', A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10' };
    const pt = HOMING_CONFIG.paytable;
    $('pays').innerHTML = Object.keys(pt).map((k) => `<div class="pay"><img src="${img(k)}" alt="${names[k]}"><dl><dt>12+</dt><dd>${pt[k][2]}×</dd><dt>10 or 11</dt><dd>${pt[k][1]}×</dd><dt>8 or 9</dt><dd>${pt[k][0]}×</dd></dl></div>`).join('');
    $('stats').innerHTML = stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  }

  // ---------- settings: kept on this device ----------
  function loadSettings() {
    try { const s = JSON.parse(localStorage.getItem('homing-settings') || 'null'); if (s) Object.assign(SET, s); } catch (e) { /* storage unavailable */ }
  }
  function saveSettings() { try { localStorage.setItem('homing-settings', JSON.stringify(SET)); } catch (e) { /* storage unavailable */ } }
  function applySettings() {
    $('setMusic').setAttribute('aria-checked', SET.music); $('setSfx').setAttribute('aria-checked', SET.sfx);
    $('setAmb').setAttribute('aria-checked', SET.amb); $('setCalm').setAttribute('aria-checked', SET.calm);
    Audio2.setBus('music', SET.music); Audio2.setBus('sfx', SET.sfx); Audio2.setBus('amb', SET.amb);
    G.reduced = G.osReduced || SET.calm;
  }

  return { init, render, bet, cost, setBalance, setWin, setBusy, showBuy, setAuto, showtime, toast, announce, showBar, buildInfo, open, close, applySettings, S, SET, BETS };
})();

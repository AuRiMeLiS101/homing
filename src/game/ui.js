/* HTML controls: ticket strip, modals, rules screen. */
const UI = (function () {
  const $ = (id) => document.getElementById(id);
  const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  const S = { betIdx: 3, balance: 100000, busy: false, auto: 0, cb: {} };
  let toastT = null, lastFocus = null;

  function init(cb) {
    S.cb = cb;
    $('spin').addEventListener('click', () => { Audio2.play('click'); cb.spin(); });
    $('betUp').addEventListener('click', () => { if (S.betIdx < BETS.length - 1) { S.betIdx++; Audio2.play('click'); render(); cb.betChanged && cb.betChanged(); } });
    $('betDown').addEventListener('click', () => { if (S.betIdx > 0) { S.betIdx--; Audio2.play('click'); render(); cb.betChanged && cb.betChanged(); } });
    $('turboBtn').addEventListener('click', () => { const on = $('turboBtn').getAttribute('aria-pressed') !== 'true'; $('turboBtn').setAttribute('aria-pressed', on); Audio2.play('click'); cb.turbo(on); });
    $('autoBtn').addEventListener('click', () => {
      Audio2.play('click');
      if (S.auto > 0) { cb.autoStop(); return; }
      open('autoModal');
    });
    $('autoChoices').addEventListener('click', (e) => {
      const n = e.target && e.target.getAttribute('data-n');
      if (!n) return; close('autoModal'); cb.autoStart(+n);
    });
    $('buy').addEventListener('click', () => { Audio2.play('click'); if (S.busy) return; $('buyCost').textContent = U.fmt(cost()); open('buyModal'); });
    $('buyConfirm').addEventListener('click', () => { close('buyModal'); cb.buy(); });
    $('refill').addEventListener('click', () => { close('emptyModal'); cb.refill(); });
    $('infoBtn').addEventListener('click', () => { Audio2.play('click'); open('infoModal'); });
    $('infoBtn2').addEventListener('click', () => { Audio2.play('click'); open('infoModal'); });
    $('soundBtn').addEventListener('click', () => {
      const on = $('soundBtn').getAttribute('aria-pressed') !== 'true';
      $('soundBtn').setAttribute('aria-pressed', on); cb.sound(on);
    });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { Audio2.play('click'); close(b.closest('.modal').id); }));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => { if (e.target === m) close(m.id); }));
    window.addEventListener('keydown', (e) => {
      const open = document.querySelector('.modal:not([hidden])');
      if (e.key === 'Escape' && open) { close(open.id); return; }
      if ((e.code === 'Space' || e.key === ' ') && !open && !$('bar').hidden) {
        const tag = (document.activeElement && document.activeElement.tagName) || '';
        if (tag === 'INPUT') return;
        e.preventDefault(); cb.spin();
      }
    });
    render();
  }

  function open(id) {
    lastFocus = document.activeElement;
    $(id).hidden = false;
    const f = $(id).querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
  function close(id) { $(id).hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); }

  function bet() { return BETS[S.betIdx]; }
  function cost() { return Math.round(HOMING_CONFIG.buyPrice * bet()); }

  function render() {
    $('balance').innerHTML = U.fmt(S.balance) + '<small>FUN</small>';
    $('betValue').textContent = U.fmt(bet());
    $('buyPrice').textContent = U.fmt(cost());
    $('betUp').disabled = S.busy || S.betIdx >= BETS.length - 1;
    $('betDown').disabled = S.busy || S.betIdx <= 0;
    $('buy').disabled = S.busy || S.balance < cost();
    $('autoBtn').setAttribute('aria-pressed', S.auto > 0 ? 'true' : 'false');
    $('autoBtn').textContent = S.auto > 0 ? 'AUTO ' + S.auto : 'AUTO';
    $('spin').classList.toggle('stop', S.auto > 0);
    $('spin').setAttribute('aria-label', S.auto > 0 ? 'Stop autoplay' : (S.busy ? 'Hurry up' : 'Spin'));
  }

  function setBalance(c) { S.balance = c; render(); }
  function setWin(c, hot) {
    $('winValue').textContent = U.fmt(c);
    $('winValue').classList.toggle('hot', !!hot && c > 0);
  }
  function setBusy(b) { S.busy = b; render(); }
  function showBuy(on) {
    const b = $('buy');
    if (on && b.hidden) { b.hidden = false; b.animate([{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1) rotate(0)' }], { duration: 420, easing: 'cubic-bezier(.2,1.5,.4,1)' }); }
    else if (!on) b.hidden = true;
  }
  function setAuto(n) { S.auto = n; render(); }
  function announce(msg) { $('live').textContent = msg; }

  function toast(msg, ms) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms || 2200);
  }

  function showBar() {
    const bar = $('bar'); bar.hidden = false;
    $('topbtns').hidden = false;
    bar.animate([{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.2,1.4,.4,1)' });
  }

  function buildInfo(stats) {
    const img = (k) => G.tex.symCanvas[k] ? G.tex.symCanvas[k].toDataURL('image/png') : '';
    $('imgBird').src = img('BIRD'); $('imgClock').src = img('CLOCK');
    const names = { GENA: 'Gennady', CHAMP: 'Marshal', RAD: 'Radio', TEA: 'Thermos', SEED: 'Seed sack', BINO: 'Binoculars', A: 'A', K: 'K', Q: 'Q', J: 'J', T: '10' };
    const pt = HOMING_CONFIG.paytable;
    $('pays').innerHTML = Object.keys(pt).map((k) => `<div class="pay"><img src="${img(k)}" alt="${names[k]}"><dl><dt>12+</dt><dd>${pt[k][2]}×</dd><dt>10 or 11</dt><dd>${pt[k][1]}×</dd><dt>8 or 9</dt><dd>${pt[k][0]}×</dd></dl></div>`).join('');
    $('stats').innerHTML = stats.map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  }

  return { init, render, bet, cost, setBalance, setWin, setBusy, showBuy, setAuto, toast, announce, showBar, buildInfo, open, close, S, BETS };
})();

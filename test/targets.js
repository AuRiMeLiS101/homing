// Touch target audit, run inside the page: for every visible control, measure the area that actually takes the
// tap (pseudo element hit areas included) by probing outward from its centre with elementFromPoint.
// Returns the controls whose hit area is under 44 by 44 CSS pixels.
(() => {
  const sel = 'button, [role="tab"], [role="switch"], a[href]';
  const out = [];
  for (const el of document.querySelectorAll(sel)) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || el.closest('[hidden]')) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || +st.opacity === 0) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === el || el.contains(e)); };
    if (!hit(cx, cy)) continue; // covered by something else (for example a sheet backdrop)
    const reach = (dx, dy) => { let d = 0; while (d < 60 && hit(cx + dx * (d + 1), cy + dy * (d + 1))) d++; return d; };
    const w = reach(-1, 0) + reach(1, 0) + 1, h = reach(0, -1) + reach(0, 1) + 1;
    if (w < 44 || h < 44) out.push((el.id || el.getAttribute('aria-label') || el.textContent.trim().slice(0, 16)) + ' ' + w + 'x' + h);
  }
  return out.length ? out : 'all controls 44x44 or larger';
})()

/* Homing pigeons: side view flight frames and perched poses. */
(function (root) {
  'use strict';
  const A = root.HomingArtCore;
  const { C, Painter, rr, circ, ell } = A;

  const SCHEMES = {
    grey: { body: C.PIG, wing: C.PIGL, tip: C.PIGD, neck: C.TEAL, sheen: C.VIOLETL, bars: C.INK },
    white: { body: '#E9E2D4', wing: '#FBF6EC', tip: '#BDB4A6', neck: '#BFE0DA', sheen: '#E9C9E8', bars: '#9A9184' },
    dark: { body: '#56616C', wing: '#78858F', tip: '#2B3139', neck: C.TEAL, sheen: C.VIOLETL, bars: '#1B1622' },
    red: { body: '#B8744A', wing: '#D9A27A', tip: '#7A4428', neck: '#B9497C', sheen: C.YELLOW, bars: '#5C2E18' }
  };

  const WINGS = {
    up: 'M84 84C78 44 94 8 136 -2C150 -4 156 4 148 12L142 20C150 20 152 28 146 32L134 42C140 44 138 52 132 54L122 86Z',
    mid: 'M82 88C104 60 146 46 198 40C206 41 204 50 194 55C162 67 132 80 120 92Z',
    down: 'M84 90C92 120 112 150 140 172C150 178 160 172 156 164L150 150C158 150 164 144 160 136L148 120C154 116 154 108 146 104L126 92Z',
    glide: 'M80 88C110 76 150 74 206 70C212 74 206 82 194 84C152 92 118 98 96 100Z'
  };
  const TIPS = {
    up: 'M116 6L136 -2C150 -4 156 4 148 12L142 20C150 20 152 28 146 32L130 36Z',
    mid: 'M164 46L198 40C206 41 204 50 194 55L170 62Z',
    down: 'M126 150L140 172C150 178 160 172 156 164L150 150C158 150 164 144 160 136L140 132Z',
    glide: 'M170 74L206 70C212 74 206 82 194 84L172 86Z'
  };
  const FAR = {
    up: 'M98 80C102 46 118 22 152 12C142 36 130 60 122 84Z',
    mid: 'M100 84C120 64 150 54 184 50C164 64 140 78 124 88Z'
  };

  function flight(frame, scheme, banded, boil) {
    const s = SCHEMES[scheme] || SCHEMES.grey;
    const p = new Painter(220, 196, 1);
    p.lineW = 6; p.mis = [3, 3]; p.light = [-9, -9];
    p.x.translate(0, 14);
    if (FAR[frame]) p.part({ d: FAR[frame], fill: s.tip, lw: 5 });
    // tail
    p.part({ d: 'M54 92L10 80L6 98L12 114L56 106Z', fill: s.body, shade: true, lw: 5 });
    p.stroke('M14 108L50 100', s.tip, 6);
    // body
    p.part({ d: 'M48 96C60 70 116 66 146 78C160 86 162 104 148 112C118 126 66 122 48 106Z', fill: s.body, shade: true, hi: true });
    // feet tucked
    p.stroke('M102 118L96 132M114 118L110 132', C.CORAL, 7);
    if (banded) p.part({ d: rr(104, 122, 16, 9, 3), fill: C.YELLOW, lw: 3 });
    // neck and head
    p.part({ d: 'M138 82C144 60 156 46 172 46C186 48 190 62 184 74C178 86 164 92 150 98Z', fill: s.neck, shade: true });
    p.stroke('M150 86C156 74 162 66 172 62', s.sheen, 6);
    p.part({ d: circ(176, 58, 16), fill: s.body, hi: true, lw: 5 });
    p.part({ d: 'M190 54L212 61L190 68Z', fill: C.TAN, lw: 4 });
    p.part({ d: ell(188, 54, 5, 3.6), fill: C.PAPER, lw: 2 });
    p.fillOnly(circ(178, 54, 5), C.ORANGE);
    p.fillOnly(circ(178.5, 54, 2.2), C.INK);
    // near wing
    p.part({ d: WINGS[frame], fill: s.wing, shade: true, hi: true, lw: 5 });
    p.fillOnly(TIPS[frame], s.tip);
    p.stroke(WINGS[frame], C.INK, 5);
    if (frame === 'up') p.stroke('M98 62C106 54 114 50 122 48M100 74C108 66 116 62 124 60', s.bars, 5);
    if (frame === 'mid') p.stroke('M104 76C118 68 134 62 150 58M110 84C122 78 136 72 150 68', s.bars, 5);
    if (frame === 'glide') p.stroke('M110 86C126 82 142 80 160 78', s.bars, 5);
    if (frame === 'down') p.stroke('M100 104C110 114 120 124 130 132', s.bars, 5);
    return p.done(boil ? { seed: boil, amp: 1.2, period: 12 } : null);
  }

  function perched(bob, scheme, banded, boil) {
    const s = SCHEMES[scheme] || SCHEMES.grey;
    const p = new Painter(170, 190, 1);
    p.lineW = 6; p.mis = [3, 3]; p.light = [-9, -9];
    // legs
    p.stroke('M86 140L82 172M102 140L106 172', C.CORAL, 8);
    p.stroke('M70 174H92M96 174H118', C.CORAL, 6);
    if (banded) p.part({ d: rr(96, 150, 18, 10, 3), fill: C.YELLOW, lw: 3 });
    // tail
    p.part({ d: 'M50 116L18 152L38 160L64 128Z', fill: s.body, shade: true, lw: 5 });
    // body
    p.part({ d: 'M44 110C44 74 82 60 112 70C134 78 140 100 128 122C116 144 70 146 52 132Z', fill: s.body, shade: true, hi: true });
    // folded wing
    p.part({ d: 'M56 96C78 80 112 86 128 106C112 124 80 132 54 122Z', fill: s.wing, shade: true, lw: 5 });
    p.stroke('M70 104C84 100 98 102 110 108M66 114C80 112 94 114 106 118', s.bars, 5);
    p.fillOnly('M54 122C44 118 40 112 44 104L60 112Z', s.tip);
    // neck / head
    const hx = bob ? 142 : 130, hy = bob ? 54 : 40;
    p.part({ d: `M104 74C104 54 ${hx - 22} ${hy - 6} ${hx - 6} ${hy - 8}C${hx + 10} ${hy - 8} ${hx + 16} ${hy + 6} ${hx + 12} ${hy + 18}C${hx + 6} ${hy + 30} 128 ${hy + 42} 118 86Z`, fill: s.neck, shade: true });
    p.stroke(`M112 80C${hx - 18} ${hy + 30} ${hx - 10} ${hy + 18} ${hx - 2} ${hy + 14}`, s.sheen, 5);
    p.part({ d: circ(hx, hy, 15), fill: s.body, hi: true, lw: 5 });
    p.part({ d: `M${hx + 13} ${hy - 3}L${hx + 31} ${hy + 2}L${hx + 13} ${hy + 7}Z`, fill: C.TAN, lw: 4 });
    p.part({ d: ell(hx + 12, hy - 4, 4.5, 3.2), fill: C.PAPER, lw: 2 });
    p.fillOnly(circ(hx + 3, hy - 3, 4.6), C.ORANGE);
    p.fillOnly(circ(hx + 3.5, hy - 3, 2), C.INK);
    return p.done(boil ? { seed: boil, amp: 1.2, period: 12 } : null);
  }

  // small dark silhouette for the distant flock (fast to draw, no detail)
  function silhouette(frame, color) {
    const p = new Painter(220, 196, 0.35);
    p.x.translate(0, 14);
    const wing = WINGS[frame];
    p.fillOnly('M54 92L10 80L6 98L12 114L56 106Z', color);
    p.fillOnly('M48 96C60 70 116 66 146 78C160 86 162 104 148 112C118 126 66 122 48 106Z', color);
    p.fillOnly('M138 82C144 60 156 46 172 46C186 48 190 62 184 74C178 86 164 92 150 98Z', color);
    p.fillOnly(circ(176, 58, 16), color);
    p.fillOnly('M190 54L212 61L190 68Z', color);
    p.fillOnly(wing, color);
    if (FAR[frame]) p.fillOnly(FAR[frame], color);
    return p.c;
  }

  root.HomingBirds = { flight, perched, silhouette, FRAMES: ['up', 'mid', 'glide', 'down'], SCHEMES: Object.keys(SCHEMES) };
})(typeof self !== 'undefined' ? self : this);

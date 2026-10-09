/*!
 * doodle-orbs.js — six generative orb loaders built from plain DOM cells and
 * CSS keyframes. Dependency-free vanilla JS, UMD. v1.0.0
 *
 * Inspired by css-doodle (https://github.com/css-doodle/css-doodle,
 * https://css-doodle.com) by Yuan Chuan, MIT licensed. No css-doodle code is
 * copied or bundled: the idea it is known for — one cell of CSS repeated over a
 * grid, with a seeded @rand and index-based @nth/@at placement — is
 * reimplemented here as a tiny generator that stamps out cells carrying
 * per-cell CSS custom properties (--x --y --p ...) and lets shared keyframes do
 * the animating. The six looks are original compositions in that vein.
 *
 * css-doodle licence (applies to the idea and the name credited above):
 *
 *   MIT License
 *
 *   Copyright (c) 2017-present Yuan Chuan <yuanchuan23@gmail.com>
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   'Software'), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 *   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 *   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 *   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 *   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Adapted for orb-loaders: a ~15 KB generator instead of the css-doodle
 * runtime; cells are placed polar-to-cartesian once at mount, then animated
 * with compositor-only properties (translate/rotate/scale/opacity) and no
 * JavaScript per frame; three size tiers (20 / 64 / 96 px) with their own cell
 * counts and dot sizes; seeded layout; reduced-motion static pose;
 * offscreen/hidden-tab pause; ink follows `currentColor`.
 *
 * Usage:
 *   DoodleOrbs.mount(element, { variant: 'ring-wave', size: 64, color: 'currentColor' })
 *   -> returns { destroy() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoodleOrbs = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = Math.PI * 2;
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  const STYLE_ID = 'doodle-orbs-style';
  const MIN_SPEED = 0.1;
  const MAX_SPEED = 5;
  const TIER_XS_MAX = 32;   // inline: 16-32 px
  const TIER_MD_MAX = 72;   // control / card: 33-72 px, otherwise hero

  /* ================================================================== CSS */

  // One stylesheet shared by every orb. Cells never set their own animation;
  // they only carry numbers (--x --y --w --p --t ...) that the rules below read.
  // `--u` is 1% of the orb, so every geometry value is authored on a 100 grid.
  const CSS = `
.dd-orb{--u:calc(var(--s) / 100);--ease:cubic-bezier(.45,.05,.55,.95);
  position:relative;display:block;flex:none;width:var(--s);height:var(--s);
  contain:layout paint style}
.dd-orb *{box-sizing:border-box}
.dd-c,.dd-g{position:absolute}
.dd-g{inset:0;rotate:var(--a,0deg)}
.dd-c{left:50%;top:50%;
  width:calc(var(--w,5) * var(--u));height:calc(var(--h,var(--w,5)) * var(--u));
  margin:calc(var(--h,var(--w,5)) * var(--u) * -.5) 0 0 calc(var(--w,5) * var(--u) * -.5);
  border-radius:50%;background:currentColor;
  translate:calc(var(--x,0) * var(--u)) calc(var(--y,0) * var(--u));
  rotate:var(--a,0deg);scale:var(--k,1);opacity:var(--o,1)}
.dd-ring{background:none;border:max(1px,calc(var(--u) * 1.2)) solid currentColor}
.dd-arc{background:conic-gradient(currentColor calc(var(--f) * 1turn),transparent 0);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - var(--bw) * var(--u)),#000 calc(100% - var(--bw) * var(--u) + .6px));
  mask:radial-gradient(farthest-side,transparent calc(100% - var(--bw) * var(--u)),#000 calc(100% - var(--bw) * var(--u) + .6px))}

.dd-wave,.dd-twinkle,.dd-petal,.dd-breathe,.dd-core{animation-iteration-count:infinite;
  animation-timing-function:var(--ease);animation-duration:var(--t);
  animation-delay:calc(var(--t) * var(--p,0) * -1)}
.dd-wave{animation-name:dd-wave}
.dd-twinkle{animation-name:dd-twinkle}
.dd-petal{animation-name:dd-petal}
.dd-breathe{animation-name:dd-breathe}
.dd-core{animation-name:dd-core}
.dd-spin,.dd-sweep{animation-name:dd-spin;animation-iteration-count:infinite;
  animation-duration:var(--t);animation-direction:var(--dir,normal);
  animation-delay:calc(var(--t) * var(--p,0) * -1)}
.dd-spin{animation-timing-function:linear}
.dd-sweep{animation-timing-function:cubic-bezier(.45,.15,.55,.85)}
.dd-inhale{animation:dd-inhale var(--t) var(--ease) infinite}

@keyframes dd-wave{0%,100%{scale:.35;opacity:.28}50%{scale:1.2;opacity:1}}
@keyframes dd-twinkle{0%,100%{scale:.55;opacity:.2}50%{scale:1.15;opacity:1}}
@keyframes dd-petal{0%,100%{scale:.45 .7;opacity:.3}50%{scale:1 1;opacity:.8}}
@keyframes dd-breathe{0%,100%{scale:.5;opacity:.35}50%{scale:1.05;opacity:1}}
@keyframes dd-core{0%,100%{scale:.75}50%{scale:1.15}}
@keyframes dd-inhale{0%,100%{scale:.92}50%{scale:1.04}}
@keyframes dd-spin{from{rotate:var(--a,0deg)}to{rotate:calc(var(--a,0deg) + 360deg)}}

.dd-orb.dd-off,.dd-orb.dd-off *{animation-play-state:paused!important}
@keyframes dd-calm{0%,100%{opacity:.55}50%{opacity:1}}
/* Reduced motion: every cell holds its static pose; the whole orb only fades. */
@media (prefers-reduced-motion:reduce){.dd-orb *{animation:none!important}
  .dd-orb{animation:dd-calm 3.2s ease-in-out infinite!important}}
`;

  /* ============================================================== helpers */

  // mulberry32, public domain (Tommy Ettinger). css-doodle's @seed, in 6 lines.
  function seeded(seed) {
    let a = seed | 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const n = (v) => Math.round(v * 1000) / 1000;
  const lerp = (a, b, f) => a + (b - a) * f;
  const pick = (tier, list) => list[tier];
  // 0 -> 1 -> 0 over p in [0,1]: the static pose matching a keyframe phase.
  const pulse = (p) => 0.5 - 0.5 * Math.cos(TAU * p);

  function make(parent, cls, vars) {
    const el = document.createElement('div');
    el.className = cls;
    for (const k in vars) el.style.setProperty('--' + k, vars[k]);
    parent.appendChild(el);
    return el;
  }

  const polar = (r, ang) => ({ x: n(Math.cos(ang) * r), y: n(Math.sin(ang) * r) });

  /* ============================================================== variants */

  // Each builder receives { tier, rnd, dur, root } and returns the root period
  // in seconds. Tier 0 = inline (<=32 px), 1 = control (<=72 px), 2 = hero.

  // Polar dot ring: counter-rotating wave travelling round two or three rings.
  function ringWave(c) {
    const rings = pick(c.tier, [
      [[8, 34, 17, 1]],
      [[18, 40, 8.5, 1], [10, 25, 6.5, -1]],
      [[24, 41, 7.5, 1], [14, 27, 6, -1], [7, 13, 5, 1]]
    ]);
    rings.forEach(function (ring) {
      const count = ring[0], dir = ring[3];
      for (let i = 0; i < count; i++) {
        const f = i / count, p = dir > 0 ? f : 1 - f, s = pulse(p);
        const v = polar(ring[1], f * TAU - Math.PI / 2);
        v.w = ring[2]; v.p = n(p); v.k = n(0.35 + 0.85 * s); v.o = n(0.28 + 0.72 * s);
        make(c.root, 'dd-c dd-wave', v);
      }
    });
    return 1.8;
  }

  // Phyllotaxis spiral: dots on the golden angle, inner arm spins faster than
  // the outer (differential rotation), each dot twinkling on its own seed.
  function spiralGalaxy(c) {
    const count = pick(c.tier, [12, 30, 72]);
    const sizes = pick(c.tier, [[24, 12], [9, 4.2], [8, 3.2]]);
    const maxR = 43, step = maxR / Math.sqrt(count);
    const inner = make(c.root, 'dd-g dd-spin', { t: c.dur(9) });
    const outer = make(c.root, 'dd-g dd-spin', { t: c.dur(26) });
    for (let i = 0; i < count; i++) {
      const r = step * Math.sqrt(i + 0.5), f = r / maxR, p = c.rnd();
      const v = polar(r, i * GOLDEN_ANGLE);
      v.w = n(lerp(sizes[0], sizes[1], f)); v.p = n(p);
      v.t = c.dur(1.6 + c.rnd() * 1.4);
      v.k = n(0.7 + 0.4 * pulse(p)); v.o = n((1 - 0.55 * f) * (0.5 + 0.5 * pulse(p)));
      make(f < 0.5 ? inner : outer, 'dd-c dd-twinkle', v);
    }
    return 2;
  }

  // Petals rotate as a flower while each swells in turn; a core beats beneath.
  function petalOrb(c) {
    const cfg = pick(c.tier, [[6, 21, 40, 24], [8, 22, 40, 15], [8, 22, 40, 14]]);
    const count = cfg[0];
    const flower = make(c.root, 'dd-g dd-spin', { t: c.dur(30) });
    for (let i = 0; i < count; i++) {
      const f = i / count, ang = f * TAU, s = pulse(f);
      const v = polar(cfg[1], ang);
      v.w = cfg[2]; v.h = cfg[3]; v.a = n(ang * 180 / Math.PI) + 'deg';
      v.p = n(f); v.k = n(0.45 + 0.55 * s); v.o = n(0.3 + 0.5 * s);
      make(flower, 'dd-c dd-petal', v);
    }
    make(c.root, 'dd-c dd-core', { w: pick(c.tier, [13, 10, 11]), t: c.dur(1.8) });
    return 3.6;
  }

  // Cells on faint orbit rings, inner orbits faster, alternate directions.
  function orbitingCells(c) {
    const orbits = pick(c.tier, [
      [[37, 17, 1, 1.7], [19, 13, 1, 1.1]],
      [[40, 9, 1, 3.4], [27, 7.5, 2, 2.4], [15, 6, 1, 1.5]],
      [[40, 10, 1, 3.6], [27, 8, 2, 2.5], [15, 6.5, 1, 1.6]]
    ]);
    orbits.forEach(function (o, j) {
      make(c.root, 'dd-c dd-ring', { w: o[0] * 2, o: 0.22 });
      const p = c.rnd();
      const g = make(c.root, 'dd-g dd-spin', {
        t: c.dur(o[3]), p: n(p), a: n(p * 360) + 'deg', dir: j % 2 ? 'reverse' : 'normal'
      });
      for (let k = 0; k < o[2]; k++) {
        const v = polar(o[0], (k / o[2]) * TAU);
        v.w = o[1];
        make(g, 'dd-c', v);
      }
    });
    if (c.tier > 0) make(c.root, 'dd-c dd-core', { w: pick(c.tier, [0, 8, 10]), t: c.dur(2.4) });
    return 2.4;
  }

  // Disc cut from a square grid. Dot size follows sphere shading; the ripple
  // delay follows distance from centre, so each breath rolls outward.
  function gridSphere(c) {
    const grid = pick(c.tier, [5, 9, 11]);
    const span = 80, spacing = span / (grid - 1), wMax = spacing * 0.78;
    const ball = make(c.root, 'dd-g dd-inhale', { t: c.dur(3.8) });
    for (let row = 0; row < grid; row++) {
      for (let col = 0; col < grid; col++) {
        const gx = (col / (grid - 1)) * 2 - 1, gy = (row / (grid - 1)) * 2 - 1;
        const d = Math.hypot(gx, gy);
        if (d > 1.001) continue;
        const shade = Math.sqrt(Math.max(0, 1 - d * d * 0.85));
        const p = d * 0.55, s = pulse(p);
        make(ball, 'dd-c dd-breathe', {
          x: n(gx * span / 2), y: n(gy * span / 2), w: n(wMax * (0.4 + 0.6 * shade)),
          p: n(p), k: n(0.5 + 0.55 * s), o: n(0.35 + 0.65 * s)
        });
      }
    }
    return 3.8;
  }

  // Concentric partial rings, each sweeping at its own tempo and direction.
  function arcRings(c) {
    const rings = pick(c.tier, [
      [[40, 11], [22, 11]],
      [[43, 8], [30, 8], [17, 8]],
      [[44, 5.5], [34, 5.5], [24, 5.5], [14, 5.5]]
    ]);
    rings.forEach(function (ring, j) {
      const a = c.rnd() * 360;
      make(c.root, 'dd-c dd-arc dd-sweep', {
        w: ring[0] * 2, bw: ring[1], f: n(0.3 + c.rnd() * 0.4), a: n(a) + 'deg',
        t: c.dur(2.2 + j * 0.6 + c.rnd() * 0.4), dir: j % 2 ? 'reverse' : 'normal',
        o: n(1 - j * 0.14)
      });
    });
    return 2.4;
  }

  const VARIANTS = {
    'ring-wave': ringWave,
    'spiral-galaxy': spiralGalaxy,
    'petal-orb': petalOrb,
    'orbiting-cells': orbitingCells,
    'grid-sphere': gridSphere,
    'arc-rings': arcRings
  };
  const VARIANT_IDS = Object.keys(VARIANTS);

  /* =============================================================== runtime */

  let styleEl = null;
  let styleRefs = 0;

  function acquireStyle() {
    if (styleRefs++ === 0) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      styleEl.textContent = CSS;
      document.head.appendChild(styleEl);
    }
  }

  function releaseStyle() {
    if (--styleRefs === 0 && styleEl) {
      styleEl.remove();
      styleEl = null;
    }
  }

  function clamp(v, lo, hi, fallback) {
    const x = Number(v);
    return isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback;
  }

  function mount(host, opts) {
    if (!host || host.nodeType !== 1) throw new TypeError('DoodleOrbs.mount: host must be a DOM element');
    const o = opts || {};
    const variant = o.variant || VARIANT_IDS[0];
    if (!VARIANTS[variant]) {
      throw new RangeError('DoodleOrbs.mount: unknown variant "' + variant + '". Use one of: ' + VARIANT_IDS.join(', '));
    }
    const size = clamp(o.size, 8, 1024, 64);
    const speed = clamp(o.speed, MIN_SPEED, MAX_SPEED, 1);
    const seed = Number.isFinite(o.seed) ? o.seed : VARIANT_IDS.indexOf(variant) + 1;
    const tier = size <= TIER_XS_MAX ? 0 : size <= TIER_MD_MAX ? 1 : 2;
    const dur = (sec) => n(sec / speed) + 's';

    acquireStyle();
    const el = document.createElement('div');
    el.className = 'dd-orb';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', o.label || 'Loading');
    el.style.setProperty('--s', size + 'px');
    if (o.color) el.style.color = o.color;
    const period = VARIANTS[variant]({ tier: tier, rnd: seeded(seed), dur: dur, root: el });
    el.style.setProperty('--t', dur(period));
    host.appendChild(el);

    // Pause the compositor animations while offscreen or in a background tab.
    let onscreen = true;
    const sync = () => el.classList.toggle('dd-off', document.hidden || !onscreen);
    let observer = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(function (entries) {
        onscreen = entries[entries.length - 1].isIntersecting;
        sync();
      });
      observer.observe(el);
    }
    document.addEventListener('visibilitychange', sync);
    sync();

    let destroyed = false;
    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
        el.remove();
        releaseStyle();
      }
    };
  }

  return { mount: mount, VARIANTS: VARIANT_IDS };
}));

/*!
 * thinking-orb-extended.js — eight extended "thinking orb" loading indicators.
 * Dependency-free vanilla JS, UMD. v1.0.0
 *
 * Upstream: solid-thinking-orbs — https://github.com/Mvkweb/solid-thinking-orbs
 *   Live demo: https://solid-thinking-orbs.vercel.app
 * Upstream authors:
 *   Jakub Antalik — original React implementation
 *                   (https://github.com/Jakubantalik/thinking-orbs)
 *   Mvkweb        — SolidJS port and the extended V2 states ported here
 *   inkform       — the dotted-3D engine core ("Ported from inkform",
 *                   PlotterLab's HalftoneSphere lineage), credited as upstream does
 * Upstream licence: MIT
 *
 *   MIT License
 *
 *   Copyright (c) 2026 Jakub Antalik (Original React Implementation)
 *   Copyright (c) 2026 Mvkweb (SolidJS Port)
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 *
 * Adapted for orb-loaders: the SolidJS component and TypeScript engine are
 * rewritten as one framework-free UMD file with a `mount(host, opts)` that
 * matches thinking-orb.js. Grayscale ink becomes a six-palette ramp. Frames are
 * drawn from a pooled dot list (no per-frame allocation), colour strings come
 * from a lookup table, and each state has its own reduced-motion rest frame.
 * Easing, timing and palette contrast are re-tuned; see README.md, "Changes
 * from upstream", for the full list.
 *
 * Usage:
 *   ThinkingOrbX.mount(element, { state: 'blooming', size: 64, palette: 'violet' })
 *   -> returns { destroy(), setPaused(bool) }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThinkingOrbX = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TAU = Math.PI * 2;

  /* ================================================================= states */

  // The eight extended states that have an engine of their own upstream, each
  // mapped to the painter that draws it. `syncing` and `evolving` share the
  // ribbon painter; `conjuring` and `conjuring_static` share the merkaba one.
  var STATE_TO_MODE = {
    syncing:          'ribbon',
    evolving:         'ribbon',
    building:         'cube',
    hypercube:        'tesseract',
    conjuring:        'merkaba',
    conjuring_static: 'merkaba',
    assembling:       'assembling',
    blooming:         'blooming'
  };

  // Upstream lists four more states (glacio, flower, sandglass, sand_orbs).
  // Its registry points every one of them at the blooming painter with the same
  // preset, so they render identically to `blooming`. They are accepted here as
  // aliases so code written against upstream keeps working, but they are not
  // separate states and the demo does not list them.
  var ALIASES = {
    glacio: 'blooming', flower: 'blooming', sandglass: 'blooming', sand_orbs: 'blooming'
  };

  var STATE_LABEL = {
    syncing: 'Syncing…', evolving: 'Evolving…', building: 'Building…',
    hypercube: 'Structuring…', conjuring: 'Conjuring…', conjuring_static: 'Conjuring…',
    assembling: 'Assembling…', blooming: 'Blooming…'
  };

  // Base density profiles per painter, before size tuning is folded in.
  var PROFILES = {
    ribbon:     { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    cube:       { ghostN: 15, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    tesseract:  { ghostN: 15, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    merkaba:    { ghostN: 12, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    assembling: { ghostN: 14, rBase: 1.1, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    blooming:   { ghostN: 14, rBase: 1.1, rDepth: 1.6, rsPow: 0.6, rMin: 0.3 }
  };

  // Per-size tuning. Two separate designs per state (64 px and 20 px), not a
  // scale factor: `count` thins the geometry, `size` fattens the dots, `speed`
  // is the baked clock. `extra` is merged verbatim after scaling.
  var TUNING = {
    syncing: {
      64: { speed: 4.5, count: 0.8, size: 0.8, extra: { lanes: 12, spin: 3.0, bandMul: 0, wobMul: 0, sweep: 1 } },
      20: { speed: 5.5, count: 0.25, size: 1.2, extra: { lanes: 6, spin: 3.0, bandMul: 0, wobMul: 0, sweep: 1 } }
    },
    evolving: {
      64: { speed: 2.5, count: 0.4, size: 0.9, extra: { spin: 2.5, bandMul: 8.5, wobMul: 1.5, lanes: 4 } },
      20: { speed: 3.2, count: 0.15, size: 1.2, extra: { spin: 2.5, bandMul: 3, wobMul: 1.5, lanes: 4 } }
    },
    building: {
      64: { speed: 1.5, count: 1.0, size: 0.9, extra: { spin: 2.0, ghostN: 18 } },
      20: { speed: 2.0, count: 0.4, size: 1.4, extra: { spin: 2.0, ghostN: 8 } }
    },
    hypercube: {
      64: { speed: 1.8, count: 1.0, size: 0.9, extra: { spin: 2.0, ghostN: 7 } },
      20: { speed: 2.2, count: 0.5, size: 1.3, extra: { spin: 2.0, ghostN: 4, wave: 0.1 } }
    },
    conjuring: {
      64: { speed: 1.6, count: 1.0, size: 0.9, extra: { spin: 1.4, ghostN: 16 } },
      20: { speed: 1.8, count: 0.5, size: 1.3, extra: { spin: 1.4, ghostN: 8 } }
    },
    conjuring_static: {
      64: { speed: 1.6, count: 1.0, size: 0.9, extra: { spin: 0, ghostN: 16 } },
      20: { speed: 1.8, count: 0.5, size: 1.3, extra: { spin: 0, ghostN: 8 } }
    },
    assembling: {
      64: { speed: 1.6, count: 1.0, size: 0.9, extra: { spin: 2.0, ghostN: 16 } },
      20: { speed: 2.0, count: 0.5, size: 1.3, extra: { spin: 2.0, ghostN: 8 } }
    },
    blooming: {
      64: { speed: 0.9, count: 1.0, size: 1.0, extra: { spin: 0.55 } },
      20: { speed: 1.0, count: 0.45, size: 1.35, extra: { spin: 0.55 } }
    }
  };

  // The clock value (already speed-scaled) each state freezes at under
  // prefers-reduced-motion. Chosen by eye per state, not a shared constant.
  var REST = {
    syncing: 0.6, evolving: 0.6, building: 2.1, hypercube: 2.1,
    conjuring: 0.6, conjuring_static: 0.6, assembling: 2.1, blooming: 0.6
  };

  // Ink ramps. `v` runs 0 (nearest, strongest) to 1 (farthest, faintest); a
  // palette is two stops the ramp interpolates, darkest first. Dark-theme
  // frames mirror `v`, so the first stop is the far end there.
  var PALETTES = {
    mono:    { light: ['#000000', '#ffffff'], dark: ['#000000', '#ffffff'] },
    violet:  { light: ['#2e1065', '#a78bfa'], dark: ['#312e81', '#c4b5fd'] },
    cyan:    { light: ['#083344', '#22d3ee'], dark: ['#0e4f5f', '#a5f3fc'] },
    magenta: { light: ['#4a044e', '#f0abfc'], dark: ['#581c87', '#f5d0fe'] },
    jade:    { light: ['#0f3b32', '#a9dbcb'], dark: ['#0d2a25', '#7fe3c6'] },
    slate:   { light: ['#1e293b', '#b8c4d0'], dark: ['#1e293b', '#cbd5e1'] }
  };

  /* ================================================================== math */

  // Deterministic hash — the same one upstream uses, so every seeded
  // arrangement (assembling's per-dot phases and snap corners) lands alike.
  function hash(a, b) {
    var t = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return t - Math.floor(t);
  }

  function clamp01(n) { return n < 0 ? 0 : n > 1 ? 1 : n; }

  // Camera: yaw/pitch rotation plus orthographic projection. State lives in
  // module variables and results come back through PX/PY/PZ, so a frame builds
  // no closures and no arrays. Painters run one at a time, so sharing is safe.
  var CAM_SY = 0, CAM_CY = 1, CAM_SP = 0, CAM_CP = 1, CAM_X = 0, CAM_Y = 0, CAM_K = 1;
  var PX = 0, PY = 0, PZ = 0;

  function camera(yaw, pitch, cx, cy, scale) {
    CAM_SY = Math.sin(yaw); CAM_CY = Math.cos(yaw);
    CAM_SP = Math.sin(pitch); CAM_CP = Math.cos(pitch);
    CAM_X = cx; CAM_Y = cy; CAM_K = scale;
  }

  // Screen axes take `scale`; depth (PZ) stays in input units.
  function project(x, y, z) {
    var px = x * CAM_CY + z * CAM_SY;
    var pz = -x * CAM_SY + z * CAM_CY;
    PX = CAM_X + px * CAM_K;
    PY = CAM_Y - (y * CAM_CP - pz * CAM_SP) * CAM_K;
    PZ = y * CAM_SP + pz * CAM_CP;
  }

  // Fibonacci sphere — evenly spread points on a unit sphere, via DX/DY/DZ.
  var DX = 0, DY = 0, DZ = 0;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));
  function fibSphere(i, n) {
    var y = 1 - 2 * (i + 0.5) / n;
    var r = Math.sqrt(1 - y * y);
    var th = i * GOLDEN;
    DX = r * Math.cos(th); DY = y; DZ = r * Math.sin(th);
  }

  // Easings. Upstream's ejection used one symmetric sine; the burst and the
  // snap want opposite curves, so both ends are explicit.
  function easeOutCubic(p) { var q = 1 - p; return 1 - q * q * q; }
  function easeInCubic(p) { return p * p * p; }

  /* ============================================================== dot pool */

  // A frame is a fixed-size list of reusable dot objects. Painters `put` into
  // it; nothing is allocated once the first frame has sized the pool. Dots that
  // should not show carry a ~0 alpha and are skipped at paint time, so every
  // frame has the same count.
  function createFrame() { return { dots: [], n: 0 }; }

  function put(fr, x, y, z, r, v, a) {
    var d = fr.dots[fr.n] || (fr.dots[fr.n] = { x: 0, y: 0, z: 0, r: 0, v: 0, a: 1 });
    fr.n++;
    d.x = x; d.y = y; d.z = z; d.r = r; d.v = v; d.a = a;
  }

  function byDepth(a, b) { return a.z - b.z; }

  // Painter's algorithm: far to near.
  function seal(fr) {
    fr.dots.length = fr.n;
    fr.dots.sort(byDepth);
  }

  /* =============================================================== painters */

  // Cube corners and edges, shared by building and assembling. Each row is
  // x1, y1, z1, x2, y2, z2 on the -1..1 unit cube.
  var EDGES = [
    [1, 1, 1, -1, 1, 1], [-1, 1, 1, -1, -1, 1], [-1, -1, 1, 1, -1, 1], [1, -1, 1, 1, 1, 1],
    [1, 1, -1, -1, 1, -1], [-1, 1, -1, -1, -1, -1], [-1, -1, -1, 1, -1, -1], [1, -1, -1, 1, 1, -1],
    [1, 1, 1, 1, 1, -1], [-1, 1, 1, -1, 1, -1], [-1, -1, 1, -1, -1, -1], [1, -1, 1, 1, -1, -1]
  ];
  var CUBE_DIAG = 1.732;   // sqrt(3): farthest a cube corner can sit from centre

  // syncing / evolving — a band of strands on a precessing great circle, over
  // a faint ghost sphere. `spin` scales the tumble; `bandMul` and `wobMul`
  // set how many strands and how hard they undulate. `syncing` collapses to a
  // single clean ring (bandMul 0, wobMul 0); `evolving` fans out into a dense
  // twisting sash. `sweep` (syncing only) adds a bright head running the ring.
  function ribbon(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.78;
    var spin = o.spin == null ? 1 : o.spin;
    camera(t * 0.1 * spin, 0.3, cx, cx, 1);

    for (var g = 0; g < o.ghostN; g++) {
      fibSphere(g, o.ghostN);
      project(DX * R, DY * R, DZ * R);
      put(fr, PX, PY, PZ, 0.8 * rs, 0.78, 0.1 + 0.22 * ((PZ / R + 1) / 2));
    }

    // The band plane (u, v) and its normal n = u x v, precessing with `spin`.
    var ya = t * 0.24 * spin;
    var ta = 0.55 + 0.3 * Math.sin(t * 0.18) * spin;
    var ux = Math.cos(ya), uz = Math.sin(ya);
    var vx = -uz * Math.sin(ta), vy = Math.cos(ta), vz = ux * Math.sin(ta);
    var nx = -uz * vy, ny = uz * vx - ux * vz, nz = ux * vy;

    var wob = o.wobMul == null ? 1 : o.wobMul;
    var sweep = o.sweep || 0;
    var lanes = Math.max(1, Math.round(o.lanes * (o.bandMul == null ? 1 : o.bandMul)));
    var half = (lanes - 1) / 2;

    for (var w = 0; w < lanes; w++) {
      var laneOff = (w - half) * 0.075;
      var edge = Math.abs(w - half) / Math.max(1, half);
      for (var k = 0; k < o.segs; k++) {
        var a = k / o.segs * TAU;
        // Two travelling waves along the band; wobMul 0 leaves a clean ring.
        var off = laneOff + (0.16 * Math.sin(a * 3 - t * 1.7 + w * 0.22) +
                             0.07 * Math.sin(a * 5 + t * 1.1)) * wob;
        var x = ux * Math.cos(a) + vx * Math.sin(a) + nx * off;
        var y = vy * Math.sin(a) + ny * off;
        var z = uz * Math.cos(a) + vz * Math.sin(a) + nz * off;
        var l = Math.sqrt(x * x + y * y + z * z);
        project(x / l * R, y / l * R, z / l * R);
        var depth = (PZ / R + 1) / 2;
        var head = sweep ? sweep * Math.pow(0.5 + 0.5 * Math.cos(a - t * 1.2), 6) : 0;
        put(fr, PX, PY, PZ,
            (o.rBase + o.rDepth * depth + head * 1.2) * (1 - 0.25 * edge) * rs,
            0.52 - 0.44 * depth + 0.18 * edge - head * 0.1,
            clamp01(0.4 + 0.6 * depth + head * 0.4));
      }
    }
    seal(fr);
  }

  // building — a dotted wireframe cube tumbling on two axes.
  function cube(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.55;   // scaled down so corners never clip
    var spin = o.spin == null ? 1 : o.spin;
    camera(t * 0.2 * spin, t * 0.15 * spin, cx, cx, 1);
    var perEdge = Math.max(2, Math.floor(o.ghostN));
    var maxZ = R * CUBE_DIAG;

    for (var e = 0; e < EDGES.length; e++) {
      var E = EDGES[e];
      for (var i = 0; i < perEdge; i++) {
        var f = i / (perEdge - 1);
        project((E[0] + (E[3] - E[0]) * f) * R,
                (E[1] + (E[4] - E[1]) * f) * R,
                (E[2] + (E[5] - E[2]) * f) * R);
        var depth = (PZ / maxZ + 1) / 2;
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * depth) * rs, 0.52 - 0.44 * depth, 0.4 + 0.6 * depth);
      }
    }
    seal(fr);
  }

  // The six faces of the unit cube as [axis, side]; the face normal runs along
  // `axis` with the sign of `side`.
  var FACES = [[2, 1], [2, -1], [0, 1], [0, -1], [1, 1], [1, -1]];

  // hypercube — a filled cubic matrix: six dotted faces, a wave pushing each
  // dot along its face normal. `wave` is the push, in cube units.
  function tesseract(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.52;
    var spin = o.spin == null ? 1 : o.spin;
    camera(t * 0.18 * spin, t * 0.14 * spin, cx, cx, 1);
    var grid = Math.max(4, Math.floor(o.ghostN));
    var amp = o.wave == null ? 0.06 : o.wave;
    var maxZ = R * CUBE_DIAG;

    for (var f = 0; f < FACES.length; f++) {
      var axis = FACES[f][0], side = FACES[f][1];
      for (var i = 0; i < grid; i++) {
        var u = -1 + 2 * i / (grid - 1);
        for (var j = 0; j < grid; j++) {
          var v = -1 + 2 * j / (grid - 1);
          var lx = axis === 2 ? u : axis === 0 ? side : u;
          var ly = axis === 2 ? v : axis === 0 ? u : side;
          var lz = axis === 2 ? side : v;
          var push = amp * Math.sin(t * 2.2 + (lx + ly + lz) * 1.5);
          project((lx + (axis === 0 ? side * push : 0)) * R,
                  (ly + (axis === 1 ? side * push : 0)) * R,
                  (lz + (axis === 2 ? side * push : 0)) * R);
          var depth = (PZ / maxZ + 1) / 2;
          put(fr, PX, PY, PZ, (o.rBase + o.rDepth * depth) * rs, 0.55 - 0.45 * depth, 0.35 + 0.65 * depth);
        }
      }
    }
    seal(fr);
  }

  // conjuring / conjuring_static — a twisting spiral tetrahedron: three
  // curved edges from a spinning base to a fixed apex, a base ring, a
  // pedestal orbit and a core beacon. spin 0 is the upright, static camera.
  var MERKABA_RING = 18, MERKABA_CORE = 10;
  function merkaba(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.55;
    var spin = o.spin == null ? 1 : o.spin;
    var upright = spin === 0;
    camera(upright ? 0.25 : t * 0.35 * spin,
           upright ? 0.38 : 0.45 + 0.25 * Math.sin(t * 0.6 * spin),
           cx, cx, 1);
    var roll = upright ? 0 : t * 0.2 * spin;
    var cr = Math.cos(roll), sr = Math.sin(roll);
    var baseSpin = t * (upright ? 1.0 : 0.8);
    var perEdge = Math.max(4, Math.floor(o.ghostN));
    var apexY = 0.9, baseY = -0.6, maxZ = R * 1.5;
    var i, b;

    // 1. Three spiral edges, base to apex, with an energy crest climbing them.
    for (b = 0; b < 3; b++) {
      var start = b * TAU / 3 + baseSpin;
      for (i = 0; i < perEdge; i++) {
        var f = i / (perEdge - 1);
        var rad = 1 - f;
        var twist = start + f * Math.PI * 1.2;
        var ex = Math.cos(twist) * rad * R, ez = Math.sin(twist) * rad * R;
        project(ex * cr - (baseY + (apexY - baseY) * f) * R * sr,
                ex * sr + (baseY + (apexY - baseY) * f) * R * cr, ez);
        var depth = (PZ / maxZ + 1) / 2;
        // A continuous harmonic, so the crest never resets or jumps.
        var pulse = Math.pow(0.5 + 0.5 * Math.cos(t * 2.8 - f * Math.PI * 4), 2.5);
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * depth + pulse * 0.9) * rs,
            0.65 - 0.45 * depth - pulse * 0.2, 0.4 + 0.6 * depth);
      }
    }

    // 2. The spinning base ring joining the three rotating base vertices.
    var ringDots = Math.floor(perEdge * 0.8);
    for (b = 0; b < 3; b++) {
      var a1 = b * TAU / 3 + baseSpin, a2 = (b + 1) * TAU / 3 + baseSpin;
      for (i = 0; i < ringDots; i++) {
        var rf = i / (ringDots - 1);
        var ang = a1 + (a2 - a1) * rf;
        var arc = 1 + 0.12 * Math.sin(rf * Math.PI);
        var rx = Math.cos(ang) * arc * R;
        var ry = (baseY + 0.06 * Math.sin(rf * Math.PI)) * R;
        project(rx * cr - ry * sr, rx * sr + ry * cr, Math.sin(ang) * arc * R);
        var rd = (PZ / maxZ + 1) / 2;
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * rd) * rs, 0.58 - 0.4 * rd, 0.35 + 0.65 * rd);
      }
    }

    // 3. The pedestal orbit, turning faster and against the base.
    for (i = 0; i < MERKABA_RING; i++) {
      var pa = i / MERKABA_RING * TAU - baseSpin * 1.5;
      var pr = 1.15 * (1 + 0.05 * Math.sin(t * 3 + i)) * R;
      var py = (baseY - 0.08) * R;
      var px = Math.cos(pa) * pr;
      project(px * cr - py * sr, px * sr + py * cr, Math.sin(pa) * pr);
      var pd = (PZ / R + 1) / 2;
      put(fr, PX, PY, PZ, (0.7 + 1.1 * pd) * rs, 0.5 - 0.35 * pd, 0.3 + 0.5 * pd);
    }

    // 4. The core beacon: a slim helix up the axis.
    for (i = 0; i < MERKABA_CORE; i++) {
      var cf = i / (MERKABA_CORE - 1);
      var cRad = 0.08 * Math.sin(cf * Math.PI) * (1 + 0.3 * Math.sin(t * 3 + cf * 5)) * R;
      var cAng = -t * 2.5 + cf * 3;
      var cxx = Math.cos(cAng) * cRad, cyy = (baseY + 0.2 + cf * 1.1) * R;
      project(cxx * cr - cyy * sr, cxx * sr + cyy * cr, Math.sin(cAng) * cRad);
      var cd = (PZ / R + 1) / 2;
      put(fr, PX, PY, PZ, (1.4 + 1.2 * cd) * rs, 0.75 - 0.45 * cd, 0.7 + 0.3 * cd);
    }
    seal(fr);
  }

  // assembling — a wireframe cube whose dots burst outward and snap back, with
  // stray particles that collapse into the corners.
  var SNAP_COUNT = 12;
  var EJECT_START = Math.PI * 0.8, EJECT_SPAN = Math.PI * 0.9;
  var BURST_END = 0.28, SNAP_START = 0.58;   // fractions of the ejection window

  // 0 -> 1 -> 0 over the window: a fast ease-out burst, a short hold at the
  // apex, then an ease-in return that arrives at full speed — a snap, not a
  // sine's symmetric sway.
  function ejectEnvelope(p) {
    if (p < BURST_END) return easeOutCubic(p / BURST_END);
    if (p < SNAP_START) return 1;
    return 1 - easeInCubic((p - SNAP_START) / (1 - SNAP_START));
  }

  function assembling(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.52;
    var spin = o.spin == null ? 1 : o.spin;
    camera(t * 0.2 * spin, t * 0.15 * spin, cx, cx, 1);
    var perEdge = Math.max(2, Math.floor(o.ghostN));
    var maxZ = R * CUBE_DIAG;
    var e, i;

    for (e = 0; e < EDGES.length; e++) {
      var E = EDGES[e];
      for (i = 0; i < perEdge; i++) {
        var f = i / (perEdge - 1);
        var bx = E[0] + (E[3] - E[0]) * f;
        var by = E[1] + (E[4] - E[1]) * f;
        var bz = E[2] + (E[5] - E[2]) * f;
        var phase = hash((e + 1) * 100 + i, 3.14) * TAU;
        var cycle = (t * 1.8 + phase) % TAU;
        var env = 0;
        if (cycle > EJECT_START && cycle < EJECT_START + EJECT_SPAN) {
          env = ejectEnvelope((cycle - EJECT_START) / EJECT_SPAN);
        }
        var norm = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
        var push = 1 + 0.5 * env / norm;
        project(bx * push * R, by * push * R, bz * push * R);
        var depth = (PZ / maxZ + 1) / 2;
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * depth + 0.4 * env) * rs,
            0.55 - 0.42 * depth, (0.4 + 0.6 * depth) * (1 - 0.4 * env));
      }
    }

    // Strays: each spends half its cycle away, then collapses into a corner.
    for (var s = 0; s < SNAP_COUNT; s++) {
      var seed = hash(s + 50, 7.12);
      var sc = (t * 2.2 + seed * TAU) % TAU;
      var live = sc > Math.PI;
      var ease = live ? Math.pow(1 - (sc - Math.PI) / Math.PI, 3) : 0;
      var corner = Math.floor(seed * 8), dist = 1.2 * ease;
      project(((corner & 1 ? 1 : -1) + Math.sin(seed * 15) * dist) * R,
              ((corner & 2 ? 1 : -1) + Math.cos(seed * 25) * dist) * R,
              ((corner & 4 ? 1 : -1) + Math.sin(seed * 35) * dist) * R);
      var sd = (PZ / maxZ + 1) / 2;
      put(fr, PX, PY, PZ, (1.3 + 1.2 * sd) * rs, 0.7 - 0.4 * sd, live ? 0.2 + 0.8 * (1 - ease) : 0);
    }
    seal(fr);
  }

  // blooming — a five-petal flower of dotted contours, with a beam, a radial
  // wave and a loop wave moving light through it, a ring at the roots and a
  // glowing pistil. Petal outlines are cubic Beziers on `u` in 0..1.
  function bezier(p0, p1, p2, p3, t) {
    var m = 1 - t;
    return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
  }

  // Petal outline point at `u`, written to DX/DY (left half, then mirrored).
  function petalPoint(u, L, W) {
    var side = u <= 0.5 ? 1 : -1;
    var t = u <= 0.5 ? u / 0.5 : (1 - u) / 0.5;
    DX = side * bezier(0, -W * 0.65, -W * 1.05, 0, t);
    DY = bezier(0, L * 0.25, L * 0.85, L * 1.05, t);
  }

  var PETALS = 5, PISTIL = 4;
  function blooming(fr, size, t, o, rs) {
    var cx = size / 2, R = size / 2 * 0.82, maxZ = R * 1.5;
    var spin = o.spin == null ? 0.6 : o.spin;
    var turn = t * spin * 0.45;
    camera(0.12 * Math.sin(t * 0.5), 0.14 * Math.cos(t * 0.4), cx, cx, 1);

    // `count` thins the contours at small sizes. Upstream computes `count` per
    // preset but never hands it to this painter, so its 20 px flower drew at
    // full density; here it reaches the painter.
    var root = Math.sqrt(o.count == null ? 1 : o.count);
    var outerN = Math.max(8, Math.floor(16 * root));
    var innerN = Math.max(4, Math.floor(9 * root));
    var ringN = Math.max(5, Math.floor(10 * root));

    var breathe = 1 + 0.035 * Math.sin(t * 1.2);
    var k, i;
    for (k = 0; k < PETALS; k++) {
      var angle = turn + k * TAU / PETALS + 0.025 * Math.sin(t * 1.8 + k * 1.25);
      var ca = Math.cos(angle), sa = Math.sin(angle);
      var layer = 0.08 * Math.sin(k / PETALS * TAU);   // each petal on its own depth plane

      for (i = 0; i < outerN; i++) {
        var u = i / outerN;
        petalPoint(u, 0.88 * breathe, 0.48 * breathe);
        var rx = DX * ca - DY * sa, ry = DX * sa + DY * ca;
        project(rx * R, ry * R, (layer + 0.06 * Math.sin(u * Math.PI)) * R);
        var depth = (PZ / maxZ + 1) / 2;
        var beam = Math.pow(Math.max(0, Math.cos(Math.atan2(ry, rx) - t * 1.8)), 3.5);
        var radial = Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 - Math.hypot(rx, ry) * 3.5), 2.2);
        var loop = 0.5 + 0.5 * Math.sin(t * 3.2 - u * TAU + k * 1.25);
        var pulse = Math.min(1, beam * 0.7 + radial * 0.35 + loop * 0.2);
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * depth + pulse * 1.1) * rs,
            0.72 - 0.35 * depth - pulse * 0.45, 0.3 + 0.45 * depth + pulse * 0.35);
      }

      for (i = 0; i < innerN; i++) {
        var iu = i / innerN;
        petalPoint(iu, 0.58 * breathe, 0.28 * breathe);
        var ix = DX * ca - DY * sa, iy = DX * sa + DY * ca;
        project(ix * R, iy * R, (layer - 0.03 + 0.04 * Math.sin(iu * Math.PI)) * R);
        var id = (PZ / maxZ + 1) / 2;
        var ib = Math.pow(Math.max(0, Math.cos(Math.atan2(iy, ix) - t * 1.8 + Math.PI * 0.3)), 3.0);
        var ir = Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 - Math.hypot(ix, iy) * 3.5 + Math.PI * 0.5), 2.0);
        var ip = Math.min(1, ib * 0.65 + ir * 0.35);
        put(fr, PX, PY, PZ, (o.rBase + o.rDepth * id + ip * 0.75) * rs * 0.85,
            0.65 - 0.3 * id - ip * 0.35, 0.22 + 0.4 * id + ip * 0.35);
      }
    }

    // The ring at the petal roots.
    var ringR = 0.16 * breathe * R;
    for (i = 0; i < ringN; i++) {
      var ra = -turn * 1.2 + i * TAU / ringN;
      project(Math.cos(ra) * ringR, Math.sin(ra) * ringR, 0.04 * Math.sin(t * 3 + i) * R);
      var rdp = (PZ / maxZ + 1) / 2;
      var rp = Math.pow(0.5 + 0.5 * Math.sin(t * 2.6 + ra * 2), 2.0);
      put(fr, PX, PY, PZ, (o.rBase + o.rDepth * rdp + rp * 0.6) * rs,
          0.62 - 0.35 * rdp - rp * 0.3, 0.4 + 0.45 * rdp + rp * 0.25);
    }

    // The pistil.
    for (i = 0; i < PISTIL; i++) {
      var pa = t * 1.5 + i * TAU / PISTIL;
      var pr = 0.045 * (0.8 + 0.4 * Math.sin(t * 2.5 + i)) * R;
      project(Math.cos(pa) * pr, Math.sin(pa) * pr, 0.05);
      var pdp = (PZ / maxZ + 1) / 2;
      put(fr, PX, PY, PZ, (1.4 + 1.2 * pdp + (0.5 + 0.5 * Math.sin(t * 3 + i)) * 0.8) * rs,
          0.25 - 0.2 * pdp, 0.8 + 0.2 * pdp);
    }
    seal(fr);
  }

  var MODES = {
    ribbon: ribbon, cube: cube, tesseract: tesseract, merkaba: merkaba,
    assembling: assembling, blooming: blooming
  };

  /* ============================================================ preset math */

  // Counts that must move together to keep a grid square-ish under thinning.
  var COUNT_PAIRS = [['lanes', 'segs']];
  var COUNT_KEYS = ['ghostN'];
  var RADIUS_KEYS = ['rBase', 'rDepth'];

  function scaleCount(opts, c) {
    var o = Object.assign({}, opts), root = Math.sqrt(c);
    for (var i = 0; i < COUNT_PAIRS.length; i++) {
      var a = COUNT_PAIRS[i][0], b = COUNT_PAIRS[i][1];
      if (o[a] == null || o[b] == null) continue;
      o[a] = Math.max(2, Math.round(o[a] * root));
      o[b] = Math.max(2, Math.round(o[b] * root));
    }
    for (var j = 0; j < COUNT_KEYS.length; j++) {
      var k = COUNT_KEYS[j];
      if (o[k] != null) o[k] = Math.max(1, Math.round(o[k] * c));
    }
    return o;
  }

  function scaleRadius(opts, s) {
    var o = Object.assign({}, opts);
    for (var i = 0; i < RADIUS_KEYS.length; i++) {
      var k = RADIUS_KEYS[i];
      if (o[k] != null) o[k] = o[k] * s;
    }
    return o;
  }

  function canonical(state) { return ALIASES[state] || state; }

  // Resolve a state to { mode, speed, opts }. `tuneAt` picks which of the two
  // hand-tuned designs to build from — upstream only ships 64 and 20.
  function resolve(state, tuneAt) {
    var name = canonical(state);
    var mode = STATE_TO_MODE[name];
    var tune = TUNING[name][tuneAt] || TUNING[name][64];
    var opts = Object.assign({}, PROFILES[mode]);
    if (tune.count !== 1) opts = scaleCount(opts, tune.count);
    if (tune.size !== 1) opts = scaleRadius(opts, tune.size);
    opts.count = tune.count;
    if (tune.extra) opts = Object.assign(opts, tune.extra);
    return { mode: mode, speed: tune.speed, opts: opts };
  }

  /* ================================================================ drawing */

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // A frame carries hundreds of dots, each with its own depth shade and alpha;
  // building an `rgba(...)` string per dot per frame is what makes a wall of
  // orbs stutter. Shade and alpha are quantised onto a fine grid and each
  // colour string is built once, ever. The grid is finer than one 8-bit step.
  var SHADES = 128;  // steps along the ink ramp
  var ALPHAS = 64;   // steps of opacity

  function ramp(stops) {
    var lo = hexToRgb(stops[0]), hi = hexToRgb(stops[1]);
    var lut = new Array(SHADES * ALPHAS);   // [shade][alpha], filled lazily

    return {
      key: function (v, a) {
        var si = clamp01(v) * (SHADES - 1) + 0.5 | 0;
        var ai = clamp01(a) * (ALPHAS - 1) + 0.5 | 0;
        return si * ALPHAS + ai;
      },
      css: function (key) {
        var hit = lut[key];
        if (hit === undefined) {
          var f = (key / ALPHAS | 0) / (SHADES - 1);
          hit = lut[key] = 'rgba(' + Math.round(lo[0] + (hi[0] - lo[0]) * f) + ',' +
                                     Math.round(lo[1] + (hi[1] - lo[1]) * f) + ',' +
                                     Math.round(lo[2] + (hi[2] - lo[2]) * f) + ',' +
                                     ((key % ALPHAS) / (ALPHAS - 1)).toFixed(3) + ')';
        }
        return hit;
      }
    };
  }

  function paint(ctx, size, fr, rMin, ink, isDark) {
    ctx.clearRect(0, 0, size, size);
    var dots = fr.dots, last = -1;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (d.a < 0.02) continue;
      var key = ink.key(isDark ? 1 - d.v : d.v, d.a);
      if (key !== last) { ctx.fillStyle = ink.css(key); last = key; }
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r < rMin ? rMin : d.r, 0, TAU);
      ctx.fill();
    }
  }

  /* ================================================================== mount */

  function pickState(name) {
    if (STATE_TO_MODE[canonical(name)]) return name;
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('ThinkingOrbX: unknown state "' + name + '", using "blooming". Known states: ' +
                   Object.keys(STATE_TO_MODE).join(', '));
    }
    return 'blooming';
  }

  function mount(host, config) {
    var cfg = config || {};
    var state = pickState(cfg.state == null ? 'blooming' : cfg.state);
    var size = cfg.size || 64;
    var isDark = cfg.theme === 'dark';
    var ink = ramp((PALETTES[cfg.palette] || PALETTES.violet)[isDark ? 'dark' : 'light']);

    // Upstream ships exactly two designs. Below ~32 px the sparse one reads
    // better; above it, build from the 64 px design.
    var tuneAt = cfg.tuneAt || (size <= 32 ? 20 : 64);
    var res = resolve(state, tuneAt);
    var opts = Object.assign(res.opts, cfg.overrides || {});
    var speed = res.speed * (cfg.speed || 1);
    var rest = REST[canonical(state)];

    // Upstream's radius curve shrinks dots relative to the canvas as it grows
    // — at 96 px+ the orb reads as a faint speck. `zoom` scales the tuned
    // design linearly instead, which a hero loader wants.
    var rs = Math.pow(size / 300, opts.rsPow);
    if (cfg.zoom) rs = Math.pow(tuneAt / 300, opts.rsPow) * (size / tuneAt);

    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', cfg.label || STATE_LABEL[canonical(state)]);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.style.display = 'block';

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    host.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var fr = createFrame();
    var painter = MODES[res.mode];
    function draw(t) {
      fr.n = 0;
      painter(fr, size, t, opts, rs);
      paint(ctx, size, fr, opts.rMin, ink, isDark);
    }

    var raf = 0, running = false, paused = false, destroyed = false;
    function frame() {
      draw(performance.now() / 1000 * speed);
      if (running) raf = requestAnimationFrame(frame);
    }
    function start() { if (!running && !paused) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // Respect reduced motion: paint the state's rest frame, never animate.
    // `reducedMotion` overrides the media query, for apps with their own setting.
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    var still = cfg.reducedMotion == null ? !!(rm && rm.matches) : !!cfg.reducedMotion;
    if (still) {
      draw(rest);
      return {
        destroy: function () {
          if (destroyed) return;
          destroyed = true;
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        },
        setPaused: function () {}
      };
    }

    // Don't burn frames while offscreen or backgrounded.
    var visible = true;
    var io = window.IntersectionObserver ? new IntersectionObserver(function (e) {
      visible = e[0].isIntersecting;
      if (visible && document.visibilityState !== 'hidden') start(); else stop();
    }) : null;
    if (io) io.observe(canvas); else start();

    function onVis() {
      if (document.visibilityState === 'hidden') stop();
      else if (visible) start();
    }
    document.addEventListener('visibilitychange', onVis);
    draw(performance.now() / 1000 * speed);

    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stop();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
      setPaused: function (p) {
        if (destroyed) return;
        paused = p;
        if (p) stop();
        else if (visible && document.visibilityState !== 'hidden') start();
      }
    };
  }

  return {
    mount: mount,
    resolve: resolve,
    STATES: Object.keys(STATE_TO_MODE),
    STATE_TO_MODE: STATE_TO_MODE,
    STATE_LABEL: STATE_LABEL,
    ALIASES: ALIASES,
    PROFILES: PROFILES,
    TUNING: TUNING,
    PALETTES: PALETTES,
    // exposed for checks against the upstream engine and for the demo's dot counts
    _frame: function (mode, size, t, opts, rs) {
      var fr = createFrame();
      MODES[mode](fr, size, t, opts, rs);
      return fr;
    }
  };
}));

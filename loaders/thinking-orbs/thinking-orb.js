/*!
 * thinking-orb.js — nine animated "thinking orb" loading indicators.
 * Dependency-free vanilla JS, UMD. v2.0.0
 *
 * Ported from thinking-orbs@0.3.1 (MIT, Jakub Antalik,
 * https://github.com/Jakubantalik/thinking-orbs). That package is React-only;
 * the geometry is reimplemented here with the same constants and no framework
 * dependency, so it drops into any page, theme or bundler.
 *
 * Every state is a plain 2D canvas — no WebGL, no filters, no SVG. Each frame
 * builds a list of dots (and for `connecting`, lines), projects them, shades
 * them by depth and paints back-to-front.
 *
 * Geometry is verified identical to the upstream engine for all nine states at
 * both tuned sizes; only the ink ramp differs (grayscale -> a chosen palette).
 *
 * Usage:
 *   ThinkingOrb.mount(element, { state: 'working', size: 64, palette: 'jade' })
 *   -> returns { destroy(), setPaused(bool) }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThinkingOrb = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ================================================================= states */

  // The nine verbs an agent can be doing, each mapped to the painter that
  // draws it. `breathing` reuses the ribbon painter with `faceOn` set.
  var STATE_TO_MODE = {
    working:    'orbits',
    searching:  'globe',
    solving:    'rubik',
    listening:  'wave',
    connecting: 'web',
    weaving:    'braid',
    composing:  'ribbon',
    breathing:  'ring',
    shaping:    'morph'
  };

  var STATE_LABEL = {
    working: 'Working…', searching: 'Searching…', solving: 'Solving…',
    listening: 'Listening…', connecting: 'Connecting…', weaving: 'Weaving…',
    composing: 'Composing…', breathing: 'Thinking…', shaping: 'Shaping…'
  };

  // Base geometry per mode, before size tuning is folded in.
  var PRESETS = {
    orbits: { orbitN: 12, ghostN: 40, ghostR: 0.9, ghostA: 0.5, particles: 3,
              partR: 1.2, partRDepth: 1.6, rsPow: 0.6, rMin: 0.3 },
    globe:  { latRings: 17, lonDensity: 44, rBase: 0.6, rDepth: 1.7, rBoost: 1,
              inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    rubik:  { latRings: 15, lonDensity: 40, moveCount: 14, rBase: 0.6, rDepth: 1.7,
              rActive: 0.3, inkFar: 0.62, inkSpan: 0.54, rsPow: 0.6, rMin: 0.3 },
    wave:   { rings: 15, lonDensity: 40, rBase: 0.6, rDepth: 1.7, rsPow: 0.6, rMin: 0.3 },
    web:    { nodeN: 30, thr: 0.72, signals: 5, nodeR: 1.4, nodeRDepth: 1.8,
              lineW: 0.8, rsPow: 0.6, rMin: 0.3 },
    braid:  { strandN: 52, turns: 3, ghostN: 150, rBase: 1.2, rDepth: 1.8,
              rsPow: 0.6, rMin: 0.3 },
    ribbon: { lanes: 5, segs: 88, ghostN: 150, rBase: 1.1, rDepth: 1.7,
              rsPow: 0.6, rMin: 0.3 },
    // ring shares ribbon's painter; faceOn cancels the camera tilt, moves the
    // undulation onto the radius, and drops the ghost sphere behind it
    ring:   { lanes: 5, segs: 88, ghostN: 0, faceOn: 1, rBase: 1.1, rDepth: 1.7,
              rsPow: 0.6, rMin: 0.3 },
    morph:  { rDot: 0.021, iconD: 1, rMin: 0.25 }
  };

  // Per-size tuning. These are separate designs, not a scale factor: `count`
  // thins the geometry, `size` fattens the dots, `speed` is baked per state.
  var TUNING = {
    orbits: { 64: { speed: 1.885, count: 1, size: 1 },
              20: { speed: 3.9, count: 0.238, size: 2.4 } },
    globe:  { 64: { speed: 2.015, count: 0.42, size: 1.15, extra: { scanMul: 4.08, dimBase: 0.45 } },
              20: { speed: 2.665, count: 0.105, size: 1.75, extra: { scanMul: 4.335, dimBase: 0.45 } } },
    rubik:  { 64: { speed: 1.82, count: 0.35, size: 1.05 },
              20: { speed: 1.95, count: 0.088, size: 1.9 } },
    wave:   { 64: { speed: 4.388, count: 0.341, size: 1 },
              20: { speed: 3.998, count: 0.105, size: 1.6 } },
    web:    { 64: { speed: 3.315, count: 1.35, size: 0.95 },
              20: { speed: 6.63, count: 0.25, size: 1.52 } },
    braid:  { 64: { speed: 1.625, count: 0.5, size: 1 },
              20: { speed: 2.75, count: 0.1125, size: 1.36 } },
    ribbon: { 64: { speed: 2.34, count: 0.25, size: 0.85, extra: { spin: 0, bandMul: 3.9, wobMul: 1 } },
              20: { speed: 3.12, count: 0.051, size: 1.073, extra: { spin: 0, bandMul: 4.94, wobMul: 1 } } },
    ring:   { 64: { speed: 3.24, count: 0.25, size: 0.956, extra: { spin: 0, bandMul: 3.627, wobMul: 0.368 } },
              20: { speed: 3.78, count: 0.028, size: 1.622, extra: { spin: 0, bandMul: 3.968, wobMul: 0.565 } } },
    morph:  { 64: { speed: 2.405, count: 0.702, size: 0.395, extra: { spread: 1.45 } },
              20: { speed: 2.08, count: 0.53, size: 1.011, extra: { spread: 1.45 } } }
  };

  // Ink ramps. `v` runs 0 (darkest) to 1 (lightest), matching the library's
  // grayscale value, so a palette is just two stops the ramp interpolates.
  var PALETTES = {
    mono:  { light: ['#000000', '#ffffff'], dark: ['#000000', '#ffffff'] },
    jade:  { light: ['#0f3b32', '#a9dbcb'], dark: ['#0d2a25', '#7fe3c6'] },
    slate: { light: ['#1e293b', '#b8c4d0'], dark: ['#0f172a', '#94a3b8'] }
  };

  /* ================================================================== math */

  // Deterministic hash — the same one the library uses, so every seeded
  // arrangement (orbit tilts, rubik moves, node jitter) lands identically.
  function hash(a, b) {
    var t = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
    return t - Math.floor(t);
  }

  function fract(n) { return n - Math.floor(n); }

  // Value noise on a 2D lattice, smoothstep-interpolated.
  function noise2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var a = hash(xi, yi), b = hash(xi + 1, yi);
    var c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function smoothstep01(n) { return n * n * (3 - 2 * n); }

  // Shortest signed angle from b to a.
  function angleDelta(a, b) {
    return Math.atan2(Math.sin(a - b), Math.cos(a - b));
  }

  // Fibonacci sphere — evenly spread points on a unit sphere.
  function fibSphere(i, n) {
    var ga = Math.PI * (3 - Math.sqrt(5));
    var y = 1 - 2 * (i + 0.5) / n;
    var r = Math.sqrt(1 - y * y);
    var th = i * ga;
    return [r * Math.cos(th), y, r * Math.sin(th)];
  }

  // Yaw/pitch rotation plus orthographic projection. Returns [x, y, depth].
  // `scale` applies to the screen axes only; depth stays in input units.
  function projector(yaw, pitch, cx, cy, scale) {
    var sp = Math.sin(pitch), cp = Math.cos(pitch);
    var sy = Math.sin(yaw), cyaw = Math.cos(yaw);
    return function (x, y, z) {
      var px = x * cyaw + z * sy;
      var pz = -x * sy + z * cyaw;
      return [cx + px * scale, cy - (y * cp - pz * sp) * scale, y * sp + pz * cp];
    };
  }

  // Arc-length parameterisation of a closed polygon: t in [0,1] -> [x, y].
  function polyPath(points) {
    var n = points.length, seg = [], total = 0;
    for (var i = 0; i < n; i++) {
      var a = points[i], b = points[(i + 1) % n];
      var d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      seg.push(d); total += d;
    }
    return function (t) {
      var walk = t * total, i = 0;
      while (walk > seg[i] && i < n - 1) { walk -= seg[i]; i++; }
      var a = points[i], b = points[(i + 1) % n];
      var f = seg[i] ? Math.min(1, walk / seg[i]) : 0;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
    };
  }

  // Painter's algorithm: drop invisible dots, clamp radius, sort far-to-near.
  function finalize(dots, lines, rMin) {
    var out = [];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if ((d.a == null ? 1 : d.a) < 0.02) continue;
      d.r = Math.max(rMin == null ? 0.3 : rMin, d.r);
      out.push(d);
    }
    out.sort(function (a, b) { return a.z - b.z; });
    return {
      dots: out,
      lines: (lines || []).filter(function (l) { return (l.a == null ? 1 : l.a) >= 0.02; })
    };
  }

  /* =============================================================== painters */

  // working — particles running tilted orbits around a sphere.
  function orbits(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.82;
    var project = projector(t * 0.12, 0.3, cx, cy, 1);
    var dots = [];

    for (var i = 0; i < o.orbitN; i++) {
      var h1 = hash(i, 1.7), h2 = hash(i, 5.2), h3 = hash(i, 8.9);

      // A random great circle: pick a normal on the sphere, then build two
      // perpendicular basis vectors (u, w) spanning the orbit plane.
      var r = radius * (0.45 + 0.52 * h1);
      var theta = h1 * 2 * Math.PI, phi = Math.acos(2 * h2 - 1);
      var nx = Math.sin(phi) * Math.cos(theta);
      var ny = Math.cos(phi);
      var nz = Math.sin(phi) * Math.sin(theta);

      var ux = -ny, uy = nx, uz = 0;
      var ul = Math.max(1e-6, Math.sqrt(ux * ux + uy * uy));
      ux /= ul; uy /= ul;

      var wx = ny * uz - nz * uy;
      var wy = nz * ux - nx * uz;
      var wz = nx * uy - ny * ux;

      var dir = (0.25 + 0.55 * h3) * (h3 > 0.5 ? 1 : -1); // speed and spin sign

      for (var g = 0; g < o.ghostN; g++) {          // the ring itself
        var ga = g / o.ghostN * 2 * Math.PI;
        var p = project((ux * Math.cos(ga) + wx * Math.sin(ga)) * r,
                        (uy * Math.cos(ga) + wy * Math.sin(ga)) * r,
                        (uz * Math.cos(ga) + wz * Math.sin(ga)) * r);
        var gd = (p[2] / r + 1) / 2;
        dots.push({ x: p[0], y: p[1], z: p[2], r: o.ghostR * rs,
                    v: 0.72, a: o.ghostA * (0.4 + 0.6 * gd) });
      }

      for (var k = 0; k < o.particles; k++) {       // the travellers
        var pa = t * dir + k / o.particles * 2 * Math.PI + h2 * 6;
        var q = project((ux * Math.cos(pa) + wx * Math.sin(pa)) * r,
                        (uy * Math.cos(pa) + wy * Math.sin(pa)) * r,
                        (uz * Math.cos(pa) + wz * Math.sin(pa)) * r);
        var pd = (q[2] / r + 1) / 2;
        dots.push({ x: q[0], y: q[1], z: q[2],
                    r: (o.partR + o.partRDepth * pd) * rs,
                    v: 0.3 - 0.22 * pd, a: 1 });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // searching — a scan meridian sweeps a dotted globe.
  function globe(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.82;
    var pitch = 0.4 + 0.06 * Math.sin(t * 0.35);
    var project = projector(t * 0.5, pitch, cx, cy, radius);
    var scan = t * (0.5 + 1.2 * (o.scanMul == null ? 1 : o.scanMul));
    var dim = o.dimBase == null ? 1 : o.dimBase;
    var dots = [];

    for (var ring = 0; ring <= o.latRings; ring++) {
      var lat = -Math.PI / 2 + ring / o.latRings * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var n = Math.max(1, Math.round(Math.abs(cosLat) * o.lonDensity));
      for (var j = 0; j < n; j++) {
        var lon = j / n * 2 * Math.PI;
        var p = project(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
        var depth = (p[2] + 1) / 2;
        // Gaussian falloff around the sweeping meridian, front hemisphere only.
        var dl = angleDelta(lon + t * 0.5, scan);
        var lit = Math.exp(-(dl * dl) / 0.18) * Math.max(0, p[2]);
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: (o.rBase + o.rDepth * depth + o.rBoost * lit) * rs,
          v: o.inkFar - o.inkSpan * depth,
          a: dim + (1 - dim) * Math.min(1, lit)
        });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // Seeded quarter-turn moves for the rubik state: axis, slab, direction.
  function rubikMoves(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var axis = Math.min(2, Math.floor(hash(i, 2.3) * 3));
      var lo = -1 + 0.5 * Math.min(3, Math.floor(hash(i, 5.9) * 4));
      var sign = hash(i, 7.7) < 0.5 ? 1 : -1;
      out.push({ axis: axis, lo: lo, hi: lo + 0.5, ang: sign * Math.PI / 2 });
    }
    return out;
  }

  // Scramble forward move by move, then unwind back to solved.
  function rubikSchedule(t, moves, perMove, pause) {
    var cycle = 2 * moves * perMove + pause;
    var at = t % cycle;
    var amount = new Array(moves).fill(0);
    var active = -1;

    if (at < 2 * moves * perMove) {
      var idx = Math.floor(at / perMove);
      var f = (at - idx * perMove) / perMove;
      var eased = 1 - Math.pow(1 - Math.min(1, f / 0.7), 3);
      if (idx < moves) {
        for (var i = 0; i < idx; i++) amount[i] = 1;
        amount[idx] = eased; active = idx;
      } else {
        var back = 2 * moves - 1 - idx;
        for (var j = 0; j < back; j++) amount[j] = 1;
        amount[back] = 1 - eased; active = back;
      }
    }
    return { amount: amount, active: active };
  }

  // Apply every partially-applied move to one point on the sphere.
  function rubikApply(pt, moves, sched) {
    var x = pt[0], y = pt[1], z = pt[2], onActive = false;
    for (var i = 0; i < moves.length; i++) {
      if (sched.amount[i] <= 0) continue;
      var m = moves[i];
      var coord = m.axis === 0 ? x : m.axis === 1 ? y : z;
      if (coord < m.lo || coord >= m.hi) continue;   // point not in this slab
      if (i === sched.active) onActive = true;
      var ang = m.ang * sched.amount[i];
      var c = Math.cos(ang), s = Math.sin(ang);
      if (m.axis === 0)      { var ny = y * c - z * s; z = y * s + z * c; y = ny; }
      else if (m.axis === 1) { var nx = x * c + z * s; z = -x * s + z * c; x = nx; }
      else                   { var mx = x * c - y * s; y = x * s + y * c; x = mx; }
    }
    return [x, y, z, onActive];
  }

  // solving — bands scramble, then click back solved.
  function rubik(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.82;
    var project = projector(t * 0.55, 0.35 + 0.1 * Math.sin(t * 0.9), cx, cy, radius);
    var moves = rubikMoves(o.moveCount);
    var sched = rubikSchedule(t, o.moveCount, 0.42, 1.2);
    var dots = [];

    for (var ring = 0; ring <= o.latRings; ring++) {
      var lat = -Math.PI / 2 + ring / o.latRings * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      var n = Math.max(1, Math.round(Math.abs(cosLat) * o.lonDensity));
      for (var j = 0; j < n; j++) {
        var lon = j / n * 2 * Math.PI;
        var m = rubikApply([cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon)], moves, sched);
        var p = project(m[0], m[1], m[2]);
        var depth = (p[2] + 1) / 2;
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: (o.rBase + o.rDepth * depth + (m[3] ? o.rActive : 0)) * rs,
          v: o.inkFar - o.inkSpan * depth - (m[3] ? 0.14 : 0)
        });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // listening — a waveform rolls through the latitude rings.
  function wave(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.874;
    var project = projector(t * 0.18, 0.38, cx, cy, 1);
    var dots = [];

    for (var ring = 0; ring <= o.rings; ring++) {
      var lat = -Math.PI / 2 + ring / o.rings * Math.PI;
      var cosLat = Math.cos(lat), sinLat = Math.sin(lat);
      // Two detuned sines so the ripple never repeats on a short loop.
      var amp = 0.62 * Math.sin(t * 2.1 - ring * 0.52) + 0.38 * Math.sin(t * 1.27 + ring * 0.83);
      var rr = radius * (0.88 + 0.105 * amp);
      var n = Math.max(1, Math.round(Math.abs(cosLat) * o.lonDensity));
      for (var j = 0; j < n; j++) {
        var lon = j / n * 2 * Math.PI;
        var p = project(cosLat * Math.cos(lon) * rr, sinLat * rr, cosLat * Math.sin(lon) * rr);
        var depth = (p[2] / radius + 1) / 2;
        var crest = Math.max(0, amp);
        dots.push({
          x: p[0], y: p[1], z: p[2],
          r: (o.rBase + o.rDepth * depth) * (1 + 0.4 * crest) * rs,
          v: 0.66 - 0.56 * depth - 0.1 * crest
        });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // connecting — a constellation wires itself, with signals running the edges.
  function web(size, t, o, rs) {
    var cx = size / 2, cy = size / 2;
    var radius = size / 2 * 0.8 * (o.spread == null ? 1 : o.spread);
    var project = projector(t * 0.12, 0.32, cx, cy, radius);
    var nodes = [];

    for (var i = 0; i < o.nodeN; i++) {
      // Drift each node off its lattice slot with slow independent noise.
      var base = fibSphere(i, o.nodeN);
      var x = base[0] + 0.3 * (noise2(i * 0.31 + 9, t * 0.24) - 0.5) * 2;
      var y = base[1] + 0.3 * (noise2(i * 0.53 + 27, t * 0.21) - 0.5) * 2;
      var z = base[2] + 0.3 * (noise2(i * 0.77 + 55, t * 0.27) - 0.5) * 2;
      var len = Math.sqrt(x * x + y * y + z * z);
      nodes.push([x / len, y / len, z / len]);
    }

    var lines = [], dots = [];
    for (var a = 0; a < o.nodeN; a++) {
      for (var b = a + 1; b < o.nodeN; b++) {
        var dx = nodes[a][0] - nodes[b][0];
        var dy = nodes[a][1] - nodes[b][1];
        var dz = nodes[a][2] - nodes[b][2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= o.thr) continue;                     // too far apart to wire
        var pa = project(nodes[a][0], nodes[a][1], nodes[a][2]);
        var pb = project(nodes[b][0], nodes[b][1], nodes[b][2]);
        var mid = ((pa[2] + pb[2]) / 2 + 1) / 2;
        lines.push({
          x1: pa[0], y1: pa[1], x2: pb[0], y2: pb[1],
          v: 0.42, a: (1 - d / o.thr) * (0.3 + 0.55 * mid),
          w: Math.max(0.6, o.lineW * rs)
        });
      }
    }

    for (var n2 = 0; n2 < o.nodeN; n2++) {
      var p = project(nodes[n2][0], nodes[n2][1], nodes[n2][2]);
      var depth = (p[2] + 1) / 2;
      var pulse = 1 + 0.25 * Math.sin(t * 1.4 + n2 * 2.7);
      dots.push({ x: p[0], y: p[1], z: p[2],
                  r: (o.nodeR + o.nodeRDepth * depth) * pulse * rs,
                  v: 0.55 - 0.45 * depth });
    }

    // Signals: bright dots ferrying between two random nodes.
    for (var s = 0; s < o.signals; s++) {
      var tick = Math.floor(t * 0.55 + s * 7.31);
      var from = Math.floor(hash(tick, s * 3.1 + 1.7) * o.nodeN);
      var to = Math.floor(hash(tick, s * 5.7 + 4.2) * o.nodeN);
      if (from === to) continue;
      var f = fract(t * 0.55 + s * 7.31);
      var sx = nodes[from][0] + (nodes[to][0] - nodes[from][0]) * f;
      var sy = nodes[from][1] + (nodes[to][1] - nodes[from][1]) * f;
      var sz = nodes[from][2] + (nodes[to][2] - nodes[from][2]) * f;
      var sl = Math.max(1e-6, Math.sqrt(sx * sx + sy * sy + sz * sz));
      var sp = project(sx / sl, sy / sl, sz / sl);
      var sd = (sp[2] + 1) / 2;
      dots.push({ x: sp[0], y: sp[1], z: sp[2],
                  r: (o.nodeR * 1.5 + o.nodeRDepth * sd) * rs,
                  v: 0.05, a: 0.5 + 0.5 * sd });
    }

    return finalize(dots, lines, o.rMin);
  }

  // weaving — three strands plait around the sphere.
  function braid(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.76;
    var project = projector(t * 0.4, 0.3, cx, cy, 1);
    var dots = [];

    for (var g = 0; g < o.ghostN; g++) {            // faint sphere behind
      var s = fibSphere(g, o.ghostN);
      var p = project(s[0] * radius, s[1] * radius, s[2] * radius);
      var gd = (p[2] / radius + 1) / 2;
      dots.push({ x: p[0], y: p[1], z: p[2], r: 0.8 * rs,
                  v: 0.78, a: 0.1 + 0.22 * gd });
    }

    for (var strand = 0; strand < 3; strand++) {
      var phase = strand / 3 * 2 * Math.PI;
      for (var i = 0; i < o.strandN; i++) {
        // Height runs pole to pole and wraps; the strand twists as it climbs.
        var h = (fract(i / o.strandN + t * 0.045) * 2 - 1) * 0.96;
        var band = Math.sqrt(Math.max(0, 1 - h * h));
        var fade = Math.min(1, (1 - Math.abs(h)) / 0.1);   // soften at the poles
        var ang = h * Math.PI * o.turns + phase;
        var bulge = 1 + 0.075 * Math.sin(h * Math.PI * o.turns * 2 + phase * 2 + t * 0.8);
        var rr = band * radius * bulge;
        var q = project(Math.cos(ang) * rr, h * radius * bulge, Math.sin(ang) * rr);
        var depth = (q[2] / radius + 1) / 2;
        dots.push({
          x: q[0], y: q[1], z: q[2],
          r: (o.rBase + o.rDepth * depth) * rs,
          v: 0.55 - 0.45 * depth,
          a: fade * (0.45 + 0.55 * depth)
        });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // composing / breathing — an undulating multi-band sash around the sphere.
  // `faceOn` turns it toward the camera and moves the wobble onto the radius,
  // which is what makes the calmer `breathing` ring.
  function ribbon(size, t, o, rs) {
    var cx = size / 2, cy = size / 2, radius = size / 2 * 0.78;
    var spin = o.spin == null ? 1 : o.spin;
    var PITCH = 0.3;
    var project = projector(t * 0.1 * spin, PITCH, cx, cy, 1);
    var dots = [];

    for (var g = 0; g < o.ghostN; g++) {
      var s = fibSphere(g, o.ghostN);
      var p = project(s[0] * radius, s[1] * radius, s[2] * radius);
      var gd = (p[2] / radius + 1) / 2;
      dots.push({ x: p[0], y: p[1], z: p[2], r: 0.8 * rs,
                  v: 0.78, a: 0.1 + 0.22 * gd });
    }

    // Build an orthonormal frame (a, b, c) for the band's plane.
    var yaw = t * 0.24 * spin;
    var tilt = o.faceOn ? -PITCH : 0.55 + 0.3 * Math.sin(t * 0.18) * spin;
    var ax = Math.cos(yaw), ay = 0, az = Math.sin(yaw);
    var bx = -az * Math.sin(tilt), by = Math.cos(tilt), bz = ax * Math.sin(tilt);
    var cx3 = ay * bz - az * by;
    var cy3 = az * bx - ax * bz;
    var cz3 = ax * by - ay * bx;

    var wob = o.wobMul == null ? 1 : o.wobMul;
    var slack = 0.23 * wob;
    var rr = o.faceOn ? radius / (1 + 0.85 * slack) : radius;
    var bands = Math.max(1, Math.round(o.lanes * (o.bandMul == null ? 1 : o.bandMul)));

    for (var lane = 0; lane < bands; lane++) {
      var offset = (lane - (bands - 1) / 2) * 0.075;
      var edge = Math.abs(lane - (bands - 1) / 2) / Math.max(1, (bands - 1) / 2);
      for (var seg = 0; seg < o.segs; seg++) {
        var a2 = seg / o.segs * 2 * Math.PI;
        var w = (0.16 * Math.sin(a2 * 3 - t * 1.7 + lane * 0.22) +
                 0.07 * Math.sin(a2 * 5 + t * 1.1)) * wob;
        var swell = o.faceOn ? 1 + w : 1;
        var lat = o.faceOn ? offset : offset + w;
        var vx = ax * Math.cos(a2) + bx * Math.sin(a2) + cx3 * lat;
        var vy = ay * Math.cos(a2) + by * Math.sin(a2) + cy3 * lat;
        var vz = az * Math.cos(a2) + bz * Math.sin(a2) + cz3 * lat;
        var len = Math.sqrt(vx * vx + vy * vy + vz * vz);
        var reach = rr * swell;
        var p2 = project(vx / len * reach, vy / len * reach, vz / len * reach);
        var depth = (p2[2] / radius + 1) / 2;
        dots.push({
          x: p2[0], y: p2[1], z: p2[2],
          r: (o.rBase + o.rDepth * depth) * (1 - 0.25 * edge) * rs,
          v: 0.52 - 0.44 * depth + 0.18 * edge,
          a: 0.4 + 0.6 * depth
        });
      }
    }
    return finalize(dots, [], o.rMin);
  }

  // shaping — a dotted outline morphing circle -> triangle -> square.
  var SHAPES = [
    function (t) { var a = -Math.PI / 2 + t * 2 * Math.PI;
                   return [Math.cos(a) * 0.24, Math.sin(a) * 0.24]; },
    polyPath([[0, -0.26], [0.24, 0.16], [-0.24, 0.16]]),
    polyPath([[0, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2], [-0.2, -0.2]])
  ];
  var HOLD = 1.4, BLEND = 0.9, STEP = HOLD + BLEND;

  function morph(size, t, o) {
    var n = SHAPES.length;
    var at = t % (STEP * n);
    var idx = Math.floor(at / STEP);
    var local = at - idx * STEP;
    var mix = local > HOLD ? smoothstep01((local - HOLD) / BLEND) : 0;
    var spread = o.spread == null ? 1 : o.spread;
    var from = SHAPES[idx], to = SHAPES[(idx + 1) % n];

    // Resample both shapes, blend, then re-walk by arc length so the dots stay
    // evenly spaced through the morph instead of bunching at the corners.
    var SAMPLES = 160, path = [];
    for (var i = 0; i < SAMPLES; i++) {
      var f = i / SAMPLES, a = from(f), b = to(f);
      path.push([(a[0] + (b[0] - a[0]) * mix) * spread,
                 (a[1] + (b[1] - a[1]) * mix) * spread]);
    }

    var seg = [], total = 0;
    for (var j = 0; j < SAMPLES; j++) {
      var p = path[j], q = path[(j + 1) % SAMPLES];
      var d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      seg.push(d); total += d;
    }

    var count = Math.max(6, Math.round(34 * (o.iconD == null ? 1 : o.iconD)));
    var dotR = (o.rDot == null ? 0.021 : o.rDot) * 1.35 * spread;
    var breathe = 1 + 0.02 * Math.sin(local * 3.1);
    var half = size / 2;
    var dots = [], cursor = 0, walked = 0;

    for (var k = 0; k < count; k++) {
      var target = k / count * total;
      while (walked + seg[cursor] < target && cursor < SAMPLES - 1) {
        walked += seg[cursor]; cursor++;
      }
      var s0 = path[cursor], s1 = path[(cursor + 1) % SAMPLES];
      var f2 = seg[cursor] ? Math.min(1, (target - walked) / seg[cursor]) : 0;
      var px = (s0[0] + (s1[0] - s0[0]) * f2) * breathe;
      var py = (s0[1] + (s1[1] - s0[1]) * f2) * breathe;
      dots.push({ x: half + px * size, y: half + py * size, z: 0,
                  r: Math.max(0.35, dotR * size), v: 0.1 });
    }
    return finalize(dots, [], o.rMin);
  }

  var MODES = {
    orbits: orbits, globe: globe, rubik: rubik, wave: wave, web: web,
    braid: braid, ribbon: ribbon, ring: ribbon, morph: morph
  };

  /* ============================================================ preset math */

  // Counts that must move together to keep a grid square-ish under thinning.
  var COUNT_PAIRS = [['latRings', 'lonDensity'], ['rings', 'lonDensity'], ['lanes', 'segs']];
  var COUNT_KEYS = ['orbitN', 'ghostN', 'nodeN', 'strandN', 'signals'];
  var SPACING_KEYS = ['iconD'];
  var RADIUS_KEYS = ['rBase', 'rDepth', 'rActive', 'rDot', 'ghostR', 'partR',
                     'partRDepth', 'nodeR', 'nodeRDepth'];

  function scaleCount(opts, c) {
    var o = Object.assign({}, opts), done = {}, root = Math.sqrt(c);
    for (var i = 0; i < COUNT_PAIRS.length; i++) {
      var a = COUNT_PAIRS[i][0], b = COUNT_PAIRS[i][1];
      if (o[a] == null || o[b] == null || done[a] || done[b]) continue;
      o[a] = Math.max(2, Math.round(o[a] * root));
      o[b] = Math.max(2, Math.round(o[b] * root));
      done[a] = done[b] = true;
    }
    for (var j = 0; j < COUNT_KEYS.length; j++) {
      var k = COUNT_KEYS[j];
      if (o[k] == null || o[k] === 0 || done[k]) continue;
      o[k] = Math.max(1, Math.round(o[k] * c));
    }
    for (var m = 0; m < SPACING_KEYS.length; m++) {
      var s = SPACING_KEYS[m];
      if (o[s] != null) o[s] = Math.max(0.02, o[s] * c);
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

  // Resolve a state to { mode, speed, opts }. `tuneAt` picks which of the two
  // hand-tuned designs to build from — upstream only accepts 64 and 20.
  function resolve(state, tuneAt) {
    var mode = STATE_TO_MODE[state] || 'orbits';
    var tune = TUNING[mode][tuneAt] || TUNING[mode][64];
    var opts = Object.assign({}, PRESETS[mode]);
    if (tune.count !== 1) opts = scaleCount(opts, tune.count);
    if (tune.size !== 1) opts = scaleRadius(opts, tune.size);
    if (tune.extra) opts = Object.assign(opts, tune.extra);
    return { mode: mode, speed: tune.speed, opts: opts };
  }

  /* ================================================================ drawing */

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function ramp(stops) {
    var lo = hexToRgb(stops[0]), hi = hexToRgb(stops[1]);
    return function (v) {
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      return 'rgb(' + Math.round(lo[0] + (hi[0] - lo[0]) * v) + ',' +
                      Math.round(lo[1] + (hi[1] - lo[1]) * v) + ',' +
                      Math.round(lo[2] + (hi[2] - lo[2]) * v) + ')';
    };
  }

  function rgba(rgb, a) { return rgb.replace('rgb(', 'rgba(').replace(')', ',' + a + ')'); }

  function paint(ctx, size, t, mode, opts, rs, ink, isDark) {
    ctx.clearRect(0, 0, size, size);
    var frame = MODES[mode](size, t, opts, rs);

    for (var i = 0; i < frame.lines.length; i++) {
      var l = frame.lines[i];
      ctx.strokeStyle = rgba(ink(isDark ? 1 - l.v : l.v), l.a == null ? 1 : l.a);
      ctx.lineWidth = l.w;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    }
    for (var j = 0; j < frame.dots.length; j++) {
      var d = frame.dots[j];
      ctx.fillStyle = rgba(ink(isDark ? 1 - d.v : d.v), d.a == null ? 1 : d.a);
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ================================================================== mount */

  function mount(host, config) {
    var cfg = config || {};
    var state = STATE_TO_MODE[cfg.state] ? cfg.state : 'working';
    var size = cfg.size || 64;
    var isDark = cfg.theme === 'dark';
    var ink = ramp((PALETTES[cfg.palette] || PALETTES.jade)[isDark ? 'dark' : 'light']);

    // Upstream ships exactly two designs. Below ~32 px the sparse one reads
    // better; above it, build from the 64 px design.
    var tuneAt = cfg.tuneAt || (size <= 32 ? 20 : 64);
    var res = resolve(state, tuneAt);
    var opts = Object.assign(res.opts, cfg.overrides || {});
    var speed = res.speed * (cfg.speed || 1);

    // The library's radius curve deliberately shrinks dots relative to the
    // canvas as it grows — at 96 px+ the orb reads as a faint speck. `zoom`
    // scales the tuned design linearly instead, which a hero loader wants.
    var rs = Math.pow(size / 300, opts.rsPow == null ? 0.6 : opts.rsPow);
    if (cfg.zoom) {
      rs = Math.pow(tuneAt / 300, opts.rsPow == null ? 0.6 : opts.rsPow) * (size / tuneAt);
    }

    var canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', cfg.label || STATE_LABEL[state]);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.style.display = 'block';

    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    host.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var raf = 0, running = false, paused = false;

    function draw(t) { paint(ctx, size, t, res.mode, opts, rs, ink, isDark); }
    function frame() {
      draw(performance.now() / 1000 * speed);
      if (running) raf = requestAnimationFrame(frame);
    }
    function start() { if (!running && !paused) { running = true; raf = requestAnimationFrame(frame); } }
    function stop() { running = false; cancelAnimationFrame(raf); }

    // Respect reduced motion: paint one representative frame, never animate.
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (rm && rm.matches) {
      draw(0.6);
      return {
        destroy: function () { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); },
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
        stop();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
      setPaused: function (p) { paused = p; if (p) stop(); else start(); }
    };
  }

  return {
    mount: mount,
    resolve: resolve,
    STATE_TO_MODE: STATE_TO_MODE,
    STATE_LABEL: STATE_LABEL,
    PRESETS: PRESETS,
    TUNING: TUNING,
    PALETTES: PALETTES,
    // exposed for the parity test against the upstream library
    _frame: function (mode, size, t, opts, rs) { return MODES[mode](size, t, opts, rs); }
  };
}));

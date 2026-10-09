/*!
 * voice-orbs.js — five audio-reactive voice-assistant orbs on one 7-state contract.
 * Dependency-free vanilla JS, UMD. Plain 2D canvas: no WebGL, no filters, no CSS animation.
 *
 * Ported from VoiceOrbs (https://github.com/amunozdev/voiceorbs, gallery
 * https://voiceorbs.vercel.app/) by Alexis Munoz (amunozdev). That project is
 * React-only; the five orbs below are reimplemented on raw canvas with the same
 * state parameters, timings and 7-state contract (idle, connecting, listening,
 * thinking, speaking, error, disabled). The CSS-only upstream orbs (Equalizer,
 * Pulse) are redrawn from their stylesheets.
 *
 * Upstream licence (MIT), reproduced as the licence requires:
 *
 *   MIT License
 *
 *   Copyright (c) 2026 Alexis Munoz
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
 * Adapted for orb-loaders: React/CSS-modules/hooks replaced by one canvas engine
 * with a shared scheduler; light-theme rendering added (upstream additive
 * blending vanishes on white); size-aware detail and stroke widths; per-state
 * accessible labels; reduced-motion poses. See README "Changes from upstream".
 *
 * Usage:
 *   var orb = VoiceOrbs.mount(el, { orb: 'particles', state: 'listening', size: 96 });
 *   orb.setState('thinking');  orb.setLevel(0.6);  orb.setLevel(null);  orb.destroy();
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VoiceOrbs = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TWO_PI = Math.PI * 2;
  var STATES = ['idle', 'connecting', 'listening', 'thinking', 'speaking', 'error', 'disabled'];
  // Resting level of each state: the pose a reduced-motion frame is drawn at.
  var REST = { idle: 0, connecting: 0.12, listening: 0.55, thinking: 0.3, speaking: 0.55, error: 0.2, disabled: 0 };
  var LABELS = {
    idle: 'idle', connecting: 'connecting', listening: 'listening', thinking: 'thinking',
    speaking: 'speaking', error: 'error', disabled: 'unavailable'
  };

  // Blend rates (1/s). Upstream 14 / 5 / 10; eased to read as a settle, not a cut.
  var ENTER_RATE = 10, SETTLE_RATE = 4, ERROR_RATE = 12;
  var LEVEL_ATTACK = 14, LEVEL_RELEASE = 4, MAX_DT = 0.1;
  var LIGHT_DEEPEN = 0.3;       // light theme: ink mixed toward black by this much
  var DESAT_MAX = 0.85;         // disabled: how far ink is pulled to grey
  var ERR_FROM = [251, 113, 133], ERR_TO = [244, 63, 94];
  var BLACK = [0, 0, 0], WHITE = [255, 255, 255];

  /* ================================================================ helpers */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function approach(c, t, rate, dt) { return c + (t - c) * (1 - Math.exp(-rate * dt)); }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function frac(x) { return x - Math.floor(x); }

  function hexToRgb(h) {
    var s = String(h).replace('#', '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-f]{6}$/i.test(s)) throw new RangeError('VoiceOrbs: colour must be a hex string, got ' + h);
    var n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lin(c) { var v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function srgb(v) {
    var c = v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return clamp(c * 255, 0, 255);
  }
  // Mix in linear light, as upstream does. Allocates: call on palette change only.
  function mix(a, b, t) {
    return [0, 1, 2].map(function (i) { return srgb(lin(a[i]) + (lin(b[i]) - lin(a[i])) * t); });
  }
  function grey(c, t) {
    var g = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    return mix(c, [g, g, g], t);
  }
  function rgba(c, a) {
    return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + clamp01(a).toFixed(3) + ')';
  }

  // Piecewise value between keyframe positions, eased per segment.
  function keyframes(pos, vals, f) {
    for (var i = 0; i < pos.length - 1; i++) {
      if (f <= pos[i + 1]) {
        var u = (f - pos[i]) / (pos[i + 1] - pos[i]);
        return vals[i] + (vals[i + 1] - vals[i]) * smooth(u);
      }
    }
    return vals[vals.length - 1];
  }

  // Blends a per-state parameter table by the live state weights, into one reused object.
  function makeBlender(table) {
    var keys = Object.keys(table.idle), out = {};
    keys.forEach(function (k) { out[k] = 0; });
    return function (w) {
      var i, j, row, ws;
      for (j = 0; j < keys.length; j++) out[keys[j]] = 0;
      for (i = 0; i < STATES.length; i++) {
        ws = w[STATES[i]];
        if (ws === 0) continue;
        row = table[STATES[i]];
        for (j = 0; j < keys.length; j++) out[keys[j]] += row[keys[j]] * ws;
      }
      return out;
    };
  }

  // Built-in energy when no level is supplied: a state-shaped, speech-like pulse.
  function wv(x) { return 0.5 - 0.5 * Math.cos(x); }
  function stateEnergy(s, t) {
    switch (s) {
      case 'listening': return 0.4 + 0.32 * wv(t * 17) + 0.18 * wv(t * 8.2 + 3);
      case 'speaking': return 0.3 + 0.24 * wv(t * 12.4) + 0.16 * wv(t * 6 + 1.2);
      case 'thinking': return 0.24 + 0.2 * wv(t * 4.8);
      case 'connecting': return 0.12 + 0.1 * wv(t * 3.2);
      case 'error': return 0.2;
      default: return 0;
    }
  }

  // Vertical capsule centred on cy. Appends to the current path.
  function pill(ctx, x, cy, w, hh) {
    var r = w / 2;
    if (hh < r) hh = r;
    ctx.moveTo(x, cy - hh + r);
    ctx.arc(x + r, cy - hh + r, r, Math.PI, TWO_PI);
    ctx.arc(x + r, cy + hh - r, r, 0, Math.PI);
    ctx.closePath();
  }

  /* ================================================================ particles
   * Upstream "Particles Orb": a Fibonacci sphere of dots that breathes, ripples,
   * pulses and collapses to a ring while connecting. */

  var PARTICLE_STATES = {
    idle:       { tempo: 1, spin: 0.14, breathe: 0.05, drift: 1, ripple: 0, swell: 0.04, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.72 },
    connecting: { tempo: 1, spin: 0.3, breathe: 0.02, drift: 0.2, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0.06, pulseRate: 0.5, ring: 1, jitter: 0, shake: 0, alpha: 0.8 },
    listening:  { tempo: 1, spin: 0.55, breathe: 0.012, drift: 0, ripple: 1, swell: 0.12, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.92 },
    thinking:   { tempo: 1, spin: 0.32, breathe: 0.01, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 1, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.78 },
    speaking:   { tempo: 1, spin: 0.24, breathe: 0.01, drift: 0, ripple: 0, swell: 0.06, flow: 1, swirl: 1, pulse: 0, pulseRate: 1, ring: 0, jitter: 0.6, shake: 0, alpha: 0.94 },
    error:      { tempo: 1, spin: 0.08, breathe: 0, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0.7, shake: 1, alpha: 0.85 },
    disabled:   { tempo: 0.04, spin: 0, breathe: 0, drift: 0, ripple: 0, swell: 0, flow: 0, swirl: 0, pulse: 0, pulseRate: 1, ring: 0, jitter: 0, shake: 0, alpha: 0.45 }
  };
  var TONE_BUCKETS = 6, ALPHA_BUCKETS = 10, P_BUCKETS = TONE_BUCKETS * ALPHA_BUCKETS;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  var TILT = 0.32;

  function particlesPainter(env) {
    var ctx = env.ctx, size = env.size, center = size / 2;
    var blend = makeBlender(PARTICLE_STATES);
    var n = Math.round(160 + 560 * env.detail);
    var sx = new Float32Array(n), sy = new Float32Array(n), sz = new Float32Array(n);
    var ringFrac = new Float32Array(n), seed = new Float32Array(n), tone = new Float32Array(n);
    var toneBucket = new Uint8Array(n);
    var px = new Float32Array(n), py = new Float32Array(n), pr = new Float32Array(n);
    var bucketOf = new Uint8Array(n), order = new Uint16Array(n);
    var counts = new Uint16Array(P_BUCKETS), starts = new Uint16Array(P_BUCKETS);
    var toneStyles = new Array(TONE_BUCKETS);
    var i, y, rAtY, theta;
    for (i = 0; i < n; i++) {
      y = 1 - (i / (n - 1)) * 2;
      rAtY = Math.sqrt(1 - y * y);
      theta = GOLDEN_ANGLE * i;
      sx[i] = Math.cos(theta) * rAtY; sy[i] = y; sz[i] = Math.sin(theta) * rAtY;
      ringFrac[i] = (i * 0.61803398875) % 1;
      seed[i] = ((i * 0.7548776662) % 1) * TWO_PI;
      tone[i] = (i * 0.5436890126) % 1;
      toneBucket[i] = Math.min(TONE_BUCKETS - 1, Math.floor(tone[i] * TONE_BUCKETS));
    }
    var smallness = Math.min(1, size / 140);
    var dotScale = (0.55 + 0.45 * smallness) * (env.dark ? 1 : 1.12);
    var alphaScale = 0.4 + 0.6 * smallness;
    var baseRadius = center * (0.62 + 0.2 * (1 - smallness));   // small sizes fill more of the box
    var cosX = Math.cos(TILT), sinX = Math.sin(TILT);
    var rev = -1, lastPhase = 0, clock = 0, pulseClock = 0, angleY = 0, ringPhase = 0;

    return function draw(f) {
      var b, k, w = f.w, p = blend(w), level = f.level;
      var dPhase = Math.max(0, f.phase - lastPhase);
      lastPhase = f.phase;
      if (rev !== env.rev) {
        rev = env.rev;
        for (b = 0; b < TONE_BUCKETS; b++) toneStyles[b] = rgba(mix(env.a, env.b, (b + 0.5) / TONE_BUCKETS), 1);
      }
      clock += dPhase * p.tempo;
      pulseClock += dPhase * p.tempo * p.pulseRate;
      angleY += dPhase * p.spin * (1 + p.ripple * level * 1.8);
      ringPhase = (ringPhase + dPhase * 0.7) % TWO_PI;
      var t = clock + 1.7, pt = pulseClock + 1.7;

      var beat = Math.sin(pt * 2.6) * 0.5 + 0.5;
      var radius = baseRadius * (1 + p.breathe * Math.sin(t * 1.1) + level * p.swell - p.pulse * (0.06 + 0.12 * beat * beat * beat));
      var shakeAmp = p.shake * radius * 0.05;
      var shakeX = shakeAmp * (Math.sin(t * 26) + 0.5 * Math.sin(t * 15.7));
      var shakeY = shakeAmp * (Math.cos(t * 22.5) + 0.5 * Math.sin(t * 13.1));
      var driftAmp = p.drift * radius * 0.055;
      var jitterAmp = p.jitter * radius * (0.012 + level * 0.07);
      var rippleAmp = p.ripple * (0.04 + level * 0.22);
      var pulseAmp = p.pulse * 0.16 * (0.4 + 0.6 * beat);
      var flowAmp = p.flow * (0.18 + level * 0.4);
      var swirlAmp = p.swirl * (0.35 + level * 0.9);
      var ringW = clamp01(p.ring);
      var ringBreath = 1 + p.pulse * 0.4 * Math.sin(pt * 2.6);
      var floor = env.dark ? 0.12 : 0.26;   // light theme: far-side dots must not vanish

      counts.fill(0);
      for (i = 0; i < n; i++) {
        var sd = seed[i];
        var twist = swirlAmp > 0.002 ? angleY + swirlAmp * Math.sin(sy[i] * 2.4 + t * 1.6) : angleY;
        var cy = Math.cos(twist), sny = Math.sin(twist);
        var x1 = sx[i] * cy - sz[i] * sny, z1 = sx[i] * sny + sz[i] * cy;
        var y1 = sy[i] * cosX - z1 * sinX, z2 = sy[i] * sinX + z1 * cosX;
        var depth = (z2 + 1) / 2, persp = 0.65 + depth * 0.45;

        var pointR = radius;
        if (rippleAmp > 0.002) pointR *= 1 + rippleAmp * (0.5 + 0.5 * Math.sin(sy[i] * 4.5 - t * 6.5));
        if (pulseAmp > 0.002) pointR *= 1 - pulseAmp * (0.5 + 0.5 * Math.sin(ringFrac[i] * TWO_PI + pt * 3.1));
        if (flowAmp > 0.002) { var st = 0.5 + 0.5 * Math.sin(sd * 3 - t * 3.4); pointR *= 1 - flowAmp * st * st; }

        var ox = shakeX, oy = shakeY;
        if (driftAmp > 0.01) {
          ox += driftAmp * (Math.sin(t * 0.55 + sd * 3.7) + 0.5 * Math.sin(t * 1.3 + sd * 1.3));
          oy += driftAmp * (Math.cos(t * 0.62 + sd * 2.9) + 0.5 * Math.sin(t * 1.05 + sd * 5.1));
        }
        if (jitterAmp > 0.01) {
          ox += jitterAmp * Math.sin(t * 14 + sd * 9.3);
          oy += jitterAmp * Math.cos(t * 17 + sd * 6.1);
        }
        var scrX = center + x1 * pointR * persp + ox, scrY = center + y1 * pointR * persp + oy;
        var alpha = floor + depth * depth * (0.9 - floor), dot = 0.6 + depth * 1.5;

        if (ringW > 0.004) {
          var ang = (i / n) * TWO_PI + ringPhase + 0.05 * Math.sin(t * 1.3 + sd);
          var rr = center * (0.58 + 0.13 * ringFrac[i]) * (1 + 0.05 * Math.sin(t + sd * 1.7)) * ringBreath;
          scrX += (center + Math.cos(ang) * rr - scrX) * ringW;
          scrY += (center + Math.sin(ang) * rr - scrY) * ringW;
          alpha += (0.35 + tone[i] * 0.5 - alpha) * ringW;
          dot += (0.75 + tone[i] * 0.9 - dot) * ringW;
        }
        px[i] = scrX; py[i] = scrY; pr[i] = dot * dotScale;
        b = toneBucket[i] * ALPHA_BUCKETS + Math.min(ALPHA_BUCKETS - 1, Math.floor(alpha * alphaScale * ALPHA_BUCKETS));
        bucketOf[i] = b;
        counts[b]++;
      }
      var acc = 0;
      for (b = 0; b < P_BUCKETS; b++) { starts[b] = acc; acc += counts[b]; }
      for (i = 0; i < n; i++) { b = bucketOf[i]; order[starts[b]++] = i; }

      ctx.globalCompositeOperation = env.dark ? 'lighter' : 'source-over';
      var cursor = 0;
      for (b = 0; b < P_BUCKETS; b++) {
        var count = counts[b];
        if (count === 0) continue;
        var ab = b % ALPHA_BUCKETS;
        ctx.globalAlpha = clamp01(((ab + 0.5) / ALPHA_BUCKETS) * p.alpha * (env.dark ? 1 : 1.7));
        ctx.fillStyle = toneStyles[(b - ab) / ALPHA_BUCKETS];
        ctx.beginPath();
        for (k = cursor; k < cursor + count; k++) {
          i = order[k];
          ctx.moveTo(px[i] + pr[i], py[i]);
          ctx.arc(px[i], py[i], pr[i], 0, TWO_PI);
        }
        ctx.fill();
        cursor += count;
      }
    };
  }

  /* ============================================================== wave line
   * Upstream "Siri Wave Line": four overlapping sine envelopes on one axis. */

  var WAVE_STATES = {
    idle:       { amp: 0.035, ampLevel: 0, freq: 1.6, freqLevel: 0, flow: 0.7, spread: 0.35, width: 1.5, wobble: 0.35, jitter: 0, line: 0.6, dim: 1, fill: 0.22, f0: 1, f1: 0.7, f2: 0.5, f3: 0.35 },
    connecting: { amp: 0.26, ampLevel: 0.05, freq: 2.6, freqLevel: 0, flow: 1.4, spread: 0, width: 0.5, wobble: 0.1, jitter: 0, line: 0.45, dim: 0.92, fill: 0.28, f0: 1, f1: 0.3, f2: 0.18, f3: 0.1 },
    listening:  { amp: 0.06, ampLevel: 0.5, freq: 2.6, freqLevel: 1.6, flow: 2.4, spread: 0.55, width: 1, wobble: 0.3, jitter: 0, line: 0.35, dim: 1, fill: 0.26, f0: 1, f1: 0.8, f2: 0.65, f3: 0.5 },
    thinking:   { amp: 0.22, ampLevel: 0.05, freq: 3.4, freqLevel: 0, flow: 2, spread: 0, width: 0.5, wobble: 0.15, jitter: 0, line: 0.4, dim: 1, fill: 0.28, f0: 1, f1: 0.85, f2: 0.7, f3: 0.55 },
    speaking:   { amp: 0.06, ampLevel: 0.6, freq: 2.8, freqLevel: 3.2, flow: 3.4, spread: 1, width: 1.05, wobble: 0.3, jitter: 0, line: 0.25, dim: 1, fill: 0.3, f0: 1, f1: 0.9, f2: 0.8, f3: 0.7 },
    error:      { amp: 0.13, ampLevel: 0, freq: 7.5, freqLevel: 0, flow: 4, spread: 0.2, width: 0.55, wobble: 0, jitter: 0.8, line: 0.45, dim: 1, fill: 0.3, f0: 1, f1: 0.8, f2: 0.6, f3: 0.45 },
    disabled:   { amp: 0.006, ampLevel: 0, freq: 1.2, freqLevel: 0, flow: 0.2, spread: 0.2, width: 1.8, wobble: 0, jitter: 0, line: 0.35, dim: 0.45, fill: 0.15, f0: 1, f1: 0.3, f2: 0.2, f3: 0.1 }
  };
  var CURVES = 4, X_RANGE = 2;
  var W_CENTER = [-0.35, 0.4, 0.05, -0.7], W_FREQ = [1, 1.3, 0.75, 1.55], W_FLOW = [1, 1.2, 0.85, 1.4];
  var W_WOBBLE = [1.3, 1.7, 2.1, 1.1], W_SEED = [0.3, 2.1, 4.2, 5.4];

  function wavePainter(env) {
    var ctx = env.ctx, size = env.size, cy = size / 2, pad = size * 0.04, halfH = size * 0.5;
    var blend = makeBlender(WAVE_STATES);
    var samples = Math.round(48 + 72 * env.detail);
    var unit = size / 168;
    var lineW = Math.max(1, 1.1 * unit), glowW = Math.max(2.5, 4.5 * unit);
    var xs = new Float32Array(samples), xn = new Float32Array(samples);
    var edge = new Float32Array(samples), ys = new Float32Array(samples);
    var ampS = new Float32Array(CURVES), centerS = new Float32Array(CURVES), phs = new Float32Array(CURVES);
    var fill = new Array(CURVES), glow = new Array(CURVES), line = new Array(CURVES), baseGrad = null;
    var factors = new Float32Array(CURVES);
    var i, j, u, e;
    for (j = 0; j < samples; j++) {
      u = j / (samples - 1);
      xs[j] = pad + u * (size - pad * 2);
      xn[j] = (u * 2 - 1) * X_RANGE;
      e = 1 - (u * 2 - 1) * (u * 2 - 1);
      edge[j] = e * e;
    }
    for (i = 0; i < CURVES; i++) { centerS[i] = W_CENTER[i] * 0.35; phs[i] = W_SEED[i]; }
    var freqS = WAVE_STATES.idle.freq, prevPhase = 0, rev = -1, first = true;

    function edgeGradient(c) {
      var g = ctx.createLinearGradient(pad, 0, size - pad, 0);
      g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.18, rgba(c, 0.55)); g.addColorStop(0.5, rgba(c, 1));
      g.addColorStop(0.82, rgba(c, 0.55)); g.addColorStop(1, rgba(c, 0));
      return g;
    }
    function rebuild() {
      var palette = [env.a, env.b, mix(env.a, env.b, 0.5), mix(mix(env.a, env.b, 0.25), WHITE, 0.2)];
      var pole = env.dark ? WHITE : BLACK, k = env.dark ? 0.3 : 0.18;
      for (var c = 0; c < CURVES; c++) {
        fill[c] = rgba(palette[c], 1);
        glow[c] = edgeGradient(palette[c]);
        line[c] = edgeGradient(mix(palette[c], pole, k));
      }
      baseGrad = edgeGradient(mix(env.a, env.b, 0.5));
    }

    return function draw(f) {
      var w = f.w, p = blend(w), level = clamp01(f.level), dt = f.dt;
      var snap = f.reduced || first;
      first = false;
      if (rev !== env.rev) { rev = env.rev; rebuild(); }
      var dPhase = f.phase - prevPhase;
      prevPhase = f.phase;

      var targetFreq = p.freq + p.freqLevel * level;
      freqS = snap ? targetFreq : approach(freqS, targetFreq, 6, dt);
      factors[0] = p.f0; factors[1] = p.f1; factors[2] = p.f2; factors[3] = p.f3;
      var baseAmp = p.amp + p.ampLevel * level;
      var thinkT = f.phase * 1.3, sweep = Math.sin(f.phase * 0.8) * 1.3;
      for (i = 0; i < CURVES; i++) {
        var target = baseAmp * factors[i];
        ampS[i] = snap ? target : approach(ampS[i], target, target > ampS[i] ? 12 : 5, dt);
        var center = p.spread * W_CENTER[i] + w.thinking * Math.sin(thinkT + i * 1.35) * 1.2 + w.connecting * sweep;
        centerS[i] = snap ? center : approach(centerS[i], center, 10, dt);
        phs[i] += dPhase * p.flow * W_FLOW[i];
      }

      var dim = p.dim, dark = env.dark;
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      ctx.globalAlpha = clamp01(p.line * dim * (dark ? 1 : 1.3));
      ctx.fillStyle = baseGrad;
      ctx.fillRect(pad, cy - lineW / 2, size - pad * 2, lineW);

      for (var k = CURVES - 1; k >= 0; k--) {
        var wob = 1 - p.wobble * (0.5 + 0.5 * Math.sin(f.phase * W_WOBBLE[k] + W_SEED[k]));
        var jit = 1 + p.jitter * (0.6 * Math.sin(f.phase * 31 + k * 1.7) + 0.4 * Math.sin(f.phase * 47 + k * 2.9));
        var amp = ampS[k] * wob * jit * halfH;
        if (amp < 0.05) continue;
        var width = Math.max(0.2, p.width), c0 = centerS[k], fk = freqS * W_FREQ[k], ph = phs[k];
        for (j = 0; j < samples; j++) {
          var uu = (xn[j] - c0) / width, u4 = uu * uu * uu * uu, env2 = 2 / (2 + u4);
          ys[j] = amp * env2 * env2 * edge[j] * Math.sin(fk * xn[j] - ph);
        }
        ctx.beginPath();
        ctx.moveTo(xs[0], cy - ys[0]);
        for (j = 1; j < samples; j++) ctx.lineTo(xs[j], cy - ys[j]);
        for (j = samples - 1; j >= 0; j--) ctx.lineTo(xs[j], cy + ys[j]);
        ctx.closePath();
        ctx.globalAlpha = clamp01(p.fill * dim * (dark ? 1 : 1.25));
        ctx.fillStyle = fill[k];
        ctx.fill();
        ctx.globalAlpha = clamp01(0.14 * dim);
        ctx.strokeStyle = glow[k];
        ctx.lineWidth = glowW;
        ctx.stroke();
        ctx.globalAlpha = clamp01(0.85 * dim);
        ctx.strokeStyle = line[k];
        ctx.lineWidth = lineW;
        ctx.stroke();
      }
    };
  }

  /* ============================================================== waveform ring
   * Upstream "Waveform Ring": a circle whose radius is displaced by a state
   * waveform, with echo rings while thinking and a dashed orbit while connecting. */

  var RING_STATES = {
    idle:       { tempo: 1, amp: 0.03, levelAmp: 0, bias: 0, breathe: 0.02, contract: 0, echo: 0, echoRate: 1, dash: 0, core: 0.5, coreGain: 0.2, glowGain: 0.3, lineGain: 0.4 },
    connecting: { tempo: 1, amp: 0.04, levelAmp: 0, bias: 0, breathe: 0.01, contract: 0.5, echo: 0.55, echoRate: 0.5, dash: 1, core: 0.45, coreGain: 0.2, glowGain: 0.3, lineGain: 0.3 },
    listening:  { tempo: 1, amp: 0.1, levelAmp: 0.14, bias: 0.85, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, core: 0.35, coreGain: 0.15, glowGain: 1.4, lineGain: 1.2 },
    thinking:   { tempo: 1, amp: 0.05, levelAmp: 0, bias: 0, breathe: 0, contract: 1, echo: 1, echoRate: 1, dash: 0, core: 0.5, coreGain: 0.3, glowGain: 0.4, lineGain: 0.4 },
    speaking:   { tempo: 1, amp: 0.1, levelAmp: 0.12, bias: -0.55, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, core: 0.55, coreGain: 0.9, glowGain: 0.5, lineGain: 0.8 },
    error:      { tempo: 1, amp: 0.11, levelAmp: 0, bias: 0, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, core: 0.5, coreGain: 0.2, glowGain: 0.3, lineGain: 0.3 },
    disabled:   { tempo: 0.04, amp: 0.008, levelAmp: 0, bias: 0, breathe: 0, contract: 0, echo: 0, echoRate: 1, dash: 0, core: 0.28, coreGain: 0, glowGain: 0, lineGain: 0 }
  };
  var COLOR_BUCKETS = 16, R_ALPHA_BUCKETS = 6, R_BUCKETS = COLOR_BUCKETS * R_ALPHA_BUCKETS;

  function jag(u, t) {
    return (Math.sin(TWO_PI * 19 * u + t * 1.9) >= 0 ? 1 : -1) * (0.5 + 0.5 * Math.abs(Math.sin(TWO_PI * 7 * u - t * 2.4)));
  }

  function ringPainter(env) {
    var ctx = env.ctx, size = env.size, cx = size / 2, R = size * 0.355;
    var blend = makeBlender(RING_STATES);
    var segs = Math.round(64 + 96 * env.detail);
    var k = clamp(size / 140, 0.45, 1.6);   // stroke scale: upstream widths are fixed px
    var xs = new Float32Array(segs + 1), ys = new Float32Array(segs + 1);
    var segColor = new Uint8Array(segs), bucketOf = new Uint8Array(segs), order = new Uint16Array(segs);
    var counts = new Uint16Array(R_BUCKETS), starts = new Uint16Array(R_BUCKETS);
    var colorStyles = new Array(COLOR_BUCKETS), echoStyle = '#fff', coreG = null;
    var rev = -1, lastPhase = 0, clock = 0, echoClock = 0, rot = 0;
    var i, b;
    for (i = 0; i < segs; i++) {
      var uu = (i + 0.5) / segs, g = uu < 0.5 ? uu * 2 : (1 - uu) * 2;
      segColor[i] = Math.min(COLOR_BUCKETS - 1, Math.floor(g * COLOR_BUCKETS));
    }

    return function draw(f) {
      var w = f.w, p = blend(w), level = clamp01(f.level);
      var dPhase = Math.max(0, f.phase - lastPhase);
      lastPhase = f.phase;
      if (rev !== env.rev) {
        rev = env.rev;
        var mid = mix(env.a, env.b, 0.5);
        for (b = 0; b < COLOR_BUCKETS; b++) colorStyles[b] = rgba(mix(env.a, env.b, (b + 0.5) / COLOR_BUCKETS), 1);
        echoStyle = rgba(mid, 1);
        coreG = ctx.createRadialGradient(cx, cx, 0, cx, cx, R);
        coreG.addColorStop(0, rgba(mid, 0.3)); coreG.addColorStop(0.68, rgba(mid, 0.1)); coreG.addColorStop(1, rgba(mid, 0));
      }
      clock += dPhase * p.tempo;
      echoClock += dPhase * p.tempo * p.echoRate * 0.45;
      rot += dPhase * 2.8 * p.tempo;
      var t = clock + 4.2;

      var amp = p.amp + level * p.levelAmp;
      var baseR = R * (1 + p.breathe * Math.sin(t * 1.1) + level * 0.02) * (1 - p.contract * (0.05 + 0.05 * Math.sin((echoClock + 4.2) * 5.8)));
      var bias = p.bias, absBias = Math.abs(bias), dashW = clamp01(p.dash);

      for (i = 0; i <= segs; i++) {
        var u = i / segs, theta = u * TWO_PI - Math.PI / 2, proc = 0;
        if (w.idle > 0) proc += w.idle * Math.sin(TWO_PI * 2 * u + t * 0.9);
        if (w.connecting > 0) proc += w.connecting * Math.sin(TWO_PI * 3 * u - t * 1.2);
        if (w.listening > 0) proc += w.listening * (0.62 * Math.sin(TWO_PI * 6 * u + t * 7.2) + 0.38 * Math.sin(TWO_PI * 11 * u - t * 9.6));
        if (w.thinking > 0) proc += w.thinking * Math.sin(TWO_PI * 3 * u + t * 2.1);
        if (w.speaking > 0) {
          proc += w.speaking * (0.5 * Math.sin(TWO_PI * 4 * u + t * 5.3) + 0.32 * Math.sin(TWO_PI * 9 * u + t * 8.9) + 0.26 * Math.sin(TWO_PI * 15 * u - t * 6.4));
        }
        if (w.error > 0) proc += w.error * jag(u, t);
        var r = baseR + (proc * (1 - absBias) + Math.abs(proc) * bias) * amp * R;
        xs[i] = cx + Math.cos(theta) * r;
        ys[i] = cx + Math.sin(theta) * r;
      }

      counts.fill(0);
      for (i = 0; i < segs; i++) {
        var th = ((i + 0.5) / segs) * TWO_PI - Math.PI / 2;
        var dash = dashW > 0.004 ? 0.5 + 0.5 * Math.tanh(Math.sin(th * 7 - rot) * 5) : 1;
        b = segColor[i] * R_ALPHA_BUCKETS + Math.round((1 - dashW * (1 - dash)) * (R_ALPHA_BUCKETS - 1));
        bucketOf[i] = b;
        counts[b]++;
      }
      var acc = 0;
      for (b = 0; b < R_BUCKETS; b++) { starts[b] = acc; acc += counts[b]; }
      for (i = 0; i < segs; i++) { b = bucketOf[i]; order[starts[b]++] = i; }

      var alphaMul = 1 - 0.45 * w.disabled;
      ctx.globalAlpha = clamp01(p.core + level * p.coreGain) * alphaMul * (env.dark ? 1 : 1.5);
      ctx.fillStyle = coreG;
      ctx.fillRect(0, 0, size, size);

      if (p.echo > 0.004) {
        ctx.strokeStyle = echoStyle;
        ctx.lineWidth = 1.2 * k;
        for (var e = 0; e < 2; e++) {
          var ph = (echoClock + e * 0.5) % 1, ea = p.echo * ph * (1 - ph) * 1.6 * alphaMul;
          if (ea <= 0.004) continue;
          ctx.globalAlpha = clamp01(ea);
          ctx.beginPath();
          ctx.arc(cx, cx, R * (1.02 - ph * 0.72), 0, TWO_PI);
          ctx.stroke();
        }
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (var pass = 0; pass < 2; pass++) {
        var glowPass = pass === 0;
        // Additive glow is invisible on a light page: there it is a soft normal-blend halo.
        ctx.globalCompositeOperation = glowPass && env.dark ? 'lighter' : 'source-over';
        ctx.lineWidth = glowPass ? (5.5 + level * 6 * p.glowGain) * k : Math.max(1.1, (1.7 + level * 1.5 * p.lineGain) * k - w.disabled * 0.8);
        var passAlpha = (glowPass ? (env.dark ? 0.16 : 0.12) : 0.92) * alphaMul, cursor = 0;
        for (b = 0; b < R_BUCKETS; b++) {
          var count = counts[b];
          if (count === 0) continue;
          var ab = b % R_ALPHA_BUCKETS, a = passAlpha * (ab / (R_ALPHA_BUCKETS - 1));
          if (a > 0.004) {
            ctx.globalAlpha = a;
            ctx.strokeStyle = colorStyles[(b - ab) / R_ALPHA_BUCKETS];
            ctx.beginPath();
            var prev = -2;
            for (var q = cursor; q < cursor + count; q++) {
              i = order[q];
              if (i !== prev + 1) ctx.moveTo(xs[i], ys[i]);
              ctx.lineTo(xs[i + 1], ys[i + 1]);
              prev = i;
            }
            ctx.stroke();
          }
          cursor += count;
        }
      }
    };
  }

  /* ============================================================== equalizer
   * Upstream "Equalizer Orb" (pure CSS): a glass disc with seven capsule bars. Each
   * state has its own bar layer; layers cross-fade by state weight. */

  var EQ_POS = [[0, 0.3, 0.55, 0.8, 1], [0, 0.3, 0.55, 0.78, 1], [0, 0.25, 0.52, 0.8, 1]];
  // indices into [lo, mid, mh, hi]
  var EQ_IDX = [[0, 3, 1, 2, 0], [1, 0, 3, 0, 1], [0, 1, 0, 3, 0]];
  var EQ_ANIM = [1, 0, 2, 0, 1, 2, 0];
  var EQ_DUR = [0.96, 0.78, 1.08, 0.72, 0.9, 0.84, 1.02];
  var EQ_DELAY = [-0.31, -0.12, -0.54, -0.2, -0.66, -0.4, -0.09];
  var EQ_GAIN = [0.55, 0.7, 0.9, 1, 0.88, 0.72, 0.55];
  var EQ_H = [0.48, 0.66, 0.86, 1, 0.84, 0.64, 0.5];
  var EQ_BAND = [[0, 0, 1], [0, 0.55, 0.45], [0.2, 0.8, 0], [0.75, 0.25, 0], [0.15, 0.85, 0], [0, 0.5, 0.5], [0, 0.1, 0.9]];
  var CONNECT_POS = [0, 0.12, 0.26, 1], CONNECT_VAL = [0, 1, 0, 0];

  function equalizerPainter(env) {
    var ctx = env.ctx, size = env.size, c = size / 2, discR = size * 0.465;
    var bars = env.detail < 0.35 ? [1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6];
    var nb = bars.length, spread = 7 / nb;
    var barW = Math.max(1.6, size * 0.0506 * spread), gap = size * 0.038 * spread;
    var x0 = c - (nb * barW + (nb - 1) * gap) / 2;
    var areaH = size * 0.54, dotBase = size * 0.013, dotGain = size * 0.006;
    var vals = [0, 0, 0, 0], kv = [0, 0, 0, 0, 0];
    var sprite = document.createElement('canvas');
    sprite.width = env.canvas.width; sprite.height = env.canvas.height;
    var rev = -1, haloG, coreG, barG, sheenG, vigG, ringStyle, dark = env.dark;
    var layerW = [0, 0, 0, 0, 0];   // idle, active, wave, sweep, flat

    function rebuild() {
      dark = env.dark;
      var a = env.a, b = env.b, sc = sprite.getContext('2d'), d = env.dpr;
      var hi = dark ? mix([11, 14, 23], a, 0.2) : mix(WHITE, a, 0.1);
      var lo = dark ? mix([5, 7, 13], b, 0.11) : mix([233, 237, 247], b, 0.16);
      var rim = dark ? mix([20, 24, 36], a, 0.42) : mix([185, 195, 216], a, 0.38);
      sc.setTransform(d, 0, 0, d, 0, 0);
      sc.clearRect(0, 0, size, size);
      var bg = sc.createRadialGradient(c, size * 0.2, 0, c, size * 0.2, size * 0.7);
      bg.addColorStop(0, rgba(hi, 1)); bg.addColorStop(0.78, rgba(lo, 1)); bg.addColorStop(1, rgba(lo, 1));
      sc.shadowColor = dark ? rgba(a, 0.4) : 'rgba(15,23,42,0.28)';
      sc.shadowBlur = size * 0.07; sc.shadowOffsetY = dark ? 0 : size * 0.025;
      sc.fillStyle = bg;
      sc.beginPath(); sc.arc(c, c, discR, 0, TWO_PI); sc.fill();
      sc.shadowColor = 'transparent';
      sc.lineWidth = Math.max(1, size / 168); sc.strokeStyle = rgba(rim, 1);
      sc.beginPath(); sc.arc(c, c, discR - sc.lineWidth / 2, 0, TWO_PI); sc.stroke();

      var halo = mix(a, b, 0.6);
      haloG = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.43);
      haloG.addColorStop(0, rgba(halo, dark ? 1 : 0.65)); haloG.addColorStop(0.7, rgba(halo, 0));
      coreG = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 0.22);
      coreG.addColorStop(0, rgba(a, dark ? 1 : 0.75)); coreG.addColorStop(0.68, rgba(a, 0));
      sheenG = ctx.createRadialGradient(c, c - discR * 0.9, 0, c, c - discR * 0.9, discR * 1.1);
      sheenG.addColorStop(0, dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.65)'); sheenG.addColorStop(0.62, 'rgba(255,255,255,0)');
      vigG = ctx.createRadialGradient(c, c * 0.95, discR * 0.58, c, c * 0.95, discR);
      vigG.addColorStop(0, 'rgba(0,0,0,0)'); vigG.addColorStop(1, dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.16)');
      barG = ctx.createLinearGradient(0, c + areaH / 2, 0, c - areaH / 2);
      barG.addColorStop(0, rgba(a, 1)); barG.addColorStop(0.55, rgba(mix(a, b, 0.55), 1)); barG.addColorStop(1, rgba(mix(b, WHITE, 0.3), 1));
      ringStyle = rgba(mix(a, b, 0.45), 1);
    }

    function barHalf(layer, i, d, t, bi) {
      var g = EQ_GAIN[i], dot = dotBase + dotGain * g, bh = EQ_H[i] * areaH, x;
      vals[0] = (0.07 + 0.09 * d) * g; vals[1] = (0.14 + 0.22 * d) * g;
      vals[2] = (0.17 + 0.28 * d) * g; vals[3] = (0.2 + 0.34 * d) * g;
      if (layer === 1) {
        var an = EQ_ANIM[i], pos = EQ_POS[an], idx = EQ_IDX[an];
        for (x = 0; x < 5; x++) kv[x] = vals[idx[x]];
        return Math.max(dot, keyframes(pos, kv, frac((t - EQ_DELAY[i]) / EQ_DUR[i])) * bh);
      }
      if (layer === 2) return Math.max(dot, (vals[0] + (vals[2] - vals[0]) * wv(TWO_PI * (t / 2.4 + bi * 0.125))) * bh);
      if (layer === 3) {
        var cn = (0.13 + 0.24 * d) * (0.7 + 0.3 * g);
        return dot + (Math.max(dot, cn * bh) - dot) * keyframes(CONNECT_POS, CONNECT_VAL, frac((t - bi * 0.09) / 1.6));
      }
      return layer === 4 ? size * 0.012 : dot;
    }

    return function draw(f) {
      var w = f.w, level = clamp01(f.level), t = f.phase, i, l;
      if (rev !== env.rev) { rev = env.rev; rebuild(); }
      var ring = w.listening, talk = w.speaking;
      layerW[0] = w.idle + w.disabled; layerW[1] = w.listening + w.speaking;
      layerW[2] = w.thinking; layerW[3] = w.connecting; layerW[4] = w.error;
      var dim = 1 - 0.5 * w.disabled;

      // listening ring, outside the disc
      if (ring > 0.01) {
        ctx.globalAlpha = ring * (0.18 + 0.6 * level) * dim;
        ctx.strokeStyle = ringStyle;
        ctx.lineWidth = Math.max(1, 1.5 * size / 168);
        ctx.beginPath(); ctx.arc(c, c, c * (0.94 + ring * (0.025 + 0.08 * level)) - 0.75, 0, TWO_PI); ctx.stroke();
      }
      // disc, scaled as one group
      var sc = 1 + (0.02 + 0.05 * ring) * level + 0.02 * w.idle * wv(TWO_PI * t / 4);
      ctx.save();
      ctx.translate(c, c); ctx.scale(sc, sc); ctx.translate(-c, -c);
      ctx.globalAlpha = dim;
      ctx.drawImage(sprite, 0, 0, size, size);
      ctx.beginPath(); ctx.arc(c, c, discR, 0, TWO_PI); ctx.clip();

      var hs = 1 + (0.08 + 0.1 * ring) * level;
      ctx.save(); ctx.translate(c, c); ctx.scale(hs, hs);
      ctx.globalAlpha = (0.16 + (0.3 + 0.2 * ring) * level) * dim;
      ctx.fillStyle = haloG; ctx.fillRect(-size / 2, -size / 2, size, size);
      var cs = 1 + (0.12 + 0.14 * talk) * level;
      ctx.scale(cs, cs);
      ctx.globalAlpha = clamp01(0.26 + (0.36 + 0.3 * talk) * level) * dim;
      ctx.fillStyle = coreG; ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();

      var bass = clamp01(level * (0.78 + 0.22 * Math.sin(t * 2.3)));
      var mid = clamp01(level * (0.78 + 0.22 * Math.sin(t * 3.4 + 2.1)));
      var treble = clamp01(level * (0.78 + 0.22 * Math.sin(t * 4.6 + 4.2)));
      var sf = frac(t / 1.8);
      var shake = w.error > 0.01 && sf < 0.22 ? w.error * Math.sin(sf / 0.22 * Math.PI * 4) * (1 - sf / 0.22) * 1.6 * size / 168 : 0;
      ctx.fillStyle = barG;
      for (l = 0; l < 5; l++) {
        if (layerW[l] < 0.01) continue;
        ctx.globalAlpha = clamp01(layerW[l]) * dim;
        ctx.beginPath();
        for (i = 0; i < nb; i++) {
          var bi = bars[i], band = EQ_BAND[bi];
          var d = (band[0] * bass + band[1] * mid + band[2] * treble) * (1 - 0.6 * ring);
          pill(ctx, x0 + i * (barW + gap) + shake, c, barW, barHalf(l, bi, d, t, i));
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = sheenG; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = vigG; ctx.fillRect(0, 0, size, size);
      ctx.restore();
    };
  }

  /* ================================================================== pulse
   * Upstream "Pulse Orb" (pure CSS): a glossy core, emitted rings (slow idle,
   * inward listening, fast speaking) and a conic loading arc. */

  var RING_BASE = [2.7, 3.1, 3.6], RING_DELAY = [0, -1.1, -2.3], RING_SCALE = [2.1, 2.3, 2.5], RING_MIX = [0.28, 0.6, 0.88];
  var SET_TIME = [1.85, 0.9, 0.667];
  var BLINK_POS = [0, 0.07, 0.13, 0.2, 0.26, 1], BLINK_VAL = [0, 1, 0.15, 1, 0, 0];

  function pulsePainter(env) {
    var ctx = env.ctx, size = env.size, c = size / 2, R = size * 0.21, arcR = size * 0.27;
    var ringW = Math.max(1, 1.5 * Math.min(1, size / 100));
    var rev = -1, glowA, glowB, coreG, shadeG, hiG, arcG, hasConic = typeof ctx.createConicGradient === 'function';
    var ringStyle = ['', '', ''], arcDot = '', arcSolid = '';

    function rebuild() {
      var a = env.a, b = env.b;
      glowA = ctx.createRadialGradient(-0.115 * size, -0.148 * size, 0, -0.115 * size, -0.148 * size, 0.39 * size);
      glowA.addColorStop(0, rgba(a, env.dark ? 0.7 : 0.9)); glowA.addColorStop(0.7, rgba(a, 0));
      glowB = ctx.createRadialGradient(0.131 * size, 0.164 * size, 0, 0.131 * size, 0.164 * size, 0.43 * size);
      glowB.addColorStop(0, rgba(b, env.dark ? 0.64 : 0.84)); glowB.addColorStop(0.72, rgba(b, 0));
      coreG = ctx.createRadialGradient(-0.36, -0.44, 0, -0.36, -0.44, 2);
      coreG.addColorStop(0, rgba(mix(a, WHITE, 0.6), 1)); coreG.addColorStop(0.3, rgba(a, 1));
      coreG.addColorStop(0.78, rgba(b, 1)); coreG.addColorStop(1, rgba(mix(b, BLACK, 0.35), 1));
      var shade = mix(b, BLACK, 0.6);
      shadeG = ctx.createRadialGradient(-0.3, -0.4, 0, -0.3, -0.4, 1.7);
      shadeG.addColorStop(0, rgba(shade, 0)); shadeG.addColorStop(0.55, rgba(shade, 0)); shadeG.addColorStop(1, rgba(shade, 0.5));
      hiG = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      hiG.addColorStop(0, 'rgba(255,255,255,0.9)'); hiG.addColorStop(1, 'rgba(255,255,255,0)');
      for (var i = 0; i < 3; i++) ringStyle[i] = rgba(mix(a, b, RING_MIX[i]), 1);
      arcDot = rgba(b, 1); arcSolid = rgba(b, 0.85);
      if (hasConic) {
        var mid = mix(a, b, 0.55);
        arcG = ctx.createConicGradient(-Math.PI / 2, 0, 0);
        arcG.addColorStop(0, rgba(a, 0)); arcG.addColorStop(0.153, rgba(a, 0)); arcG.addColorStop(0.389, rgba(a, 0.22));
        arcG.addColorStop(0.694, rgba(mid, 1)); arcG.addColorStop(0.983, rgba(b, 1)); arcG.addColorStop(0.986, rgba(b, 0)); arcG.addColorStop(1, rgba(b, 0));
      }
    }

    function drawRings(set, weight, level, t, dim) {
      var rev2 = set === 1, dur, f, g, o, oa = 0.4 + 0.5 * level;
      for (var i = 0; i < 3; i++) {
        dur = RING_BASE[i] * SET_TIME[set];
        f = frac((t - RING_DELAY[i] * SET_TIME[set]) / dur);
        g = rev2 ? 1 - f : f;
        o = (g < 0.14 ? g / 0.14 : Math.pow(1 - (g - 0.14) / 0.86, 1.5)) * oa * weight * dim;
        if (o < 0.004) continue;
        var e = 1 - Math.pow(1 - g, 3);
        ctx.globalAlpha = clamp01(o);
        ctx.strokeStyle = ringStyle[i];
        ctx.beginPath(); ctx.arc(c, c, R * (1 + (RING_SCALE[i] - 1) * e), 0, TWO_PI); ctx.stroke();
      }
    }

    return function draw(f) {
      var w = f.w, level = clamp01(f.level), t = f.phase, dim = 1 - 0.5 * w.disabled;
      if (rev !== env.rev) { rev = env.rev; rebuild(); }

      var glow = 1 - 0.4 * w.connecting - 0.6 * w.disabled;
      var gs = 0.95 + 0.22 * level;
      ctx.save(); ctx.translate(c, c); ctx.scale(gs, gs);
      ctx.globalAlpha = clamp01(glow * (0.5 + 0.5 * level)) * dim;
      ctx.fillStyle = glowA; ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.fillStyle = glowB; ctx.fillRect(-size, -size, size * 2, size * 2);
      ctx.restore();

      ctx.lineWidth = ringW;
      drawRings(0, 0.45 * w.idle, level, t, dim);
      drawRings(1, w.listening, level, t, dim);
      drawRings(2, w.speaking, level, t, dim);

      var arcA = 0.75 * w.connecting + w.thinking;
      if (arcA > 0.01) {
        var ang = TWO_PI * t / 2.4 + w.thinking * TWO_PI * t / 4.8;
        ctx.save(); ctx.translate(c, c); ctx.rotate(ang);
        ctx.globalAlpha = clamp01(arcA) * dim;
        ctx.lineWidth = Math.max(1.2, arcR * 0.15);
        ctx.strokeStyle = hasConic ? arcG : arcSolid;
        ctx.beginPath();
        if (hasConic) ctx.arc(0, 0, arcR, 0, TWO_PI); else ctx.arc(0, 0, arcR, -4.4, -0.1);
        ctx.stroke();
        ctx.fillStyle = arcDot;
        ctx.beginPath(); ctx.arc(0, -arcR * 0.98, Math.max(1, arcR * 0.13), 0, TWO_PI); ctx.fill();
        ctx.restore();
      }

      var breathe = 1 + 0.05 * w.idle * wv(TWO_PI * t / 4) + 0.05 * w.thinking * wv(TWO_PI * t / 3);
      var blink = 1 - 0.65 * w.error * keyframes(BLINK_POS, BLINK_VAL, frac(t / 1.8));
      var cs = R * (1 + 0.14 * level) * breathe;
      ctx.save(); ctx.translate(c, c); ctx.scale(cs, cs);
      ctx.globalAlpha = clamp01(blink) * dim;
      ctx.beginPath(); ctx.arc(0, 0, 1, 0, TWO_PI); ctx.clip();
      ctx.fillStyle = coreG; ctx.fillRect(-1, -1, 2, 2);
      ctx.fillStyle = shadeG; ctx.fillRect(-1, -1, 2, 2);
      ctx.translate(-0.28, -0.54); ctx.rotate(-0.35); ctx.scale(0.4, 0.26);
      ctx.fillStyle = hiG; ctx.beginPath(); ctx.arc(0, 0, 1, 0, TWO_PI); ctx.fill();
      ctx.restore();
    };
  }

  /* ================================================================= engine */

  var ORBS = {
    particles: { name: 'Particles', make: particlesPainter, from: '#f0abfc', to: '#818cf8', shake: false },
    wave:      { name: 'Wave line', make: wavePainter, from: '#22d3ee', to: '#e879f9', shake: true },
    ring:      { name: 'Waveform ring', make: ringPainter, from: '#2dd4bf', to: '#38bdf8', shake: false },
    equalizer: { name: 'Equalizer', make: equalizerPainter, from: '#38bdf8', to: '#818cf8', shake: false },
    pulse:     { name: 'Pulse', make: pulsePainter, from: '#818cf8', to: '#22d3ee', shake: false }
  };

  // One rAF loop drives every visible, animating orb.
  var running = [], rafId = 0, lastTime = 0;
  function loop(now) {
    rafId = 0;
    var dt = lastTime ? Math.min((now - lastTime) / 1000, MAX_DT) : 0;
    lastTime = now;
    for (var i = 0; i < running.length; i++) running[i](dt);
    if (running.length) rafId = requestAnimationFrame(loop);
    else lastTime = 0;
  }
  function wake(step) {
    if (running.indexOf(step) < 0) running.push(step);
    if (!rafId) { lastTime = 0; rafId = requestAnimationFrame(loop); }
  }
  function sleep(step) {
    var at = running.indexOf(step);
    if (at >= 0) running.splice(at, 1);
    if (!running.length && rafId) { cancelAnimationFrame(rafId); rafId = 0; lastTime = 0; }
  }

  function assertState(s) {
    if (STATES.indexOf(s) < 0) throw new RangeError('VoiceOrbs: unknown state "' + s + '"; use one of ' + STATES.join(', '));
  }

  function pageIsDark() {
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function mount(host, opts) {
    if (!host || host.nodeType !== 1) throw new TypeError('VoiceOrbs.mount: host must be an element');
    opts = opts || {};
    var id = opts.orb || 'particles', def = ORBS[id];
    if (!def) throw new RangeError('VoiceOrbs: unknown orb "' + id + '"; use one of ' + Object.keys(ORBS).join(', '));
    var state = opts.state || 'idle';
    assertState(state);
    var size = opts.size == null ? 96 : Number(opts.size);
    if (!(size >= 12 && size <= 1024)) throw new RangeError('VoiceOrbs: size must be 12..1024 px');
    var speed = opts.speed == null ? 1 : Math.max(0, Number(opts.speed));
    var fixedTheme = opts.theme === 'light' || opts.theme === 'dark' ? opts.theme : null;
    var baseLabel = opts.label || 'Assistant orb';
    var from = hexToRgb(opts.colorFrom || def.from), to = hexToRgb(opts.colorTo || def.to);

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var wrap = document.createElement('div');
    var canvas = document.createElement('canvas');
    wrap.style.cssText = 'display:inline-block;position:relative;line-height:0;width:' + size + 'px;height:' + size + 'px';
    wrap.setAttribute('role', 'img');
    canvas.style.cssText = 'display:block;width:' + size + 'px;height:' + size + 'px';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('VoiceOrbs: 2D canvas is unavailable');
    wrap.appendChild(canvas);
    host.appendChild(wrap);

    var env = {
      ctx: ctx, canvas: canvas, size: size, dpr: dpr, unit: size / 168,
      detail: clamp01((size - 24) / 116),   // 0 at <=24px, 1 at >=140px
      dark: fixedTheme ? fixedTheme === 'dark' : pageIsDark(),
      a: from, b: to, rev: 0, key: -1
    };
    // Resolve ink for the current error / disabled blend and theme; bumps env.rev when it changes.
    function refreshInk(w) {
      var e = Math.round(w.error * 32), d = Math.round(w.disabled * 32);
      var key = (e * 64 + d) * 2 + (env.dark ? 1 : 0);
      if (key === env.key) return;
      env.key = key;
      var a = mix(from, ERR_FROM, e / 32), b = mix(to, ERR_TO, e / 32);
      if (d) { a = grey(a, DESAT_MAX * d / 32); b = grey(b, DESAT_MAX * d / 32); }
      if (!env.dark) { a = mix(a, BLACK, LIGHT_DEEPEN); b = mix(b, BLACK, LIGHT_DEEPEN); }
      env.a = a; env.b = b; env.rev++;
    }

    var w = {};
    STATES.forEach(function (s) { w[s] = s === state ? 1 : 0; });
    var frame = { dt: 0, phase: 0, level: 0, reduced: false, w: w };
    var painter = def.make(env);
    var liveLevel = -1, inView = true, pageVisible = document.visibilityState === 'visible';
    var destroyed = false, shakeAnim = null;
    var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    frame.reduced = !!(mqReduce && mqReduce.matches);

    function label() { wrap.setAttribute('aria-label', baseLabel + ', ' + LABELS[state]); wrap.setAttribute('data-state', state); }

    function step(dt) {
      var i, total = 0, rate = state === 'error' ? ERROR_RATE : state === 'idle' || state === 'disabled' ? SETTLE_RATE : ENTER_RATE;
      for (i = 0; i < STATES.length; i++) {
        var s = STATES[i], target = s === state ? 1 : 0, next = approach(w[s], target, rate, dt);
        w[s] = target === 0 && next < 0.001 ? 0 : next;
        total += w[s];
      }
      var energy = 0, rest = 0;
      for (i = 0; i < STATES.length; i++) {
        if (total > 0) w[STATES[i]] /= total;
        if (w[STATES[i]] > 0) { energy += w[STATES[i]] * stateEnergy(STATES[i], frame.phase); rest += w[STATES[i]] * REST[STATES[i]]; }
      }
      if (!frame.reduced) frame.phase += dt * speed;
      var wanted = frame.reduced ? rest : liveLevel >= 0 ? liveLevel : energy;
      frame.level = frame.reduced ? wanted : approach(frame.level, wanted, wanted > frame.level ? LEVEL_ATTACK : LEVEL_RELEASE, dt);
      frame.dt = dt;
      refreshInk(w);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      painter(frame);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    function sync() {
      if (destroyed) return;
      if (inView && pageVisible && !frame.reduced) wake(step); else sleep(step);
    }
    function redraw() { if (!destroyed) step(0); }

    function snapWeights() { STATES.forEach(function (s) { w[s] = s === state ? 1 : 0; }); }
    function onReduce() {
      frame.reduced = !!(mqReduce && mqReduce.matches);
      if (frame.reduced) snapWeights();
      sync(); redraw();
    }
    function onTheme() {
      var dark = fixedTheme ? fixedTheme === 'dark' : pageIsDark();
      if (dark === env.dark) return;
      env.dark = dark;
      redraw();
    }
    function onVisibility() { pageVisible = document.visibilityState === 'visible'; sync(); }

    var observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(function (entries) {
      inView = entries[entries.length - 1].isIntersecting;
      sync();
    });
    if (observer) observer.observe(wrap);
    document.addEventListener('visibilitychange', onVisibility);
    if (!fixedTheme) {
      window.addEventListener('themechange', onTheme);
      if (mqDark) mqDark.addEventListener('change', onTheme);
    }
    if (mqReduce) mqReduce.addEventListener('change', onReduce);

    label();
    if (frame.reduced) snapWeights();
    redraw();
    sync();

    return {
      setState: function (next) {
        assertState(next);
        if (destroyed || next === state) return;
        state = next;
        label();
        if (frame.reduced) { snapWeights(); redraw(); }
        if (next === 'error' && def.shake && !frame.reduced && canvas.animate) {
          if (shakeAnim) shakeAnim.cancel();
          var px = 3 * size / 168;
          shakeAnim = canvas.animate(
            [0, -0.5, 1, -0.67, 0.33, 0].map(function (m) { return { transform: 'translateX(' + (m * px).toFixed(2) + 'px)' }; }),
            { duration: 340, easing: 'ease-out' }
          );
        }
      },
      // 0..1 simulates audio input; null hands control back to the built-in state energy.
      setLevel: function (v) {
        if (v == null) { liveLevel = -1; return; }
        if (typeof v !== 'number' || !isFinite(v)) throw new TypeError('VoiceOrbs: level must be a finite number or null');
        liveLevel = clamp01(v);
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        sleep(step);
        if (observer) observer.disconnect();
        if (shakeAnim) shakeAnim.cancel();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('themechange', onTheme);
        if (mqDark) mqDark.removeEventListener('change', onTheme);
        if (mqReduce) mqReduce.removeEventListener('change', onReduce);
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    };
  }

  var list = Object.keys(ORBS).map(function (k) { return { id: k, name: ORBS[k].name, from: ORBS[k].from, to: ORBS[k].to }; });
  return { mount: mount, STATES: STATES.slice(), ORBS: list };
}));

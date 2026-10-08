/*!
 * particle-orbs.js — four WebGL particle / orb loading indicators.
 * Dependency-free vanilla JS + raw WebGL1, UMD. v1.0.0
 *
 * Ported from sketch-threejs (https://github.com/ykob/sketch-threejs,
 * demo https://ykob.github.io/sketch-threejs/) by Yoichi Kobayashi (ykob),
 * Tokyo. Upstream licence: MIT.
 *
 *   MIT License
 *
 *   Copyright (c) 2021 yoichi kobayashi
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
 * Variant -> upstream sketch (src/js/sketch/<name>/ in the upstream repo):
 *   ember  <- sun    core.vs/core.fs (flowing emissive sphere, limb rim light)
 *                    + points.vs/points.fs (3 s blinking, counter-rotating halo)
 *   drift  <- blink  points.vs/points.fs + Points.js (simplex-noise-gated
 *                    point lattice, noise sampled in view space)
 *   swarm  <- hole   points.vs/points.fs (per-point radian triples orbiting
 *                    a centre, size = |sin(phase)|)
 *   bloom  <- egg    egg.fs (stacked smoothstep masks over a rotating
 *                    simplex-noise field, banded blob)
 *
 * Third-party code inside the shaders: the 3D simplex noise below is Ashima
 * Arts / Stefan Gustavson's webgl-noise (the same code upstream pulls in via
 * glsl-noise). Copyright (C) 2011 Ashima Arts. All rights reserved.
 * Distributed under the MIT License. https://github.com/ashima/webgl-noise
 *
 * Adapted for orb-loaders: three.js removed (raw WebGL1, one file); sketch
 * textures replaced by procedural noise; one shared offscreen GL context for
 * every orb on the page, blitted into per-orb 2D canvases (no context-limit
 * wall); colours rebuilt from a two-theme palette (upstream is additive-glow
 * on black only); camera/point sizes retuned for 20-160 px; CSS fallback when
 * WebGL is unavailable; pause offscreen / hidden tab; static frame under
 * prefers-reduced-motion.
 *
 * Usage:
 *   ParticleOrbs.mount(element, { variant: 'ember', size: 96, theme: 'dark' })
 *   -> returns { destroy(), setPaused(bool), setTheme('light'|'dark') }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ParticleOrbs = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================================================== constants */

  var MAX_DPR = 2;
  var MIN_SIZE = 12;
  var MAX_SIZE = 640;
  var DEFAULT_SIZE = 96;
  var MAX_DT = 0.1;                    // seconds; a long stall must not teleport the animation
  var FOV = 35 * Math.PI / 180;
  var NEAR = 0.1, FAR = 30;
  var INLINE_MAX = 32;                 // <= this many CSS px counts as an inline orb
  var STYLE_ATTR = 'data-particle-orbs';

  /* ================================================================ shaders */

  var VS_HEAD = 'precision highp float;\n';
  var FS_HEAD = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    ''
  ].join('\n');

  // Ashima Arts / Stefan Gustavson 3D simplex noise (MIT) — see file header.
  var NOISE = [
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }',
    'vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }',
    'vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }',
    'float snoise(vec3 v) {',
    '  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);',
    '  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);',
    '  vec3 i = floor(v + dot(v, C.yyy));',
    '  vec3 x0 = v - i + dot(i, C.xxx);',
    '  vec3 g = step(x0.yzx, x0.xyz);',
    '  vec3 l = 1.0 - g;',
    '  vec3 i1 = min(g.xyz, l.zxy);',
    '  vec3 i2 = max(g.xyz, l.zxy);',
    '  vec3 x1 = x0 - i1 + C.xxx;',
    '  vec3 x2 = x0 - i2 + C.yyy;',
    '  vec3 x3 = x0 - D.yyy;',
    '  i = mod289(i);',
    '  vec4 p = permute(permute(permute(',
    '            i.z + vec4(0.0, i1.z, i2.z, 1.0))',
    '          + i.y + vec4(0.0, i1.y, i2.y, 1.0))',
    '          + i.x + vec4(0.0, i1.x, i2.x, 1.0));',
    '  float n_ = 0.142857142857;',
    '  vec3 ns = n_ * D.wyz - D.xzx;',
    '  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);',
    '  vec4 x_ = floor(j * ns.z);',
    '  vec4 y_ = floor(j - 7.0 * x_);',
    '  vec4 x = x_ * ns.x + ns.yyyy;',
    '  vec4 y = y_ * ns.x + ns.yyyy;',
    '  vec4 h = 1.0 - abs(x) - abs(y);',
    '  vec4 b0 = vec4(x.xy, y.xy);',
    '  vec4 b1 = vec4(x.zw, y.zw);',
    '  vec4 s0 = floor(b0) * 2.0 + 1.0;',
    '  vec4 s1 = floor(b1) * 2.0 + 1.0;',
    '  vec4 sh = -step(h, vec4(0.0));',
    '  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;',
    '  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;',
    '  vec3 p0 = vec3(a0.xy, h.x);',
    '  vec3 p1 = vec3(a0.zw, h.y);',
    '  vec3 p2 = vec3(a1.xy, h.z);',
    '  vec3 p3 = vec3(a1.zw, h.w);',
    '  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));',
    '  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;',
    '  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);',
    '  m = m * m;',
    '  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));',
    '}',
    ''
  ].join('\n');

  var PALETTE_UNIFORMS = [
    'uniform float uTime;', 'uniform float uTheme;', 'uniform float uPx;',
    'uniform vec3 uC0;', 'uniform vec3 uC1;', 'uniform vec3 uC2;', ''
  ].join('\n');

  var VIEW_UNIFORMS = [
    'uniform mat4 uProj;', 'uniform mat4 uMV;', 'uniform float uCam;', ''
  ].join('\n');

  var PROGRAMS = {

    // sun/core.vs + core.fs: the emissive sphere. The texture lookup that
    // upstream distorts with a normal map becomes domain-warped simplex noise.
    emberCore: {
      attribs: ['aPos'],
      vs: VS_HEAD + VIEW_UNIFORMS + [
        'attribute vec3 aPos;',
        'varying vec3 vObj;',
        'varying vec3 vN;',
        'void main() {',
        '  vObj = aPos;',
        '  vN = (uMV * vec4(aPos, 0.0)).xyz;',
        '  gl_Position = uProj * uMV * vec4(aPos, 1.0);',
        '}'
      ].join('\n'),
      fs: FS_HEAD + PALETTE_UNIFORMS + NOISE + [
        'varying vec3 vObj;',
        'varying vec3 vN;',
        'void main() {',
        '  float t = uTime * 0.32;',
        '  vec3 p = vObj * 1.55;',
        '  vec3 w = vec3(snoise(p + vec3(0.0, t, 0.0)),',
        '                snoise(p + vec3(5.2, 1.3, -t)),',
        '                snoise(p + vec3(-t, 8.1, 3.7)));',
        '  float f = snoise(p * 1.3 + w * 0.7 + vec3(0.0, 0.0, t * 0.6)) * 0.5 + 0.5;',
        '  float g = snoise(p * 3.1 - w * 0.9 + vec3(t * 0.8, 0.0, 0.0)) * 0.5 + 0.5;',
        '  float r = smoothstep(0.12, 0.95, clamp(f * 0.75 + g * 0.35 - 0.05, 0.0, 1.0));',
        '  vec3 col = mix(uC0, uC1, smoothstep(0.0, 0.6, r));',
        '  col = mix(col, uC2, smoothstep(0.55, 1.0, r));',
        // Upstream brightens the limb (smoothstep(0.7, 1.0, |sin(angleToCamera)|)).
        // Light theme darkens it instead so the disc keeps an edge on a pale page.
        '  float sinA = sqrt(max(1.0 - vN.z * vN.z / dot(vN, vN), 0.0));',
        '  float rim = smoothstep(0.7, 1.0, sinA) * 0.9;',
        '  col = mix(col, mix(uC2, uC0, uTheme), rim * 0.6);',
        '  gl_FragColor = vec4(col, 1.0);',
        '}'
      ].join('\n')
    },

    // sun/points.vs + points.fs: halo of sprites, 3 s blink cycle, each
    // point spinning at its own signed speed.
    emberHalo: {
      attribs: ['aPos', 'aTw'],
      vs: VS_HEAD + VIEW_UNIFORMS + PALETTE_UNIFORMS + [
        'attribute vec3 aPos;',
        'attribute vec2 aTw;',
        'varying float vA;',
        'varying float vMix;',
        'vec3 rot(vec3 p, vec3 a) {',
        '  float cx = cos(a.x), sx = sin(a.x), cy = cos(a.y), sy = sin(a.y), cz = cos(a.z), sz = sin(a.z);',
        '  p = vec3(p.x, cx * p.y - sx * p.z, sx * p.y + cx * p.z);',
        '  p = vec3(cy * p.x + sy * p.z, p.y, -sy * p.x + cy * p.z);',
        '  return vec3(cz * p.x - sz * p.y, sz * p.x + cz * p.y, p.z);',
        '}',
        'void main() {',
        '  float interval = mod(uTime + aTw.x * 3.0, 3.0) / 3.0;',
        '  float s = sin(interval * 4.0);',
        '  float blink = max(s * 2.0 - 1.0, 0.0);',
        '  vec3 a = radians(vec3(0.3, 1.0, 0.3) * uTime * aTw.y * 3.0);',
        '  vec4 mv = uMV * vec4(rot(aPos, a), 1.0);',
        '  float k = uCam / length(mv.xyz);',
        '  gl_Position = uProj * mv;',
        '  gl_PointSize = max(uPx * 0.075 * max(s, 0.0) * k, 1.5);',
        '  vA = blink * clamp(k * 0.9, 0.3, 1.0);',
        '  vMix = 0.5 + 0.5 * sin(aTw.x * 6.2831 + uTime);',
        '}'
      ].join('\n'),
      fs: FS_HEAD + PALETTE_UNIFORMS + [
        'varying float vA;',
        'varying float vMix;',
        'void main() {',
        '  float d = length(gl_PointCoord * 2.0 - 1.0);',
        '  float a = (1.0 - smoothstep(0.25, 1.0, d)) * vA;',
        '  vec3 col = mix(mix(uC1, uC2, vMix), mix(uC0, uC1, vMix), uTheme);',
        '  gl_FragColor = vec4(col * a, a);',
        '}'
      ].join('\n')
    },

    // blink/points.vs: size and opacity both ride a view-space simplex field.
    drift: {
      attribs: ['aPos'],
      vs: VS_HEAD + VIEW_UNIFORMS + PALETTE_UNIFORMS + NOISE + [
        'attribute vec3 aPos;',
        'varying float vA;',
        'varying float vMix;',
        'varying float vHot;',
        'void main() {',
        '  vec4 mv = uMV * vec4(aPos, 1.0);',
        '  float n1 = snoise(mv.xyz * 3.0 + vec3(-uTime, uTime, uTime) * 0.5);',
        '  float n2 = snoise(mv.xyz * 0.55 + vec3(uTime, -uTime, uTime) * 0.06);',
        '  float nz = max(n1, 0.0);',
        '  float k = uCam / length(mv.xyz);',
        '  float front = clamp(0.5 + (mv.z + uCam) * 0.5, 0.0, 1.0);',
        '  gl_Position = nz < 0.04 ? vec4(2.0, 2.0, 2.0, 1.0) : uProj * mv;',
        '  gl_PointSize = max(uPx * 0.09 * nz * k, 1.5);',
        '  vA = pow(clamp(nz * 1.5, 0.0, 1.0), 1.5) * mix(0.4, 1.0, front);',
        '  vMix = n2 * 0.5 + 0.5;',
        '  vHot = nz;',
        '}'
      ].join('\n'),
      fs: FS_HEAD + PALETTE_UNIFORMS + [
        'varying float vA;',
        'varying float vMix;',
        'varying float vHot;',
        'void main() {',
        '  float d = length(gl_PointCoord * 2.0 - 1.0);',
        '  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA;',
        '  vec3 col = mix(mix(uC0, uC1, vMix), uC2, vHot * vHot);',
        '  gl_FragColor = vec4(col * a, a);',
        '}'
      ].join('\n')
    },

    // hole/points.vs: position = unit vector from two advancing angles;
    // size = |sin(a + phase)|. Beads are shaded as little spheres.
    swarm: {
      attribs: ['aRad'],
      vs: VS_HEAD + VIEW_UNIFORMS + PALETTE_UNIFORMS + [
        'uniform float uBead;',
        'attribute vec4 aRad;',
        'varying float vS;',
        'varying float vF;',
        'void main() {',
        '  float a = uTime * 1.25;',
        '  float r1 = a + aRad.x;',
        '  float r2 = a + aRad.y;',
        '  vec3 p = vec3(cos(r1) * cos(r2), cos(r1) * sin(r2), sin(r1)) * aRad.w;',
        '  vec4 mv = uMV * vec4(p, 1.0);',
        '  float k = uCam / length(mv.xyz);',
        '  float s = abs(sin(a + aRad.z));',
        '  gl_Position = uProj * mv;',
        '  gl_PointSize = max(uPx * uBead * s * k, 1.0);',
        '  vS = s;',
        '  vF = clamp(0.5 + 0.5 * (mv.z + uCam) / aRad.w, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fs: FS_HEAD + PALETTE_UNIFORMS + [
        'varying float vS;',
        'varying float vF;',
        'void main() {',
        '  vec2 q = gl_PointCoord * 2.0 - 1.0;',
        '  float d2 = dot(q, q);',
        '  float edge = 1.0 - smoothstep(0.72, 1.0, sqrt(d2));',
        '  float z = sqrt(max(1.0 - d2, 0.0));',
        '  float lit = clamp(dot(vec3(q.x, -q.y, z), normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);',
        '  vec3 col = mix(mix(uC0, uC1, vF), uC2, pow(lit, 3.0) * 0.85);',
        '  float a = edge * smoothstep(0.0, 0.2, vS) * mix(0.4, 1.0, vF);',
        '  gl_FragColor = vec4(col * a, a);',
        '}'
      ].join('\n')
    },

    // egg/egg.fs: concentric smoothstep masks over a rotating noise field.
    // Upstream's hard step() bands become anti-aliased smoothsteps.
    bloom: {
      attribs: ['aPos'],
      vs: VS_HEAD + [
        'attribute vec2 aPos;',
        'varying vec2 vP;',
        'void main() {',
        '  vP = aPos;',
        '  gl_Position = vec4(aPos, 0.0, 1.0);',
        '}'
      ].join('\n'),
      fs: FS_HEAD + PALETTE_UNIFORMS + NOISE + [
        'varying vec2 vP;',
        'void main() {',
        '  float breathe = 1.0 + 0.045 * sin(uTime * 1.3);',
        '  vec2 pos = vP * 0.95 / breathe;',
        '  float r = length(pos);',
        '  float nt = uTime * 0.32;',
        '  float noise = (snoise(vec3(pos * 1.15 + vec2(sin(nt), cos(nt)), nt)) + 1.0) * 0.25;',
        '  float outer = smoothstep(0.1, 1.0, 1.0 - r);',
        '  float inner = smoothstep(0.0, 0.3, 0.5 - r) * 0.5;',
        '  float lightC = smoothstep(0.0, 0.1, 0.3 - r) * smoothstep(0.0, 0.1, 0.2 - length(pos + vec2(0.2, -0.2)));',
        '  float mask = outer * noise + inner;',
        '  float hi = lightC * (noise + 0.12);',
        '  float e = 0.8 / uPx;',
        '  float sil = smoothstep(0.006, 0.006 + 2.0 * e, mask);',
        '  float b3 = smoothstep(0.014, 0.014 + 2.0 * e, mask);',
        '  float b2 = smoothstep(0.28 - e, 0.28 + e, mask);',
        '  float b1 = smoothstep(0.6 - e, 0.6 + e, mask);',
        '  float bh = smoothstep(0.13 - e, 0.13 + e, hi) * 0.9;',
        '  vec3 col = mix(uC1, uC0, uTheme);',
        '  col = mix(col, mix(uC0, uC2, uTheme), b3);',
        '  col = mix(col, uC1, b2);',
        '  col = mix(col, mix(uC2, uC0, uTheme), b1);',
        '  col = mix(col, vec3(1.0), bh);',
        '  gl_FragColor = vec4(col * sil, sil);',
        '}'
      ].join('\n')
    }
  };

  /* ================================================================ variants */

  // hue: default palette hue 0..1. cam: camera distance, framed so the
  // variant's outermost extent just fits the canvas. t0 / still: start time
  // and the frame shown under prefers-reduced-motion.
  var VARIANTS = {
    ember: { hue: 0.075, sat: 0.9, cam: 4.5, t0: 1.0, still: 2.4 },
    drift: { hue: 0.54, sat: 0.85, cam: 3.55, t0: 0.5, still: 3.0 },
    swarm: { hue: 0.74, sat: 0.8, cam: 3.4, t0: 0.5, still: 1.7 },
    bloom: { hue: 0.94, sat: 0.8, cam: 1, t0: 1.0, still: 3.2 }
  };
  var VARIANT_NAMES = ['ember', 'drift', 'swarm', 'bloom'];

  var EMBER_POINTS = 360;
  var DRIFT_SIDE = 13;
  var SWARM_HERO = 96;
  var SWARM_INLINE = 16;
  var SWARM_BEAD_HERO = 0.075;
  var SWARM_BEAD_INLINE = 0.24;
  var GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

  /* ================================================================== maths */

  // Deterministic, so a variant looks the same on every load and in screenshots.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function perspective(out, fov, near, far) {
    var f = 1 / Math.tan(fov / 2);
    out.fill(0);
    out[0] = f; out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = 2 * far * near / (near - far);
  }

  // Column-major model-view: R = Rz * Rx * Ry, then translate (0, 0, -cam).
  function modelView(out, rx, ry, rz, cam) {
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var cz = Math.cos(rz), sz = Math.sin(rz);
    var a00 = cy, a01 = 0, a02 = sy;
    var a10 = sx * sy, a11 = cx, a12 = -sx * cy;
    var a20 = -cx * sy, a21 = sx, a22 = cx * cy;
    out[0] = cz * a00 - sz * a10; out[4] = cz * a01 - sz * a11; out[8]  = cz * a02 - sz * a12;
    out[1] = sz * a00 + cz * a10; out[5] = sz * a01 + cz * a11; out[9]  = sz * a02 + cz * a12;
    out[2] = a20;                 out[6] = a21;                 out[10] = a22;
    out[3] = 0; out[7] = 0; out[11] = 0;
    out[12] = 0; out[13] = 0; out[14] = -cam; out[15] = 1;
  }

  /* ================================================================= colour */

  function rgbToHsl(r, g, b) {
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  }

  function hslToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    function ch(t) {
      t = ((t % 1) + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    return [ch(h + 1 / 3), ch(h), ch(h - 1 / 3)];
  }

  var colorCtx = null;

  // Any CSS colour -> [r, g, b] in 0..1, or null if the browser rejects it.
  // The 2D context normalises fillStyle to #rrggbb or rgba(r, g, b, a).
  function parseColor(css) {
    if (typeof css !== 'string') return null;
    if (!colorCtx) colorCtx = document.createElement('canvas').getContext('2d');
    colorCtx.fillStyle = '#010203';
    colorCtx.fillStyle = css;
    var v = colorCtx.fillStyle;
    if (v === '#010203' && css.replace(/\s/g, '').toLowerCase() !== '#010203') return null;
    var m;
    if ((m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(v))) {
      return [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255];
    }
    if ((m = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/.exec(v))) {
      return [m[1] / 255, m[2] / 255, m[3] / 255];
    }
    return null;
  }

  // Three analogous stops around the base hue, darkest first. Dark theme: glow
  // ramp (deep -> base -> near-white). Light theme: ink ramp that never goes
  // pale enough to vanish on the page background.
  function buildPalette(hue, sat, theme) {
    var light = theme === 'light';
    var s = Math.min(1, Math.max(0.25, sat));
    var stops = light
      ? [[hue - 0.04, s, 0.27], [hue, s, 0.43], [hue + 0.04, s, 0.62]]
      : [[hue - 0.06, Math.min(1, s + 0.05), 0.40], [hue, s, 0.58], [hue + 0.05, s * 0.8, 0.84]];
    var rgb = stops.map(function (c) { return hslToRgb(c[0], c[1], c[2]); });
    return {
      c0: new Float32Array(rgb[0]),
      c1: new Float32Array(rgb[1]),
      c2: new Float32Array(rgb[2]),
      css: rgb.map(function (c) {
        return 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')';
      })
    };
  }

  /* ============================================================ GL plumbing */

  // One offscreen WebGL context serves every orb on the page. Each orb draws
  // into the bottom-left corner of it, then blits that square into its own 2D
  // canvas. A page of twenty orbs therefore costs one context, not twenty
  // (browsers evict the oldest context past ~16).
  var shared = null;
  var glFailure = null;                // sticky: 'no-webgl' | 'shader' once the device has proven it cannot
  var scratchMV = new Float32Array(16);
  var scratchProj = new Float32Array(16);

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error('shader: ' + log);
    }
    return sh;
  }

  function buildProgram(gl, def) {
    var vs = compile(gl, gl.VERTEX_SHADER, def.vs);
    var fs = compile(gl, gl.FRAGMENT_SHADER, def.fs);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    def.attribs.forEach(function (name, i) { gl.bindAttribLocation(prog, i, name); });
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      var log = gl.getProgramInfoLog(prog);
      gl.deleteProgram(prog);
      throw new Error('link: ' + log);
    }
    var u = {};
    var n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var name = gl.getActiveUniform(prog, i).name;
      u[name] = gl.getUniformLocation(prog, name);
    }
    return { prog: prog, u: u };
  }

  function makeBuffer(gl, target, data) {
    var buf = gl.createBuffer();
    gl.bindBuffer(target, buf);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return buf;
  }

  function sphereGeometry(gl) {
    var bands = 32, verts = [], idx = [];
    for (var la = 0; la <= bands; la++) {
      var th = la * Math.PI / bands;
      for (var lo = 0; lo <= bands; lo++) {
        var ph = lo * 2 * Math.PI / bands;
        verts.push(Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph));
      }
    }
    for (var a = 0; a < bands; a++) {
      for (var b = 0; b < bands; b++) {
        var p = a * (bands + 1) + b, q = p + bands + 1;
        idx.push(p, q, p + 1, q, q + 1, p + 1);
      }
    }
    return {
      buf: makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(verts)),
      ibuf: makeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx)),
      count: idx.length
    };
  }

  function emberPoints(gl) {
    var rnd = mulberry32(1203), data = new Float32Array(EMBER_POINTS * 5);
    for (var i = 0; i < EMBER_POINTS; i++) {
      var lat = (rnd() * 150 - 75) * Math.PI / 180;
      var lon = rnd() * 2 * Math.PI;
      var rad = 1 + rnd() * rnd() * 0.4;
      data[i * 5]     = Math.cos(lat) * Math.cos(lon) * rad;
      data[i * 5 + 1] = Math.sin(lat) * rad;
      data[i * 5 + 2] = Math.cos(lat) * Math.sin(lon) * rad;
      data[i * 5 + 3] = rnd();
      data[i * 5 + 4] = (5 + rnd() * 5) * (rnd() < 0.5 ? -1 : 1);
    }
    return makeBuffer(gl, gl.ARRAY_BUFFER, data);
  }

  function driftPoints(gl) {
    var rnd = mulberry32(50), pts = [], cell = 2 / DRIFT_SIDE;
    for (var z = 0; z < DRIFT_SIDE; z++) {
      for (var y = 0; y < DRIFT_SIDE; y++) {
        for (var x = 0; x < DRIFT_SIDE; x++) {
          var px = (x + 0.5) * cell - 1 + (rnd() - 0.5) * cell * 0.6;
          var py = (y + 0.5) * cell - 1 + (rnd() - 0.5) * cell * 0.6;
          var pz = (z + 0.5) * cell - 1 + (rnd() - 0.5) * cell * 0.6;
          if (px * px + py * py + pz * pz <= 1) pts.push(px, py, pz);
        }
      }
    }
    return { buf: makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(pts)), count: pts.length / 3 };
  }

  function swarmPoints(gl) {
    var rnd = mulberry32(32), data = new Float32Array(SWARM_HERO * 4);
    for (var i = 0; i < SWARM_HERO; i++) {
      data[i * 4]     = i * GOLDEN_ANGLE;      // spread evenly so beads do not clump
      data[i * 4 + 1] = rnd() * 2 * Math.PI;
      data[i * 4 + 2] = rnd() * 2 * Math.PI;
      data[i * 4 + 3] = 0.72 + rnd() * 0.28;
    }
    return makeBuffer(gl, gl.ARRAY_BUFFER, data);
  }

  function createShared() {
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    var gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true, premultipliedAlpha: true, antialias: true, depth: true,
        powerPreference: 'low-power'
      });
    } catch (e) { gl = null; }
    if (!gl) return null;

    var S = {
      canvas: canvas, gl: gl, cap: 1, refs: 0, attribCount: 0, lost: false,
      programs: {}, geo: {}, onLost: null
    };
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.SCISSOR_TEST);
    gl.depthFunc(gl.LEQUAL);
    S.geo.quad = makeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    perspective(scratchProj, FOV, NEAR, FAR);

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      S.lost = true;
      if (S.onLost) S.onLost();
    }, false);
    return S;
  }

  // Programs and geometry a variant needs, built once and cached on the shared context.
  var VARIANT_NEEDS = {
    ember: ['emberCore', 'emberHalo'], drift: ['drift'], swarm: ['swarm'], bloom: ['bloom']
  };

  function ensureResources(S, variant) {
    var gl = S.gl;
    VARIANT_NEEDS[variant].forEach(function (name) {
      if (!S.programs[name]) S.programs[name] = buildProgram(gl, PROGRAMS[name]);
    });
    if (variant === 'ember' && !S.geo.sphere) {
      S.geo.sphere = sphereGeometry(gl);
      S.geo.ember = emberPoints(gl);
    } else if (variant === 'drift' && !S.geo.drift) {
      S.geo.drift = driftPoints(gl);
    } else if (variant === 'swarm' && !S.geo.swarm) {
      S.geo.swarm = swarmPoints(gl);
    }
  }

  function growCanvas(S, px) {
    if (px <= S.cap) return;
    S.cap = px;
    S.canvas.width = px;
    S.canvas.height = px;
  }

  function releaseShared(S) {
    if (!S || shared !== S) return;
    S.refs -= 1;
    if (S.refs > 0) return;
    S.onLost = null;                   // the loss we are about to cause is not a failure
    var ext = S.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    shared = null;
  }

  function setAttribs(S, count) {
    var gl = S.gl;
    for (var i = S.attribCount; i < count; i++) gl.enableVertexAttribArray(i);
    for (var j = count; j < S.attribCount; j++) gl.disableVertexAttribArray(j);
    S.attribCount = count;
  }

  function useProgram(S, name, inst, t) {
    var gl = S.gl, P = S.programs[name], u = P.u;
    gl.useProgram(P.prog);
    gl.uniform1f(u.uTime, t);
    gl.uniform1f(u.uTheme, inst.theme === 'light' ? 1 : 0);
    gl.uniform1f(u.uPx, inst.px);
    gl.uniform1f(u.uCam, inst.spec.cam);
    gl.uniform3fv(u.uC0, inst.pal.c0);
    gl.uniform3fv(u.uC1, inst.pal.c1);
    gl.uniform3fv(u.uC2, inst.pal.c2);
    gl.uniformMatrix4fv(u.uProj, false, scratchProj);
    gl.uniformMatrix4fv(u.uMV, false, scratchMV);
    return P;
  }

  /* ================================================================== draws */

  var DRAW = {
    ember: function (S, inst, t) {
      var gl = S.gl, g = S.geo;
      modelView(scratchMV, 0, 0, 0, inst.spec.cam);
      gl.enable(gl.DEPTH_TEST);

      useProgram(S, 'emberCore', inst, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.sphere.buf);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.sphere.ibuf);
      setAttribs(S, 1);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.drawElements(gl.TRIANGLES, g.sphere.count, gl.UNSIGNED_SHORT, 0);

      useProgram(S, 'emberHalo', inst, t);
      gl.depthMask(false);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.ember);
      setAttribs(S, 2);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      gl.drawArrays(gl.POINTS, 0, EMBER_POINTS);
      gl.depthMask(true);
    },

    drift: function (S, inst, t) {
      var gl = S.gl, d = S.geo.drift;
      modelView(scratchMV, t * 0.12, t * 0.35, t * 0.1, inst.spec.cam);
      gl.disable(gl.DEPTH_TEST);
      useProgram(S, 'drift', inst, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, d.buf);
      setAttribs(S, 1);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, d.count);
    },

    swarm: function (S, inst, t) {
      var gl = S.gl, inline = inst.size <= INLINE_MAX;
      modelView(scratchMV, 0.35, t * 0.18, 0, inst.spec.cam);
      gl.disable(gl.DEPTH_TEST);
      var P = useProgram(S, 'swarm', inst, t);
      gl.uniform1f(P.u.uBead, inline ? SWARM_BEAD_INLINE : SWARM_BEAD_HERO);
      gl.bindBuffer(gl.ARRAY_BUFFER, S.geo.swarm);
      setAttribs(S, 1);
      gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.POINTS, 0, inline ? SWARM_INLINE : SWARM_HERO);
    },

    bloom: function (S, inst, t) {
      var gl = S.gl;
      gl.disable(gl.DEPTH_TEST);
      useProgram(S, 'bloom', inst, t);
      gl.bindBuffer(gl.ARRAY_BUFFER, S.geo.quad);
      setAttribs(S, 1);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  };

  function renderInstance(inst, t) {
    var S = shared, gl = S.gl, px = inst.px;
    gl.depthMask(true);
    gl.viewport(0, 0, px, px);
    gl.scissor(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    DRAW[inst.variant](S, inst, t);
    // GL's origin is bottom-left; the canvas bitmap's is top-left.
    inst.ctx.drawImage(S.canvas, 0, S.canvas.height - px, px, px, 0, 0, px, px);
  }

  /* ============================================================== scheduler */

  var instances = [];
  var rafId = 0;
  var lastTs = 0;
  var reducedMq = null;
  var listening = false;

  function isReduced() { return !!(reducedMq && reducedMq.matches); }

  function isRunning(inst) {
    return inst.mode === 'gl' && inst.inView && !inst.paused && !document.hidden && !isReduced();
  }

  function anyRunning() {
    for (var i = 0; i < instances.length; i++) if (isRunning(instances[i])) return true;
    return false;
  }

  function tick(ts) {
    rafId = 0;
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, MAX_DT) : 0;
    lastTs = ts;
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      if (!isRunning(inst)) continue;
      inst.t += dt * inst.speed;
      renderInstance(inst, inst.t);
    }
    if (anyRunning()) rafId = requestAnimationFrame(tick);
    else lastTs = 0;
  }

  // Start the loop if there is work, let it lapse if there is none.
  function sync() {
    if (rafId || !anyRunning()) return;
    lastTs = 0;
    rafId = requestAnimationFrame(tick);
  }

  function drawStill(inst) {
    if (inst.mode !== 'gl') return;
    renderInstance(inst, isReduced() ? inst.spec.still : inst.t);
  }

  function onVisibility() { sync(); }

  function onReducedChange() {
    for (var i = 0; i < instances.length; i++) drawStill(instances[i]);
    sync();
  }

  function onContextLost() {
    shared = null;
    for (var i = 0; i < instances.length; i++) toFallback(instances[i], 'context-lost');
  }

  function addGlobalListeners() {
    if (listening) return;
    listening = true;
    if (window.matchMedia) {
      reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (reducedMq.addEventListener) reducedMq.addEventListener('change', onReducedChange);
    }
    document.addEventListener('visibilitychange', onVisibility);
  }

  function removeGlobalListeners() {
    if (!listening) return;
    listening = false;
    if (reducedMq && reducedMq.removeEventListener) reducedMq.removeEventListener('change', onReducedChange);
    document.removeEventListener('visibilitychange', onVisibility);
    reducedMq = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    lastTs = 0;
  }

  /* ================================================================ fallback */

  function injectStyle() {
    if (document.querySelector('style[' + STYLE_ATTR + ']')) return;
    var st = document.createElement('style');
    st.setAttribute(STYLE_ATTR, '');
    st.textContent = [
      '.po-orb{display:inline-block;position:relative;flex:none;line-height:0;vertical-align:middle}',
      '.po-orb>canvas{display:block;width:100%;height:100%}',
      '.po-fb{display:block;width:100%;height:100%;border-radius:50%;',
      'background:radial-gradient(circle at 36% 30%,var(--po-c2),var(--po-c1) 46%,var(--po-c0) 100%);',
      'animation:po-breathe 2.6s ease-in-out infinite}',
      '@keyframes po-breathe{0%,100%{transform:scale(.9);opacity:.8}50%{transform:scale(1);opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.po-fb{animation:none;transform:none;opacity:1}}'
    ].join('');
    document.head.appendChild(st);
  }

  // Swap the canvas for a CSS-only orb: same size, same palette, same label.
  function toFallback(inst, reason) {
    if (inst.mode === 'fallback') return;
    if (inst.holdsGl) { inst.holdsGl = false; releaseShared(shared); }
    if (inst.io) { inst.io.disconnect(); inst.io = null; }
    inst.mode = 'fallback';
    inst.wrap.setAttribute('data-po-fallback', reason);
    if (inst.canvas.parentNode) inst.wrap.removeChild(inst.canvas);
    var fb = document.createElement('span');
    fb.className = 'po-fb';
    fb.setAttribute('aria-hidden', 'true');
    fb.style.setProperty('--po-c0', inst.pal.css[0]);
    fb.style.setProperty('--po-c1', inst.pal.css[1]);
    fb.style.setProperty('--po-c2', inst.pal.css[2]);
    inst.wrap.appendChild(fb);
    inst.fb = fb;
  }

  /* =================================================================== mount */

  function resolveBase(opts, host, spec) {
    var css = opts.color === 'currentColor' ? window.getComputedStyle(host).color : opts.color;
    var rgb = css ? parseColor(css) : null;
    if (!rgb) return { hue: spec.hue, sat: spec.sat };
    var hsl = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return { hue: hsl[0], sat: hsl[1] };
  }

  function normalizeTheme(theme) {
    if (theme === 'light' || theme === 'dark') return theme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function clampNumber(v, lo, hi, fallback) {
    var n = Number(v);
    return isFinite(n) && n > 0 ? Math.min(hi, Math.max(lo, n)) : fallback;
  }

  function attachGl(inst) {
    if (glFailure) return glFailure;
    try {
      if (!shared || shared.lost) {
        shared = createShared();
        if (!shared) { glFailure = 'no-webgl'; return glFailure; }
        shared.onLost = onContextLost;
      }
      ensureResources(shared, inst.variant);
    } catch (e) {
      glFailure = 'shader';
      if (shared && shared.refs === 0) { shared.refs = 1; releaseShared(shared); }
      return glFailure;
    }
    shared.refs += 1;
    inst.holdsGl = true;
    growCanvas(shared, inst.px);
    return null;
  }

  function mount(host, options) {
    if (!host || host.nodeType !== 1) throw new TypeError('ParticleOrbs.mount: host must be an element');
    var opts = options || {};
    var variant = opts.variant || 'ember';
    if (!VARIANTS.hasOwnProperty(variant)) {
      throw new RangeError('ParticleOrbs.mount: unknown variant "' + variant + '" (use ' + VARIANT_NAMES.join(' | ') + ')');
    }
    var spec = VARIANTS[variant];
    var size = Math.round(clampNumber(opts.size, MIN_SIZE, MAX_SIZE, DEFAULT_SIZE));
    var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    var base = resolveBase(opts, host, spec);
    var theme = normalizeTheme(opts.theme);

    injectStyle();
    addGlobalListeners();

    var wrap = document.createElement('span');
    wrap.className = 'po-orb';
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', opts.label || 'Loading');
    wrap.style.width = size + 'px';
    wrap.style.height = size + 'px';
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.round(size * dpr);
    wrap.appendChild(canvas);
    host.appendChild(wrap);

    var inst = {
      variant: variant, spec: spec, size: size, px: canvas.width, theme: theme,
      base: base, pal: buildPalette(base.hue, base.sat, theme),
      speed: clampNumber(opts.speed, 0.1, 4, 1), t: spec.t0,
      wrap: wrap, canvas: canvas, ctx: canvas.getContext('2d'), fb: null,
      mode: 'gl', holdsGl: false, paused: false, inView: true, io: null
    };
    inst.ctx.globalCompositeOperation = 'copy';
    instances.push(inst);

    var failure = attachGl(inst);
    if (failure) toFallback(inst, failure);
    else drawStill(inst);

    if (inst.mode === 'gl' && window.IntersectionObserver) {
      inst.io = new IntersectionObserver(function (entries) {
        inst.inView = entries[entries.length - 1].isIntersecting;
        sync();
      });
      inst.io.observe(wrap);
    }
    sync();

    return {
      destroy: function () { destroy(inst); },
      setPaused: function (flag) { inst.paused = !!flag; sync(); },
      setTheme: function (next) {
        inst.theme = normalizeTheme(next);
        inst.pal = buildPalette(inst.base.hue, inst.base.sat, inst.theme);
        if (inst.mode === 'fallback') {
          inst.fb.style.setProperty('--po-c0', inst.pal.css[0]);
          inst.fb.style.setProperty('--po-c1', inst.pal.css[1]);
          inst.fb.style.setProperty('--po-c2', inst.pal.css[2]);
        } else if (!isRunning(inst)) {
          drawStill(inst);
        }
      }
    };
  }

  function destroy(inst) {
    var at = instances.indexOf(inst);
    if (at === -1) return;
    instances.splice(at, 1);
    if (inst.io) { inst.io.disconnect(); inst.io = null; }
    if (inst.holdsGl) { inst.holdsGl = false; releaseShared(shared); }
    inst.mode = 'destroyed';
    if (inst.wrap.parentNode) inst.wrap.parentNode.removeChild(inst.wrap);
    if (!instances.length) removeGlobalListeners();
  }

  return {
    mount: mount,
    VARIANTS: VARIANT_NAMES.slice()
  };
}));

/*!
 * globe-orb.js — dotted-globe loading indicators. Dependency-free, UMD. v1.0.0
 *
 * Based on COBE (v2.0.1, commit 7e94076) by Shu Ding.
 *   Upstream:  https://github.com/shuding/cobe   (site: https://cobe.vercel.app/)
 *   Licence:   MIT
 *
 * COBE has no runtime dependencies (its package.json lists build tools only:
 * esbuild, glslx, terser, typescript, and the Next.js docs site), so nothing
 * else is vendored here. The land-mask texture below is COBE's src/texture.png,
 * inlined unchanged as a data URI, and the dot-lattice shader maths is COBE's.
 *
 * ---------------------------------------------------------------------------
 * MIT License
 *
 * Copyright (c) 2021 Shu Ding
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 * ---------------------------------------------------------------------------
 *
 * Adapted for orb-loaders: COBE's library is re-cut into a loader. The shaders
 * are hand-expanded from GLSLX (no build step), instancing and the DOM anchor
 * layer are dropped, all instances share one WebGL context (blitted to a 2D
 * canvas each, so a wall of globes never hits the browser's context limit),
 * the dot lattice is sized from the pixel size, markers gain pulse rings,
 * arcs gain a travelling head and tail, and five loader variants, theme
 * palettes, reduced-motion, pause-offscreen and a no-WebGL fallback are added.
 * See README.md, "Changes from upstream".
 *
 * Usage:
 *   GlobeOrb.mount(element, { variant: 'searching', size: 96, theme: 'auto' })
 *   -> returns { destroy() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GlobeOrb = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PI = Math.PI;
  var DEG = PI / 180;
  var VARIANTS = ['searching', 'connecting', 'syncing', 'idle', 'inline'];
  var LABELS = {
    searching: 'Searching', connecting: 'Connecting', syncing: 'Syncing',
    idle: 'Loading', inline: 'Loading'
  };
  var SMALL_MAX = 32;          // at or below this size the small tuning applies
  var MAX_DPR = 2;
  var MAX_FRAME_DT = 0.1;      // seconds; a resumed tab never jumps
  var MARKER_ELEVATION = 0.05;
  // Frame (seconds) painted when prefers-reduced-motion is set. Picked per
  // variant so the single still shows its idea: a pulse, wires, a wave.
  var STILL_T = { searching: 0.95, connecting: 2.1, syncing: 0.75, idle: 0, inline: 0.55 };

  // COBE src/texture.png (1024x512 land mask), unchanged.
  var TEXTURE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAACAAQAAAADMzoqnAAAECklEQVR42u3VsW4jRRzH8d94gzfF4Q0VQaC4vBLTRTp0mze4ggfAPAE5XQEFsGNAVIjwBrmW7h7gJE+giKjyABTZE4g06LKJETdRJvtD65kdz6yduKABiW+TVfzRf2bXYxtcE/59YJCz6YdbgQF6ACSRrwYKYImmh5PbwOewlV3wlQNbAN6SEExjUOO+BU0aCSnxReHABUlK4YFQeJeUT3da8IIkZ6NGoSnFY5KsMoVzMKfECUnqxgPYRArarmUCndHwzIEaQEpg5xVdBXROl8mpAQx5dUgPiHoYAAkg5w3JABR06byGAVgcRGAz5bznj6phBQNRFwyqgdxebH6gshJAesWoFhgYpApAFoG8BIZ/fEhSox5jDjQXmV0Ar5XJfAIrALi3URVs09gHIL4XJCkLC5LH9JWiArABFCSrQjdgkBzRJ0WJeUOSNyQAfJJwUSWUBRlJQ8oGHATACGlBynnzy2kEYLNjrxouigD8BZcgOeVPqh12RtufaCN5wCPVDpvQ9lsIrqndsJtDcWqBCpf4hWN7OdWHBw58FwIaNOU/n1TpMW2DFaD48cmr4185T8NHkpUFX749pQPVdgRKC/DGoQPVeAEKv+WHvY8OOWNTPRp5kHuwSf8wzXtVBKR7YwEH9H3lQUaypUfSATOALyVNu5vZJW31Bnx98nkLfDUWJaz6ixvm+RIQRdl3kmRxxiaDoGnZW4CpPfkaQadlcPim1xOSvETQo7Lv75enVAXJ3xGUlony4KQBBWUM1NiDc6qhyS8RgQs18OCMMtPDaAUIyg0PZkRWDqs+wnKJBTDI1Js6BolegOsKmUxNDBAAKqQyMQmidhegBlLZ+wwKYdv5M/8x1khkb1cgKqP2H+MKyV5vS+whrE8DQDgAlUAoRBX056EElJCjJVACeJBZgNfVp+iCCm4RBWCgKsRxASSA9KgDhDtCiTuMyfHsKXzhC6wNAIjjWb8LKAOA2ctk3FmCOlgKFy8f1N0JJtgsxinYnVAHt4t3gPzZXSCTyCWCQmBT91QE3B5yarSN40dNHYPka4TlDhTUI8zLvl0JSL3vZn6DsCFZOeB2yROEpR68sECQQA++xIGCR2X7DwlEoLRgUrZrqlUg50S1uy43YqDcN6UFBVkhAjWiCV2Q0jgQPdplMKxvBXodcOfAwJYvgdL+1etA1YJJfBcZlQV7sO1i2gHoNiyxtQ5sBsCgWyoxCHiFFd2L5nUTCqMAqGUgsQ9f5kCcCiZgRYkMgMTd5WsB1rTzj0Em14BE4r+QxN1lCEsVur2PoF5Wbg8RJXR4djgvBgauhLywoEZQrt1KKRdVS4CdlJ8qafyP+9KIj/nE/d7kKwH9jgS72e9DV+kvfTWgct4ZyP8Byb8BPG7MaaIIkAQAAAAASUVORK5CYII=';

  /* ============================================================== shaders */
  // Hand-expanded from COBE's .glslx sources: the stage entry points are
  // `main`, `sample` is renamed (reserved in newer GLSL), and every uniform is
  // set per draw call rather than per instance.

  var VERT_QUAD = [
    'attribute vec2 aPosition;',
    'void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }'
  ].join('\n');

  // Dot-lattice globe: COBE's nearestFibonacciLattice, with a sized dot radius,
  // an anti-aliased silhouette, a translucent body and a rim/halo.
  var FRAG_GLOBE = [
    'precision highp float;',
    'uniform vec2 uResolution;',
    'uniform vec2 rotation;',      // (phi, theta)
    'uniform float dots;',
    'uniform float dotR;',         // dot radius, unit-sphere chord
    'uniform float scale;',
    'uniform float diffuse;',
    'uniform float mapBase;',      // brightness of ocean dots
    'uniform vec3 bodyCol;',
    'uniform vec3 dotCol;',
    'uniform vec3 glowCol;',
    'uniform vec4 params;',        // (bodyAlpha, dotFloor, rimAlpha, haloAlpha)
    'uniform sampler2D uTexture;',
    'const float sqrt5 = 2.236068;',
    'const float PI = 3.141593;',
    'const float kTau = 6.283185;',
    'const float kPhi = 1.618034;',
    'const float r = 0.8;',
    'float byDots;',
    'mat3 rotate(float theta, float phi) {',
    '  float cx = cos(theta); float cy = cos(phi);',
    '  float sx = sin(theta); float sy = sin(phi);',
    '  return mat3(cy, sy * sx, -sy * cx, 0.0, cx, sx, sy, cy * -sx, cy * cx);',
    '}',
    'vec3 nearestFibonacciLattice(vec3 p, out float m) {',
    '  p = p.xzy;',
    '  float k = max(2.0, floor(log2(sqrt5 * dots * PI * (1.0 - p.z * p.z)) * 0.72021));',
    '  vec2 f = floor(pow(kPhi, k) / sqrt5 * vec2(1.0, kPhi) + 0.5);',
    '  vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;',
    '  vec2 br2 = -2.0 * f;',
    '  vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);',
    '  vec2 c = floor(vec2(br2.y * sp.x - br1.y * (sp.y * dots + 1.0), -br2.x * sp.x + br1.x * (sp.y * dots + 1.0)) / (br1.x * br2.y - br2.x * br1.y));',
    '  float mindist = PI;',
    '  vec3 minip;',
    '  for (float s = 0.0; s < 4.0; s += 1.0) {',
    '    vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));',
    '    float idx = dot(f, c + o);',
    '    if (idx > dots) continue;',
    '    float a = idx; float b = 0.0;',
    '    if (a >= 16384.0) { a -= 16384.0; b += 0.868872; }     if (a >= 8192.0) { a -= 8192.0; b += 0.934436; }     if (a >= 4096.0) { a -= 4096.0; b += 0.467218; }     if (a >= 2048.0) { a -= 2048.0; b += 0.733609; }',
    '    if (a >= 1024.0) { a -= 1024.0; b += 0.866804; }     if (a >= 512.0) { a -= 512.0; b += 0.433402; }     if (a >= 256.0) { a -= 256.0; b += 0.216701; }     if (a >= 128.0) { a -= 128.0; b += 0.108351; }',
    '    if (a >= 64.0) { a -= 64.0; b += 0.554175; }     if (a >= 32.0) { a -= 32.0; b += 0.777088; }     if (a >= 16.0) { a -= 16.0; b += 0.888544; }     if (a >= 8.0) { a -= 8.0; b += 0.944272; }',
    '    if (a >= 4.0) { a -= 4.0; b += 0.472136; }     if (a >= 2.0) { a -= 2.0; b += 0.236068; }     if (a >= 1.0) { a -= 1.0; b += 0.618034; }',
    '    float theta = fract(b) * kTau;',
    '    float cosphi = 1.0 - 2.0 * idx * byDots;',
    '    float sinphi = sqrt(1.0 - cosphi * cosphi);',
    '    vec3 pt = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);',
    '    float dist = length(p - pt);',
    '    if (dist < mindist) { mindist = dist; minip = pt; }',
    '  }',
    '  m = mindist;',
    '  return minip.xzy;',
    '}',
    'void main() {',
    '  byDots = 1.0 / dots;',
    '  vec2 invRes = 1.0 / uResolution;',
    '  vec2 uv = ((gl_FragCoord.xy * invRes) * 2.0 - 1.0) / scale;',
    '  uv.x *= uResolution.x * invRes.y;',
    '  float uvPx = 2.0 / (scale * uResolution.y);',   // uv units per device pixel
    '  float l = dot(uv, uv);',
    '  float rr = sqrt(l);',
    '  vec4 col = vec4(0.0);',
    '  if (rr <= r + uvPx) {',
    '    float edge = clamp((r - rr) / uvPx + 0.5, 0.0, 1.0);',
    '    float dis;',
    '    vec3 p = normalize(vec3(uv, sqrt(max(r * r - l, 0.0))));',
    '    float dotNL = p.z;',
    '    vec3 gP = nearestFibonacciLattice(p * rotate(rotation.y, rotation.x), dis);',
    '    float gPhi = asin(clamp(gP.y, -1.0, 1.0));',
    '    float gTheta = acos(clamp(-gP.x / max(cos(gPhi), 0.0001), -1.0, 1.0));',
    '    if (gP.z < 0.0) gTheta = -gTheta;',
    '    float land = max(texture2D(uTexture, vec2((gTheta * 0.5) / PI, -(gPhi / PI + 0.5))).x, mapBase);',
    '    float pxChord = uvPx / r;',
    '    float cov = land * (1.0 - smoothstep(max(dotR - 0.6 * pxChord, 0.0), dotR + 0.6 * pxChord, dis));',
    '    float dotA = cov * (params.y + (1.0 - params.y) * pow(max(dotNL, 0.0), diffuse));',
    '    float bodyA = params.x * (0.5 + 0.5 * dotNL);',
    '    float rim = pow(1.0 - dotNL, 3.0) * params.z;',
    '    float rest = 1.0 - dotA;',
    '    vec3 rgb = dotCol * dotA + (bodyCol * bodyA + glowCol * rim) * rest;',
    '    float a = dotA + (bodyA + rim) * rest;',
    '    col = vec4(rgb, min(a, 1.0)) * edge;',
    '  }',
    '  float g = 0.0;',
    '  if (l > r * r) {',
    '    float od = sqrt(0.2 / (l - r * r));',
    '    g = smoothstep(0.5, 1.0, od / (od + 1.0)) * params.w;',
    '  }',
    '  gl_FragColor = col + vec4(glowCol * g, g) * (1.0 - col.a);',
    '}'
  ].join('\n');

  var VERT_MARKER = [
    'attribute vec2 aPosition;',
    'uniform float phi; uniform float theta;',
    'uniform vec2 uResolution; uniform float scale;',
    'uniform vec3 uPos; uniform float uExtent;',
    'varying vec2 vUV; varying float vVis; varying float vAA;',
    'void main() {',
    '  float cx = cos(theta); float sx = sin(theta);',
    '  float cy = cos(phi); float sy = sin(phi);',
    '  vec3 p = uPos * (0.8 + ' + MARKER_ELEVATION + ');',
    '  vec3 rp = vec3(cy * p.x + sy * p.z,',
    '    sy * sx * p.x + cx * p.y - cy * sx * p.z,',
    '    -sy * cx * p.x + sx * p.y + cy * cx * p.z);',
    '  float rad = length(rp.xy);',
    '  if (rp.z < 0.0 && rad < 0.8) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); vUV = vec2(0.0); vVis = 0.0; vAA = 0.0; return; }',
    '  vVis = smoothstep(-0.02, 0.18, rp.z) * (1.0 - smoothstep(0.58, 0.8, rad));',
    '  vec2 pos = (rp.xy + aPosition * uExtent) * vec2(uResolution.y / uResolution.x, 1.0) * scale;',
    '  gl_Position = vec4(pos, 0.0, 1.0);',
    '  vUV = aPosition;',
    '  vAA = 1.0 / (uExtent * scale * uResolution.y * 0.5);',
    '}'
  ].join('\n');

  // A filled core, a soft halo and one expanding ring (uRing 0..1, <0 = none).
  var FRAG_MARKER = [
    'precision highp float;',
    'varying vec2 vUV; varying float vVis; varying float vAA;',
    'uniform vec3 uColor; uniform float uCore; uniform float uRing; uniform float uAlpha;',
    'void main() {',
    '  float d = length(vUV);',
    '  float aa = vAA;',
    '  float a = 1.0 - smoothstep(uCore - aa, uCore + aa, d);',
    '  float halo = (1.0 - smoothstep(uCore, uCore * 2.6, d)) * 0.3;',
    '  a = max(a, halo);',
    '  if (uRing >= 0.0) {',
    '    float rr = mix(uCore, 0.96, uRing);',
    '    float hw = max(0.05, aa * 1.1);',
    '    float fade = (1.0 - uRing) * (1.0 - uRing);',
    '    float ring = (1.0 - smoothstep(hw - aa, hw + aa, abs(d - rr))) * fade * 0.9;',
    '    a = a + ring * (1.0 - a);',
    '  }',
    '  a *= uAlpha * vVis;',
    '  gl_FragColor = vec4(uColor * a, a);',
    '}'
  ].join('\n');

  var VERT_ARC = [
    'attribute vec2 aPosition;',    // (t along the arc, side -1..1)
    'uniform float phi; uniform float theta;',
    'uniform vec2 uResolution; uniform float scale;',
    'uniform vec3 uFrom; uniform vec3 uTo; uniform float uHeight; uniform float uWidth;',
    'varying float vT; varying float vSide; varying float vDepth; varying float vRad;',
    'mat3 rotate(float theta, float phi) {',
    '  float cx = cos(theta); float cy = cos(phi);',
    '  float sx = sin(theta); float sy = sin(phi);',
    '  return mat3(cy, sy * sx, -sy * cx, 0.0, cx, sx, sy, cy * -sx, cy * cx);',
    '}',
    'void main() {',
    '  mat3 rot = rotate(theta, phi);',
    '  float endR = 0.8 + ' + MARKER_ELEVATION + ';',
    '  vec3 from = uFrom * endR; vec3 to = uTo * endR;',
    '  vec3 midSum = uFrom + uTo;',
    '  float midLen = length(midSum);',
    '  vec3 midDir = midLen > 0.001 ? midSum / midLen : vec3(0.0, 1.0, 0.0);',
    '  vec3 mid = midDir * (0.8 + uHeight);',
    '  float t = aPosition.x; float u = 1.0 - t;',
    '  vec3 pt = u * u * from + 2.0 * u * t * mid + t * t * to;',
    '  vec3 tan = 2.0 * u * (mid - from) + 2.0 * t * (to - mid);',
    '  vec3 rpt = rot * pt;',
    '  vec2 st = (rot * tan).xy;',
    '  float stl = length(st);',
    '  vec2 perp = stl > 0.001 ? vec2(-st.y, st.x) / stl : vec2(1.0, 0.0);',
    '  vec2 base = rpt.xy * vec2(uResolution.y / uResolution.x, 1.0) * scale;',
    '  gl_Position = vec4(base + perp * uWidth * aPosition.y * scale, 0.0, 1.0);',
    '  vT = t; vSide = aPosition.y; vDepth = rpt.z; vRad = length(rpt.xy);',
    '}'
  ].join('\n');

  // Visible between uTail and uHead along the arc; uTrail fades the tail end.
  var FRAG_ARC = [
    'precision highp float;',
    'varying float vT; varying float vSide; varying float vDepth; varying float vRad;',
    'uniform vec3 uColor; uniform float uHead; uniform float uTail; uniform float uTrail;',
    'void main() {',
    '  if (vDepth < 0.0 && vRad < 0.8) discard;',
    '  if (vT > uHead || vT < uTail) discard;',
    '  float s = (vT - uTail) / max(uHead - uTail, 0.0001);',
    '  float a = mix(1.0, 0.12 + 0.88 * s * s, uTrail);',
    '  a *= 1.0 - smoothstep(0.6, 1.0, abs(vSide));',
    '  gl_FragColor = vec4(uColor * a, a);',
    '}'
  ].join('\n');

  /* ============================================================ GL core */
  // One WebGL context for every globe on the page. Each instance renders into
  // the corner of the shared canvas, then copies its pixels to its own 2D
  // canvas. Browsers cap live WebGL contexts (~16); this never approaches it.

  var ARC_SEGMENTS = 32;
  var QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  var core = null;

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null; }
    return sh;
  }

  function program(gl, vs, fs, uniforms) {
    var v = compile(gl, gl.VERTEX_SHADER, vs);
    var f = compile(gl, gl.FRAGMENT_SHADER, fs);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPosition');
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { gl.deleteProgram(p); return null; }
    var u = {};
    for (var i = 0; i < uniforms.length; i++) u[uniforms[i]] = gl.getUniformLocation(p, uniforms[i]);
    return { p: p, u: u };
  }

  function createCore() {
    var canvas = document.createElement('canvas');
    var gl = null;
    try {
      gl = canvas.getContext('webgl', {
        alpha: true, antialias: false, depth: false, stencil: false,
        premultipliedAlpha: true, preserveDrawingBuffer: false
      });
    } catch (e) { gl = null; }
    if (!gl) return null;

    var globe = program(gl, VERT_QUAD, FRAG_GLOBE, ['uResolution', 'rotation', 'dots', 'dotR',
      'scale', 'diffuse', 'mapBase', 'bodyCol', 'dotCol', 'glowCol', 'params', 'uTexture']);
    var marker = program(gl, VERT_MARKER, FRAG_MARKER, ['phi', 'theta', 'uResolution', 'scale',
      'uPos', 'uExtent', 'uColor', 'uCore', 'uRing', 'uAlpha']);
    var arc = program(gl, VERT_ARC, FRAG_ARC, ['phi', 'theta', 'uResolution', 'scale', 'uFrom',
      'uTo', 'uHeight', 'uWidth', 'uColor', 'uHead', 'uTail', 'uTrail']);
    if (!globe || !marker || !arc) return null;

    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

    var strip = new Float32Array((ARC_SEGMENTS + 1) * 4);
    for (var i = 0; i <= ARC_SEGMENTS; i++) {
      var t = i / ARC_SEGMENTS;
      strip.set([t, -1, t, 1], i * 4);
    }
    var arcBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, arcBuf);
    gl.bufferData(gl.ARRAY_BUFFER, strip, gl.STATIC_DRAW);

    // 1x1 black until the land mask decodes, then the real thing.
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    var c = {
      canvas: canvas, gl: gl, globe: globe, marker: marker, arc: arc,
      quadBuf: quadBuf, arcBuf: arcBuf, tex: tex,
      refs: 0, ready: false, waiting: [], image: new Image()
    };
    c.image.onload = function () {
      if (gl.isContextLost()) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, c.image);
      c.ready = true;
      var cbs = c.waiting;
      c.waiting = [];
      for (var k = 0; k < cbs.length; k++) cbs[k]();
    };
    c.image.src = TEXTURE;
    return c;
  }

  function acquireCore() {
    if (core && core.gl.isContextLost()) disposeCore(core);
    if (!core) core = createCore();
    if (core) core.refs++;
    return core;
  }

  function releaseCore(c) {
    if (!c) return;
    c.refs--;
    if (c.refs <= 0) disposeCore(c);
  }

  function disposeCore(c) {
    c.image.onload = null;
    var ext = c.gl.getExtension('WEBGL_lose_context');
    if (ext && !c.gl.isContextLost()) ext.loseContext();
    c.canvas.width = c.canvas.height = 1;
    if (core === c) core = null;
  }

  function growCore(c, w, h) {
    if (c.canvas.width >= w && c.canvas.height >= h) return;
    c.canvas.width = Math.max(c.canvas.width, w);
    c.canvas.height = Math.max(c.canvas.height, h);
  }

  function setupQuad(gl, buf) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  // Draws one frame of `sc` (scene) into the corner of the shared canvas.
  // Returns false if the context is gone.
  function render(c, sc, pal, cfg, w, h) {
    var gl = c.gl;
    if (gl.isContextLost()) return false;
    growCore(c, w, h);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // outputs are premultiplied

    // globe
    var g = c.globe;
    gl.useProgram(g.p);
    setupQuad(gl, c.quadBuf);
    gl.uniform2f(g.u.uResolution, w, h);
    gl.uniform2f(g.u.rotation, sc.phi, sc.theta);
    gl.uniform1f(g.u.dots, cfg.dots);
    gl.uniform1f(g.u.dotR, cfg.dotR);
    gl.uniform1f(g.u.scale, cfg.scale);
    gl.uniform1f(g.u.diffuse, cfg.diffuse);
    gl.uniform1f(g.u.mapBase, cfg.mapBase);
    gl.uniform3f(g.u.bodyCol, pal.body[0], pal.body[1], pal.body[2]);
    gl.uniform3f(g.u.dotCol, pal.dot[0], pal.dot[1], pal.dot[2]);
    gl.uniform3f(g.u.glowCol, pal.glow[0], pal.glow[1], pal.glow[2]);
    gl.uniform4f(g.u.params, pal.bodyAlpha, cfg.dotFloor, pal.rim, pal.halo * cfg.haloMul * sc.haloMul);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, c.tex);
    gl.uniform1i(g.u.uTexture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // arcs
    var a = c.arc;
    if (sc.nArcs > 0) {
      gl.useProgram(a.p);
      setupQuad(gl, c.arcBuf);
      gl.uniform1f(a.u.phi, sc.phi);
      gl.uniform1f(a.u.theta, sc.theta);
      gl.uniform2f(a.u.uResolution, w, h);
      gl.uniform1f(a.u.scale, cfg.scale);
      gl.uniform3f(a.u.uColor, pal.arc[0], pal.arc[1], pal.arc[2]);
      gl.uniform1f(a.u.uWidth, cfg.arcWidth);
      for (var i = 0; i < sc.nArcs; i++) {
        var ar = sc.arcs[i];
        if (ar.head <= ar.tail) continue;
        gl.uniform3f(a.u.uFrom, ar.fx, ar.fy, ar.fz);
        gl.uniform3f(a.u.uTo, ar.tx, ar.ty, ar.tz);
        gl.uniform1f(a.u.uHeight, ar.height);
        gl.uniform1f(a.u.uHead, ar.head);
        gl.uniform1f(a.u.uTail, ar.tail);
        gl.uniform1f(a.u.uTrail, ar.trail);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (ARC_SEGMENTS + 1) * 2);
      }
    }

    // markers
    var m = c.marker;
    if (sc.nMarkers > 0) {
      gl.useProgram(m.p);
      setupQuad(gl, c.quadBuf);
      gl.uniform1f(m.u.phi, sc.phi);
      gl.uniform1f(m.u.theta, sc.theta);
      gl.uniform2f(m.u.uResolution, w, h);
      gl.uniform1f(m.u.scale, cfg.scale);
      gl.uniform3f(m.u.uColor, pal.marker[0], pal.marker[1], pal.marker[2]);
      gl.uniform1f(m.u.uExtent, cfg.markerExtent);
      for (var j = 0; j < sc.nMarkers; j++) {
        var mk = sc.markers[j];
        if (mk.alpha <= 0.002) continue;
        gl.uniform3f(m.u.uPos, mk.x, mk.y, mk.z);
        gl.uniform1f(m.u.uCore, mk.core * cfg.coreFrac);
        gl.uniform1f(m.u.uRing, mk.ring);
        gl.uniform1f(m.u.uAlpha, mk.alpha);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }
    }
    return true;
  }

  /* ============================================================== palette */
  // Generic slate-indigo globe with a warm marker; arcs in violet. Light:
  // deep ink dots on a pale body (7+:1). Dark: pale dots on a dim blue body.

  function hex(h) {
    var s = h.charAt(0) === '#' ? h.slice(1) : h;
    if (s.length === 3) s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
    return [parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255];
  }

  var PALETTES = {
    light: {
      body: hex('#b3c1f2'), bodyAlpha: 0.5, dot: hex('#27346e'), glow: hex('#5a70d6'),
      rim: 0.5, halo: 0.24, marker: hex('#d9480f'), arc: hex('#6d28d9'),
      css: { dot: '#27346e', rim: 'rgba(106,130,230,.45)' }
    },
    dark: {
      body: hex('#36447a'), bodyAlpha: 0.4, dot: hex('#b9c8ff'), glow: hex('#6e86ff'),
      rim: 0.34, halo: 0.3, marker: hex('#ffb347'), arc: hex('#c4b5fd'),
      css: { dot: '#b9c8ff', rim: 'rgba(110,134,255,.55)' }
    }
  };

  var HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

  function themeNow() {
    if (typeof window !== 'undefined' && window.OrbTheme && window.OrbTheme.current) {
      return window.OrbTheme.current() === 'dark' ? 'dark' : 'light';
    }
    var mq = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    return mq && mq.matches ? 'dark' : 'light';
  }

  // Palette for a theme, with the optional accent override applied.
  function resolvePalette(theme, color) {
    var base = PALETTES[theme];
    if (!color || !HEX_RE.test(color)) return base;
    var out = {};
    for (var k in base) out[k] = base[k];
    out.marker = hex(color);
    out.arc = hex(color);
    return out;
  }

  /* ============================================================== helpers */

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function pmod(a, n) { return ((a % n) + n) % n; }
  function outCubic(x) { var u = 1 - x; return 1 - u * u * u; }
  function inOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function outBack(x) { var c1 = 1.70158, c3 = c1 + 1, u = x - 1; return 1 + c3 * u * u * u + c1 * u * u; }

  // Point at the middle of the screen for a given rotation (checked against
  // COBE's rotation matrix): latitude = theta, longitude = 270deg - phi.
  function frontLon(phi) { return 270 - phi / DEG; }

  function place(o, lat, lon) {
    var la = lat * DEG, lo = lon * DEG - PI, c = Math.cos(la);
    o.x = -c * Math.cos(lo);
    o.y = Math.sin(la);
    o.z = c * Math.sin(lo);
  }

  // core: 1 = the variant's base core radius; ring: 0..1 progress, <0 = no ring
  function newMarker() { return { x: 0, y: 0, z: 0, core: 0, ring: -1, alpha: 0 }; }

  function newArc() {
    return { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0, height: 0, head: 0, tail: 0, trail: 0 };
  }

  function setArc(ar, a, b) {
    var f = { x: 0, y: 0, z: 0 }, t = { x: 0, y: 0, z: 0 };
    place(f, a[0], a[1]);
    place(t, b[0], b[1]);
    ar.fx = f.x; ar.fy = f.y; ar.fz = f.z;
    ar.tx = t.x; ar.ty = t.y; ar.tz = t.z;
    var chord = Math.sqrt((f.x - t.x) * (f.x - t.x) + (f.y - t.y) * (f.y - t.y) + (f.z - t.z) * (f.z - t.z));
    ar.height = 0.06 + chord * 0.26;     // longer hops arch higher
  }

  /* ============================================================ variants */
  // Each variant builds a scene and returns step(scene, t). A scene is mutated
  // in place every frame; step() allocates nothing.

  function newScene(nMarkers, nArcs) {
    var sc = { phi: 0, theta: 0, haloMul: 1, nMarkers: nMarkers, nArcs: nArcs, markers: [], arcs: [] };
    for (var i = 0; i < nMarkers; i++) sc.markers.push(newMarker());
    for (var j = 0; j < nArcs; j++) sc.arcs.push(newArc());
    return sc;
  }

  // slow spin, a marker lands somewhere new each cycle and pings twice
  var SEARCH_CYCLE = 2.1;
  var SEARCH_OMEGA = 0.34;
  var SEARCH_SPOTS = [[6, -4], [-12, 16], [18, 22], [-4, -18], [14, 6], [-18, -6]];

  function buildSearching(small) {
    var sc = newScene(2, 0);
    var cycle = small ? 1.5 : SEARCH_CYCLE;
    var omega = small ? 0.8 : SEARCH_OMEGA;
    var last = -1;
    sc.step = function (s, t) {
      s.phi = 4.4 + omega * t;
      s.theta = 0.3;
      var k = Math.floor(t / cycle);
      var u = t / cycle - k;
      var a = s.markers[0], b = s.markers[1];
      if (k !== last) {
        last = k;
        var spot = SEARCH_SPOTS[pmod(k, SEARCH_SPOTS.length)];
        var midPhi = 4.4 + omega * (k + 0.5) * cycle;
        place(a, 0.3 / DEG + (small ? 0 : spot[0]), frontLon(midPhi) + (small ? 0 : spot[1]));
        b.x = a.x; b.y = a.y; b.z = a.z;
      }
      var fadeOut = u > 0.78 ? 1 - inOutCubic((u - 0.78) / 0.22) : 1;
      a.core = outBack(clamp01(u / 0.2));
      a.alpha = fadeOut * clamp01(u / 0.06);
      var r1 = (u - 0.08) / 0.62, r2 = (u - 0.34) / 0.62;
      a.ring = r1 <= 0 || r1 >= 1 ? -1 : outCubic(r1);
      b.core = 0.05;
      b.alpha = fadeOut;
      b.ring = small || r2 <= 0 || r2 >= 1 ? -1 : outCubic(r2);
    };
    return sc;
  }

  // five nodes wired in a loop; each hop draws on, holds, then retracts
  var NODES = [[30, -34], [-8, -12], [26, 22], [-24, 36], [10, 68]];
  var CONNECT_PERIOD = 4.0;
  var CONNECT_STAGGER = 0.8;
  var CONNECT_ARRIVE = 0.22;

  function buildConnecting() {
    var sc = newScene(NODES.length, NODES.length);
    for (var i = 0; i < NODES.length; i++) {
      place(sc.markers[i], NODES[i][0], NODES[i][1]);
      setArc(sc.arcs[i], NODES[i], NODES[(i + 1) % NODES.length]);
    }
    // The reduced-motion still: every hop drawn in full, every node at rest.
    sc.settle = function (s) {
      for (var k = 0; k < NODES.length; k++) {
        var ar = s.arcs[k], m = s.markers[k];
        ar.head = 1; ar.tail = 0; ar.trail = 0;
        m.ring = -1; m.core = 0.85; m.alpha = 1;
      }
    };
    sc.step = function (s, t) {
      s.phi = 4.363 + 0.3 * Math.sin(t * 0.5);
      s.theta = 0.2;
      for (var k = 0; k < NODES.length; k++) {
        var u = pmod(t - k * CONNECT_STAGGER, CONNECT_PERIOD) / CONNECT_PERIOD;
        var ar = s.arcs[k];
        ar.trail = 1;
        ar.head = inOutCubic(clamp01(u / CONNECT_ARRIVE));
        ar.tail = inOutCubic(clamp01((u - 0.3) / 0.22));
        // the node this hop lands on answers with a ping
        var m = s.markers[(k + 1) % NODES.length];
        var sinceArrival = pmod(t - k * CONNECT_STAGGER - CONNECT_ARRIVE * CONNECT_PERIOD, CONNECT_PERIOD);
        var p = sinceArrival / 1.1;
        m.ring = p < 1 ? outCubic(p) : -1;
        m.core = 0.85 * (1 + 0.5 * Math.max(0, 1 - sinceArrival / 0.5));
        m.alpha = 0.7 + 0.3 * Math.max(0, 1 - sinceArrival / 0.9);
      }
    };
    return sc;
  }

  // ten markers around the equator belt, pulsing one after another
  var SYNC_N = 10;
  var SYNC_PERIOD = 3.0;
  var SYNC_LATS = [18, -12, 6, -24, 24, -6, 14, -20, 2, 22];

  function buildSyncing() {
    var sc = newScene(SYNC_N, 0);
    for (var i = 0; i < SYNC_N; i++) place(sc.markers[i], SYNC_LATS[i], i * (360 / SYNC_N));
    sc.step = function (s, t) {
      s.phi = 4.4 + 0.24 * t;
      s.theta = 0.28;
      for (var i = 0; i < SYNC_N; i++) {
        var ph = pmod(t / SYNC_PERIOD - (SYNC_N - 1 - i) / SYNC_N, 1);
        var m = s.markers[i];
        var bump = ph < 0.3 ? Math.sin(PI * ph / 0.3) : 0;
        m.core = 0.75 * (1 + 0.9 * outCubic(bump));
        m.alpha = 0.5 + 0.5 * bump;
        m.ring = ph < 0.55 ? outCubic(ph / 0.55) : -1;
      }
    };
    return sc;
  }

  // no markers: a slow turn, a tilt that drifts, a halo that breathes
  function buildIdle() {
    var sc = newScene(0, 0);
    sc.step = function (s, t) {
      s.phi = 4.4 + 0.11 * t;
      s.theta = 0.38 + 0.05 * Math.sin(t * 0.35);
      s.haloMul = 0.85 + 0.15 * Math.sin(t * 0.9);
    };
    return sc;
  }

  function buildScene(variant, small) {
    if (variant === 'connecting') return buildConnecting();
    if (variant === 'syncing') return buildSyncing();
    if (variant === 'idle') return buildIdle();
    return buildSearching(small);      // searching, inline
  }

  /* ============================================================== config */

  // Everything that depends on pixel size: dot count and radius from a target
  // pitch in CSS px, marker and arc sizes from px, then into shader units.
  function makeConfig(size, small) {
    var scale = small ? 1.25 : 1.14;
    var radiusPx = 0.4 * scale * size;               // projected globe radius
    var pitchPx = small ? 2.5 : size <= 64 ? 2.9 : 3.3;
    var pitch = pitchPx / radiusPx;
    var dots = Math.max(60, Math.min(9000, Math.round(4 * PI / (pitch * pitch))));
    var corePx = small ? 2.1 : Math.max(2.2, size * 0.032);
    var extentPx = corePx * (small ? 3.6 : 4.6);
    var unitPx = scale * size / 2;                   // px per sphere unit
    var arcPx = small ? 1.1 : Math.max(1.5, size * 0.02);
    return {
      scale: scale,
      dots: dots,
      dotR: pitch * (small ? 0.36 : 0.3),
      mapBase: small ? 0.3 : 0.14,
      diffuse: small ? 0.5 : 0.8,
      dotFloor: small ? 0.6 : 0.3,
      haloMul: small ? 0 : 1,
      markerExtent: extentPx / unitPx,
      coreFrac: corePx / extentPx,
      arcWidth: arcPx / (scale * size)
    };
  }

  /* ============================================================ fallback */
  // No WebGL: a dotted disc, drifting sideways. Plain CSS, no canvas.

  function buildFallback(size, pal, animate) {
    var el = document.createElement('div');
    var pitch = Math.max(4, Math.round(size / 9));
    var dot = Math.max(1, Math.round(pitch * 0.28));
    el.style.cssText = 'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
      'background-size:' + pitch + 'px ' + pitch + 'px;';
    paintFallback(el, pal, dot);
    var anim = null;
    if (animate && el.animate) {
      anim = el.animate(
        [{ backgroundPosition: '0px 0px' }, { backgroundPosition: pitch * 4 + 'px 0px' }],
        { duration: 12000, iterations: Infinity }
      );
    }
    return { el: el, dot: dot, anim: anim };
  }

  function paintFallback(el, pal, dot) {
    var fg = pal.css.dot;
    el.style.backgroundImage = 'radial-gradient(circle, ' + fg + ' ' + dot + 'px, transparent ' + (dot + 0.6) + 'px)';
    el.style.boxShadow = 'inset 0 0 0 1px ' + pal.css.rim;
  }

  /* ============================================================== mount */

  function clampSize(n) {
    var v = Math.round(Number(n));
    return isFinite(v) && v >= 8 ? Math.min(v, 1024) : 64;
  }

  function mount(host, opts) {
    if (!host || host.nodeType !== 1) throw new TypeError('GlobeOrb.mount: host must be an element');
    opts = opts || {};
    var variant = VARIANTS.indexOf(opts.variant) >= 0 ? opts.variant : 'searching';
    var size = clampSize(opts.size);
    var small = size <= SMALL_MAX || variant === 'inline';
    var speed = opts.speed > 0 ? Number(opts.speed) : 1;
    var themeOpt = opts.theme === 'light' || opts.theme === 'dark' ? opts.theme : 'auto';
    var theme = themeOpt === 'auto' ? themeNow() : themeOpt;
    var accent = opts.color;
    var pal = resolvePalette(theme, accent);

    var wrap = document.createElement('div');
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', opts.label || LABELS[variant]);
    wrap.style.cssText = 'display:inline-block;position:relative;line-height:0;flex:none;' +
      'width:' + size + 'px;height:' + size + 'px;';

    var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var reduced = !!(mq && mq.matches);

    var c = acquireCore();
    var cfg = makeConfig(size, small);
    var sc = buildScene(variant, small);
    var cv = null, ctx = null, W = 0, H = 0, fb = null;

    if (c) {
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      var rs = Math.min(Math.max(dpr, size <= 48 ? 2 : 1), MAX_DPR);   // small globes are drawn at 2x and downsampled
      W = H = Math.round(size * rs);
      cv = document.createElement('canvas');
      cv.width = W;
      cv.height = H;
      cv.style.cssText = 'display:block;width:' + size + 'px;height:' + size + 'px;';
      ctx = cv.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      wrap.appendChild(cv);
    }
    host.appendChild(wrap);

    var destroyed = false, visible = true, raf = 0, t = 0, last = 0;
    var io = null;

    function drawFrame(time, settled) {
      sc.step(sc, time);
      if (settled && sc.settle) sc.settle(sc);
      if (!render(c, sc, pal, cfg, W, H)) { toFallback(); return; }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(c.canvas, 0, c.canvas.height - H, W, H, 0, 0, W, H);
    }

    function toFallback() {
      stop();
      if (cv) { wrap.removeChild(cv); cv = null; ctx = null; }
      if (c) { releaseCore(c); c = null; }
      if (!fb) {
        fb = buildFallback(size, pal, !reduced);
        wrap.appendChild(fb.el);
      }
    }

    function frame(now) {
      raf = 0;
      if (!last) last = now;
      t += Math.min((now - last) / 1000, MAX_FRAME_DT) * speed;
      last = now;
      drawFrame(t);
      if (c) raf = requestAnimationFrame(frame);
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    }

    function shouldRun() { return !destroyed && visible && !document.hidden && !reduced && c; }

    function sync() {
      if (shouldRun()) { if (!raf) raf = requestAnimationFrame(frame); }
      else stop();
    }

    function still() {
      if (c && !destroyed) drawFrame(STILL_T[variant] || 0, true);
    }

    function redrawIfIdle() {
      if (!raf) { if (reduced) still(); else if (c) drawFrame(t); }
    }

    function onVisibility() { sync(); }
    function onMotion() {
      reduced = !!(mq && mq.matches);
      if (fb && fb.anim) { if (reduced) fb.anim.pause(); else fb.anim.play(); }
      sync();
      if (reduced) still();
    }
    function onTheme() {
      theme = themeNow();
      pal = resolvePalette(theme, accent);
      if (fb) paintFallback(fb.el, pal, fb.dot);
      redrawIfIdle();
    }

    if (c) {
      if (!c.ready) c.waiting.push(redrawIfIdle);
      if (typeof IntersectionObserver === 'function') {
        io = new IntersectionObserver(function (entries) {
          visible = entries[entries.length - 1].isIntersecting;
          sync();
        });
        io.observe(wrap);
        visible = false;     // the first observer callback reports the real state
      }
      document.addEventListener('visibilitychange', onVisibility);
      if (mq && mq.addEventListener) mq.addEventListener('change', onMotion);
      if (themeOpt === 'auto') window.addEventListener('themechange', onTheme);
      if (reduced) still(); else { drawFrame(0); sync(); }
    } else {
      fb = buildFallback(size, pal, !reduced);
      wrap.appendChild(fb.el);
      if (mq && mq.addEventListener) mq.addEventListener('change', onMotion);
      if (themeOpt === 'auto') window.addEventListener('themechange', onTheme);
    }

    return {
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        stop();
        if (io) io.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMotion);
        window.removeEventListener('themechange', onTheme);
        if (fb && fb.anim) fb.anim.cancel();
        if (c) { releaseCore(c); c = null; }
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      }
    };
  }

  return { mount: mount, VARIANTS: VARIANTS.slice() };
}));

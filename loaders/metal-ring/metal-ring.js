/*!
 * metal-ring.js — a liquid-metal WebGL ring for buttons, chips and inputs,
 * framed as a "busy" indicator. Dependency-free vanilla JS, UMD. v1.0.0
 *
 * Ported from "Metal FX" in solid-thinking-orbs (SolidJS):
 *   https://github.com/Mvkweb/solid-thinking-orbs
 *   Live demo: https://solid-thinking-orbs.vercel.app
 * Original design: Jakub Antalik (original Thinking Orbs concept and React
 *   implementation) and Alex Brinza (https://x.com/a_brinza, creator).
 * SolidJS port: Mvkweb.
 *
 * MIT License
 *
 * Copyright (c) 2026 Jakub Antalik (Original React Implementation)
 * Copyright (c) 2026 Mvkweb (SolidJS Port)
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
 *
 * Adapted for orb-loaders: React/Solid component rewritten as a framework-free
 * mount(); one shared WebGL context renders every preset/theme in use (upstream
 * could show only one preset per page); the wandering halo is drawn into the
 * ring's own canvas instead of an SVG with animated filters; dead shader
 * uniforms removed; busy-state semantics (aria-busy), reduced-motion static
 * frame, WebGL-missing / context-lost static CSS ring, offscreen and hidden-tab
 * pausing, light-theme contrast hairline. The neighbour-reflection feature is
 * not ported.
 *
 * Usage:
 *   MetalRing.mount(button, { preset: 'blueberry', variant: 'button' })
 *   -> returns { destroy(), setPreset(name), setTheme(t), setStrength(n), setPaused(b), isFallback() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MetalRing = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* =============================================================== presets */

  // Only the fields the shader reads. Five colours blend along the noise value;
  // the other two colour slots, per-colour alphas, softness and shape in the
  // upstream presets are never read by its shader, so they are not carried.
  function mode(colors, o) {
    return {
      colors: colors,
      dir: (o.dir == null ? 80 : o.dir) * Math.PI / 180,
      speed: o.speed == null ? 1.2 : o.speed,
      intensity: o.intensity == null ? 2 : o.intensity,
      scale: o.scale,
      distortion: o.distortion == null ? 0.3 : o.distortion,
      complexity: o.complexity == null ? 0.68 : o.complexity,
      vignette: o.vignette,
      vigOpacity: o.vigOpacity,
      opacity: o.opacity == null ? 1 : o.opacity,
      rgb: toRgbArray(colors)
    };
  }

  function toRgbArray(colors) {
    var out = new Float32Array(colors.length * 3);
    for (var i = 0; i < colors.length; i++) {
      var h = colors[i].replace('#', '');
      out[i * 3]     = parseInt(h.slice(0, 2), 16) / 255;
      out[i * 3 + 1] = parseInt(h.slice(2, 4), 16) / 255;
      out[i * 3 + 2] = parseInt(h.slice(4, 6), 16) / 255;
    }
    return out;
  }

  var RICH = { intensity: 2.2, scale: 3.0, distortion: 0.45, complexity: 0.75 };

  function rich(extra) {
    var o = {};
    for (var k in RICH) o[k] = RICH[k];
    for (var j in extra) o[j] = extra[j];
    return o;
  }

  var PRESETS = {
    chromatic: {
      dark:  mode(['#000000', '#aae8ff', '#c5fe9e', '#f7888d', '#0d0d0d'],
                  { scale: 1.6, vignette: 0.26, vigOpacity: 0.6 }),
      light: mode(['#ffffff', '#ffffff', '#ffffff', '#ffb3b3', '#adadad'],
                  { scale: 2.5, vignette: 0.24, vigOpacity: 0.16 })
    },
    silver: {
      dark:  mode(['#000000', '#dedede', '#747270', '#e5e5e5', '#0d0d0d'],
                  { scale: 2.5, vignette: 0.26, vigOpacity: 0.6, opacity: 0.88 }),
      light: mode(['#f6f6f6', '#ffffff', '#ffffff', '#f7f7f7', '#c9c9c9'],
                  { scale: 2.5, vignette: 0.2, vigOpacity: 0.26 })
    },
    gold: {
      dark:  mode(['#000000', '#ffffff', '#ffffff', '#f7d488', '#0d0d0d'],
                  { scale: 2.5, speed: 1.0, vignette: 0.26, vigOpacity: 0.6, opacity: 0.92 }),
      light: mode(['#fff8e1', '#fffbe0', '#ffffff', '#fff6d6', '#d2c7a7'],
                  { scale: 2.5, vignette: 0.22, vigOpacity: 0.24 })
    },
    blueberry: {
      dark:  mode(['#090314', '#3c126d', '#1d6ce6', '#70a6ff', '#e6f0ff'],
                  rich({ dir: 75, speed: 1.4, vignette: 0.25, vigOpacity: 0.6, opacity: 0.98 })),
      light: mode(['#ffffff', '#c3cee8', '#4b7bec', '#1e3799', '#70a6ff'],
                  rich({ dir: 75, speed: 1.4, vignette: 0.22, vigOpacity: 0.2 }))
    },
    rose: {
      dark:  mode(['#170206', '#850c26', '#e61c48', '#ff6b8b', '#fff0f3'],
                  rich({ dir: 85, speed: 1.3, vignette: 0.25, vigOpacity: 0.6, opacity: 0.98 })),
      light: mode(['#ffffff', '#fcdada', '#e84118', '#c23616', '#ff6b8b'],
                  rich({ dir: 85, speed: 1.3, vignette: 0.22, vigOpacity: 0.2 }))
    },
    copper: {
      dark:  mode(['#190a04', '#803512', '#d96b27', '#f7a468', '#fff3e8'],
                  rich({ speed: 1.3, vignette: 0.25, vigOpacity: 0.6, opacity: 0.98 })),
      light: mode(['#ffffff', '#fce8dc', '#e67e3a', '#b84e14', '#f7a468'],
                  rich({ speed: 1.3, vignette: 0.22, vigOpacity: 0.2 }))
    }
  };

  var PRESET_NAMES = Object.keys(PRESETS);

  /* ================================================================ tuning */

  var GL_SIZE = 96;            // shader canvas, px
  var GL_DPR_CAP = 1;          // shader is a soft field: 1x costs 4x fewer pixels than upstream's 2x
  var DPR_CAP = 2;             // ring canvas
  var FRAME_MS = 33;           // ~30 fps; upstream throttles to ~15
  var FRAME_SLACK = 4;
  var MAX_DT = 100;
  var SCAN_MS = 1500;          // how often the halo re-reads the shader
  var STATIC_T = 4;            // shader time of the reduced-motion frame
  var REF_W = 140, REF_H = 40; // upstream's canonical pill
  var REF_PERIM = 2 * (REF_W - REF_H) + 2 * Math.PI * 20;
  var SHADER_SCALE = { button: 1.6, circle: 1.3 };
  var PAD = 16;                // canvas margin that lets the halo spill outward
  var PERIM_SAMPLES = 16;
  var FADE_IN_MS = 350;

  // Halo behaviour — upstream constants where they carried over.
  var HALO_LO = 0.08, HALO_HI = 0.32;
  var RELOCATE_DELTA = 0.05, MIN_DWELL_MS = 3000, RELOC_FADE_MS = 1500;
  var PEAK_OP = 0.85, BASE_OP = 0.34;
  var WANDER_RANGE = 15, WANDER_TAU_MS = 1600, WANDER_RETARGET_MS = 2600;
  var INSET = 1.5, HALO_HALFLEN = 7.8, TINT_FADE_MS = 400;
  var LT_SAT_BOOST = 2.625, LT_MIN_VAL = 0.31;

  /* ================================================================ shader */

  var VERT_SRC =
    'attribute vec2 a_position;\n' +
    'void main() { gl_Position = vec4(a_position, 0.0, 1.0); }\n';

  // Simplex-noise fbm warped through a five-colour palette. Identical maths to
  // upstream with the dead branches (per-colour alpha, softness, shape, a
  // constant blur flag) folded away.
  var FRAG_SRC =
    '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n' +
    'uniform vec2 u_res; uniform float u_time; uniform vec3 u_col[5];\n' +
    'uniform float u_intensity, u_scale, u_dir, u_dist, u_cpx, u_vig, u_vigOp, u_opacity;\n' +
    'vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }\n' +
    'vec2 mod289v2(vec2 x){ return x - floor(x*(1.0/289.0))*289.0; }\n' +
    'vec3 permute(vec3 x){ return mod289((x*34.0+1.0)*x); }\n' +
    'float snoise(vec2 v){\n' +
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);\n' +
    '  vec2 i = floor(v + dot(v, C.yy));\n' +
    '  vec2 x0 = v - i + dot(i, C.xx);\n' +
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);\n' +
    '  vec4 x12 = x0.xyxy + C.xxzz;\n' +
    '  x12.xy -= i1;\n' +
    '  i = mod289v2(i);\n' +
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));\n' +
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);\n' +
    '  m = m*m; m = m*m;\n' +
    '  vec3 x_ = 2.0*fract(p*C.www) - 1.0;\n' +
    '  vec3 h = abs(x_) - 0.5;\n' +
    '  vec3 ox = floor(x_ + 0.5);\n' +
    '  vec3 a0 = x_ - ox;\n' +
    '  m *= 1.79284291400159 - 0.85373472095314*(a0*a0 + h*h);\n' +
    '  vec3 g;\n' +
    '  g.x = a0.x*x0.x + h.x*x0.y;\n' +
    '  g.yz = a0.yz*x12.xz + h.yz*x12.yw;\n' +
    '  return 130.0*dot(m, g);\n' +
    '}\n' +
    'float fbm(vec2 p, float oct){\n' +
    '  float val = 0.0, amp = 0.5; int n = int(oct);\n' +
    '  for (int i = 0; i < 7; i++) { if (i >= n) break; val += amp*snoise(p); p *= 2.0; amp *= 0.5; }\n' +
    '  return val;\n' +
    '}\n' +
    'float nfbm(vec2 p){ return fbm(p, 3.0 + u_cpx*4.0); }\n' +
    'vec3 palette(float t){\n' +
    '  t = clamp(t, 0.0, 1.0); t = t*t*(3.0 - 2.0*t);\n' +
    '  vec3 acc = vec3(0.0); float tot = 0.0001;\n' +
    '  for (int i = 0; i < 5; i++) {\n' +
    '    float d = t - float(i)*0.25; float w = exp(-64.0*d*d);\n' +
    '    acc += u_col[i]*w; tot += w;\n' +
    '  }\n' +
    '  return acc/tot;\n' +
    '}\n' +
    'vec3 effect(vec2 uv, float aspect, float t){\n' +
    '  vec2 p = (uv - 0.5)*u_scale; p.x *= aspect;\n' +
    '  p += vec2(cos(u_dir), sin(u_dir))*t*0.15;\n' +
    '  float freq = 3.0 + u_cpx*8.0;\n' +
    '  float val = sin(p.x*freq + t) + sin(p.y*freq + t*1.3)\n' +
    '            + sin((p.x + p.y)*freq*0.7 + t*0.7) + sin(length(p)*freq*0.8 - t*1.5);\n' +
    '  vec2 w = vec2(nfbm(p + vec2(t*0.1, 0.0)), nfbm(p + vec2(0.0, t*0.12) + 5.0))*u_dist*2.0;\n' +
    '  val += (w.x + w.y)*u_dist;\n' +
    '  return palette(clamp(val*0.2*u_intensity + 0.5, 0.0, 1.0));\n' +
    '}\n' +
    'void main(){\n' +
    '  vec2 uv = gl_FragCoord.xy/u_res; float aspect = u_res.x/u_res.y; float t = u_time;\n' +
    '  const float r = 0.02;\n' +
    '  vec3 col = effect(uv, aspect, t)*0.4\n' +
    '           + effect(uv + vec2( r, 0.0), aspect, t)*0.15\n' +
    '           + effect(uv + vec2(-r, 0.0), aspect, t)*0.15\n' +
    '           + effect(uv + vec2(0.0,  r), aspect, t)*0.15\n' +
    '           + effect(uv + vec2(0.0, -r), aspect, t)*0.15;\n' +
    '  col = pow(col, vec3(1.3));\n' +
    '  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));\n' +
    '  float range = (40.0/min(u_res.x, u_res.y))*(1.0 + u_vig*3.0);\n' +
    '  float vig = smoothstep(0.0, 1.0, edge*edge/(range*range));\n' +
    '  col *= mix(1.0, vig, u_vig*u_vigOp);\n' +
    '  gl_FragColor = vec4(col, u_opacity);\n' +
    '}\n';

  /* =============================================================== WebGL */

  var UNIFORMS = ['u_res', 'u_time', 'u_col', 'u_intensity', 'u_scale', 'u_dir',
                  'u_dist', 'u_cpx', 'u_vig', 'u_vigOp', 'u_opacity'];

  var GL = null;          // { canvas, gl, size, loc, lost }
  var glUnavailable = false;
  var glWarned = false;

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(log || 'shader compile failed');
    }
    return sh;
  }

  function buildPipeline(gl) {
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || 'program link failed');
    }
    gl.useProgram(prog);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    var pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);
    var loc = {};
    for (var i = 0; i < UNIFORMS.length; i++) loc[UNIFORMS[i]] = gl.getUniformLocation(prog, UNIFORMS[i]);
    return loc;
  }

  function ensureGL() {
    if (GL) return GL;
    if (glUnavailable) return null;
    var size = Math.round(GL_SIZE * Math.min(GL_DPR_CAP, window.devicePixelRatio || 1));
    var canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false }) ||
           canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) { glUnavailable = true; return null; }
    var loc;
    try {
      loc = buildPipeline(gl);
    } catch (err) {
      glUnavailable = true;
      if (!glWarned && typeof console !== 'undefined') {
        glWarned = true;
        console.warn('metal-ring: WebGL shader failed, using the static CSS ring. ' + err.message);
      }
      return null;
    }
    canvas.addEventListener('webglcontextlost', onContextLost, false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);
    GL = { canvas: canvas, gl: gl, size: size, loc: loc, lost: false };
    return GL;
  }

  function teardownGL() {
    if (!GL) return;
    GL.canvas.removeEventListener('webglcontextlost', onContextLost, false);
    GL.canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
    var ext = GL.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    GL = null;
  }

  function onContextLost(e) {
    e.preventDefault();
    if (GL) GL.lost = true;
    for (var i = 0; i < instances.length; i++) setFallback(instances[i], true);
  }

  function onContextRestored() {
    if (!GL) return;
    try {
      GL.loc = buildPipeline(GL.gl);
    } catch (err) {
      return; // stay on the CSS ring
    }
    GL.lost = false;
    for (var i = 0; i < instances.length; i++) {
      if (!instances[i].forceCss) setFallback(instances[i], false);
    }
    kick();
  }

  function drawShader(g, t) {
    var gl = GL.gl, loc = GL.loc, m = g.mode, s = GL.size;
    gl.viewport(0, 0, s, s);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.u_res, s, s);
    gl.uniform1f(loc.u_time, t);
    gl.uniform3fv(loc.u_col, m.rgb);
    gl.uniform1f(loc.u_intensity, m.intensity);
    gl.uniform1f(loc.u_scale, m.scale);
    gl.uniform1f(loc.u_dir, m.dir);
    gl.uniform1f(loc.u_dist, m.distortion);
    gl.uniform1f(loc.u_cpx, m.complexity);
    gl.uniform1f(loc.u_vig, m.vignette);
    gl.uniform1f(loc.u_vigOp, m.vigOpacity);
    gl.uniform1f(loc.u_opacity, m.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /* ============================================================ geometry */

  function roundRectPath(path, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    path.moveTo(x + r, y);
    path.arcTo(x + w, y, x + w, y + h, r);
    path.arcTo(x + w, y + h, x, y + h, r);
    path.arcTo(x, y + h, x, y, r);
    path.arcTo(x, y, x + w, y, r);
    path.closePath();
  }

  function perimeterLength(w, h, r) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    return 2 * (Math.max(0, w - 2 * rr) + Math.max(0, h - 2 * rr)) + 2 * Math.PI * rr;
  }

  // Point on the rounded-rectangle outline, `s` px clockwise from the top-left
  // arc's end; `inset` pulls it inward, `outward` pushes it back out.
  function pathPoint(s, w, h, r, inset, outward, out) {
    var rr = Math.max(0, Math.min(r, w / 2, h / 2));
    var top = Math.max(0, w - 2 * rr), side = Math.max(0, h - 2 * rr);
    var arc = Math.PI * rr / 2;
    var perim = 2 * (top + side) + 4 * arc;
    if (perim <= 0.0001) { out.x = w / 2; out.y = h / 2; return out; }
    s = ((s % perim) + perim) % perim;
    var rad = Math.max(0, rr - inset + outward);
    var d = s, th;
    if (d < top) { out.x = rr + d; out.y = inset - outward; return out; }
    d -= top;
    if (d < arc) {
      th = -Math.PI / 2 + (arc > 0 ? d / arc : 0) * (Math.PI / 2);
      out.x = (w - rr) + rad * Math.cos(th); out.y = rr + rad * Math.sin(th); return out;
    }
    d -= arc;
    if (d < side) { out.x = w - inset + outward; out.y = rr + d; return out; }
    d -= side;
    if (d < arc) {
      th = (arc > 0 ? d / arc : 0) * (Math.PI / 2);
      out.x = (w - rr) + rad * Math.cos(th); out.y = (h - rr) + rad * Math.sin(th); return out;
    }
    d -= arc;
    if (d < top) { out.x = w - rr - d; out.y = h - inset + outward; return out; }
    d -= top;
    if (d < arc) {
      th = Math.PI / 2 + (arc > 0 ? d / arc : 0) * (Math.PI / 2);
      out.x = rr + rad * Math.cos(th); out.y = (h - rr) + rad * Math.sin(th); return out;
    }
    d -= arc;
    if (d < side) { out.x = inset - outward; out.y = h - rr - d; return out; }
    d -= side;
    th = Math.PI + (arc > 0 ? d / arc : 0) * (Math.PI / 2);
    out.x = rr + rad * Math.cos(th); out.y = rr + rad * Math.sin(th);
    return out;
  }

  var _pa = { x: 0, y: 0 }, _pb = { x: 0, y: 0 };

  function tangentAngle(s, w, h, r, inset) {
    pathPoint(s - 0.1, w, h, r, inset, 0, _pa);
    pathPoint(s + 0.1, w, h, r, inset, 0, _pb);
    return Math.atan2(_pb.y - _pa.y, _pb.x - _pa.x);
  }

  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }

  /* ============================================================== sampling */

  // Maps a point in host CSS px to the shader canvas and averages a small
  // region. Reads the pixels captured at the last scan, never the live frame.
  var _s = { r: 0, g: 0, b: 0, lum: 0, n: 0 };

  function sampleRegion(inst, g, x, y, radius, chromatic) {
    var size = GL.size, px = g.pixels;
    var bx = Math.round(inst.cropX + (x / inst.w) * inst.cropW);
    var by = Math.round(size - 1 - (inst.cropY + (y / inst.h) * inst.cropH));
    var x0 = Math.max(0, bx - radius), x1 = Math.min(size, bx + radius + 1);
    var y0 = Math.max(0, by - radius), y1 = Math.min(size, by + radius + 1);
    var best = -1;
    _s.r = 0; _s.g = 0; _s.b = 0; _s.lum = 0; _s.n = 0;
    for (var py = y0; py < y1; py++) {
      for (var qx = x0; qx < x1; qx++) {
        var i = (py * size + qx) * 4;
        var r = px[i], gg = px[i + 1], b = px[i + 2];
        if (chromatic) {
          var mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
          var score = (mx > 0 ? (mx - mn) / mx : 0) * (0.35 + 0.65 * (mx / 255));
          if (score > best) { best = score; _s.r = r; _s.g = gg; _s.b = b; _s.n = 1; }
        } else {
          _s.r += r; _s.g += gg; _s.b += b; _s.n++;
          _s.lum += (0.2126 * r + 0.7152 * gg + 0.0722 * b) / 255;
        }
      }
    }
    return _s;
  }

  /* ================================================================= color */

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return [h, max === 0 ? 0 : d / max, max];
  }

  function hsvToRgb(h, s, v) {
    var i = Math.floor(h * 6), f = h * 6 - i;
    var p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    var r = 0, g = 0, b = 0;
    switch (i % 6) {
      case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  /* ================================================================ sprites */

  var SPRITE = 64;
  var HALO_STOPS = [[0, 0.9], [0.3, 0.55], [0.65, 0.2], [1, 0]];
  var CORE_STOPS = [[0, 1], [0.35, 0.7], [0.7, 0.2], [1, 0]];

  function makeSprite() {
    var c = document.createElement('canvas');
    c.width = c.height = SPRITE;
    return { c: c, x: c.getContext('2d') };
  }

  function paintSprite(sp, rgb, stops) {
    var x = sp.x, h = SPRITE / 2;
    x.clearRect(0, 0, SPRITE, SPRITE);
    var gr = x.createRadialGradient(h, h, 0, h, h, h);
    for (var i = 0; i < stops.length; i++) {
      gr.addColorStop(stops[i][0], 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + stops[i][1] + ')');
    }
    x.fillStyle = gr;
    x.fillRect(0, 0, SPRITE, SPRITE);
  }

  /* ============================================================== instances */

  var instances = [];
  var groups = {};
  var groupList = [];
  var raf = 0, lastT = 0;
  var listening = false;
  var mqReduce = null, mqDark = null;

  function reducedMotion() { return !!(mqReduce && mqReduce.matches); }

  function resolveTheme(opt) {
    if (opt === 'light' || opt === 'dark') return opt;
    return mqDark && mqDark.matches ? 'dark' : 'light';
  }

  function joinGroup(inst) {
    var key = inst.preset + ':' + inst.theme;
    var g = groups[key];
    if (!g) {
      g = {
        key: key, mode: PRESETS[inst.preset][inst.theme], t: STATIC_T, insts: [],
        pixels: GL ? new Uint8Array(GL.size * GL.size * 4) : null, version: 0, lastScan: -1e9
      };
      groups[key] = g;
      groupList.push(g);
    }
    g.insts.push(inst);
    inst.group = g;
  }

  function leaveGroup(inst) {
    var g = inst.group;
    if (!g) return;
    g.insts.splice(g.insts.indexOf(inst), 1);
    if (!g.insts.length) {
      delete groups[g.key];
      groupList.splice(groupList.indexOf(g), 1);
    }
    inst.group = null;
  }

  function newGlow() {
    return {
      phase: 'none', idx: 0, nextIdx: 0, start: 0, from: 0, to: 0, opacity: 0, target: BASE_OP,
      appearedAt: 0, seen: -1, lums: new Float32Array(PERIM_SAMPLES),
      wander: 0, wanderTarget: 0, retargetAt: 0,
      tintFrom: [255, 255, 255], tintTo: [255, 255, 255], tintStart: -1e9, key: -1,
      halo: makeSprite(), core: makeSprite()
    };
  }

  function mount(host, options) {
    if (!host || host.nodeType !== 1) throw new TypeError('MetalRing.mount: host must be an element');
    var tag = host.tagName;
    if (tag === 'INPUT' || tag === 'IMG' || tag === 'TEXTAREA' || tag === 'SELECT') {
      throw new TypeError('MetalRing.mount: <' + tag.toLowerCase() + '> cannot hold children, mount on a wrapper element instead');
    }
    var o = options || {};
    ensureObservers();

    var inst = {
      host: host,
      preset: PRESETS[o.preset] ? o.preset : 'chromatic',
      themeOpt: o.theme || 'auto',
      theme: resolveTheme(o.theme),
      variant: o.variant === 'circle' ? 'circle' : 'button',
      strength: o.strength == null ? 1 : Math.max(0, Math.min(1, o.strength)),
      glowOn: o.glow !== false,
      radiusOpt: typeof o.radius === 'number' ? o.radius : null,
      ringOpt: typeof o.ringWidth === 'number' ? o.ringWidth : null,
      forceCss: o.renderer === 'css',
      paused: false, visible: true, needsPaint: true, fallback: false,
      w: 0, h: 0, dpr: 1, radius: 0, ringPx: 1, scale: 1,
      cropX: 0, cropY: 0, cropW: 1, cropH: 1,
      canvas: null, ctx: null, css: null, io: null, ro: null,
      paths: null, perim: null, group: null, glow: newGlow(),
      prevPosition: host.style.position, prevBusy: host.getAttribute('aria-busy'),
      busy: o.busy !== false, destroyed: false, ready: false
    };
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    if (inst.busy) host.setAttribute('aria-busy', 'true');

    inst.canvas = document.createElement('canvas');
    inst.canvas.setAttribute('aria-hidden', 'true');
    inst.canvas.setAttribute('data-metal-ring', '');
    inst.canvas.style.cssText = 'position:absolute;pointer-events:none;display:block;opacity:0;';
    inst.ctx = inst.canvas.getContext('2d');
    host.appendChild(inst.canvas);

    inst.fallback = inst.forceCss || !ensureGL() || (GL && GL.lost);
    instances.push(inst);
    joinGroup(inst);
    layout(inst);
    applyFallbackState(inst);

    if (typeof ResizeObserver !== 'undefined') {
      inst.ro = new ResizeObserver(function () { layout(inst); kick(); });
      inst.ro.observe(host);
    }
    if (typeof IntersectionObserver !== 'undefined') {
      inst.io = new IntersectionObserver(function (entries) {
        inst.visible = entries[entries.length - 1].isIntersecting;
        if (inst.visible) { inst.needsPaint = true; kick(); }
      }, { rootMargin: '64px' });
      inst.io.observe(host);
    }
    fadeIn(inst);
    kick();

    return {
      destroy: function () { destroy(inst); },
      setPreset: function (name) {
        if (!PRESETS[name] || name === inst.preset) return;
        retarget(inst, name, inst.theme);
      },
      setTheme: function (t) {
        inst.themeOpt = t;
        var next = resolveTheme(t);
        if (next !== inst.theme) retarget(inst, inst.preset, next);
      },
      setStrength: function (n) {
        inst.strength = Math.max(0, Math.min(1, n));
        applyOpacity(inst);
      },
      setPaused: function (b) {
        inst.paused = !!b;
        if (!inst.paused) kick();
      },
      isFallback: function () { return inst.fallback; }
    };
  }

  function fadeIn(inst) {
    if (!reducedMotion()) inst.canvas.style.transition = 'opacity ' + FADE_IN_MS + 'ms ease-out';
    if (inst.css) inst.css.style.transition = inst.canvas.style.transition;
    requestAnimationFrame(function () {
      if (inst.destroyed) return;
      inst.ready = true;
      applyOpacity(inst);
    });
  }

  // Opacity is held at 0 until the first frame so the ring fades in.
  function applyOpacity(inst) {
    if (!inst.ready) return;
    var v = String(inst.strength);
    inst.canvas.style.opacity = v;
    if (inst.css) inst.css.style.opacity = v;
  }

  function retarget(inst, preset, theme) {
    leaveGroup(inst);
    inst.preset = preset;
    inst.theme = theme;
    joinGroup(inst);
    inst.glow = newGlow();
    inst.needsPaint = true;
    applyFallbackState(inst);
    kick();
  }

  function destroy(inst) {
    if (inst.destroyed) return;
    inst.destroyed = true;
    if (inst.io) inst.io.disconnect();
    if (inst.ro) inst.ro.disconnect();
    leaveGroup(inst);
    instances.splice(instances.indexOf(inst), 1);
    if (inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
    if (inst.css && inst.css.parentNode) inst.css.parentNode.removeChild(inst.css);
    inst.host.style.position = inst.prevPosition;
    if (inst.busy) {
      if (inst.prevBusy == null) inst.host.removeAttribute('aria-busy');
      else inst.host.setAttribute('aria-busy', inst.prevBusy);
    }
    if (!instances.length) shutdown();
  }

  function shutdown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0; lastT = 0;
    teardownGL();
    glUnavailable = false;
    if (listening) {
      document.removeEventListener('visibilitychange', onVisibility, false);
      if (mqReduce) mqReduce.removeEventListener('change', onMedia);
      if (mqDark) mqDark.removeEventListener('change', onMedia);
      listening = false;
    }
  }

  function ensureObservers() {
    if (listening) return;
    listening = true;
    mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    mqDark = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    document.addEventListener('visibilitychange', onVisibility, false);
    if (mqReduce) mqReduce.addEventListener('change', onMedia);
    if (mqDark) mqDark.addEventListener('change', onMedia);
  }

  function onVisibility() { if (!document.hidden) kick(); }

  function onMedia() {
    for (var i = 0; i < instances.length; i++) {
      var inst = instances[i];
      inst.needsPaint = true;
      if (inst.themeOpt === 'auto') {
        var next = resolveTheme('auto');
        if (next !== inst.theme) retarget(inst, inst.preset, next);
      }
    }
    kick();
  }

  /* =============================================================== layout */

  function parseRadius(value, w, h) {
    var n = parseFloat(value);
    if (!isFinite(n)) return 0;
    return /%/.test(value) ? (n / 100) * Math.min(w, h) : n;
  }

  function layout(inst) {
    var host = inst.host;
    var w = host.offsetWidth, h = host.offsetHeight;
    if (!w || !h) { inst.w = 0; inst.h = 0; return; }
    var dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    var radius = inst.variant === 'circle'
      ? Math.min(w, h) / 2
      : (inst.radiusOpt != null ? inst.radiusOpt : parseRadius(getComputedStyle(host).borderTopLeftRadius, w, h));
    radius = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    var ring = inst.ringOpt != null ? inst.ringOpt : defaultRing(inst.variant, w, h);

    inst.w = w; inst.h = h; inst.dpr = dpr; inst.radius = radius; inst.ringPx = ring;
    inst.scale = SHADER_SCALE[inst.variant];

    var cw = w + 2 * PAD, ch = h + 2 * PAD;
    var left = -(PAD + host.clientLeft), top = -(PAD + host.clientTop);
    var cv = inst.canvas;
    cv.style.left = left + 'px'; cv.style.top = top + 'px';
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    inst.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (inst.css) placeCss(inst);

    inst.paths = buildPaths(inst, cw, ch);
    inst.perim = buildPerim(inst);
    if (GL) cropFor(inst);
    inst.needsPaint = true;
    inst.glow.seen = -1;
  }

  // Ring thickness grows with the element so a 64px circle does not wear the
  // hairline of a 24px one. Upstream fixes it at 1px (pill) / 2px (circle).
  function defaultRing(variant, w, h) {
    var m = Math.min(w, h);
    var px = variant === 'circle' ? m / 16 : m / 36;
    var lo = variant === 'circle' ? 1.5 : 1, hi = variant === 'circle' ? 4 : 3;
    return Math.round(Math.max(lo, Math.min(hi, px)) * 2) / 2;
  }

  function buildPaths(inst, cw, ch) {
    var w = inst.w, h = inst.h, r = inst.radius, k = inst.ringPx;
    var ring = new Path2D(), outside = new Path2D();
    roundRectPath(ring, PAD, PAD, w, h, r);
    roundRectPath(ring, PAD + k, PAD + k, w - 2 * k, h - 2 * k, Math.max(0, r - k));
    outside.rect(0, 0, cw, ch);
    roundRectPath(outside, PAD + k, PAD + k, w - 2 * k, h - 2 * k, Math.max(0, r - k));
    return { ring: ring, outside: outside };
  }

  function buildPerim(inst) {
    var xs = new Float32Array(PERIM_SAMPLES), ys = new Float32Array(PERIM_SAMPLES);
    var len = perimeterLength(inst.w, inst.h, inst.radius);
    var inset = INSET * (inst.ringPx > 1.5 ? inst.ringPx / 1.5 : 1);
    var p = { x: 0, y: 0 };
    for (var i = 0; i < PERIM_SAMPLES; i++) {
      pathPoint((i / PERIM_SAMPLES) * len, inst.w, inst.h, inst.radius, inset, 0, p);
      xs[i] = p.x; ys[i] = p.y;
    }
    return { xs: xs, ys: ys, len: len, inset: inset, ratio: Math.max(0.5, Math.min(2, len / REF_PERIM)) };
  }

  function cropFor(inst) {
    var size = GL.size;
    inst.cropW = Math.min(size, (inst.w / REF_W) * size / inst.scale);
    inst.cropH = Math.min(size, (inst.h / REF_H) * size / inst.scale);
    inst.cropX = (size - inst.cropW) / 2;
    inst.cropY = (size - inst.cropH) / 2;
  }

  /* =========================================================== CSS fallback */

  function fallbackStops(inst) {
    var cols = PRESETS[inst.preset][inst.theme].colors, keep = [];
    for (var i = 0; i < cols.length; i++) {
      var v = parseInt(cols[i].slice(1, 3), 16) * 0.2126 + parseInt(cols[i].slice(3, 5), 16) * 0.7152 +
              parseInt(cols[i].slice(5, 7), 16) * 0.0722;
      var l = v / 255;
      if (inst.theme === 'dark' ? l > 0.12 : l < 0.93) keep.push(cols[i]);
    }
    if (keep.length < 2) keep = cols.slice();
    return keep.concat(keep[0]);
  }

  function ensureCss(inst) {
    if (inst.css) return;
    var el = document.createElement('span');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-metal-ring-fallback', '');
    el.style.cssText = 'position:absolute;pointer-events:none;display:block;box-sizing:border-box;opacity:0;' +
      '-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);' +
      '-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);' +
      'mask-composite:exclude;';
    inst.css = el;
    inst.host.appendChild(el);
    placeCss(inst);
    fadeIn(inst);
  }

  function placeCss(inst) {
    var s = inst.css.style, host = inst.host;
    s.left = -host.clientLeft + 'px'; s.top = -host.clientTop + 'px';
    s.width = inst.w + 'px'; s.height = inst.h + 'px';
    s.borderRadius = inst.radius + 'px';
    s.padding = inst.ringPx + 'px';
    s.background = 'conic-gradient(from 200deg,' + fallbackStops(inst).join(',') + ')';
  }

  function setFallback(inst, on) {
    inst.fallback = on;
    applyFallbackState(inst);
  }

  function applyFallbackState(inst) {
    if (inst.fallback) {
      ensureCss(inst);
      placeCss(inst);
      inst.canvas.style.visibility = 'hidden';
      inst.css.style.visibility = 'visible';
    } else {
      inst.canvas.style.visibility = 'visible';
      if (inst.css) inst.css.style.visibility = 'hidden';
      if (GL && !inst.group.pixels) inst.group.pixels = new Uint8Array(GL.size * GL.size * 4);
      if (GL) cropFor(inst);
      inst.needsPaint = true;
    }
    applyOpacity(inst);
  }

  /* ================================================================== loop */

  function kick() {
    if (!raf && instances.length) raf = requestAnimationFrame(tick);
  }

  function wants(inst, animating) {
    if (inst.fallback || !inst.visible || !inst.w) return false;
    return inst.needsPaint || (animating && !inst.paused);
  }

  function canAnimate() {
    if (reducedMotion() || document.hidden) return false;
    for (var i = 0; i < instances.length; i++) {
      var n = instances[i];
      if (!n.fallback && n.visible && !n.paused && n.w) return true;
    }
    return false;
  }

  function tick(now) {
    raf = 0;
    if (!instances.length) return;
    var animating = canAnimate();
    if (animating && lastT && now - lastT < FRAME_MS - FRAME_SLACK) {
      raf = requestAnimationFrame(tick);
      return;
    }
    var dt = lastT ? Math.min(MAX_DT, now - lastT) : 16;
    lastT = now;
    if (GL && !GL.lost) renderFrame(now, dt, animating);
    if (animating) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }

  function renderFrame(now, dt, animating) {
    for (var gi = 0; gi < groupList.length; gi++) {
      var g = groupList[gi], any = false, i;
      for (i = 0; i < g.insts.length; i++) {
        if (wants(g.insts[i], animating)) { any = true; break; }
      }
      if (!any) continue;
      if (animating) g.t += (dt / 1000) * g.mode.speed;
      drawShader(g, g.t);
      var scan = false;
      if (now - g.lastScan >= SCAN_MS || g.version === 0) {
        GL.gl.readPixels(0, 0, GL.size, GL.size, GL.gl.RGBA, GL.gl.UNSIGNED_BYTE, g.pixels);
        g.lastScan = now; g.version++; scan = true;
      }
      for (i = 0; i < g.insts.length; i++) {
        var inst = g.insts[i];
        if (!wants(inst, animating)) continue;
        paint(inst, g, now, dt, animating);
        inst.needsPaint = false;
      }
      if (scan && !animating) g.lastScan = -1e9;
    }
  }

  /* ================================================================= paint */

  function paint(inst, g, now, dt, animating) {
    var ctx = inst.ctx, cw = inst.w + 2 * PAD, ch = inst.h + 2 * PAD;
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.clip(inst.paths.ring, 'evenodd');
    ctx.drawImage(GL.canvas, inst.cropX, inst.cropY, inst.cropW, inst.cropH, PAD, PAD, inst.w, inst.h);
    ctx.restore();
    if (inst.theme === 'light') hairline(inst, ctx);
    if (inst.glowOn) glowFrame(inst, g, now, dt, animating);
  }

  // Light themes have pale presets that vanish on a pale page; a faint outer
  // hairline keeps the shape findable. Upstream does this with a box-shadow.
  function hairline(inst, ctx) {
    ctx.save();
    ctx.clip(inst.paths.ring, 'evenodd');
    ctx.strokeStyle = 'rgba(15,23,42,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke(inst.paths.ring);
    ctx.restore();
  }

  /* ================================================================== glow */

  function targetFor(gl, idx) {
    return BASE_OP + (PEAK_OP - BASE_OP) * smoothstep(HALO_LO, HALO_HI, gl.lums[idx]);
  }

  function startFade(gl, now, from, to, phase) {
    gl.phase = phase; gl.start = now; gl.from = from; gl.to = to;
  }

  function scanGlow(inst, g, now, animating) {
    var gl = inst.glow, p = inst.perim, i, max = -1, maxIdx = gl.idx;
    for (i = 0; i < PERIM_SAMPLES; i++) {
      var s = sampleRegion(inst, g, p.xs[i], p.ys[i], 2, false);
      var lum = s.n ? s.lum / s.n : 0;
      gl.lums[i] = lum;
      if (lum > max) { max = lum; maxIdx = i; }
    }
    var cur = gl.lums[gl.idx];
    if (gl.phase === 'none' || !animating) {
      gl.idx = maxIdx; gl.appearedAt = now; gl.wander = 0; gl.wanderTarget = 0;
      gl.target = targetFor(gl, gl.idx);
      if (animating) startFade(gl, now, 0, gl.target, 'in');
      else { gl.phase = 'hold'; gl.opacity = gl.target; }
    } else if (gl.phase === 'hold') {
      var dwelled = now - gl.appearedAt >= MIN_DWELL_MS;
      if (dwelled && max - cur > RELOCATE_DELTA) {
        gl.nextIdx = maxIdx;
        startFade(gl, now, gl.opacity, 0, 'out');
      } else gl.target = targetFor(gl, gl.idx);
    }
    scanTint(inst, g, now);
  }

  var _pt = { x: 0, y: 0 };

  function scanTint(inst, g, now) {
    var gl = inst.glow, p = inst.perim;
    var arc = (gl.idx / PERIM_SAMPLES) * p.len + gl.wander;
    pathPoint(arc, inst.w, inst.h, inst.radius, p.inset, 0, _pt);
    var light = inst.theme === 'light';
    var s = sampleRegion(inst, g, _pt.x, _pt.y, 2, light);
    var r = s.r, gg = s.g, b = s.b;
    if (!light) {
      if (s.n > 0) { r /= s.n; gg /= s.n; b /= s.n; }
      var peak = Math.max(r, gg, b) || 1;
      r = 255 * r / peak; gg = 255 * gg / peak; b = 255 * b / peak;
    }
    gl.tintFrom = currentTint(gl, now);
    gl.tintTo = [Math.round(r), Math.round(gg), Math.round(b)];
    gl.tintStart = gl.key === -1 ? -1e9 : now;
  }

  function currentTint(gl, now) {
    var f = Math.max(0, Math.min(1, (now - gl.tintStart) / TINT_FADE_MS));
    return [
      Math.round(gl.tintFrom[0] + (gl.tintTo[0] - gl.tintFrom[0]) * f),
      Math.round(gl.tintFrom[1] + (gl.tintTo[1] - gl.tintFrom[1]) * f),
      Math.round(gl.tintFrom[2] + (gl.tintTo[2] - gl.tintFrom[2]) * f)
    ];
  }

  function advanceGlow(inst, now, dt) {
    var gl = inst.glow, t, e;
    if (gl.phase === 'in' || gl.phase === 'out') {
      t = Math.min(1, (now - gl.start) / RELOC_FADE_MS);
      e = t * t * (3 - 2 * t);
      gl.opacity = gl.from + (gl.to - gl.from) * e;
      if (t >= 1) {
        if (gl.phase === 'out') {
          gl.idx = gl.nextIdx; gl.appearedAt = now; gl.wander = 0; gl.wanderTarget = 0;
          startFade(gl, now, 0, targetFor(gl, gl.idx), 'in');
        } else {
          gl.phase = 'hold'; gl.target = gl.to;
        }
      }
    } else if (gl.phase === 'hold') {
      gl.opacity += (gl.target - gl.opacity) * (1 - Math.exp(-dt / 1200));
    }
    if (now >= gl.retargetAt) {
      gl.wanderTarget = (Math.random() * 2 - 1) * WANDER_RANGE * inst.perim.ratio;
      gl.retargetAt = now + WANDER_RETARGET_MS;
    }
    gl.wander += (gl.wanderTarget - gl.wander) * (1 - Math.exp(-dt / WANDER_TAU_MS));
  }

  function glowFrame(inst, g, now, dt, animating) {
    var gl = inst.glow;
    if (gl.seen !== g.version) { scanGlow(inst, g, now, animating); gl.seen = g.version; }
    if (animating) advanceGlow(inst, now, dt);
    if (gl.opacity <= 0.004) return;

    var p = inst.perim, ctx = inst.ctx, light = inst.theme === 'light';
    var tint = currentTint(gl, now);
    var key = ((tint[0] >> 3) << 10) | ((tint[1] >> 3) << 5) | (tint[2] >> 3);
    if (key !== gl.key) {
      gl.key = key;
      var halo = tint, core = [255, 255, 255];
      if (light) {
        var hsv = rgbToHsv(tint[0], tint[1], tint[2]);
        halo = hsvToRgb(hsv[0], Math.min(1, hsv[1] * 1.6), Math.min(0.78, hsv[2]));
        core = hsvToRgb(hsv[0], Math.min(1, hsv[1] * LT_SAT_BOOST), Math.max(LT_MIN_VAL, Math.min(0.7, hsv[2])));
      }
      paintSprite(gl.halo, halo, HALO_STOPS);
      paintSprite(gl.core, core, CORE_STOPS);
    }

    var arc = (gl.idx / PERIM_SAMPLES) * p.len + gl.wander;
    pathPoint(arc, inst.w, inst.h, inst.radius, p.inset, 0, _pt);
    var ang = tangentAngle(arc, inst.w, inst.h, inst.radius, p.inset);
    var x = (_pt.x + PAD) * inst.dpr, y = (_pt.y + PAD) * inst.dpr;
    var c = Math.cos(ang) * inst.dpr, s = Math.sin(ang) * inst.dpr;
    var ratio = p.ratio;
    var m = light ? 0.55 : 0.8;

    var hw = HALO_HALFLEN * ratio + 15, hh = 15;
    var cwid = 6 * ratio + 8;

    ctx.save();
    ctx.globalCompositeOperation = light ? 'multiply' : 'source-over';

    // A clip is recorded in device space at the moment it is set, so each
    // region is clipped first and the blob's transform applied after.
    ctx.save();
    ctx.clip(inst.paths.outside, 'evenodd');
    ctx.setTransform(c, s, -s, c, x, y);
    ctx.globalAlpha = Math.min(1, gl.opacity * m * 0.7);
    ctx.drawImage(gl.halo.c, -hw, -hh, hw * 2, hh * 2);
    ctx.restore();

    ctx.save();
    ctx.clip(inst.paths.ring, 'evenodd');
    ctx.setTransform(c, s, -s, c, x, y);
    ctx.globalAlpha = Math.min(1, gl.opacity * m * 0.9);
    ctx.drawImage(gl.halo.c, -hw, -hh, hw * 2, hh * 2);
    ctx.globalAlpha = Math.min(1, gl.opacity * (light ? 1.6 : 3.2));
    ctx.drawImage(gl.core.c, -cwid, -4.5, cwid * 2, 9);
    ctx.restore();

    ctx.restore();
  }

  /* ================================================================ public */

  return {
    mount: mount,
    PRESETS: PRESETS,
    PRESET_NAMES: PRESET_NAMES,
    // True when a WebGL context can be created here. Creates and discards one.
    supportsWebGL: function () {
      if (GL) return true;
      if (glUnavailable) return false;
      try {
        var c = document.createElement('canvas');
        return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
      } catch (e) { return false; }
    }
  };
}));

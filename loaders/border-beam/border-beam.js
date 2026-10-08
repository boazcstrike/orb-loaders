/*!
 * border-beam.js — builds the layers border-beam.css animates, and tracks the
 * busy state. Dependency-free vanilla JS, UMD. v1.0.0
 *
 * Ported from "Border Beam" in solid-thinking-orbs (SolidJS):
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
 * Adapted for orb-loaders: the component is replaced by a mount() that adds
 * three decorative layers to an existing element; there is no per-instance
 * stylesheet and no JS animation loop (see border-beam.css). Border radius is
 * read from the host, stroke width and inner glow depth scale with its height.
 * The glow fades in and out through setActive(), the host is marked
 * aria-busy, and offscreen instances pause. Requires border-beam.css.
 *
 * Usage:
 *   BorderBeam.mount(card, { mode: 'travel', palette: 'spectrum' })
 *   -> returns { destroy(), setActive(bool), setMode(m), setPalette(p),
 *                setTheme(t), setStrength(n), setDuration(s) }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BorderBeam = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MODES = ['travel', 'line', 'breathe', 'halo'];
  var PALETTES = ['spectrum', 'mono', 'cool', 'warm'];
  var LOBES = 6;
  var DEFAULT_DURATION = { travel: 2.2, line: 3.1, breathe: 2.3, halo: 2.3 };
  var LAYERS = ['halo', 'glow', 'ring'];
  var MAX_FADE_PX = 28;
  var STYLE_PROPS = ['--bb-dur', '--bb-r', '--bb-bw', '--bb-fade', '--bb-strength'];
  var STYLE_HINT_DONE = false;

  var mqDark = null;

  function resolveTheme(opt) {
    if (opt === 'light' || opt === 'dark') return opt;
    if (!mqDark && window.matchMedia) mqDark = window.matchMedia('(prefers-color-scheme: dark)');
    return mqDark && mqDark.matches ? 'dark' : 'light';
  }

  function parseRadius(value, w, h) {
    var n = parseFloat(value);
    if (!isFinite(n)) return 0;
    return /%/.test(value) ? (n / 100) * Math.min(w, h) : n;
  }

  function strokeFor(h) { return h < 48 ? 1 : h < 160 ? 1.5 : 2; }

  function buildLayer(name) {
    var layer = document.createElement('span');
    layer.className = 'bbeam-' + name;
    layer.setAttribute('aria-hidden', 'true');
    var lobes = document.createElement('span');
    lobes.className = 'bbeam-lobes';
    for (var i = 0; i < LOBES; i++) lobes.appendChild(document.createElement('i'));
    layer.appendChild(lobes);
    return layer;
  }

  function mount(host, options) {
    if (!host || host.nodeType !== 1) throw new TypeError('BorderBeam.mount: host must be an element');
    var tag = host.tagName;
    if (tag === 'INPUT' || tag === 'IMG' || tag === 'TEXTAREA' || tag === 'SELECT') {
      throw new TypeError('BorderBeam.mount: <' + tag.toLowerCase() + '> cannot hold children, mount on a wrapper element instead');
    }
    var o = options || {};
    var state = {
      mode: MODES.indexOf(o.mode) >= 0 ? o.mode : 'travel',
      palette: PALETTES.indexOf(o.palette) >= 0 ? o.palette : 'spectrum',
      themeOpt: o.theme || 'auto',
      duration: o.duration,
      active: o.active !== false,
      radius: typeof o.radius === 'number' ? o.radius : null,
      destroyed: false
    };
    var prev = {
      cls: host.classList.contains('bbeam'),
      attrs: ['data-bb-mode', 'data-bb-palette', 'data-bb-theme', 'data-bb-state', 'data-bb-hue', 'data-bb-paused']
        .map(function (a) { return [a, host.getAttribute(a)]; }),
      // Only the custom properties this loader sets; the rest of the inline style belongs to the app.
      props: STYLE_PROPS.map(function (n) {
        return [n, host.style.getPropertyValue(n), host.style.getPropertyPriority(n)];
      }),
      hadStyle: host.hasAttribute('style'),
      busy: host.getAttribute('aria-busy')
    };

    var layers = LAYERS.map(buildLayer);
    layers.forEach(function (l) { host.appendChild(l); });
    host.classList.add('bbeam');
    warnIfUnstyled(layers[2]);

    host.setAttribute('data-bb-state', 'off');
    apply();
    setStrength(o.strength == null ? 1 : o.strength);
    measure();

    // The fade-in needs one frame at state "off" first.
    var frame = requestAnimationFrame(function () {
      frame = 0;
      if (!state.destroyed) syncState();
    });

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(host);
    var io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(function (entries) {
          if (entries[entries.length - 1].isIntersecting) host.removeAttribute('data-bb-paused');
          else host.setAttribute('data-bb-paused', '');
        }, { rootMargin: '64px' })
      : null;
    if (io) io.observe(host);
    var onTheme = function () { if (state.themeOpt === 'auto') apply(); };
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    if (mq) mq.addEventListener('change', onTheme);

    function apply() {
      host.setAttribute('data-bb-mode', state.mode);
      host.setAttribute('data-bb-palette', state.palette);
      host.setAttribute('data-bb-theme', resolveTheme(state.themeOpt));
      if (state.palette === 'mono') host.setAttribute('data-bb-hue', 'off');
      else host.removeAttribute('data-bb-hue');
      var d = state.duration != null ? state.duration : DEFAULT_DURATION[state.mode];
      host.style.setProperty('--bb-dur', d + 's');
    }

    function syncState() {
      host.setAttribute('data-bb-state', state.active ? 'on' : 'off');
      if (state.active) host.setAttribute('aria-busy', 'true');
      else host.removeAttribute('aria-busy');
    }

    function measure() {
      var w = host.offsetWidth, h = host.offsetHeight;
      if (!w || !h) return;
      var r = state.radius != null ? state.radius : parseRadius(getComputedStyle(host).borderTopLeftRadius, w, h);
      host.style.setProperty('--bb-r', Math.max(0, Math.min(r, Math.min(w, h) / 2)) + 'px');
      host.style.setProperty('--bb-bw', strokeFor(h) + 'px');
      host.style.setProperty('--bb-fade', Math.min(MAX_FADE_PX, Math.round(h * 0.3)) + 'px');
    }

    function setStrength(n) {
      host.style.setProperty('--bb-strength', String(Math.max(0, Math.min(1, n))));
    }

    return {
      destroy: function () {
        if (state.destroyed) return;
        state.destroyed = true;
        if (frame) cancelAnimationFrame(frame);
        if (ro) ro.disconnect();
        if (io) io.disconnect();
        if (mq) mq.removeEventListener('change', onTheme);
        layers.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
        if (!prev.cls) host.classList.remove('bbeam');
        prev.attrs.forEach(function (p) {
          if (p[1] == null) host.removeAttribute(p[0]); else host.setAttribute(p[0], p[1]);
        });
        prev.props.forEach(function (p) {
          if (p[1]) host.style.setProperty(p[0], p[1], p[2]); else host.style.removeProperty(p[0]);
        });
        if (!prev.hadStyle && !host.getAttribute('style')) host.removeAttribute('style');
        if (prev.busy == null) host.removeAttribute('aria-busy'); else host.setAttribute('aria-busy', prev.busy);
      },
      // Fades the glow in or out; the layers stay in place so it can resume.
      setActive: function (on) { state.active = !!on; syncState(); },
      setMode: function (m) {
        if (MODES.indexOf(m) < 0) return;
        state.mode = m; apply();
      },
      setPalette: function (p) {
        if (PALETTES.indexOf(p) < 0) return;
        state.palette = p; apply();
      },
      setTheme: function (t) { state.themeOpt = t; apply(); },
      setStrength: setStrength,
      setDuration: function (s) { state.duration = s; apply(); }
    };
  }

  // border-beam.css supplies position:absolute on the layers; without it the
  // spans would flow into the host's content. Say so once.
  function warnIfUnstyled(layer) {
    if (STYLE_HINT_DONE) return;
    STYLE_HINT_DONE = true;
    if (getComputedStyle(layer).position !== 'absolute' && typeof console !== 'undefined') {
      console.warn('border-beam: border-beam.css is not loaded, so no glow will show. Link it next to border-beam.js.');
    }
  }

  return { mount: mount, MODES: MODES, PALETTES: PALETTES, DEFAULT_DURATION: DEFAULT_DURATION };
}));

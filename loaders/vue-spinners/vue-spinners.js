/*!
 * vue-spinners.js: mounts the spinners in vue-spinners.css. Optional; the CSS
 * works on its own if you write the markup yourself.
 *
 * Upstream project : vue-spinner, https://github.com/greyby/vue-spinner
 * Upstream author  : greyby, Beijing, China (based on Halogen by Yuanyan Cao,
 *                    https://github.com/yuanyan/halogen)
 * Upstream licence : MIT. The full notices for both are in vue-spinners.css.
 *
 *   The MIT License (MIT)
 *   Copyright (c) 2015 greyby
 *   Copyright (c) 2015 Yuanyan Cao
 *   Permission is granted to use, copy, modify and distribute this software, provided
 *   the copyright notices above and the full permission notice in vue-spinners.css are
 *   included in all copies or substantial portions. Provided "AS IS", without warranty.
 *
 *
 * Adapted for orb-loaders: replaces the Vue components with one function that
 * builds the markup, sets --vs-size and the colour, and returns a handle.
 * Added: freezes the spinner while it is offscreen or the tab is hidden, and a
 * destroy() that removes the node and every listener. The accessible text is a
 * visually-hidden span added one frame after the node is inserted, because a
 * live region that is empty on insertion is usually not announced.
 *
 *   const s = VueSpinners.mount(host, { variant: 'ring', size: 64, color: '#0f766e' });
 *   s.destroy();
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VueSpinners = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Variant -> number of <i> children its markup needs. */
  var CHILDREN = {
    clip: 0, ring: 0, moon: 0, dot: 0, bounce: 0,
    pulse: 3, sync: 3, grid: 9
  };
  var DEFAULT_SIZE = 48;
  var PAUSED_CLASS = 'vs-paused';
  var SR_CLASS = 'vs-sr';

  /* One frame later, so a screen reader sees text appear in a live region it already knows. */
  var nextFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : function (fn) { return setTimeout(fn, 0); };

  function build(variant) {
    var el = document.createElement('span');
    el.className = 'vs-' + variant;
    el.setAttribute('role', 'status');
    for (var i = 0; i < CHILDREN[variant]; i++) el.appendChild(document.createElement('i'));
    return el;
  }

  function mount(host, opts) {
    if (!host || host.nodeType !== 1) throw new TypeError('VueSpinners.mount: host must be an element');
    var o = opts || {};
    var variant = o.variant || 'clip';
    if (!Object.prototype.hasOwnProperty.call(CHILDREN, variant)) {
      throw new RangeError('VueSpinners.mount: unknown variant "' + variant + '". Use one of: ' +
        Object.keys(CHILDREN).join(', '));
    }
    var size = o.size == null ? DEFAULT_SIZE : Number(o.size);
    if (!(size > 0)) throw new RangeError('VueSpinners.mount: size must be a positive number of pixels');

    var label = o.label || 'Loading';
    var el = build(variant);
    el.style.setProperty('--vs-size', size + 'px');
    if (o.color) el.style.color = o.color;

    var manual = false, offscreen = false, hidden = document.hidden;
    function apply() {
      el.classList.toggle(PAUSED_CLASS, manual || offscreen || hidden);
    }

    function onVisibility() { hidden = document.hidden; apply(); }
    document.addEventListener('visibilitychange', onVisibility);

    var io = null;
    if (typeof IntersectionObserver === 'function') {
      io = new IntersectionObserver(function (entries) {
        offscreen = !entries[entries.length - 1].isIntersecting;
        apply();
      });
      io.observe(el);
    }

    var destroyed = false;
    host.appendChild(el);
    apply();
    nextFrame(function () {
      if (destroyed) return;
      var text = document.createElement('span');
      text.className = SR_CLASS;
      text.textContent = label;
      el.appendChild(text);
    });

    return {
      el: el,
      setPaused: function (value) { manual = !!value; apply(); },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        document.removeEventListener('visibilitychange', onVisibility);
        if (io) io.disconnect();
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }

  return { mount: mount, VARIANTS: Object.keys(CHILDREN) };
}));

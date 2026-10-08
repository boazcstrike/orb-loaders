/*!
 * think-shimmer.js — AI "thinking" text and status indicators.
 * Dependency-free vanilla JS, UMD. v1.0.0. Pairs with think-shimmer.css.
 *
 * Adapted from Ant Design X (https://github.com/ant-design/x,
 * https://x.ant.design/components/think) by Ant Group / Ant UED. Licensed MIT
 * (packages/x/package.json "license": "MIT"; packages/x/LICENSE):
 *
 *   MIT LICENSE
 *
 *   Copyright (c) 2015-present Ant UED, https://xtech.antfin.com/
 *
 *   Permission is hereby granted, free of charge, to any person obtaining
 *   a copy of this software and associated documentation files (the
 *   "Software"), to deal in the Software without restriction, including
 *   without limitation the rights to use, copy, modify, merge, publish,
 *   distribute, sublicense, and/or sell copies of the Software, and to
 *   permit persons to whom the Software is furnished to do so, subject to
 *   the following conditions:
 *
 *   The above copyright notice and this permission notice shall be
 *   included in all copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 *   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *   NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 *   LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 *   OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 *   WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * Adapted for orb-loaders: upstream is React + antd + cssinjs; this is a
 * framework-free port that builds the DOM itself and leaves all motion to
 * think-shimmer.css. Added a "done" transition for every variant, a rotating-
 * verb variant and a self-advancing step chain, offscreen/hidden-tab pausing,
 * and reduced-motion handling.
 *
 * Usage:
 *   ThinkShimmer.mount(el, { variant: 'thought', text: 'Thinking…', size: 14 })
 *   -> { setText(text), done([text]), destroy(), next()? }   (next: steps only)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ThinkShimmer = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VARIANTS = ['shimmer', 'dots', 'cycle', 'thought', 'steps'];

  var DEFAULTS = {
    variant: 'shimmer',
    size: 14,                 // px; sets the font-size every part is scaled from
    text: '',                 // initial text (default depends on variant)
    doneText: '',             // text shown on done() (default depends on variant)
    texts: ['Thinking…', 'Reading the context…', 'Drafting a reply…', 'Checking the details…'],
    interval: 2200,           // ms between cycle verbs / auto-advanced steps
    content: '',              // thought: the collapsible body text
    expanded: true,           // thought: initial open state
    steps: ['Reading the request', 'Searching sources', 'Drafting an answer'],
    autoAdvance: true         // steps: walk the chain on a timer
  };

  var FALLBACK_TEXT = { shimmer: 'Thinking…', thought: 'Thinking…', dots: 'Thinking' };
  var FALLBACK_DONE = { shimmer: 'Done', cycle: 'Done', thought: 'Finished thinking', dots: 'Done', steps: 'Done' };

  var SWAP_MS = 360;
  var SWAP_EASE = 'cubic-bezier(.2,.8,.2,1)';
  var STEP_DONE_STAGGER_MS = 150;

  /* Static markup only — user text always goes through textContent. */
  var SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" ';
  var SPIN = SVG_OPEN + 'class="ts-spin"><circle class="ts-track" cx="12" cy="12" r="9"/>' +
             '<circle class="ts-arc" cx="12" cy="12" r="9" pathLength="100"/></svg>';
  var CHECK = SVG_OPEN + 'class="ts-check"><path d="M5.5 12.5l4.2 4.2 8.8-9.4" pathLength="1"/></svg>';
  var SPARK = SVG_OPEN + 'class="ts-spark"><path d="M12 2.5c.6 4.9 2.6 8.9 9.5 9.5-6.9.6-8.9 4.6-9.5 9.5-.6-4.9-2.6-8.9-9.5-9.5 6.9-.6 8.9-4.6 9.5-9.5z"/></svg>';
  var CHEVRON = SVG_OPEN + 'class="ts-chev"><path d="M9 6l6 6-6 6"/></svg>';

  var uid = 0;

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html) n.innerHTML = html;
    return n;
  }

  function merge(base, extra) {
    var out = {};
    var k;
    for (k in base) out[k] = base[k];
    for (k in extra) if (extra[k] !== undefined) out[k] = extra[k];
    return out;
  }

  /* ================================================================ timers */

  // Intervals that stop while the loader is offscreen or the tab is hidden.
  function Timers() {
    this.list = [];
    this.paused = false;
    this.pending = [];
  }
  Timers.prototype.every = function (fn, ms) {
    var self = this;
    var t = { on: false, id: 0 };
    t.arm = function () { if (t.on && !self.paused && !t.id) t.id = setInterval(fn, ms); };
    t.disarm = function () { clearInterval(t.id); t.id = 0; };
    this.list.push(t);
    return {
      start: function () { t.on = true; t.arm(); },
      stop: function () { t.on = false; t.disarm(); }
    };
  };
  Timers.prototype.later = function (fn, ms) {
    this.pending.push(setTimeout(fn, ms));
  };
  Timers.prototype.setPaused = function (p) {
    this.paused = p;
    this.list.forEach(function (t) { if (p) t.disarm(); else t.arm(); });
  };
  Timers.prototype.clear = function () {
    this.list.forEach(function (t) { t.on = false; t.disarm(); });
    this.pending.forEach(clearTimeout);
    this.pending = [];
  };

  /* ============================================================== variants */

  // Each builder fills `box`, starts its own timers, and returns { setText, done }.

  // Text with a sweep; on done the sweep stops and a check slides in.
  function buildShimmer(box, o, ctx) {
    var label = el('span', 'ts-label ts-shim');
    label.textContent = o.text || FALLBACK_TEXT.shimmer;
    box.appendChild(el('span', 'ts-icon', CHECK));
    box.appendChild(label);
    return {
      setText: function (t) { ctx.swap(label, t); },
      done: function (t) { ctx.swap(label, t || o.doneText || FALLBACK_DONE.shimmer); }
    };
  }

  // Three-dot typing bubble; on done the dots dissolve into a check.
  function buildDots(box, o) {
    var sr = el('span', 'ts-sr');
    sr.textContent = o.text || FALLBACK_TEXT.dots;
    var bubble = el('span', 'ts-bubble');
    bubble.appendChild(el('span', 'ts-dots', '<i class="ts-dot"></i><i class="ts-dot"></i><i class="ts-dot"></i>'));
    bubble.insertAdjacentHTML('beforeend', CHECK);
    box.appendChild(bubble);
    box.appendChild(sr);
    return {
      // Dots have no visible text; the status text is for assistive tech.
      setText: function (t) { sr.textContent = t; },
      done: function (t) { sr.textContent = t || o.doneText || FALLBACK_DONE.dots; }
    };
  }

  // A spark and a verb that rotates every `interval` ms.
  function buildCycle(box, o, ctx) {
    var texts = o.text ? [o.text].concat(o.texts.slice(1)) : o.texts;
    var label = el('span', 'ts-label ts-shim');
    var at = 0;
    label.textContent = texts[0];
    box.appendChild(el('span', 'ts-icon', SPARK + CHECK));
    box.appendChild(label);
    var ticker = ctx.timers.every(function () {
      at = (at + 1) % texts.length;
      ctx.swap(label, texts[at]);
    }, o.interval);
    if (texts.length > 1) ticker.start();
    return {
      setText: function (t) {
        ticker.stop();
        ctx.swap(label, t);
        if (texts.length > 1) ticker.start();
      },
      done: function (t) {
        ticker.stop();
        ctx.swap(label, t || o.doneText || FALLBACK_DONE.cycle);
      }
    };
  }

  // Collapsible header (spinner -> check) over a body of thought text.
  function buildThought(box, o, ctx) {
    var hasBody = !!o.content;
    var open = hasBody && o.expanded !== false;
    var id = 'ts-body-' + (++uid);
    var head = el(hasBody ? 'button' : 'div', 'ts-head');
    var label = el('span', 'ts-label ts-shim');
    var title = el('span', 'ts-title');
    label.textContent = o.text || FALLBACK_TEXT.thought;
    // Only the title is live: announcing the whole body on every change is noise.
    title.setAttribute('role', 'status');
    title.appendChild(label);
    head.appendChild(el('span', 'ts-icon', SPIN + CHECK));
    head.appendChild(title);
    box.appendChild(head);
    box.setAttribute('data-open', String(open));

    if (hasBody) {
      head.type = 'button';
      head.setAttribute('aria-expanded', String(open));
      head.setAttribute('aria-controls', id);
      head.insertAdjacentHTML('beforeend', CHEVRON);
      var body = el('div', 'ts-body');
      var inner = el('div', 'ts-body-in');
      var content = el('div', 'ts-content');
      body.id = id;
      content.textContent = o.content;
      inner.appendChild(content);
      body.appendChild(inner);
      box.appendChild(body);
      head.addEventListener('click', function () {
        open = !open;
        head.setAttribute('aria-expanded', String(open));
        box.setAttribute('data-open', String(open));
      });
    }
    return {
      setText: function (t) { ctx.swap(label, t); },
      done: function (t) { ctx.swap(label, t || o.doneText || FALLBACK_DONE.thought); }
    };
  }

  // A mini thought chain: pending -> active (spinner + sweep) -> done (check).
  function buildSteps(box, o, ctx) {
    var list = el('ol', 'ts-steps');
    var rows = o.steps.map(function (text, i) {
      var li = el('li', 'ts-step');
      var label = el('span', 'ts-label ts-shim');
      label.textContent = text;
      li.setAttribute('data-s', i === 0 ? 'active' : 'pending');
      li.appendChild(el('span', 'ts-node', '<i class="ts-pend"></i>' + SPIN + CHECK));
      li.appendChild(label);
      list.appendChild(li);
      return { li: li, label: label };
    });
    var at = 0;
    var last = rows.length - 1;
    box.appendChild(list);

    function mark(i, s) { rows[i].li.setAttribute('data-s', s); }
    function next() {
      if (at >= last) return;
      mark(at, 'done');
      at += 1;
      mark(at, 'active');
      if (at >= last) ticker.stop();
    }
    var ticker = ctx.timers.every(next, o.interval);
    if (o.autoAdvance !== false && last > 0) ticker.start();

    return {
      next: next,
      setText: function (t) { ctx.swap(rows[at].label, t); },
      done: function () {
        ticker.stop();
        for (var i = at; i <= last; i++) {
          ctx.timers.later(mark.bind(null, i, 'done'), (i - at) * STEP_DONE_STAGGER_MS);
        }
        at = last;
      }
    };
  }

  var BUILDERS = {
    shimmer: buildShimmer, dots: buildDots, cycle: buildCycle,
    thought: buildThought, steps: buildSteps
  };

  /* ================================================================== mount */

  function validate(host, o) {
    if (!host || host.nodeType !== 1) throw new TypeError('ThinkShimmer.mount: host must be a DOM element');
    if (VARIANTS.indexOf(o.variant) < 0) {
      throw new RangeError('ThinkShimmer.mount: unknown variant "' + o.variant + '" (use ' + VARIANTS.join(' | ') + ')');
    }
    if (!(o.size > 0)) throw new RangeError('ThinkShimmer.mount: size must be a positive number');
    if (o.variant === 'cycle' && !(o.texts && o.texts.length)) {
      throw new RangeError('ThinkShimmer.mount: cycle needs a non-empty texts array');
    }
    if (o.variant === 'steps' && !(o.steps && o.steps.length)) {
      throw new RangeError('ThinkShimmer.mount: steps needs a non-empty steps array');
    }
  }

  function mount(host, opts) {
    var o = merge(DEFAULTS, opts || {});
    validate(host, o);

    var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
    var timers = new Timers();
    var box = el('div', 'ts ts--' + o.variant);
    var visible = true;
    var paused = false;
    var observer = null;
    var destroyed = false;

    box.style.setProperty('--ts-size', o.size + 'px');
    box.setAttribute('data-state', 'active');
    if (o.variant !== 'thought') box.setAttribute('role', 'status');

    // Cross-fade into new text: rise, de-blur, fade. Skipped under reduced motion.
    function swap(node, text) {
      if (node.textContent === text) return;
      node.textContent = text;
      if (reduced.matches || !node.animate) return;
      node.animate(
        [
          { opacity: 0, transform: 'translateY(.3em)', filter: 'blur(3px)' },
          { opacity: 1, transform: 'none', filter: 'blur(0)' }
        ],
        { duration: SWAP_MS, easing: SWAP_EASE }
      );
    }

    var part = BUILDERS[o.variant](box, o, { timers: timers, swap: swap });

    function sync() {
      var next = !visible || document.hidden;
      if (next === paused) return;
      paused = next;
      if (paused) box.setAttribute('data-paused', '');
      else box.removeAttribute('data-paused');
      timers.setPaused(paused);
    }

    document.addEventListener('visibilitychange', sync);
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(function (entries) {
        visible = entries[entries.length - 1].isIntersecting;
        sync();
      });
      observer.observe(box);
    }
    host.appendChild(box);

    var api = {
      setText: function (text) {
        if (!destroyed) part.setText(String(text));
      },
      done: function (text) {
        if (destroyed) return;
        box.setAttribute('data-state', 'done');
        part.done(text === undefined ? undefined : String(text));
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        timers.clear();
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', sync);
        if (box.parentNode) box.parentNode.removeChild(box);
      }
    };
    if (part.next) api.next = function () { if (!destroyed) part.next(); };
    return api;
  }

  return { mount: mount, VARIANTS: VARIANTS.slice() };
}));

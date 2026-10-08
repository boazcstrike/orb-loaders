/*!
 * web-search.js — live "searching the web" discovery indicator.
 * Dependency-free vanilla JS, UMD. Pair with web-search.css.
 *
 * Ported from solid-thinking-orbs (MIT)
 *   https://github.com/Mvkweb/solid-thinking-orbs   (live demo: https://solid-thinking-orbs.vercel.app)
 * Upstream authors:
 *   Jakub Antalik  — original thinking-orbs concept and React implementation
 *   Mvkweb         — SolidJS port and the WebSearch component this is translated from
 *   Alex Brinza    — credited upstream as creator / original design (https://x.com/a_brinza)
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
 * Adapted for orb-loaders: Solid + CSS module removed; plain DOM and scoped `wsr-` CSS.
 * Globes are built only while a row is loading (and paused offscreen), the clock is
 * pausable, rows only link when given an href, the header reports "Searched N sources" on
 * completion, a radar ping leaves the active globe, sizing is one `size` option,
 * reduced motion keeps the progress but drops every movement. See README.md
 * "Changes from upstream".
 *
 * Usage:
 *   WebSearchRadar.mount(element, { query: '…', loop: true })  ->  { destroy() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WebSearchRadar = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_QUERY = 'token verification and middleware security best practices';
  var DEFAULT_SITES = [
    { title: 'Verifying tokens safely',        url: 'docs.example.org/guides/token-verification', discover: 600,  finish: 2400 },
    { title: 'Server middleware security guide', url: 'example.com/handbook/middleware-security',  discover: 1600, finish: 4000 },
    { title: 'Common authentication attacks',    url: 'security.example.net/auth/common-attacks',  discover: 2800, finish: 5600 }
  ];

  var DONE_BEAT = 800;          // ms after the last row finishes before the header flips to "Searched"
  var LOOP_PAUSE = 2800;        // ms the finished state rests before a loop restarts
  var MIN_ROW_MS = 400;         // a row always spends at least this long loading
  var GLOBE_FADE_MS = 320;      // keep the globe in the DOM while it fades out
  var DEFAULT_SIZE = 13;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SAFE_HREF = /^https?:\/\//i;

  // Meridian morph targets from upstream: left limb -> left mid -> right mid -> right limb -> left limb.
  var M_L  = 'M6.057 11.565 C2.081 11.565 0.371 8.159 0.371 5.964 C0.371 3.642 2.152 0.329 6.05 0.329';
  var M_ML = 'M6.012 11.55 C4.575 10.496 3.333 8.116 3.321 5.964 C3.307 3.399 4.974 0.977 6.012 0.329';
  var M_MR = 'M6.012 11.55 C7.211 10.781 8.715 8.287 8.715 5.964 C8.715 3.399 7.24 1.233 6.012 0.329';
  var M_R  = 'M6.012 11.55 C9.677 11.55 11.65 8.487 11.65 5.964 C11.65 3.499 9.748 0.329 6.012 0.329';
  var MORPH_VALUES = [M_L, M_ML, M_MR, M_R, M_L].join(';');
  var MORPH_BEGINS = ['0s', '-1.2s', '-2.4s', '-3.6s', '-4.8s', '-6s'];
  var MORPH_SPLINE = '0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1';

  var ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var ICON_SEARCH = '<svg ' + ICON_ATTRS + ' stroke-width="1.8"><path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/></svg>';
  var ICON_CARET = '<svg ' + ICON_ATTRS + ' stroke-width="2"><path d="m4.5 15.75 7.5-7.5 7.5 7.5"/></svg>';
  var ICON_ARROW = '<svg ' + ICON_ATTRS + ' stroke-width="2"><path d="M4.5 10.5 12 3m0 0 7.5 7.5M12 3v18"/></svg>';
  var ICON_DOTS = '<svg ' + ICON_ATTRS + ' stroke-width="1.8"><circle cx="12" cy="12" r="9" stroke-dasharray="1.8 3.6"/></svg>';
  var ICON_CHECK = '<svg ' + ICON_ATTRS + ' stroke-width="1.6"><path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg>';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function withIcon(node, html) {
    node.innerHTML = html;       // static markup defined above, never user text
    return node;
  }

  // Built per row only while it loads. `animated: false` is the reduced-motion globe.
  function buildGlobe(animated) {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 12 12');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '0.85');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('aria-hidden', 'true');

    var body = '<circle cx="6" cy="6" r="5.7" opacity="0.9"/><line x1="0.3" y1="6" x2="11.7" y2="6" opacity="0.9"/>';
    if (!animated) {
      body += '<path d="' + M_ML + '" opacity="0.9"/>';
    } else {
      MORPH_BEGINS.forEach(function (begin) {
        body += '<path d="' + M_L + '" opacity="0">' +
          '<animate attributeName="d" dur="7.2s" begin="' + begin + '" repeatCount="indefinite" calcMode="spline"' +
          ' keyTimes="0;0.25;0.5;0.75;1" keySplines="' + MORPH_SPLINE + '" values="' + MORPH_VALUES + '"/>' +
          '<animate attributeName="opacity" dur="7.2s" begin="' + begin + '" repeatCount="indefinite" calcMode="linear"' +
          ' keyTimes="0;0.05;0.7;0.75;1" values="0;0.9;0.9;0;0"/></path>';
      });
    }
    svg.innerHTML = body;
    return svg;
  }

  function normaliseSites(input) {
    var source = Array.isArray(input) && input.length ? input : DEFAULT_SITES;
    return source.map(function (s, i) {
      var discover = Number(s.discover) >= 0 && s.discover != null ? Number(s.discover) : 600 + i * 1000;
      var finish = Number(s.finish) > 0 ? Number(s.finish) : 2400 + i * 1600;
      return {
        title: String(s.title == null ? '' : s.title),
        url: String(s.url == null ? '' : s.url),
        href: typeof s.href === 'string' && SAFE_HREF.test(s.href) ? s.href : '',
        discover: discover,
        finish: Math.max(finish, discover + MIN_ROW_MS)
      };
    });
  }

  function mount(host, opts) {
    if (!host) throw new Error('WebSearchRadar.mount: host element required');
    opts = opts || {};

    var query = typeof opts.query === 'string' ? opts.query : DEFAULT_QUERY;
    var sites = normaliseSites(opts.sites);
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var loop = opts.loop !== false && !reduceMotion;
    var size = Number(opts.size) > 0 ? Number(opts.size) : DEFAULT_SIZE;
    var lastFinish = Math.max.apply(null, sites.map(function (s) { return s.finish; }));

    /* ---- DOM ---- */
    var rootEl = el('div', 'wsr');
    rootEl.setAttribute('data-state', 'loading');
    rootEl.style.fontSize = size + 'px';
    if (opts.width) rootEl.style.maxWidth = typeof opts.width === 'number' ? opts.width + 'px' : opts.width;
    if (opts.color) rootEl.style.color = opts.color;

    var row = el('div', 'wsr-row');
    var searchIcon = withIcon(el('span', ''), ICON_SEARCH).firstChild;
    var label = el('span', 'wsr-label');
    var headline = el('span', 'wsr-shimmer wsr-query');
    var count = el('span', 'wsr-count');
    var chevron = withIcon(el('button', 'wsr-chevron'), ICON_CARET);
    chevron.type = 'button';
    chevron.setAttribute('aria-label', 'Toggle results');
    label.appendChild(headline);
    label.appendChild(count);
    label.appendChild(chevron);
    row.appendChild(searchIcon);
    row.appendChild(label);

    var collapsible = el('div', 'wsr-collapsible');
    var inner = el('div', 'wsr-inner');
    var results = el('div', 'wsr-results');
    var list = el('ul', 'wsr-list');
    results.appendChild(el('span', 'wsr-rail'));
    results.appendChild(list);
    inner.appendChild(results);
    collapsible.appendChild(inner);

    var live = el('span', 'wsr-sr');
    live.setAttribute('role', 'status');

    var rows = sites.map(function (site, i) {
      var item = el('li', 'wsr-site');
      item.style.setProperty('--wsr-i', String(i));
      item.setAttribute('data-state', 'pending');
      // Only a row given an href is a link; without one it is plain text, not a dead hover target.
      var content = item;
      if (site.href) {
        content = el('a', 'wsr-link');
        content.href = site.href;
        content.target = '_blank';
        content.rel = 'noopener noreferrer';
        item.appendChild(content);
      }
      var bullet = el('span', 'wsr-bullet');
      var globeHost = el('span', 'wsr-globe');
      bullet.appendChild(withIcon(el('span', 'wsr-dots'), ICON_DOTS));
      bullet.appendChild(el('span', 'wsr-ping'));
      bullet.appendChild(globeHost);
      bullet.appendChild(withIcon(el('span', 'wsr-check'), ICON_CHECK));
      content.appendChild(bullet);
      content.appendChild(el('span', 'wsr-title', site.title));
      content.appendChild(el('span', 'wsr-sep', '·'));
      content.appendChild(el('span', 'wsr-url', site.url));
      if (site.href) content.appendChild(withIcon(el('span', 'wsr-arrow'), ICON_ARROW));
      list.appendChild(item);
      return { item: item, globeHost: globeHost, globe: null, dropTimer: 0 };
    });

    rootEl.appendChild(row);
    rootEl.appendChild(collapsible);
    rootEl.appendChild(live);
    host.appendChild(rootEl);

    /* ---- state ---- */
    var open = opts.defaultOpen !== false;
    var done = false;
    var announced = false;
    var paused = false;
    var destroyed = false;

    function setOpen(next) {
      open = next;
      chevron.setAttribute('aria-expanded', String(open));
      collapsible.classList.toggle('is-collapsed', !open);
      collapsible.inert = !open;
    }

    function setHeadline() {
      headline.textContent = (done ? 'Searched' : 'Searching') + ' “' + query + '”';
      count.textContent = done ? '· ' + sites.length + (sites.length === 1 ? ' source' : ' sources') : '';
      rootEl.setAttribute('data-state', done ? 'done' : 'loading');
    }

    function dropGlobe(r) {
      clearTimeout(r.dropTimer);
      if (r.globe && r.globe.parentNode) r.globe.parentNode.removeChild(r.globe);
      r.globe = null;
    }

    function setSite(index, state) {
      var r = rows[index];
      r.item.setAttribute('data-state', state);
      if (state === 'loading' && !r.globe) {
        r.globe = buildGlobe(!reduceMotion);
        r.globeHost.appendChild(r.globe);
        if (paused && r.globe.pauseAnimations) r.globe.pauseAnimations();
      } else if (state === 'done') {
        clearTimeout(r.dropTimer);
        r.dropTimer = setTimeout(function () { dropGlobe(r); }, GLOBE_FADE_MS);
      } else if (state === 'pending') {
        dropGlobe(r);
      }
    }

    function finishAll() {
      done = true;
      setHeadline();
      if (!announced) {
        announced = true;
        live.textContent = 'Search complete, ' + sites.length + (sites.length === 1 ? ' source' : ' sources');
      }
    }

    function reset() {
      done = false;
      for (var i = 0; i < rows.length; i++) setSite(i, 'pending');
      setHeadline();
    }

    /* ---- timeline on a pausable clock ---- */
    var events = [];
    sites.forEach(function (site, i) {
      events.push({ t: site.discover, run: function () { setSite(i, 'loading'); } });
      events.push({ t: site.finish, run: function () { setSite(i, 'done'); } });
    });
    events.push({ t: lastFinish + DONE_BEAT, run: finishAll });
    if (loop) events.push({ t: lastFinish + DONE_BEAT + LOOP_PAUSE, run: restart });
    events = events
      .map(function (e, i) { return { t: e.t, run: e.run, order: i }; })
      .sort(function (a, b) { return a.t - b.t || a.order - b.order; });

    var cursor = 0;
    var elapsed = 0;
    var startedAt = 0;
    var running = false;
    var timer = 0;

    function readClock() { return running ? elapsed + (performance.now() - startedAt) : elapsed; }

    function schedule() {
      clearTimeout(timer);
      if (!running || destroyed || cursor >= events.length) return;
      timer = setTimeout(tick, Math.max(0, events[cursor].t - readClock()) + 1);
    }

    function tick() {
      if (destroyed) return;
      // Re-read the clock each pass: the loop event rewinds it to zero.
      while (cursor < events.length && events[cursor].t <= readClock()) events[cursor++].run();
      schedule();
    }

    function restart() {
      cursor = 0;
      elapsed = 0;
      startedAt = performance.now();
      reset();
    }

    function setPaused(next) {
      paused = next;
      rootEl.classList.toggle('is-paused', paused);
      rows.forEach(function (r) {
        if (!r.globe || !r.globe.pauseAnimations) return;
        if (paused) r.globe.pauseAnimations(); else r.globe.unpauseAnimations();
      });
      if (paused && running) {
        elapsed = readClock();
        running = false;
        clearTimeout(timer);
      } else if (!paused && !running && !destroyed) {
        startedAt = performance.now();
        running = true;
        schedule();
      }
    }

    var hidden = document.hidden;
    var offscreen = false;
    function syncPaused() { setPaused(hidden || offscreen); }
    function onVisibility() { hidden = document.hidden; syncPaused(); }
    function onToggle() { setOpen(!open); }

    chevron.addEventListener('click', onToggle);
    document.addEventListener('visibilitychange', onVisibility);

    var observer = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(function (entries) {
        offscreen = !entries[entries.length - 1].isIntersecting;
        syncPaused();
      });
      observer.observe(rootEl);
    }

    /* ---- start ---- */
    setOpen(open);
    setHeadline();
    live.textContent = 'Searching';
    startedAt = performance.now();
    running = true;
    syncPaused();
    schedule();

    return {
      destroy: function () {
        destroyed = true;
        running = false;
        clearTimeout(timer);
        rows.forEach(function (r) { clearTimeout(r.dropTimer); });
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        chevron.removeEventListener('click', onToggle);
        if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
      }
    };
  }

  return { mount: mount };
}));

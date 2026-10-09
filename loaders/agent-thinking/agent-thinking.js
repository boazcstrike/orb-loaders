/*!
 * agent-thinking.js — collapsible multi-line "reasoning stream" indicator.
 * Dependency-free vanilla JS, UMD. Pair with agent-thinking.css.
 *
 * Ported from solid-thinking-orbs (MIT)
 *   https://github.com/Mvkweb/solid-thinking-orbs   (live demo: https://solid-thinking-orbs.vercel.app)
 * Upstream authors:
 *   Jakub Antalik  — original thinking-orbs concept and React implementation
 *   Mvkweb         — SolidJS port and the AgentThinking component this is translated from
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
 * Adapted for orb-loaders: Solid + CSS module + Tailwind removed; plain DOM and scoped
 * `ath-` CSS. Timeline runs on the wall clock (only the shimmer pauses offscreen / hidden,
 * so onComplete still fires in a background tab), the stream follows the newest line, the
 * live line is emphasised, the timer is tabular and drift-free, reduced motion shows the
 * finished state, optional looping, size option.
 * See README.md "Changes from upstream".
 *
 * Usage:
 *   AgentThinking.mount(element, { size: 13, loop: false })  ->  { destroy() }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgentThinking = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_SENTENCES = [
    'Reading the request and the open file, then locating the retry logic inside the upload handler.',
    'The handler retries on every error, including ones that can never succeed, so a bad payload loops until the timeout.',
    'Checking where the backoff delay is computed and whether the attempt counter is ever reset between requests.',
    'Planning to retry only on network and server errors, cap the attempts at five, and add jitter to the delay.',
    'Scanning the existing tests around the handler so the change stays covered and nothing downstream regresses.',
    'Drafting the patch with a focused test that proves a rejected payload fails fast instead of retrying.'
  ];
  var DEFAULT_DELAYS = [700, 900, 800, 850, 800, 900];

  var COLLAPSE_BEAT = 360;     // ms between the last line and "Thought for Ns"
  var LOOP_PAUSE = 2800;       // ms the finished state rests before a loop restarts
  var DEFAULT_SIZE = 13;       // px font size
  var LINES_PER_ENTRY = 2;     // each sentence is clamped to two lines
  var VIEWPORT_LINES = 9;      // viewport caps at 9 line-heights (180px at the 13px size)
  var HEADER_GAP = 6;          // px between header and stream
  var SNAP = 2;                // px tolerance for "scrolled to an edge"
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function chevron() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'ath-chevron');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', 'm4.5 15.75 7.5-7.5 7.5 7.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  function cumulative(delays, count) {
    var out = [];
    var t = 0;
    for (var i = 0; i < count; i++) {
      var d = Number(delays && delays[i]);
      t += d > 0 ? d : DEFAULT_DELAYS[i % DEFAULT_DELAYS.length];
      out.push(t);
    }
    return out;
  }

  function mount(host, opts) {
    if (!host) throw new Error('AgentThinking.mount: host element required');
    opts = opts || {};

    var sentences = Array.isArray(opts.sentences) && opts.sentences.length
      ? opts.sentences.slice() : DEFAULT_SENTENCES;
    var count = sentences.length;
    var at = cumulative(opts.delays, count);          // reveal time of each line
    var totalMs = at[count - 1];
    var doneAt = totalMs + COLLAPSE_BEAT;
    var showTimer = opts.showTimer !== false;
    var autoCollapse = opts.autoCollapse !== false;
    var loop = opts.loop === true;
    var defaultOpen = opts.defaultOpen !== false;
    var onComplete = typeof opts.onComplete === 'function' ? opts.onComplete : null;

    var fontSize = Number(opts.size) > 0 ? Number(opts.size) : DEFAULT_SIZE;
    var lineH = Math.round(fontSize * 1.55);
    var entryH = lineH * LINES_PER_ENTRY;
    var gap = Math.round(lineH * 0.2);
    var maxH = lineH * VIEWPORT_LINES;
    var fadeH = Math.round(lineH * 0.8);

    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var finalSeconds = Math.max(1, Math.round(totalMs / 1000));

    /* ---- DOM ---- */
    var rootEl = el('div', 'ath');
    rootEl.style.setProperty('--ath-fs', fontSize + 'px');
    rootEl.style.setProperty('--ath-lh', lineH + 'px');
    rootEl.style.width = typeof opts.width === 'number' ? opts.width + 'px' : (opts.width || '360px');
    if (opts.color) rootEl.style.color = opts.color;
    if (opts.reserveSpace !== false) rootEl.style.minHeight = (lineH + HEADER_GAP + maxH) + 'px';

    var header = el('button', 'ath-header');
    header.type = 'button';
    var label = el('span', 'ath-label');
    var verb = el('span', 'ath-verb');
    var rest = el('span', 'ath-rest');
    rest.setAttribute('aria-hidden', 'true');          // the ticking timer is not read out
    label.appendChild(verb);
    label.appendChild(rest);
    header.appendChild(label);
    header.appendChild(chevron());

    var collapsible = el('div', 'ath-collapsible');
    var inner = el('div', 'ath-inner');
    var viewport = el('div', 'ath-viewport');
    var stream = el('div', 'ath-stream');
    viewport.setAttribute('aria-label', opts.label || 'Reasoning');
    viewport.appendChild(stream);
    inner.appendChild(viewport);
    collapsible.appendChild(inner);

    var live = el('span', 'ath-sr');
    live.setAttribute('role', 'status');   // inserted empty: first text lands on a later tick so SRs announce it

    rootEl.appendChild(header);
    rootEl.appendChild(collapsible);
    rootEl.appendChild(live);
    host.appendChild(rootEl);

    /* ---- state ---- */
    var phase = 'thinking';
    var revealed = 0;
    var open = defaultOpen;
    var stick = true;                  // follow the newest line until the user scrolls away
    var capped = false;
    var fadeTop = 0;
    var fadeBottom = 0;
    var destroyed = false;
    var completed = false;             // onComplete fires at most once per run

    /* ---- wall clock: keeps advancing while hidden / offscreen, only visuals pause ---- */
    var startedAt = 0;
    var running = false;
    var timer = 0;
    var hidden = document.hidden;
    var offscreen = false;

    function now() { return performance.now(); }
    function readClock() { return now() - startedAt; }

    /* ---- rendering ---- */
    function setLabel() {
      var thinking = phase === 'thinking';
      var seconds = thinking ? Math.floor(readClock() / 1000) : finalSeconds;
      var v = thinking ? 'Thinking' : 'Thought';
      var r = (showTimer ? ' for ' + seconds + 's' : '') + (thinking ? '…' : '');
      if (verb.textContent !== v) verb.textContent = v;
      if (rest.textContent !== r) rest.textContent = r;
      label.classList.toggle('is-shimmer', thinking && !reduceMotion);
    }

    function setOpen(next) {
      open = next;
      header.setAttribute('aria-expanded', String(open));
      collapsible.classList.toggle('is-collapsed', !open);
      collapsible.inert = !open;
    }

    function layout() {
      var n = stream.children.length;
      var contentH = n ? n * entryH + (n - 1) * gap : 0;
      capped = contentH > maxH;
      viewport.style.height = (capped ? maxH : contentH) + 'px';
      viewport.classList.toggle('is-capped', capped);
      if (capped) viewport.tabIndex = 0; else viewport.removeAttribute('tabindex');
      if (capped) viewport.setAttribute('role', 'region'); else viewport.removeAttribute('role');
      return contentH;
    }

    function updateFades() {
      var top = viewport.scrollTop > SNAP ? fadeH : 0;
      var bottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight > SNAP ? fadeH : 0;
      if (top !== fadeTop) { fadeTop = top; viewport.style.setProperty('--ath-ft', top + 'px'); }
      if (bottom !== fadeBottom) { fadeBottom = bottom; viewport.style.setProperty('--ath-fb', bottom + 'px'); }
    }

    function followNewest(contentH) {
      if (!capped || !stick) return;
      viewport.scrollTo({ top: contentH - maxH, behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    function addLine(index, instant) {
      var prev = stream.lastElementChild;
      if (prev) prev.classList.remove('is-live');
      var p = el('p', 'ath-line' + (instant ? '' : ' is-live'), sentences[index]);
      stream.appendChild(p);
      var contentH = layout();
      followNewest(contentH);
      updateFades();
    }

    function finish() {
      phase = 'done';
      var lastLine = stream.lastElementChild;
      if (lastLine) lastLine.classList.remove('is-live');
      setLabel();
      live.textContent = 'Finished thinking';
      if (autoCollapse) setOpen(false);
      rootEl.setAttribute('data-phase', 'done');
      complete();
    }

    function complete() {
      if (completed || !onComplete) return;
      completed = true;
      onComplete();
    }

    function restart() {
      while (stream.firstChild) stream.removeChild(stream.firstChild);
      phase = 'thinking';
      revealed = 0;
      completed = false;
      startedAt = now();
      stick = true;
      viewport.scrollTop = 0;
      rootEl.setAttribute('data-phase', 'thinking');
      live.textContent = 'Thinking';
      layout();
      updateFades();
      setOpen(defaultOpen);
      setLabel();
    }

    /* ---- timeline: wake at the next line, the done beat, or the next whole second ---- */
    function nextEventAt() {
      if (phase === 'thinking') return revealed < count ? at[revealed] : doneAt;
      return loop ? doneAt + LOOP_PAUSE : Infinity;
    }

    function schedule() {
      clearTimeout(timer);
      if (!running || destroyed) return;
      var t = readClock();
      var target = nextEventAt();
      if (phase === 'thinking' && showTimer) target = Math.min(target, (Math.floor(t / 1000) + 1) * 1000);
      if (target === Infinity) return;
      timer = setTimeout(tick, Math.max(0, target - t) + 1);
    }

    function tick() {
      if (destroyed) return;
      var t = readClock();
      if (phase === 'thinking') {
        while (revealed < count && at[revealed] <= t) addLine(revealed++, false);
        if (t >= doneAt) finish(); else setLabel();
      } else if (loop && t >= doneAt + LOOP_PAUSE) {
        restart();
      }
      schedule();
    }

    // Hidden / offscreen freezes the shimmer only; on return, catch the timeline up and render it.
    function syncRunning() {
      if (!running || destroyed) return;
      var paused = hidden || offscreen;
      rootEl.classList.toggle('is-paused', paused);
      if (!paused) tick();
    }

    /* ---- events ---- */
    function onToggle() {
      setOpen(!open);
      if (!open) return;
      stick = phase === 'thinking';
      viewport.scrollTop = stick ? viewport.scrollHeight : 0;
      updateFades();
    }
    function onUserScroll() { stick = false; }
    function onScroll() {
      if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= SNAP) stick = true;
      updateFades();
    }
    function onVisibility() { hidden = document.hidden; syncRunning(); }

    header.addEventListener('click', onToggle);
    viewport.addEventListener('scroll', onScroll, { passive: true });
    viewport.addEventListener('wheel', onUserScroll, { passive: true });
    viewport.addEventListener('touchmove', onUserScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    var observer = null;
    if (typeof IntersectionObserver === 'function') {
      observer = new IntersectionObserver(function (entries) {
        offscreen = !entries[entries.length - 1].isIntersecting;
        syncRunning();
      });
      observer.observe(rootEl);
    }

    /* ---- start ---- */
    setOpen(defaultOpen);
    rootEl.setAttribute('data-phase', 'thinking');
    if (reduceMotion) {
      // Calm fallback: show the finished reasoning at once, nothing animates.
      for (var i = 0; i < count; i++) addLine(i, true);
      phase = 'done';
      setLabel();
      rootEl.setAttribute('data-phase', 'done');
      // Deferred so the live region is in the tree first and the caller already holds the handle.
      setTimeout(function () {
        if (destroyed) return;
        live.textContent = 'Finished thinking';
        complete();
      }, 0);
    } else {
      setTimeout(function () { if (!destroyed) live.textContent = 'Thinking'; }, 0);
      setLabel();
      startedAt = now();
      running = true;
      syncRunning();
      schedule();
    }

    return {
      destroy: function () {
        destroyed = true;
        running = false;
        clearTimeout(timer);
        if (observer) observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        header.removeEventListener('click', onToggle);
        viewport.removeEventListener('scroll', onScroll);
        viewport.removeEventListener('wheel', onUserScroll);
        viewport.removeEventListener('touchmove', onUserScroll);
        if (rootEl.parentNode) rootEl.parentNode.removeChild(rootEl);
      }
    };
  }

  return { mount: mount };
}));

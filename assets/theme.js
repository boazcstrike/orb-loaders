/*!
 * theme.js — light/dark toggle for the catalogue pages.
 *
 * No stored choice means "follow the OS", which is the default: the CSS reads
 * prefers-color-scheme and nothing is stamped on <html>. The first click pins
 * an explicit theme; from then on data-theme decides and the OS is ignored.
 *
 * Load this in <head> so the attribute is set before first paint — deferring
 * it flashes the wrong theme.
 */
(function () {
  'use strict';

  var KEY = 'orb-loaders-theme';
  var root = document.documentElement;

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function systemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function current() {
    return root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light');
  }

  function apply(theme) {
    if (theme === 'dark' || theme === 'light') root.setAttribute('data-theme', theme);
    else root.removeAttribute('data-theme');
    // Anything that renders its own colours (a canvas, say) listens for this.
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: current() } }));
  }

  // Pin a theme and remember it. Null goes back to following the OS.
  function set(theme) {
    try {
      if (theme) localStorage.setItem(KEY, theme);
      else localStorage.removeItem(KEY);
    } catch (e) { /* private mode — this session only */ }
    apply(theme);
    relabel();
  }

  var relabel = function () {};

  // Runs at parse time, before the body exists — no flash.
  apply(stored());

  // The toggle button lives in the header, so wait for it.
  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.querySelector('.theme-toggle');
    if (!btn) return;

    relabel = function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      btn.setAttribute('aria-label', 'Switch to ' + next + ' theme');
      btn.setAttribute('title', 'Switch to ' + next + ' theme');
    };

    btn.addEventListener('click', function () {
      set(current() === 'dark' ? 'light' : 'dark');
    });

    // Track the OS while no explicit choice is pinned.
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
        if (!stored()) { apply(null); relabel(); }
      });
    }

    relabel();
  });

  window.OrbTheme = { current: current, set: set };
}());

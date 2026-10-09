# Doodle Orbs

Six generative orb loaders, inspired by [css-doodle](https://css-doodle.com). One small cell repeated over a seeded
layout, placed in polar coordinates, animated by shared CSS keyframes. One dependency-free file.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/doodle-orbs/>, or open [`index.html`](index.html)
locally. All six variants, a size ladder, colour and speed controls, a seed reroll, and an inline-in-a-button example.
Serve it with a trailing slash (`/loaders/doodle-orbs/`): some static servers redirect the bare path and break the
relative script URL.

| File | What |
| --- | --- |
| `doodle-orbs.js` | The drop-in. UMD, ~14.9 KB raw, ~5.9 KB gzipped. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## The six variants

| Variant | Look |
| --- | --- |
| `ring-wave` | Polar dot rings with a wave running round them; the rings run in opposite directions |
| `spiral-galaxy` | Golden-angle (phyllotaxis) spiral. The inner arm spins faster than the outer; each dot twinkles on its own seed |
| `petal-orb` | Rotated petals swell in turn as the flower turns, with a core beating underneath |
| `orbiting-cells` | Cells on faint orbit rings; inner orbits run faster, alternate orbits reverse |
| `grid-sphere` | A square dot grid clipped to a disc and sized like a shaded sphere. Each breath ripples out from the centre |
| `arc-rings` | Concentric partial rings, each sweeping at its own tempo and direction |

---

## Usage

```html
<script src="doodle-orbs.js"></script>
<div id="loader"></div>
<script>
  const orb = DoodleOrbs.mount(document.getElementById('loader'), {
    variant: 'spiral-galaxy',
    size: 96,
    color: 'currentColor',
    speed: 1,
    seed: 7,
    label: 'Loading'
  });

  orb.destroy();   // removes the nodes and listeners
</script>
```

`DoodleOrbs.VARIANTS` lists the variant ids. An unknown variant throws a `RangeError` naming the valid ones.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `variant` | `'ring-wave'` | One of the six above. |
| `size` | `64` | Pixels, 8 to 1024. Three tuned tiers: up to 32 px (inline), 33 to 72 px (control), larger (hero). Each tier has its own cell count and dot size. |
| `color` | inherited | Any CSS colour, including `var(--x)`. Unset, the orb uses `currentColor`, so it takes the text colour of whatever it sits in. |
| `speed` | `1` | Multiplier on every duration. Clamped to 0.1 to 5. |
| `seed` | per variant | Integer. Same seed, same layout and timing offsets. Reroll for a different galaxy. |
| `label` | `'Loading'` | The accessible name. The orb is `role="img"`. |

Theme: there is no theme option. Point `color` at a CSS variable and change the variable. The demo does this with
`--orb-ink` and re-tints live, without re-mounting.

### Behaviour

- **No JavaScript per frame.** The generator runs once at mount. The browser then animates `translate`, `rotate`, `scale`
  and `opacity`, which stay on the compositor.
- **Self-pausing.** Animations pause when the orb is offscreen (`IntersectionObserver`) or the tab is hidden.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` every cell holds a static pose and the whole orb fades
  gently in opacity (3.2 s). No spatial movement, but it still reads as "busy".
- **Cleanup.** `destroy()` removes the nodes, the observer and the `visibilitychange` listener. The shared `<style>`
  element is reference-counted and removed with the last orb. `destroy()` twice is safe.
- **Zero network requests.** A CSP that blocks inline `<style>` needs `style-src 'unsafe-inline'` or a nonce; the
  stylesheet is injected at mount.

---

## Approach: reimplement, do not vendor

The brief allowed either vendoring the css-doodle runtime or reimplementing the looks. I reimplemented, because it is
lighter and the licence story is simpler.

- The upstream repository ships source only. Its runtime, `css-doodle.min.js`, is a build artefact: the `src/` tree is
  525 KB, and the build needs `esbuild` and `swc`. Vendoring means running a build in untrusted source, or taking an
  npm tarball, for a web component that carries a CSS parser, a function library, SVG, shader and noise support.
- A loader uses almost none of that. The part worth keeping is the idea: write one cell, vary it per index with a seeded
  random, place it in polar coordinates. That is about 100 lines of generator.
- Result: 14.9 KB raw and 5.9 KB gzipped for six variants, against a runtime many times larger that parses its own
  CSS dialect in the browser on every mount.
- No css-doodle code is copied. The file header still carries the MIT notice and credits Yuan Chuan, because the
  design idea and the name are theirs and the cost of crediting is zero.

## Changes from upstream

css-doodle is a general generative-art runtime, not a loader kit. The changes below are what making a loader out of
its idea took.

- **Placement is resolved once, in JavaScript, not per mount in a CSS interpreter.** Polar coordinates become `--x` and
  `--y` in a 100-unit grid. Everything scales from one variable, so any size is one number.
- **Compositor-only motion.** Cells animate with the individual transform properties (`translate`, `rotate`, `scale`)
  plus `opacity`. Placement is `translate`, the pulse is `scale`, and the two never fight. No `width`, `top` or `filter`
  is animated.
- **Phase by negative delay.** Wave, ripple and twinkle offsets are `animation-delay: calc(var(--t) * var(--p) * -1)`,
  so every orb is mid-motion on first paint instead of starting from a synchronised dead pose.
- **Easing chosen per job.** Pulses use a gentle in-out (`cubic-bezier(.45,.05,.55,.95)`); constant rotation is linear so
  it never surges; arc sweeps use a near-linear curve (`.45,.15,.55,.85`) so they breathe without stalling.
- **Rhythm.** Every ring, orbit and arc has a different period (e.g. 3.4 / 2.4 / 1.5 s) so the loop does not visibly
  repeat. The breathing grid runs slowest (3.8 s) because it is the calmest.
- **Differential rotation.** The galaxy's inner arm turns 2.9x faster than the outer, which reads as depth with no 3D.
- **Sphere shading in a flat grid.** Dot size follows `sqrt(1 - d^2)` and the ripple delay follows `d`, so a plain dot
  grid reads as a breathing sphere.
- **Three size tiers.** 20 px and 96 px are separate designs, not one design scaled: fewer, heavier cells inline (the
  20 px ring is 8 dots, not 24), full detail at hero size.
- **Seeded layout.** css-doodle's `@seed` is mulberry32 here. A given seed gives the same orb every time.
- **Reduced motion with intent.** Static poses are computed to match the animation's phase, plus a slow opacity breathe,
  instead of freezing a random frame.
- **Self-pausing and clean teardown.** Offscreen and hidden-tab pause, reference-counted stylesheet, idempotent
  `destroy()`.
- **Ink follows the page.** `currentColor` by default, so a loader inside a button or a heading matches its text and
  re-tints with the theme. Opacity ramps, not hue shifts, give depth in both light and dark.

---

## Upstream and licence

Inspired by [css-doodle](https://github.com/css-doodle/css-doodle) ([css-doodle.com](https://css-doodle.com)) by
Yuan Chuan, **MIT**. No upstream code is included; the MIT notice is reproduced in the header of `doodle-orbs.js`
and stays there.

# Activity Indicators

Eight CSS-only activity indicators in one dependency-free stylesheet: the Loaders.css animations that
the iOS library NVActivityIndicatorView is built on, retuned. No JavaScript. Colour comes from
`currentColor`, size from one custom property.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/activity-indicators/>, or open
[`index.html`](index.html) locally. All eight variants, a size ladder from 16 to 96 px, in-context
examples (button, inline text, panel), and a copyable snippet.

| File | What |
| --- | --- |
| `activity-indicators.css` | The drop-in. About 14 KB raw including the licence header, 3.7 KB gzipped. |
| `index.html` | Standalone demo page. Works from disk. |

## Variants

| Class | Children | Looks like |
| --- | --- | --- |
| `ai-ball-pulse` | 3 | Three dots shrink and recover in a rolling beat |
| `ai-ball-pulse-sync` | 3 | Three dots hop in a quick wave |
| `ai-ball-grid-pulse` | 9 | Nine dots breathe, each at its own pace |
| `ai-ball-clip-rotate-multiple` | 2 | Two broken rings spin against each other |
| `ai-ball-scale-ripple` | 2 | Rings spread outward and fade, like a sonar ping |
| `ai-line-scale-pulse-out` | 5 | Five bars squeeze in, centre first |
| `ai-line-spin-fade` | 8 | Eight spokes light up in turn with a fading tail |
| `ai-ball-triangle-path` | 3 | Three rings swap corners along a triangle |

All eight are types NVActivityIndicatorView ships (ballPulse, ballPulseSync, ballGridPulse,
ballClipRotateMultiple, ballScaleRipple, lineScalePulseOut, lineSpinFadeLoader, ballTrianglePath).

## Usage

```html
<link rel="stylesheet" href="activity-indicators.css">

<div class="ai-ball-pulse" role="status" aria-label="Loading" style="--ai-size: 48px; color: #6d28d9">
  <div></div>
  <div></div>
  <div></div>
</div>
```

Children can be any element. Inside a `<button>` use `<span>` rather than `<div>`.

### Options (CSS custom properties)

| Property | Default | Notes |
| --- | --- | --- |
| `--ai-size` | `40px` | Width and height of the box. Every dot, line, border and travel distance derives from it. |

Colour is `currentColor`: set `color` on the indicator or any ancestor. The root is block-level or a
flex box, so beside text put it in a flex parent. Mark it `aria-hidden="true"` when adjacent text
already says "Loading".

## Upstream and licence

- **Web original:** [Loaders.css](https://github.com/ConnorAtherton/loaders.css) by Connor Atherton.
  MIT, Copyright (c) 2016 Connor Atherton. Licence evidence: GitHub shows "no licence detected" because
  the repository has no `LICENSE` file, but the licence is stated three times in the repository: the
  `README.md` "Licence" section carries the full MIT text and copyright line, and `package.json` and
  `bower.json` both declare `"license": "MIT"`. That is a clear, permissive grant, so it is vendored
  here with the full text in the header of `activity-indicators.css`.
- **Native port, used as a reference only:**
  [NVActivityIndicatorView](https://github.com/ninjaprox/NVActivityIndicatorView) by Vinh Nguyen
  (ninjaprox). MIT, Copyright (c) 2016 Vinh Nguyen. Its animation list showed which Loaders.css
  variants are worth keeping, and its README credits Loaders.css as the inspiration. No code from it is
  used here.

## Changes from upstream

- **Subset and rename.** Eight of the 31 animations, classes renamed `.ai-*` so they cannot collide
  with a page that still loads the full Loaders.css.
- **Scales from one value.** Upstream is fixed-pixel (15 px balls, 35 px lines, 50 px triangle paths)
  and white (`$primary-color: #fff`). Every dimension is now a fraction of `--ai-size`, so the same
  markup is a 20 px inline spinner or a 96 px hero. Colour is `currentColor`.
- **No Sass.** The shipped upstream stylesheet is compiled Sass with vendor-prefixed duplicates. This is
  plain CSS, with delays computed by `calc((var(--i) - n) * step)`.
- **Deterministic grid pulse.** `ball-grid-pulse` used Sass `random()`. The compiled upstream roll of
  delays and durations is kept as literal values, so the rhythm is the same every load.
- **Children match any element.** Selectors are `> *`, not `> div`, so the markup is valid inside a
  `<button>`.
- **Easing.** Ball pulse keeps upstream's soft overshoot. Everything else moves to sine in-out
  (`cubic-bezier(.37, 0, .63, 1)`) or quart-out (`cubic-bezier(.25, 1, .5, 1)`). Upstream's
  `line-scale-pulse-out` used a lopsided `cubic-bezier(.85, .25, .37, .85)`.
- **Dots no longer vanish.** `ball-pulse` shrank to scale 0.1, which left nothing on screen. It now
  bottoms out at 0.35 with a dip in opacity.
- **Ripple has two rings.** Upstream `ball-scale-ripple` is one ring, so the centre is empty half the
  time. A second ring half a cycle behind keeps it continuous. Scale eases out while opacity fades
  linearly, as two separate animations, so the ring does not look finished before it has faded.
- **Spoke wheel rebuilt.** `line-spin-fade` positioned each line with hard-coded pixel offsets and
  pulsed them all alike. Lines now rotate about the centre and fade as a tail behind a bright head,
  which reads as direction.
- **Counter-rotation is calmer.** The inner ring of `ball-clip-rotate-multiple` ran at 0.5 s against
  1 s. It is now 0.8 s against 1.2 s, and the line weight scales with size (minimum 2 px).
- **Triangle path scales.** The travel distance is 70% of `--ai-size`, so it stays inside its box at any
  size, and the rings have a minimum 6 px diameter and 1.5 px stroke for small sizes.
- **Minimum feature sizes.** Dots, bars and strokes have pixel floors (`max(4px, ...)`, `max(3px,
  ...)`, `max(2px, ...)`) so 16 to 24 px inline use stays legible.
- **Reduced motion.** Upstream had none. Under `prefers-reduced-motion: reduce` each indicator holds a
  static composition and breathes in opacity over 3 s. Nothing moves, rotates or scales.
- **Only `transform` and `opacity` animate**, so every indicator stays on the compositor.

Note for demo pages: `assets/glass.css` clamps every animation to 0.001 ms under reduced motion. The
demo restates the 3 s breathing duration for the indicator roots so the calm fallback does not flicker.
Pages that do not load `glass.css` need nothing extra.

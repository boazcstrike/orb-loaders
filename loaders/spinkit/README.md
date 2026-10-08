# SpinKit

Eight CSS-only loading spinners in one dependency-free stylesheet. No JavaScript. Colour comes
from `currentColor`, size from one custom property.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/spinkit/>, or open
[`index.html`](index.html) locally. All eight variants, a size ladder from 16 to 96 px, in-context
examples (button, inline text, panel), and a copyable snippet.

| File | What |
| --- | --- |
| `spinkit.css` | The drop-in. About 13 KB raw including the licence header, 3.6 KB gzipped. |
| `index.html` | Standalone demo page. Works from disk. |

## Variants

| Class | Looks like | Upstream name (Android-SpinKit) |
| --- | --- | --- |
| `sk-chase` | Six dots chase round a ring, shrinking as they go | SpinKit v2 "chase" |
| `sk-bounce` | Two discs swell and fade in turn | DoubleBounce |
| `sk-wave` | Five bars ripple left to right | Wave |
| `sk-flow` | Three dots swell in sequence | ThreeBounce |
| `sk-swing` | Two dots pulse on a rotating axis | ChasingDots |
| `sk-circle-fade` | A bright head and fading tail circle a dim ring | FadingCircle |
| `sk-grid` | Nine cubes collapse in a diagonal wave | CubeGrid |
| `sk-fold` | Four tiles fold in, hold, and flip away | FoldingCube |

## Usage

```html
<link rel="stylesheet" href="spinkit.css">

<div class="sk-wave" role="status" aria-label="Loading" style="--sk-size: 48px; color: #6d28d9">
  <div class="sk-wave-rect"></div>
  <div class="sk-wave-rect"></div>
  <div class="sk-wave-rect"></div>
  <div class="sk-wave-rect"></div>
  <div class="sk-wave-rect"></div>
</div>
```

Child counts: chase 6, bounce 2, wave 5, flow 3, swing 2, circle-fade 12, grid 9, fold 4. Children
can be any element; inside a `<button>` use `<i>` or `<span>` rather than `<div>`.

### Options (CSS custom properties)

| Property | Default | Notes |
| --- | --- | --- |
| `--sk-size` | `40px` | Width and height of the box. `sk-flow` is `--sk-size` wide and about a third as tall. |
| `--sk-color` | `currentColor` | Optional. Leave unset and the spinner takes the text colour. |

The root is block-level. Beside text, put it in a flex parent (`display: flex; align-items: center`).
Mark it `aria-hidden="true"` when adjacent text already says "Loading".

## Upstream and licence

- **Web original:** [SpinKit](https://github.com/tobiasahlin/SpinKit) by Tobias Ahlin
  (`package.json`: Tobias Ahlin Bjerrome). MIT, Copyright (c) 2020 Tobias Ahlin. The `LICENSE` file
  in that repository was read, and its full text is in the header of `spinkit.css`.
- **Android port, used as a reference only:** [Android-SpinKit](https://github.com/ybq/Android-SpinKit)
  by ybq (Beijing). MIT, Copyright (c) 2016 ybq. Its variant list showed which spinners are worth
  keeping. No code from it is used here.

## Changes from upstream

- **Subset.** Eight of the web variants, picked for range. Dropped: plane (a flat flipping square),
  pulse and circle (near-duplicates of bounce and circle-fade), wander (its distance hack needs a nested
  `calc()` per cube).
- **`currentColor` instead of a global `--sk-color: #333`.** Upstream declared `--sk-size` and
  `--sk-color` on `:root`, which fought any page that set them. Sizes now read
  `var(--sk-size, 40px)` and colour reads `var(--sk-color, currentColor)`, so nothing is declared
  globally and the spinner works in dark mode, in a button, or in a coloured banner with no rule.
- **Dots centred on the ring.** In upstream v2 the dots of chase and circle sit in the corner of their
  rotating box, so the ring has a radius of about 0.6 times the size and spills roughly 10% outside the
  layout box. They are centred now: the ring fits its box exactly and `--sk-size` means what it says.
- **Easing.** Linear and plain `ease-in-out` curves became sine in-out (`cubic-bezier(.37, 0, .63, 1)`)
  for loops and quart-out (`cubic-bezier(.25, 1, .5, 1)`) for the circle-fade head, so motion
  accelerates and settles instead of ticking. `sk-fold` eases out of each flip and holds, where upstream
  was linear.
- **Opacity rides the motion.** Chase dots dim as they shrink, wave bars dim at rest, flow dots dim
  when small, swing dots dim when small. Depth reads better than scale alone. `sk-bounce` no longer holds
  a flat 0.6 opacity, so the two discs stop darkening where they overlap.
- **A floor on `sk-circle-fade`.** Upstream dropped dots to opacity 0 between passes, so the ring
  disappeared. A 0.14 floor leaves a faint guide ring.
- **Gutters in `sk-grid`.** Upstream cubes tile edge to edge and rest as a solid block. Cubes now rest
  at 0.84 scale with 12% radius, which reads as a grid of tiles. Layout moved from `float` to CSS grid.
- **Size tuning for 16 to 24 px.** Dots and bars have minimum pixel sizes (`max(3px, 15%)`, `max(2px,
  14%)`, `min-width: 4px`), so inline spinners stay legible instead of sub-pixel. `sk-flow` is now a
  short row sized to its dots rather than a square with the dots stuck to the top.
- **Fold stays in its box.** The rotating diamond is scaled to 0.7 so its corners no longer poke
  outside the layout box, and `backface-visibility: hidden` avoids flicker.
- **Reduced motion.** Upstream had none. Under `prefers-reduced-motion: reduce` every spinner holds a
  static composition that still reads as busy (a tapering tail, a wave envelope, a ring of varying
  weight) and the whole spinner breathes in opacity over 3 s. Nothing moves or scales.
- **Less CSS.** Per-child `nth-child` delay tables replaced by `calc()` over a `--i` index, so
  circle-fade is 12 one-line index rules instead of 24 delay rules.
- **Only `transform` and `opacity` animate**, so every spinner stays on the compositor.

Note for demo pages: `assets/glass.css` clamps every animation to 0.001 ms under reduced motion. The
demo restates the 3 s breathing duration for the spinner roots so the calm fallback does not flicker.
Pages that do not load `glass.css` need nothing extra.

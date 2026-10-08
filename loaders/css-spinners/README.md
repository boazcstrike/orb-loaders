# CSS Spinners

Eight pure-CSS loading spinners in one plain stylesheet. Empty `<div>`s for markup, no script, no
dependency. Colour is `currentColor`; every length comes from one custom property, `--cs-size`.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/css-spinners/>, or open
[`index.html`](index.html) locally: all eight spinners, a size matrix, a colour switch, in-context
examples and copyable markup.

| File | What |
| --- | --- |
| `css-spinners.css` | The drop-in. ~10.8 KB raw, ~2.7 KB gzipped. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## Variants

Each root needs exactly the number of empty child `<div>`s shown.

| Class | Children | Animation | Accessibility pattern |
| --- | --- | --- | --- |
| `.cs-spinner` | 12 | Twelve bars, a bright head and a fading tail. | `role="status"` wrapper + `<span class="cs-sr">Loading…</span>` for a page or panel wait |
| `.cs-default` | 12 | Twelve dots on a circle; a swell of size and brightness travels round. | `role="status"` wrapper + `cs-sr` text |
| `.cs-ring` | 4 | Four arcs chase each other round one circle. | `aria-hidden="true"` inside a button that keeps visible text and `aria-busy="true"` |
| `.cs-roller` | 8 | A fan of eight dots winds up and releases, each a beat behind. | `role="status"` wrapper + `cs-sr` text |
| `.cs-ripple` | 2 | Two rings spread out and fade, like a sonar ping. | `role="img"` + a specific label, e.g. `aria-label="Searching nearby"` |
| `.cs-facebook` | 3 | Three bars breathe in turn. | `role="progressbar"` + `aria-label="Loading"` with no `aria-valuenow` (indeterminate) |
| `.cs-ellipsis` | 4 | Dots shuffle left while a new one grows in. | `role="status"` wrapper + `cs-sr` verb text, e.g. `Sending…` |
| `.cs-grid` | 9 | Nine dots dim and shrink in a diagonal wave. | `role="status"` wrapper + `cs-sr` text |

When a spinner sits beside visible text, the words carry the meaning. Mark the spinner
`aria-hidden="true"` and put `aria-busy="true"` on the control or region that is updating. Use
`role="status"` only for a spinner that stands alone.

The `cs-sr` text is visually hidden but read aloud. A live region that is empty when it is inserted is often
not announced, so keep a persistent `role="status"` region on the page, or set `aria-busy="true"` on the
region being loaded; insert the spinner first, then the text.

---

## Usage

```html
<link rel="stylesheet" href="css-spinners.css">

<div role="status">
  <div class="cs-ring" style="color: #6d28d9; --cs-size: 32px">
    <div></div><div></div><div></div><div></div>
  </div>
  <span class="cs-sr">Loading…</span>
</div>

<!-- decorative, beside visible text -->
<span class="cs-ring" aria-hidden="true" style="--cs-size: 16px">
  <div></div><div></div><div></div><div></div>
</span> Saving
```

| Property | Default | Notes |
| --- | --- | --- |
| `--cs-size` | `80px` | The square the spinner fits in. Bars, dots and borders scale from it. 16 px sits in a button or a line of text, 24 px in a toolbar, 64 px as a panel loader. |
| `color` | inherited | Everything is `currentColor`. Set it on the element or any ancestor. |

### Reduced motion

Under `prefers-reduced-motion: reduce` the child animations stop. Each spinner holds a rest pose
(the bars graded, the ring fanned into an arc, the roller's dots fanned out) and the whole spinner
breathes in opacity, 1 to 0.4 over 2.4 s. The duration is `!important` so a page-wide
`* { animation-duration: .001ms !important }` reset cannot turn it into a flicker.

---

## Upstream and licence

Picked from [loading.io css spinner](https://loading.io/css/) by loading.io (zbryikt, Taipei). Source:
<https://github.com/loadingio/css-spinner>.

**CC0 1.0.** Upstream README: "All loader files here are released under CC0 License." No permission
or attribution is required. The author asks for a link back, which is kept in the header of
`css-spinners.css` and on the demo page:
[loading.io css spinner ( https://loading.io/css/ )](https://loading.io/css/). Upstream's other source
code, not used here, is MIT.

---

## Changes from upstream

Eight of upstream's twelve spinners are kept, renamed `.lds-<x>` to `.cs-<x>`. Left out: `dual-ring`
(a near-twin of `ring`), and the novelty shapes `circle`, `heart` and `hourglass`.

- **One sizing property.** Upstream is fixed at 80 px with every offset in pixels. Every length is now
  `calc(var(--cs-size) / 80 * n)`, so the same markup scales cleanly from 16 px to 120 px. Strokes and
  dots have a 1-1.5 px floor so they do not vanish at small sizes.
- **`--i` index instead of hand-written offsets.** Upstream positions each of the 12 bars and dots with
  its own `top`/`left` and delay pair (24 near-identical rules per spinner). Each child is now rotated
  by `calc(var(--i) * 30deg)` and delayed from the same index.
- **Ellipsis easing was never applied.** Upstream sets `animation-timing-function: cubic-bezier(0, 1, 1, 0)`
  on the dots, then overrides it with the `animation:` shorthand in each `nth-child` rule, which resets
  the timing function to the default. The intended curve never ran. Replaced with an explicit
  `cubic-bezier(.65, 0, .35, 1)`, and the beat shortened from 0.6 s to 0.7 s so the shuffle is readable.
- **Ripple and facebook no longer animate layout.** Upstream animates `top`, `left`, `width` and
  `height`. Ripple now animates `inset` on two elements (the border must stay a constant width, so
  `scale` is not an option); facebook uses `scaleY`, which runs on the compositor. Ripple's
  `4.9% / 5%` opacity jump is replaced with a short fade-in.
- **Facebook no longer snaps.** Upstream holds the bars short from 50% to 100% and then jumps tall at
  the loop point. Now `0% / 100%` tall and `50%` short on `ease-in-out`, so it breathes.
- **Spinner tail.** The twelve-bar fade is `ease`-shaped (bright head, longer dim tail) and stops at
  12% opacity, not 0, so the ring stays legible on both themes. Bars are pills, not 20% rounded.
- **Default gets brightness as well as size.** Dots rest at 70% opacity and swell to 160% at full
  opacity, and ease in and out, so the travelling highlight still reads at 16 px where a 1.3 px dot
  cannot grow visibly.
- **Roller and grid.** Roller geometry is a rotation and a radius from the centre instead of eight
  pre-computed coordinates. Grid moves from a flat `1 to 0.5` opacity pulse on `linear` to a `1 to 0.25`
  fade with a 65% shrink on `ease-in-out`, staggered by diagonal (`row + column`) so the wave travels.
- **Ring.** Border width is 10% of the size with a 1 px floor; delays are derived from `--i`.
- **Reduced motion.** Upstream has none. The fallback is described above.

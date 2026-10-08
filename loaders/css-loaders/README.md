# CSS Loaders

Eight ring and orb loaders in one plain stylesheet. Each is a single element, with no JavaScript. They take
their colour from `currentColor` and their size from `--cl-size`, so they follow any text colour and any theme.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/css-loaders/>, or open
[`index.html`](index.html) locally. It shows all eight, a size ladder from 16 to 96 px, a colour switch, light
and dark themes, in-context examples, and a copyable snippet.

| File | What |
| --- | --- |
| `css-loaders.css` | The drop-in. About 11 KB raw, most of it the licence header. |
| `index.html` | Standalone demo page. Loads the stylesheet by relative path; works from disk. |

---

## The eight

| Class | Animation | From upstream |
| --- | --- | --- |
| `cl-arc` | A quarter-ring turning on a faint track | circle01, circle02 |
| `cl-sweep` | A ring draws itself round, then erases from its tail | circle03 |
| `cl-counter` | An outer arc and a softer inner arc turning against each other | circle15 |
| `cl-twin` | Two dots swell and shrink in turn as the pair rotates | bubble02 |
| `cl-orbit` | A small moon circles a lit, breathing sphere | bubble33 |
| `cl-ripple` | Rings expand from a point and fade | circle20, bubble34 |
| `cl-segments` | Twelve segments with a comet tail, turning | circle21 |
| `cl-pulse` | A ring condenses from nothing, then thumps once | circle19 |

---

## Usage

```html
<link rel="stylesheet" href="css-loaders.css">

<span class="cl-arc" role="status" aria-label="Loading"></span>

<span class="cl-orbit" style="--cl-size: 96px; color: #0f766e"
      role="status" aria-label="Loading"></span>
```

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `--cl-size` | `48px` | Any CSS length, set on the element or an ancestor. Ring thickness is 10% of it, clamped to 2 to 6 px. |
| `color` | inherited | The loader's colour. Tracks and tails are derived from it with `color-mix`. |
| `.cl-paused` | none | Add to freeze a loader, for example from an `IntersectionObserver` when it scrolls offscreen. |

### Behaviour

- **No script.** Everything is CSS keyframes. Spin, scale, fade and ripple animate `transform` and
  `opacity` only. The one exception is `cl-sweep`, which animates a registered mask angle.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` nothing travels. Each loader holds one frame and
  breathes slowly in opacity. The duration is `!important`, so a page rule that shortens every animation to
  about 0 ms (as `assets/glass.css` does) cannot make it strobe.
- **Accessible.** Put `role="status"` and an `aria-label` on each loader. The animation itself is decorative.
- **Zero network requests.**
- **Browsers.** Modern evergreen. Without `@property`, `cl-sweep` steps instead of drawing smoothly. Without
  `color-mix`, tracks fall back to neutral grey.

---

## Changes from upstream

Upstream draws every loader in white and orange at a fixed `1px` unit, as a single `.loader` class. Changes:

- **One class per loader** (`.cl-<variant>`) so several can share a page. Upstream reuses `.loader` and
  `@keyframes` names such as `rotation`, which collide.
- **`currentColor` instead of hardcoded `#fff` and `#ff3d00`.** No brand orange; nothing to override per theme.
- **`--cl-size` replaces the `--size: 1px` multiplier.** One length instead of a unitless trick, and the
  default is 48 px.
- **Ring thickness scales with size and is clamped to 2 to 6 px.** Upstream's fixed 5 px ring is heavy at 20 px
  and thin at 96 px.
- **`cl-arc`:** added a track ring so it reads as a gauge.
- **`cl-sweep`:** upstream clips a square polygon, so the arc length is not linear in angle and the ring seems to
  lurch at the corners. This masks with a conic gradient and animates the start and end angles with an
  ease-in-out, so the draw speed is even.
- **`cl-counter`:** the inner arc is 58% opacity instead of a second brand colour, so the two rings stay
  separate at 20 px.
- **`cl-twin`:** upstream sits both dots on the left edge, so the pair wobbles around the axis. They are
  centred on it. The dots ease in and out, and the second is softer so the pair has a lead.
- **`cl-orbit`:** the plain disc becomes a lit sphere (radial highlight) that breathes. The moon is a painted
  dot on a turning layer instead of an animated shadow, so only `transform` animates.
- **`cl-ripple`:** added the centre dot, an ease-out expansion (fast start, slow fade) and a negative delay
  on the second ring so it is already out when the page paints.
- **`cl-segments`:** `border: dotted` renders differently in every browser and turns to mush under 24 px.
  Rebuilt as twelve conic-masked segments with a comet-tail gradient.
- **`cl-pulse`:** upstream is linear, so the thump is a hard kink. Eased in and out.
- **Negative delays everywhere**, so no loader sits blank for its first beat.
- **Reduced-motion fallback** and a `.cl-paused` utility, neither of which upstream has.

Not ported: the other ~330 upstream samples (progress bars, skeletons, text, graph, shapes). They are not rings
or orbs.

---

## Upstream and licence

Adapted from [css-loader](https://github.com/vineethtrv/css-loader) by Vineeth TR (vineethtrv), Kerala, India.
Demo: <https://cssloaders.github.io/>. **MIT**, `Copyright (c) 2021 CSS Loaders`.

The full licence text and the list of adaptations are in the header of `css-loaders.css`. Keep it there.

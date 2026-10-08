# Three Dots

Eight single-element dot loaders in one plain stylesheet. One `<div>` per loader, no script, no
dependency. Colour is `currentColor`; every length comes from one custom property, `--td-size`.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/three-dots/>, or open
[`index.html`](index.html) locally: all eight variants, a size matrix, a colour switch, in-context
examples and copyable markup.

| File | What |
| --- | --- |
| `three-dots.css` | The drop-in. ~12 KB raw, ~3.5 KB gzipped, about 2 KB of that the licence header. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## Variants

| Class | Animation | Footprint (in dot diameters) | Accessibility pattern |
| --- | --- | --- | --- |
| `.td-flashing` | Three dots fade up in a left-to-right wave. The calmest. | 4 wide | `role="status"` wrapper + `td-sr` text |
| `.td-pulse` | Dots swell and settle in turn; never shrink to nothing. The general-purpose pick. | 4.5 wide | `role="status"` wrapper + `td-sr` text |
| `.td-elastic` | A vertical stretch rolls across the row. | 4 wide | `role="status"` wrapper + `td-sr` text |
| `.td-typing` | Each dot hops and brightens in turn. The chat typing idiom. | 4 wide | `role="status"` wrapper + specific `td-sr` text, e.g. `Assistant is replying` |
| `.td-falling` | Dots drop in, hold, then fall away. | 4 wide | `role="status"` wrapper + `td-sr` text |
| `.td-collision` | Newton's cradle: outer dots swing out and strike back. | 6 wide | `role="status"` wrapper + `td-sr` text |
| `.td-revolution` | Two dots orbit a centre dot at different speeds. | 7 x 7 | `role="status"` wrapper + `td-sr` text; use at hero or empty-state size |
| `.td-windmill` | A triangle of dots turns in eased 120-degree steps. | 3 x 3 | `role="status"` wrapper + `td-sr` text |

When a loader sits beside visible text ("Saving", "Syncing your notes"), the words carry the meaning.
Mark the loader `aria-hidden="true"` and put `aria-busy="true"` on the control or region that is
updating. Use `role="status"` only for a loader that stands alone.

The `td-sr` text is visually hidden but read aloud. A live region that is empty when it is inserted is often
not announced, so keep a persistent `role="status"` region on the page, or set `aria-busy="true"` on the
region being loaded; insert the loader first, then the text.

---

## Usage

```html
<link rel="stylesheet" href="three-dots.css">

<div role="status">
  <div class="td-pulse" style="color: #6d28d9; --td-size: 10px"></div>
  <span class="td-sr">Loading…</span>
</div>

<!-- decorative, beside visible text -->
<span class="td-flashing" aria-hidden="true" style="--td-size: 3px"></span> Saving
```

| Property | Default | Notes |
| --- | --- | --- |
| `--td-size` | `10px` | Dot diameter. The whole loader, its spacing and its layout margins scale from it. About `3px` sits inline with body text, `10px`-`12px` suits a panel. |
| `color` | inherited | Dots are `currentColor`. Set it on the element or any ancestor. |

The element is an `inline-block` with `vertical-align: middle`, and its margins are its real
footprint, so it lays out like an ordinary inline element and does not overlap neighbours.

### Reduced motion

Under `prefers-reduced-motion: reduce` the dots hold their rest pose and the whole loader breathes in
opacity (1 to 0.4 over 2.4 s). That fade is not spatial motion, so it is a calm fallback rather than a
frozen frame. Its duration is `!important` so a page-wide `* { animation-duration: .001ms !important }`
reset cannot turn it into a flicker.

### Browser support

`color-mix()` (flashing, pulse, typing, falling) needs Chrome 111, Safari 16.2 or Firefox 113. Without
it the affected declarations are dropped and those four variants lose their fade but keep their motion.

---

## Upstream and licence

Picked from [three-dots](https://github.com/nzbin/three-dots) by Zongbin (nzbin), Beijing. Demo:
<https://nzbin.github.io/three-dots/>.

**MIT**, Copyright (c) 2018 Zongbin. The full notice is in the header of `three-dots.css`. Keep it
there.

---

## Changes from upstream

Upstream ships 20 dot variants in SCSS/LESS with a fixed 10 px dot and a hard-coded purple. Eight are
kept, renamed `.dot-<x>` to `.td-<x>`, and rewritten as plain CSS.

- **One sizing property.** Every length is derived from `--td-size`. Upstream hard-codes pixel offsets
  and scales by editing SCSS variables and rebuilding.
- **`currentColor`.** Upstream bakes in `#9880ff` and fades via `rgba()` of that fixed colour. Here the
  fade is `color-mix()` against `currentColor`, so the loader follows any text colour and both themes.
- **Real layout footprint.** Upstream dots overflow their one-dot box, so you must add your own margin
  or they collide with neighbours. Each variant now carries margins matching what it draws.
- **No `left: -9999px` layout hack.** Upstream's pulse, typing and falling park the element far to the
  left and offset a `box-shadow` back. That overflows scrollable area in right-to-left pages. Here the
  element is parked 9999px up instead, where overflow is never scrollable.
- **Eased curves, not linear.** Upstream animates nearly everything `linear`. `flashing`, `pulse`,
  `typing` and `elastic` use `ease-in-out`; `falling` decelerates in and accelerates out (gravity);
  `collision` swings out on ease-out and returns on ease-in (a pendulum). `revolution` keeps `linear`
  because constant angular speed is the point.
- **Windmill steps.** Upstream spins the triangle 720 degrees at constant speed. The three dots are
  identical, so the triangle now advances in eased 120-degree steps (`cubic-bezier(.65,0,.35,1)`) and
  each step lands on a frame that looks like the first.
- **Revolution speeds.** Upstream's outer dot orbits faster (1 s) than the inner (1.4 s). Swapped to
  inner 1.2 s, outer 2 s, so the outer one drifts the way an orbit does.
- **Stagger.** Upstream starts every dot at a fixed positive delay, so the first cycle begins with the
  dots at rest. Delays are now negative and derived from one `--_lag` step, so the wave is already
  running on the first frame, left to right.
- **Elastic without compounding.** Upstream scales the centre dot and its two pseudo-element children
  together, so the children's stretch is multiplied by the parent's and the squash is lost. The three
  humps are now timed back to back so they never overlap, and only `scaleY` is applied to the parent.
- **Pulse never vanishes.** Upstream's pulse shrinks the dots to zero between beats. The rest size is
  now 0.6 of `--td-size` at 75% alpha, so the loader always reads as present, including at 3 px.
- **Typing brightens.** Resting dots sit at 45% alpha and the hopping dot rises to full, which reads
  as "this one is active" without relying on movement alone.
- **Falling timing.** Entry, hold and exit are 30%, 20% and 35% of the cycle with distinct curves for
  each, instead of one linear fade-and-drop.
- **Reduced motion.** Upstream has none. The fallback is described above.
- **Kept out:** `bricks`, `carousel`, `fire`, `floating`, `gathering`, `hourglass`, `overtaking`,
  `rolling`, `shuttle`, `spin`, `stretching` and the emoji `bouncing` (experimental, or wide and
  heavily dependent on `box-shadow` colour lists that cannot follow `currentColor` cleanly).

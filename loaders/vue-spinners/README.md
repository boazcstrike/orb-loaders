# Vue Spinners

Eight spinners extracted from [vue-spinner](https://github.com/greyby/vue-spinner), with no Vue. The Vue
components are reduced to plain markup and one stylesheet, and an optional 3 KB script builds the markup and
freezes spinners that are offscreen.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/vue-spinners/>, or open
[`index.html`](index.html) locally. It shows all eight, a size ladder from 16 to 96 px, a colour switch, light
and dark themes, in-context examples, and a copyable snippet.

| File | What |
| --- | --- |
| `vue-spinners.css` | The drop-in. About 13 KB raw, most of it the two licence notices. |
| `vue-spinners.js` | Optional. UMD, about 3 KB. `VueSpinners.mount(host, opts)` returns `{ destroy, setPaused, el }`. |
| `index.html` | Standalone demo page. Loads both files by relative path; works from disk. |

---

## The eight

| Class | Animation | Upstream component |
| --- | --- | --- |
| `vs-clip` | An open ring turns while it breathes in and out | `ClipLoader` |
| `vs-ring` | Two rings tumble in 3D, one bold and one faint | `RingLoader` |
| `vs-moon` | A small moon runs round a faint ring | `MoonLoader` |
| `vs-dot` | Two dots swell and shrink at opposite ends of a turning bar | `DotLoader` |
| `vs-bounce` | Two translucent discs swell in turn and blend where they overlap | `BounceLoader` |
| `vs-pulse` | Three dots shrink in sequence with an overshoot | `PulseLoader` |
| `vs-sync` | Three dots dip and rise in a wave | `SyncLoader` |
| `vs-grid` | Nine dots flicker on their own clocks | `GridLoader` |

---

## Usage

With the script:

```html
<link rel="stylesheet" href="vue-spinners.css">
<script src="vue-spinners.js"></script>
<div id="loader"></div>
<script>
  const spinner = VueSpinners.mount(document.getElementById('loader'), {
    variant: 'ring',
    size: 64,
    color: '#0f766e',
    label: 'Loading'
  });

  spinner.destroy();          // removes the node and every listener
  spinner.setPaused(true);    // freeze without tearing down
</script>
```

With the CSS alone:

```html
<span role="status"><span class="vs-ring" style="--vs-size: 64px"></span><span class="vs-sr">Loading…</span></span>
<span role="status"><span class="vs-pulse"><i></i><i></i><i></i></span><span class="vs-sr">Loading…</span></span>
<span role="status"><span class="vs-grid"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="vs-sr">Loading…</span></span>
```

The `vs-sr` text is visually hidden but read aloud. A live region that is empty when it is inserted is often
not announced, so keep a persistent `role="status"` region on the page, or set `aria-busy="true"` on the
region being loaded; insert the spinner first, then the text. `VueSpinners.mount` does this for you: the
spinner is the `role="status"` element, and it adds the `vs-sr` text one frame after inserting it.

`clip`, `ring`, `moon`, `dot` and `bounce` are one empty `span`. `pulse` and `sync` need three `<i>`, `grid` needs
nine.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `variant` | `'clip'` | One of `clip`, `ring`, `moon`, `dot`, `bounce`, `pulse`, `sync`, `grid`. An unknown name throws a `RangeError` listing the valid ones. |
| `size` | `48` | Pixels, sets `--vs-size`. For the round spinners it is the diameter; for `pulse`, `sync` and `grid` it is the overall width. |
| `color` | inherited | Any CSS colour. Default is the surrounding text colour (`currentColor`). |
| `label` | `'Loading'` | The accessible text, added as a visually-hidden span one frame after the spinner is inserted. |

### Behaviour

- **No animation frames.** Everything is CSS keyframes on `transform` and `opacity`. The script only toggles a
  class.
- **Self-pausing.** The script adds `vs-paused` while the spinner is scrolled offscreen or the tab is hidden.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` nothing travels. Each spinner holds one frame and
  breathes slowly in opacity. The duration is `!important`, so a page rule that shortens every animation to
  about 0 ms (as `assets/glass.css` does) cannot make it strobe.
- **Accessible.** `role="status"` with visually-hidden text (`vs-sr`) instead of an `aria-label` on an empty node.
- **Zero network requests.**

---

## Changes from upstream

Upstream ships each spinner as a Vue component that writes pixel values into inline styles. Changes:

- **No Vue.** Each component's markup and `<style>` block is reduced to a class plus a stylesheet. Spinners with
  two or three nested `div`s (`ring`, `moon`, `dot`, `bounce`) now use `::before` and `::after`, so they are one
  element.
- **`--vs-size` and `currentColor` replace the `size`, `margin`, `radius` and `color` props.** The default green
  (`#5dc596`) is gone; the spinner inherits the text colour.
- **Everything scales with size.** Upstream fixes `ClipLoader`'s border at 2 px and `SyncLoader`'s travel at 10 px,
  so they break at other sizes. Stroke width, gaps and travel are fractions of the size, with the stroke clamped
  to 2 to 6 px.
- **`vs-ring` now has real perspective.** Upstream sets `perspective: 800px` on the same element it rotates,
  which does nothing, so the rings tumble flat. The perspective is inside the `transform` and scales with the
  size. One ring is 85% opacity and the other 40%, so the pair has depth.
- **`vs-clip`:** the turn stays linear while the breath (scale 1, .8, 1) eases in and out. Upstream pushes both
  through one linear keyframe.
- **`vs-moon`:** the track is 16% opacity instead of 10%, which disappears on a dark page. The moon is exactly
  the track's width so it sits flush. Turn time 0.8 s instead of 0.6 s.
- **`vs-dot` and `vs-bounce`:** eased (upstream is linear for `DotLoader`), and the second half is a negative
  delay so both start mid-motion. Upstream's `BounceLoader` has a positive 1 s delay on its second disc,
  which leaves it blank at start.
- **`vs-pulse`:** dots shrink to 35% instead of 10%, which at 16 px was a vanishing act. Negative delays, so the
  wave is already running.
- **`vs-sync`:** the container is tall enough for the travel, so the dots no longer overflow their box.
- **`vs-grid`:** upstream calls `Math.random()` for every dot's delay and duration on each mount. These are fixed
  values with the same spread, so it looks the same each time and needs no script.
- **Reduced-motion fallback** and a `vs-paused` utility, neither of which upstream has.

Not ported: `BeatLoader`, `FadeLoader`, `PacmanLoader`, `RiseLoader`, `RotateLoader`, `ScaleLoader`,
`SkewLoader`, `SquareLoader`. They are bars, squares and shapes rather than rings and orbs.

---

## Upstream and licence

Extracted from [vue-spinner](https://github.com/greyby/vue-spinner) by greyby, Beijing, China. Demo:
<http://greyby.github.io/vue-spinner/>. **MIT**, `Copyright (c) 2015 greyby`.

vue-spinner's README says it is "Based on [Halogen](https://github.com/yuanyan/halogen) by yuanyan". Halogen is
also **MIT**, `Copyright (c) 2015 Yuanyan Cao`. Both notices are reproduced in full in the header of
`vue-spinners.css`, and `vue-spinners.js` points to them. Keep them there.

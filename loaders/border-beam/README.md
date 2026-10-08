# Border Beam

A glowing border that says "this is busy". A beam travels around a card, a pool of light slides along an
input, or the edge breathes in place. The animation is CSS; a small script builds the layers and tracks the
busy state.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/border-beam/>, or open [`index.html`](index.html)
locally. Four modes, four palettes, a size ladder from a 28 px chip to a 210 px panel, interactive busy
states, light/dark.

| File | What |
| --- | --- |
| `border-beam.css` | The effect. ~19 KB raw (about 5 KB gzipped), mostly licence header and gradient definitions. |
| `border-beam.js` | `BorderBeam.mount()`. UMD, ~9 KB raw, ~3.6 KB gzipped. |
| `index.html` | Standalone demo page. Works from disk. |

---

## Modes

| Mode | What it does | Good for |
| --- | --- | --- |
| `travel` | A bright arc circles the whole border. The colours sit still; the arc sweeps past them, so it changes hue as it goes. | Bounded tasks: upload, export, deploy. |
| `line` | A pool of light slides along the bottom edge, swelling toward the middle and fading at both ends. | Inputs and bars: search, filter, autosave. |
| `breathe` | Six soft lobes of colour sit on the edge and drift in and out of phase, inside the border. | Open-ended work with no progress, such as a model thinking. |
| `halo` | The same lobes bloom outward past the edge. | A single action that deserves attention: a button, a chip. |

Palettes: `spectrum`, `mono`, `cool`, `warm`.

## Usage

```html
<link rel="stylesheet" href="border-beam.css">
<script src="border-beam.js"></script>

<div class="upload-card" style="border-radius: 16px; background: #12141c">…</div>

<script>
  const beam = BorderBeam.mount(document.querySelector('.upload-card'), {
    mode: 'travel',
    palette: 'spectrum',
    theme: 'auto',
    duration: 2.2,
    strength: 1
  });

  beam.setActive(false);   // fade out when the work ends; setActive(true) resumes
  beam.destroy();          // remove the layers and restore the element
</script>
```

The host can be any element that can hold children. It cannot be an `<input>`, `<img>`, `<textarea>` or
`<select>`; wrap those in a `<div>` and mount on that. It needs a `border-radius` and a fill of its own, so
the beam has something to sit on. `halo` spills outside the element, so keep clear space around it and do not
put it inside an `overflow: hidden` parent.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `mode` | `'travel'` | `travel`, `line`, `breathe`, `halo`. |
| `palette` | `'spectrum'` | `spectrum`, `mono`, `cool`, `warm`. |
| `theme` | `'auto'` | `'dark'`, `'light'` or `'auto'` (follows `prefers-color-scheme`, and tracks changes). |
| `duration` | per mode | Seconds per lap or breath. Defaults are in `BorderBeam.DEFAULT_DURATION`. |
| `strength` | `1` | 0 to 1. |
| `radius` | from the element | Corner radius in px, read from the computed style if omitted. |
| `active` | `true` | Start busy. |

Returned handle: `destroy()`, `setActive(bool)`, `setMode(m)`, `setPalette(p)`, `setTheme(t)`,
`setStrength(n)`, `setDuration(s)`.

### CSS only

The script only builds this markup and sets custom properties. You can write it yourself:

```html
<div class="bbeam" data-bb-mode="travel" data-bb-palette="spectrum" data-bb-theme="dark" data-bb-state="on"
     style="border-radius: 16px; --bb-r: 16px">
  …content…
  <span class="bbeam-halo"><span class="bbeam-lobes"><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
  <span class="bbeam-glow"><span class="bbeam-lobes"><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
  <span class="bbeam-ring"><span class="bbeam-lobes"><i></i><i></i><i></i><i></i><i></i><i></i></span></span>
</div>
```

Tunables (set on the host): `--bb-dur` (seconds), `--bb-strength` (0 to 1), `--bb-bw` (stroke width),
`--bb-r` (radius, needed by `halo`), `--bb-pad` (how far `halo` spills), `--bb-fade` (inner glow depth),
`--bb-hue-range` (colour swing in `travel` and `line`). Add `data-bb-paused` to freeze everything.

### Behaviour

- **No JS per frame.** `travel` and `line` animate registered custom properties; `breathe` and `halo` animate
  opacity and transform of small gradient lobes, which the compositor runs without repainting.
- **Self-pausing.** Instances pause when scrolled offscreen. A hidden tab is stopped by the browser.
- **Reduced motion.** `prefers-reduced-motion: reduce` shows a still frame: the arc parked, the pool
  mid-edge, the lobes at rest, no colour drift.
- **Accessible.** The layers are `aria-hidden`; the host gets `aria-busy="true"` while active. Announce changes
  in a `role="status"` region yourself.
- **Browsers.** Needs CSS `@property` and `mask-composite`: Chrome and Edge 120+, Safari 16.4+, Firefox 128+.
  Without `@property`, `travel` and `line` show a still beam instead of moving.
- **Zero network requests.**

---

## Changes from upstream

Upstream: `Border Beam` in [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs), a SolidJS
component with five size presets (`sm`, `md`, `line`, `pulse-inner`, `pulse-outside`).

- **Mode names say what they do.** `md` and `sm` are one mode, `travel`. `line` stays. `pulse-inner` and
  `pulse-outside` become `breathe` and `halo`. Colour variants are `spectrum`, `mono`, `cool`, `warm`.
- **One shared stylesheet.** Upstream generates a fresh `<style>` block, with per-instance ids, for every
  mounted beam. Here every instance uses the same CSS, selected by data attributes.
- **No JS animation loop.** Upstream drives the pulse modes from a shared requestAnimationFrame loop that
  rewrites about 17 custom properties 30 times a second, repainting the gradients each time. Here `breathe`
  and `halo` are six pre-painted gradient lobes per layer animating `opacity` and `transform` on the
  compositor. The lobes drift at different periods and phases, which keeps the same unsynchronised breathing.
- **Dropped the blurred bloom layer.** An animated `blur(8px)` repaints every frame. The inner glow layer
  carries that role.
- **Colour spots scale with the element.** Upstream sizes its nine gradient spots in fixed pixels, tuned to a
  350 × 140 card. Here they are percentages, so a 28 px chip and a 210 px panel get the same pattern.
- **Size-aware stroke and glow.** Stroke width is 1 px under 48 px tall, 1.5 px under 160 px, 2 px above, and
  the inner glow depth is capped at 30% of the height. Upstream uses 1 px and a fixed 28 px fade everywhere.
- **Radius is read from the element** (and re-read on resize), including percentage radii.
- **A calmer line mode.** The bottom-edge pool eases in and out (a `cubic-bezier` glide) rather than moving
  at constant speed. The row of thin vertical spikes is dropped for a soft pool, which sits better under
  text.
- **Halo stays inside its own box.** The outward bloom is masked to the ring around the element, and its
  lobes fade out well before the edge of that mask, so there is no hard cut.
- **Light theme tuned separately** (dark highlight, stronger saturation, lower fill) instead of reusing the
  dark values.
- **Busy semantics.** `aria-busy` follows `setActive()`, the glow fades in and out, and the layers are
  removed and the element's own attributes restored on `destroy()`.
- **Reduced motion** shows a still frame. Upstream only stops its pulse driver.
- **Mono skips the hue filter** entirely, since rotating the hue of grey does nothing.

## Upstream and licence

Ported from [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs) (live demo:
<https://solid-thinking-orbs.vercel.app>) — **MIT**.

- Jakub Antalik: original Thinking Orbs concept and React implementation.
- Alex Brinza ([@a_brinza](https://x.com/a_brinza)): creator, credited upstream.
- Mvkweb: SolidJS port.

The full MIT notice is in the header of both `border-beam.css` and `border-beam.js`. Keep it there.

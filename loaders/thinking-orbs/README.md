# Thinking Orbs

Nine animated "thinking orb" loading indicators in one dependency-free file. Each state is a distinct
animation for a distinct kind of wait.

**Demo:** open [`index.html`](index.html) — all nine states, a size ladder, palette and theme
switches, a speed slider, and a full-screen loading-screen example.

| File | What |
| --- | --- |
| `thinking-orb.js` | The drop-in. UMD, ~32 KB raw, ~6.6 KB minified + gzipped. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## The nine states

| State | Label | Animation |
| --- | --- | --- |
| `working` | Working… | Particles on tilted orbits |
| `searching` | Searching… | A scan meridian sweeps a dotted globe |
| `solving` | Solving… | Bands scramble, then click back solved |
| `listening` | Listening… | A waveform rolls through the rings |
| `connecting` | Connecting… | A constellation wires itself, signals running the edges |
| `weaving` | Weaving… | Three strands plait around the sphere |
| `composing` | Composing… | An undulating multi-band sash |
| `breathing` | Thinking… | A ring slowly morphing — the calmest of the nine |
| `shaping` | Shaping… | Dotted outline: circle, triangle, square. Only 24 dots, so it stays legible at 20 px |

---

## Usage

```html
<script src="thinking-orb.js"></script>
<div id="loader"></div>
<script>
  const orb = ThinkingOrb.mount(document.getElementById('loader'), {
    state: 'breathing',
    size: 96,
    palette: 'jade',
    theme: 'light',
    zoom: true,
    speed: 1,
    label: 'Loading'
  });

  orb.destroy();          // stops the rAF loop and removes the canvas
  orb.setPaused(true);    // freeze without tearing down
</script>
```

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `state` | `'working'` | One of the nine above. |
| `size` | `64` | Pixels. Upstream ships two hand-tuned designs (64 px and 20 px) — separate designs, not a scale factor. The port picks the 20 px design at or below 32 px, the 64 px one above. |
| `palette` | `'jade'` | `'jade'` \| `'slate'` \| `'mono'`. A palette is two ink stops the depth ramp interpolates between. |
| `theme` | `'light'` | `'light'` \| `'dark'` — picks that palette's ramp. |
| `zoom` | `false` | Scales the tuned design linearly so it reads the same at any size. Leave off at or below 64 px; turn on for a hero-sized loader, where upstream's `(size/300)^0.6` curve goes faint. |
| `speed` | `1` | Multiplier on the animation clock. |
| `label` | per-state | The accessible name. |

### Behaviour

- **Canvas 2D only** — no WebGL, no CSS filters, no SVG. Each frame builds a dot list (plus lines for
  `connecting`), projects them, shades by depth, paints back to front.
- **Self-pausing** — stops the rAF loop when scrolled offscreen or the tab is hidden, so an idle
  loader costs nothing.
- **Accessible** — `role="img"` with a per-state label. Under `prefers-reduced-motion` it paints one
  static frame and never animates.
- **Zero network requests.**

### Adding a palette

`PALETTES` is exported. A palette is a light and a dark pair of ink stops, darkest first:

```js
ThinkingOrb.PALETTES.amber = {
  light: ['#442a05', '#f2d29b'],
  dark:  ['#2b1a03', '#fbbf24']
};
```

---

## Upstream and licence

Ported from [thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) `@0.3.1` by Jakub Antalik —
**MIT**. That package is React-only; the geometry here is reimplemented with the same constants and no
framework dependency. Geometry is verified identical to the upstream engine for all nine states at both
tuned sizes; only the ink ramp differs (grayscale replaced by a chosen palette).

Attribution lives in the header of `thinking-orb.js`. Keep it there.

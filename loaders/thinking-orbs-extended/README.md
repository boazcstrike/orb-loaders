# Thinking Orbs Extended

Eight more animated "thinking orb" loading indicators in one dependency-free file: the extended states from
[solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs), ported to vanilla JS. It is a companion to
[`thinking-orbs`](../thinking-orbs/): the same `mount(host, options)` shape and the same palettes, a separate global.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/thinking-orbs-extended/>, or open
[`index.html`](index.html) locally. All eight states, a size ladder, palette, theme and speed controls, the
reduced-motion frames and a copyable usage snippet.

| File | What |
| --- | --- |
| `thinking-orb-extended.js` | The drop-in. UMD, ~34 KB raw, ~11 KB gzipped. Global: `ThinkingOrbX`. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## The eight states

| State | Label | Animation |
| --- | --- | --- |
| `syncing` | Syncing… | A bright head chases a single ring as it tumbles fast around a ghost sphere |
| `evolving` | Evolving… | A dense multi-strand sash twisting and folding around a sphere |
| `building` | Building… | A dotted wireframe cube tumbling on two axes |
| `hypercube` | Structuring… | A filled cubic matrix, each face rippling with a travelling wave |
| `conjuring` | Conjuring… | A spiral tetrahedron tumbling in space, energy climbing its edges |
| `conjuring_static` | Conjuring… | The same spiral held upright; only the base ring and energy pulses move |
| `assembling` | Assembling… | Cube dots burst outward and snap back; strays collapse into the corners |
| `blooming` | Blooming… | A five-petal flower of dotted contours, light sweeping through it |

### Not shipped as separate states

Upstream also lists `glacio`, `flower`, `sandglass` and `sand_orbs`. Its registry points every one of them at the
blooming painter, with a preset identical to `blooming` (`sandglass.ts` is a one-line re-export of
`drawBlooming`). They render exactly like `blooming`, so they are not shown twice. They are accepted as aliases of
`blooming`, so code written against upstream still works. The nine states of the original V1 set (`working`,
`searching`, ...) live in [`thinking-orbs`](../thinking-orbs/).

---

## Usage

```html
<script src="thinking-orb-extended.js"></script>
<div id="loader"></div>
<script>
  const orb = ThinkingOrbX.mount(document.getElementById('loader'), {
    state: 'blooming',
    size: 96,
    palette: 'violet',
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
| `state` | `'blooming'` | One of the eight above (or an alias). An unknown name logs one `console.warn` and falls back to `blooming`. |
| `size` | `64` | Pixels. Upstream ships two hand-tuned designs (64 px and 20 px) — separate designs, not a scale factor. The port picks the 20 px design at or below 32 px, the 64 px one above. |
| `palette` | `'violet'` | `'violet'` \| `'cyan'` \| `'magenta'` \| `'jade'` \| `'slate'` \| `'mono'`. A palette is two ink stops the depth ramp interpolates between. |
| `theme` | `'light'` | `'light'` \| `'dark'` — picks that palette's ramp. |
| `zoom` | `false` | Scales the tuned design linearly so it reads the same at any size. Leave off at or below 64 px; turn on for a hero-sized loader, where upstream's `(size/300)^0.6` curve goes faint. |
| `speed` | `1` | Multiplier on the animation clock. |
| `label` | per-state | The accessible name. |
| `reducedMotion` | media query | `true` forces the still frame, `false` forces animation. Left unset, `prefers-reduced-motion` decides. |

### Behaviour

- **Canvas 2D only** — no WebGL, no CSS filters, no SVG.
- **Self-pausing** — stops the rAF loop when scrolled offscreen or the tab is hidden.
- **No per-frame allocation** — dots come from a pool that is sized once and reused; colours come from a lookup table.
- **Accessible** — `role="img"` with a per-state label. Under `prefers-reduced-motion` each state paints its own still frame and never animates.
- **Zero network requests.**

### Adding a palette

`PALETTES` is exported. A palette is a light and a dark pair of ink stops, darkest first:

```js
ThinkingOrbX.PALETTES.amber = {
  light: ['#442a05', '#f2d29b'],
  dark:  ['#2b1a03', '#fbbf24']
};
```

---

## Changes from upstream

Geometry is checked against the upstream TypeScript engine: for all eight states at both tuned sizes and four
clock values, every dot's position, radius and alpha matches to within 1e-14, with the two deliberate exceptions
below (the assembling easing, the syncing sweep) switched off. What changed on purpose:

- **Assembling snaps instead of swaying.** Upstream pushes each dot out and back on one symmetric sine. Here the
  burst is an ease-out cubic over the first 28% of the window, the dot holds at the apex until 58%, and the return
  is an ease-in cubic that arrives at full speed — a snap into the lattice rather than a drift.
- **Blooming thins at 20 px.** Upstream's preset computes a `count` of 0.45 for the 20 px flower, but the painter
  never receives it, so the 20 px flower drew at full density and clotted. `count` now reaches the painter, so the
  small flower has about a third fewer dots and the petals stay separate.
- **Evolving is lighter at 20 px.** Upstream fans the 20 px sash into 34 strands, which fills the whole disc and
  hides the twist. The 20 px design uses 12 strands (431 dots against 1,179 for the same preset upstream), so the
  fold still reads in the line of text and the frame costs about a third as much.
- **Syncing has a travelling head.** Upstream's ring is evenly dotted, so at its baked speed it reads as a
  strobing wire. A bright, slightly larger head now runs around the ring, which gives the
  motion a direction. Set `sweep: 0` through `overrides` to get the plain ring back.
- **Hypercube ripples at 20 px.** The wave amplitude was fixed in cube units, which is under a pixel at 20 px.
  The small design uses 0.1 against 0.06, enough to see.
- **A rest frame per state.** Upstream freezes every state at one clock value under reduced motion. Each state now
  has its own: `building`, `hypercube` and `assembling` rest on a clean isometric view, the rest on their opening
  frame. The demo shows all eight.
- **`reducedMotion` option.** Lets an app that has its own motion setting force the still frame or the animation.
- **Palette contrast checked in both themes.** Ink stops were measured against the demo's well colours (about #f2f3f9 and #0e1119). Only `slate` in dark failed the target (far dots at 2.7:1 against a 3:1 floor for graphics); its dark ramp
  is now `#1e293b` to `#cbd5e1`, which lifts the far end to 4.5:1. The others already cleared it and are unchanged.
- **No per-frame allocation.** Upstream builds a fresh dot array, a projector closure and a result tuple for every
  point on every frame, and an `rgba()` string for every dot. Here the camera writes to module variables, dots are
  written into a reused pool, and each colour string is built once. The demo page, with 23 live orbs, held 60 fps in headless Chrome.
- **Honest naming.** `conjuring_static` is labelled "Conjuring…", not "Conjuring static…". The docs call `syncing`
  a wireframe cylinder, but the code draws one ring; the demo describes what it draws.
- **Framework removed.** The SolidJS component, its theme resolver and the TypeScript types are replaced by a
  single `mount()`; the page's theme is passed in as `theme`.

---

## Upstream and licence

Ported from [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs)
([live demo](https://solid-thinking-orbs.vercel.app)) by Mvkweb, itself a SolidJS port of
[thinking-orbs](https://github.com/Jakubantalik/thinking-orbs) by Jakub Antalik. The dotted-3D engine core is
credited upstream as "Ported from inkform"; that credit is kept here. **MIT** — copyright (c) 2026 Jakub Antalik
(original React implementation) and Mvkweb (SolidJS port). The full notice is in the header of
`thinking-orb-extended.js`; keep it there.

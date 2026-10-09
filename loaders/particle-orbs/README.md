# Particle Orbs

Four WebGL particle / orb loading indicators in one dependency-free file. Each is a port of a sketch
from Yoichi Kobayashi's [sketch-threejs](https://github.com/ykob/sketch-threejs), rebuilt on raw WebGL1
with no three.js.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/particle-orbs/>, or open
[`index.html`](index.html) locally. It shows all four variants, a size ladder from 160 px to 20 px,
a colour switch, a speed slider, a full-screen loading screen and a copyable usage snippet.

| File | What |
| --- | --- |
| `particle-orbs.js` | The drop-in. UMD, global `ParticleOrbs`, ~38 KB raw (about half of it is GLSL). |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## Variants

| Variant | Look | Upstream sketch |
| --- | --- | --- |
| `ember` | A flowing, glowing sphere with a halo of blinking sparks | [`sun`](https://github.com/ykob/sketch-threejs/tree/master/src/js/sketch/sun) |
| `drift` | A lattice of lights that swell and fade through a noise field | [`blink`](https://github.com/ykob/sketch-threejs/tree/master/src/js/sketch/blink) |
| `swarm` | Beads orbiting a centre, each pulsing on its own phase | [`hole`](https://github.com/ykob/sketch-threejs/tree/master/src/js/sketch/hole) |
| `bloom` | A banded blob that breathes and morphs | [`egg`](https://github.com/ykob/sketch-threejs/tree/master/src/js/sketch/egg) |

Sizes: 64 / 96 / 160 px are the tuned hero sizes. 20 px inline works for `ember`, `swarm` and `bloom`;
`drift` is too fine to read as a cloud below about 40 px.

---

## Usage

```html
<script src="particle-orbs.js"></script>
<div id="loader"></div>
<script>
  const orb = ParticleOrbs.mount(document.getElementById('loader'), {
    variant: 'ember',   // ember | drift | swarm | bloom
    size: 96,           // CSS px
    theme: 'dark',      // 'light' | 'dark'
    speed: 1,
    label: 'Loading'
  });

  orb.setTheme('light');  // re-tint in place
  orb.setPaused(true);    // freeze without tearing down
  orb.destroy();          // stops drawing, removes the node
</script>
```

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `variant` | `'ember'` | `'ember'` \| `'drift'` \| `'swarm'` \| `'bloom'`. An unknown name throws `RangeError`. |
| `size` | `96` | CSS pixels, clamped to 12-640. The backing store is `size x min(devicePixelRatio, 2)`. |
| `theme` | OS preference | `'light'` \| `'dark'`. Light draws darker ink-like colours; dark draws glowing ones. |
| `speed` | `1` | Multiplier on the animation clock, clamped to 0.1-4. |
| `label` | `'Loading'` | The accessible name (`role="img"` + `aria-label`). |
| `color` | per variant | Any CSS colour, or `'currentColor'`. Only its hue and saturation are used; the three-stop palette is built around them. |

`mount` returns `{ destroy(), setPaused(bool), setTheme('light'|'dark') }`.

### Behaviour

- **One GL context for the whole page.** Every orb renders into a shared offscreen WebGL canvas, then
  copies its square into its own 2D canvas. Forty orbs cost one context, not forty, so the browser's
  ~16-context limit never kicks in.
- **WebGL missing or failing.** The orb is replaced by a CSS-only radial gradient of the same size and
  palette, with a slow breathing animation. `mount` does not throw. The host element gets
  `data-po-fallback="no-webgl" | "shader" | "context-lost"` so you can tell which.
- **Self-pausing.** Stops drawing when scrolled offscreen (`IntersectionObserver`) or when the tab is
  hidden.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` it paints one still frame per orb and
  never animates. The CSS fallback drops its animation too.
- **Accessible.** `role="img"` with your label; the animation is otherwise decorative.
- **Cheap per frame.** No allocation in the draw loop: matrices and palette uniforms are preallocated,
  geometry is built once.
- **Zero network requests.** No textures, no fonts, no CDN.

---

## Changes from upstream

Upstream is a gallery of full-window three.js demos on a black background. These changes make the
sketches work as small, themeable loaders:

- **three.js removed.** Geometry (a UV sphere, point lattices, a clip-space quad), matrices and shader
  programs are hand-built on WebGL1. All variants live in one file.
- **Textures replaced with procedural noise.** `sun` and `egg` sample image textures upstream; here the
  flowing surface is domain-warped 3D simplex noise computed in the fragment shader, so nothing is
  fetched.
- **Light and dark themes.** Upstream is additive glow on black and vanishes on a pale page. The palette
  is rebuilt per theme: a glow ramp (deep, base, near-white) in dark, an ink ramp that never goes pale
  in light. In light the sun's limb darkens instead of brightening, so the disc keeps an edge.
- **One colour knob.** Upstream hard-codes yellow/orange HSV values per sketch. Here a `color` option
  retints any variant; the defaults are generic hues (amber, cyan, violet, rose).
- **Anti-aliased bands.** `egg`'s hard `step()` bands become `smoothstep`s whose width tracks the pixel
  size, so edges stay clean from 20 px to 160 px.
- **Faster, readable motion.** `egg`'s noise clock runs about 4x faster (upstream is a still image that
  drifts over a minute); `sun`'s per-spark spin is 3x faster; `blink`'s lattice rotation is quicker. A
  loader has to read as moving within a second.
- **Sizing tuned for 20-160 px.** Camera distance is set per variant so the outermost particle just fits
  the square. Sprite size scales with pixel size. `blink`'s 125,000-point cube becomes about 1,100
  points clipped to a sphere with a little jitter, so the lattice does not read as a grid.
- **Inline swarm.** Under 32 px `hole`'s beads drop to 16 larger ones, because 96 small ones turn to
  noise at button height.
- **Beads instead of flat discs.** `hole`'s white circles are shaded as small lit spheres with depth
  fade, and their phases are spread by golden angle so they do not clump.
- **Soft sprites.** `sun`'s hard double-circle sprites get a hot centre and a soft edge.
- **Dropped.** The `sun` shell and sunshine layers, `egg`'s speckle pattern, `hole`'s mouse-driven
  force and cross-fade scene, and all post-effects (bloom, blur) are left out; they need render
  targets and extra textures that do not pay for themselves at loader sizes.
- **Added.** Shared GL context, CSS fallback, offscreen/hidden pause, reduced-motion still frame,
  `setTheme`, `setPaused`, `destroy`.

---

## Upstream and licence

Ported from [sketch-threejs](https://github.com/ykob/sketch-threejs) (demo:
<https://ykob.github.io/sketch-threejs/>) by Yoichi Kobayashi (ykob), Tokyo. **MIT**, copyright (c) 2021
yoichi kobayashi. The full licence text is in the header of `particle-orbs.js`; keep it there.

The 3D simplex noise inside the shaders is Ian McEwan / Stefan Gustavson's
[webgl-noise](https://github.com/ashima/webgl-noise), copyright (C) 2011 Ashima Arts, MIT, the same code
upstream pulls in through `glsl-noise`.

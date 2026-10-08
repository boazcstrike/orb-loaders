# Globe Orb

Dotted-globe loading indicators, built on [COBE](https://github.com/shuding/cobe) by Shu Ding. One
dependency-free file, `globe-orb.js`, with the land-mask texture inlined. No network requests, no build
step to use it.

Five variants, from a 96 px hero down to a 20 px inline spinner. WebGL, drawn through one shared context,
so a page full of globes never runs into the browser's context limit.

```html
<script src="globe-orb.js"></script>
<div id="loader"></div>
<script>
  const orb = GlobeOrb.mount(document.getElementById('loader'), {
    variant: 'connecting',
    size: 96,
    theme: 'auto',
    label: 'Connecting'
  });

  // when the wait ends
  orb.destroy();
</script>
```

WebGL needs a page served over `http(s)` or `localhost`, or opened from disk in a browser that allows
`file://` WebGL. Run the demo with `npx -y serve .` from the repo root and open
`/loaders/globe-orb/`.

## Variants

| Variant | What it shows | Use it for |
| --- | --- | --- |
| `searching` | Slow spin. A marker lands somewhere new each cycle and pings twice. | Search, lookups, scoring |
| `connecting` | Five nodes wire up in a loop. Each hop draws on, holds, retracts; the node it lands on answers with a ping. | Talking to a remote service |
| `syncing` | Ten markers pulse in order round the globe, a wave passing over it. | Sync, upload, background refresh |
| `idle` | A calm drift: slow turn, tilt that wanders, a halo that breathes. No markers. | Whole-page waits |
| `inline` | Tuned for 20 px: one large marker, a faster turn, sparse dots. | Beside a button label |

At 32 px and below every variant switches to a separate small tuning (see below), so `searching` at 20 px
is not a shrunken `searching` at 96 px.

## Options

`GlobeOrb.mount(host, options)` returns `{ destroy() }`. `host` is any element; the globe is appended to it.

| Option | Default | Notes |
| --- | --- | --- |
| `variant` | `'searching'` | `searching`, `connecting`, `syncing`, `idle`, `inline` |
| `size` | `64` | CSS px, 8 to 1024. 32 and below uses the small tuning. |
| `theme` | `'auto'` | `'light'`, `'dark'`, or `'auto'`. Auto reads `OrbTheme.current()` if present, else `prefers-color-scheme`, and re-tints on the `themechange` event with no remount. |
| `speed` | `1` | Multiplies animation time. |
| `color` | theme default | A `#rgb` or `#rrggbb` hex. Overrides the marker and arc colour. Anything else is ignored. |
| `label` | variant name | The `aria-label` on the `role="img"` wrapper. |

`GlobeOrb.VARIANTS` lists the variant names.

## Behaviour

- **Reduced motion.** With `prefers-reduced-motion: reduce` it paints one still frame and never starts a
  frame loop. Each variant's still shows its idea: a mid-ping marker, the whole constellation wired, a
  pulse mid-wave. It follows the setting if it changes while mounted.
- **Offscreen and hidden.** The frame loop stops when the globe leaves the viewport
  (`IntersectionObserver`) or the tab is hidden, and resumes without a time jump.
- **No WebGL.** Falls back to a CSS dotted disc that drifts sideways. `mount` does not throw. The same
  happens if the GPU context is lost mid-run.
- **Accessibility.** `role="img"` with an `aria-label`. The animation is decorative.
- **Cost.** DPR capped at 2. No allocation in the frame loop: markers and arcs are preallocated objects
  mutated in place, and each is one draw call with uniforms, no per-frame buffers.

## Upstream

- COBE, <https://github.com/shuding/cobe>, site <https://cobe.vercel.app/>
- Author: Shu Ding
- Licence: MIT. The full notice, with the copyright line, is in the header of `globe-orb.js`.
- Based on v2.0.1, commit `7e94076` ("fix: release texture resources when destroying globe (#125)").
- Dependencies: COBE 2.0.1 has no runtime dependencies. Its `package.json` lists only build and docs tools
  (esbuild, glslx, terser, typescript, next, react), none of which are vendored. Older COBE releases used
  `phenomenon`; 2.0.1 does not. The land-mask texture is COBE's own `src/texture.png`, inlined unchanged.

## Changes from upstream

COBE is a general-purpose globe library for hero sections (hundreds of pixels, a dragged `phi`). This is a
loader, so most changes are about size, motion and cost.

**Rendering**

- **Dot lattice sized from pixels.** Upstream's `mapSamples: 10000` is right for a 600 px canvas; at 96 px
  the dots land less than a pixel apart and the globe turns to grey. The dot count is now derived from a
  target pitch (about 3.3 px hero, 2.9 px at 64, 2.5 px small), so the lattice stays legible at every size.
- **Dot radius is a uniform.** Upstream hard-codes `smoothstep(0.008, 0.0, dis)`. The radius now follows
  the lattice pitch, with an edge about one pixel wide for clean anti-aliasing.
- **Anti-aliased silhouette.** Upstream cuts the sphere with a hard `if (l <= r*r)`. Now the edge is
  blended over a pixel.
- **A body, not just dots.** A translucent body with a rim and a soft halo gives the globe an outline on
  both light and dark surfaces. Ocean dots are drawn faintly (brighter at small sizes) so the sphere keeps
  its shape where there is no land.
- **Premultiplied-alpha output and blending**, so the globe composites correctly over any page colour.
- **Theme palettes.** Generic slate-indigo globe, warm marker, violet arcs. Light: deep ink land on a pale
  body. Dark: pale land on a dim blue body.
- **Markers** are a filled core, a soft halo and an expanding ring with quadratic fade, anti-aliased by
  pixel. Upstream markers are a hard-edged disc. They also fade out as they turn toward the limb and the
  canvas edge, instead of popping or clipping.
- **Arcs** get a travelling head and a tail, with the tail fading, so a connection draws on and retracts.
  Upstream arcs are a fixed solid ribbon. Arch height now scales with arc length, and ribbon edges are
  soft.

**Motion**

- Four loader choreographies on top of upstream's raw `phi`/`markers`/`arcs` API. Easing is chosen per
  motion: `outBack` for a marker landing, `outCubic` for rings, `inOutCubic` for arcs drawing and
  retracting. Spin speeds are slow (0.11 to 0.34 rad/s) so the globe reads as calm, not busy.
- **Small tuning (20 px).** Sparser lattice, ocean dots lifted to 30 percent, gentler limb falloff, larger
  marker relative to the globe, no halo, a faster turn, one ring instead of two, and the globe scaled up
  to fill the box.
- **Reduced motion** shows a designed still per variant, not a frozen random frame.

**Cost and robustness**

- **One shared WebGL context.** Upstream creates a context per globe. Browsers cap live contexts at
  about 16, after which the oldest silently dies. Here every instance renders into the corner of one
  shared canvas and copies its pixels to its own 2D canvas.
- **No instancing, no per-frame allocation.** Upstream rebuilds `Float32Array`s with spread syntax in
  `updateMarkers`/`updateArcs` and needs WebGL2 or `ANGLE_instanced_arrays`. Here markers and arcs are a
  handful of single draw calls driven by uniforms, which runs on plain WebGL 1.
- **No DOM anchor layer.** Upstream inserts a wrapper div, one anchor element per marker and a
  document-level `<style>` rewritten as markers move. None of that is needed for a loader and it is gone.
- **Bug fixes carried in the shaders and setup.** The 1x1 placeholder texture is RGBA (upstream's 3-byte
  RGB upload triggers `INVALID_VALUE: bad image data` under the default unpack alignment). The unused
  mipmap generation is dropped (the filter is `NEAREST`). `acos` is clamped to avoid NaN at the poles. The
  variable named `sample` is renamed (reserved in GLSL ES 3.00). `smoothstep` is never called with
  reversed edges, which is undefined in the spec.
- **Lifecycle.** Pause when offscreen or hidden, resume without a time jump, theme re-tint without a
  remount, a CSS fallback for no WebGL or a lost context, `destroy()` that removes the node and every
  listener and releases the shared context when the last instance goes.

## Build steps

There is no build step for users. Nothing was bundled: COBE's own build (esbuild, then terser, with GLSLX
for shaders) was **not run**. The port was done by hand from a read-only clone, so there is nothing to
re-run to regenerate `globe-orb.js`; edit it directly. To reproduce the port:

1. Clone upstream and pin the version:
   ```bash
   git clone https://github.com/shuding/cobe .   # into an empty directory
   git checkout 7e94076fa8c38707f4c9cd114ff4f7c5c880971e   # v2.0.1 + #125
   ```
2. **Shaders.** Open `src/globe.frag.glslx`, `globe.vert.glslx`, `marker.glslx`, `arc.glslx`. GLSLX adds
   `export void fragment();` and `vertex()` entry points, renames identifiers, and `scripts/build.js`
   strips the forward declarations. Here those steps were done by hand: entry points are `main`, names are
   left readable, and the combined marker and arc files are split into one vertex and one fragment string
   each. The lattice maths in `nearestFibonacciLattice` is unchanged. The rest of each shader is rewritten
   as described above.
3. **Texture.** `src/texture.js` holds the land mask as a `data:image/png;base64,...` string. It was
   copied into `globe-orb.js` byte for byte by script, not by hand, and the result compared with the
   source string:
   ```bash
   node -e '
   const fs=require("fs");
   const tex=fs.readFileSync("src/texture.js","utf8").match(/\x27(data:[^\x27]+)\x27/)[1];
   let js=fs.readFileSync("globe-orb.js","utf8");
   js=js.replace(/var TEXTURE = \x27[^\x27]+\x27/,()=>"var TEXTURE = \x27"+tex+"\x27");
   fs.writeFileSync("globe-orb.js",js);'
   ```
4. **Renderer.** `src/index.js` was re-cut: the globe, arc and marker passes are kept; instancing, the
   anchor manager (`src/anchor.js`), `update()` and the TypeScript types are dropped; the loader layer
   (variants, palettes, fallback, lifecycle) is new.

Verified in headless Chrome (SwiftShader WebGL), light and dark, at 20, 64 and 96 px.

## File size

37,886 bytes raw as authored, 13.6 KB gzipped. About 1.5 KB of that is the texture; the shaders are kept as
readable source. There is no minified build.

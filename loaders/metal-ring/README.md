# Metal Ring

A liquid-metal WebGL ring that wraps a button, chip or card and says "this is busy". A shader paints a
slowly moving metal edge in one of six presets; a soft halo wanders to the brightest part of the ring.
One dependency-free file.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/metal-ring/>, or open [`index.html`](index.html)
locally (WebGL needs `http://`: `npx -y serve .` from the repo root). The demo has all six presets in both
shapes, a size ladder, interactive busy buttons, the static fallback, and light/dark.

| File | What |
| --- | --- |
| `metal-ring.js` | The drop-in. UMD, ~43 KB raw, ~13.5 KB gzipped (header and licence included). |
| `index.html` | Standalone demo page. Loads the file by relative path. |

---

## Presets and shapes

Presets: `chromatic`, `silver`, `gold`, `blueberry`, `rose`, `copper`. Each carries a dark and a light
tuning; `theme` picks which.

Shapes (`variant`): `button` (a pill, or any rounded rectangle, radius read from the element) and `circle`
(icon buttons).

## Usage

```html
<script src="metal-ring.js"></script>
<button id="gen" class="my-button">Generating…</button>
<script>
  const ring = MetalRing.mount(document.getElementById('gen'), {
    preset: 'blueberry',
    variant: 'button',
    theme: 'auto',
    glow: true,
    strength: 1
  });

  ring.setPreset('rose');
  ring.destroy();    // stops drawing, removes the canvas, clears aria-busy
</script>
```

`host` can be any element that can hold children: a `<button>`, a `<div>`, a chip. It cannot be an
`<input>`, `<img>`, `<textarea>` or `<select>`; wrap those in a `<div>` and mount on that. The host should
have a `border-radius` and its own fill. The ring is drawn over its outer pixels, so give it `border: 0`
or a transparent border.

Do not rewrite the host's children while a ring is mounted (`el.textContent = …` removes the canvas). Change
the label first, then mount, or put the label in a child element.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `preset` | `'chromatic'` | One of the six. An unknown name falls back to `chromatic`. |
| `variant` | `'button'` | `'button'` or `'circle'`. `circle` forces a fully round radius. |
| `theme` | `'auto'` | `'dark'`, `'light'`, or `'auto'` (follows `prefers-color-scheme`, and tracks changes). |
| `glow` | `true` | The wandering halo. |
| `strength` | `1` | 0 to 1. Fades the whole ring. |
| `radius` | from the element | Corner radius in px. Ignored for `circle`. |
| `ringWidth` | by size | Ring thickness in px. Default grows with the element. |
| `renderer` | `'auto'` | `'css'` forces the static CSS ring. |
| `busy` | `true` | Set `aria-busy="true"` on the host while mounted. |

Returned handle: `destroy()`, `setPreset(name)`, `setTheme(t)`, `setStrength(n)`, `setPaused(bool)`,
`isFallback()`. Also `MetalRing.PRESETS`, `MetalRing.PRESET_NAMES`, `MetalRing.supportsWebGL()`.

### Behaviour

- **One shader, many rings.** A single 96 px WebGL canvas is drawn once per preset and theme in use; each
  ring copies a crop of it into its own 2D canvas. Twenty rings cost about what six do.
- **Self-pausing.** A ring stops drawing when scrolled offscreen (`IntersectionObserver`) or when the tab is
  hidden. When the last ring is destroyed the WebGL context is released.
- **No WebGL.** If a context cannot be created, the shader fails, or the context is lost, the ring becomes a
  static CSS conic gradient in the preset's colours. Nothing throws. A restored context swaps the live ring
  back. Test it by opening the demo with `?nowebgl`.
- **Reduced motion.** `prefers-reduced-motion: reduce` paints one still frame of the metal and parks the
  halo. Nothing moves.
- **Accessible.** The canvas is `aria-hidden`; the host gets `aria-busy="true"` while mounted. Announce the
  state change yourself in a `role="status"` region.
- **Zero network requests.** No libraries, fonts or textures.

---

## Changes from upstream

Upstream: `Metal FX` in [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs), a SolidJS
component. This port keeps the shader maths, the six presets and the wandering halo, and changes how they are
delivered and drawn.

- **No framework.** The Solid component becomes a `mount()` that returns a handle.
- **Several presets on one page.** Upstream keeps one shared preset, so every ring on a page looks the
  same. Here each preset and theme in use gets its own pass of the shared shader.
- **The halo is drawn into the ring's own canvas.** Upstream uses an SVG with four animated Gaussian-blur
  filters per ring and rewrites CSS transforms on it. Here the halo is two pre-painted gradient sprites
  drawn each frame on the canvas, clipped so it covers the ring and the outside but never the inside. It
  moves smoothly every frame instead of hopping once a second.
- **Smoother frames.** The shader copies at ~30 fps; upstream throttles to ~15.
- **Cheaper shader canvas.** The shader canvas is 1x. Upstream renders it at 2x; the field is soft, so the
  result is the same with a quarter of the pixels.
- **Dead shader code removed.** Per-colour alpha, softness, shape, two unused colour slots and a constant
  blur flag were never read in upstream. They are gone, and colour is a `vec3[5]` array. The fragment shader
  also falls back to `mediump` where `highp` is missing.
- **Ring thickness follows size.** Upstream fixes it at 1 px (pill) and 2 px (circle). Here it grows with the
  element, so a 64 px circle does not wear the hairline of a 24 px one.
- **Light-theme contrast.** Pale presets vanish on a pale page; a faint outer hairline keeps the shape
  readable.
- **A static fallback.** No WebGL, a lost context, or `renderer: 'css'` gives a CSS conic-gradient ring. Upstream
  has no fallback and throws.
- **Reduced motion** paints a still frame. Upstream does not handle it.
- **Pauses.** Offscreen and hidden-tab pausing is per ring, and teardown releases the GL context.
- **Fade-in** on mount (350 ms), and `aria-busy` on the host.
- **Not ported:** neighbour reflections (soft light cast on nearby elements).

## Upstream and licence

Ported from [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs) (live demo:
<https://solid-thinking-orbs.vercel.app>) — **MIT**.

- Jakub Antalik: original Thinking Orbs concept and React implementation.
- Alex Brinza ([@a_brinza](https://x.com/a_brinza)): creator, credited upstream.
- Mvkweb: SolidJS port.

The full MIT notice is in the header of `metal-ring.js`. Keep it there.

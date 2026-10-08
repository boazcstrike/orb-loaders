# Voice Orbs

Five audio-reactive voice-assistant orbs in one dependency-free file, sharing one seven-state contract:
`idle`, `connecting`, `listening`, `thinking`, `speaking`, `error`, `disabled`. Drive the state from your
assistant's lifecycle and feed it a `level` from 0 to 1 for the audio.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/voice-orbs/>, or open
[`index.html`](index.html) locally. It shows all five orbs, a five-by-seven state matrix, a size ladder
(160 px down to 16 px), a chat-header and call-screen example, and a copyable snippet. The level is driven by
a synthetic sine-plus-noise signal by default, with a built-in mode and an optional microphone mode (local
only; nothing leaves the page).

| File | What |
| --- | --- |
| `voice-orbs.js` | The drop-in. UMD, about 50 KB raw. Global `VoiceOrbs`. |
| `index.html` | Standalone demo page. Loads the file by relative path; works from disk. |

---

## Orbs

| `orb` | Draws | What it does |
| --- | --- | --- |
| `particles` | Dots | Hundreds of dots on a turning Fibonacci sphere. Ripples while listening, streams while speaking, collapses to a ring while connecting. |
| `wave` | Lines | Four overlapping sine envelopes on one axis. Flat at rest, surging with the voice. |
| `ring` | Ring | A circle displaced by a per-state waveform. Echo rings while thinking, a dashed orbit while connecting, a jagged edge on error. |
| `equalizer` | Bars | Seven capsule bars in a glass disc. A separate bar layer per state, cross-faded. |
| `pulse` | Core | A glossy core that emits rings (slow idle, inward listening, fast speaking) with a conic arc that spins while connecting and thinking. |

Fifteen further orbs exist upstream. These five were chosen to cover dots, lines, a ring, bars and a solid
core, and because each ports to raw 2D canvas without a framework. The rest were left out; see
[Not ported](#not-ported).

---

## Usage

```html
<script src="voice-orbs.js"></script>
<div id="assistant"></div>
<script>
  const orb = VoiceOrbs.mount(document.getElementById('assistant'), {
    orb: 'particles',    // particles | wave | ring | equalizer | pulse
    state: 'idle',
    size: 96,
    theme: 'auto'        // 'auto' | 'light' | 'dark'
  });

  orb.setState('listening');   // blends over about 0.3 s
  orb.setLevel(0.6);           // 0..1, call every frame while audio plays
  orb.setLevel(null);          // back to the built-in energy curve
  orb.destroy();               // stops drawing, removes nodes and listeners
</script>
```

The file is UMD, so `require('./voice-orbs.js')` works under a bundler too.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `orb` | `'particles'` | One of the five ids above. Unknown ids throw. |
| `state` | `'idle'` | One of the seven states. Unknown states throw. |
| `size` | `96` | Pixels, 12 to 1024. Detail and stroke widths follow size. |
| `theme` | `'auto'` | `'auto'` follows `data-theme` on `<html>` (the catalogue's `OrbTheme`), then the OS, and re-tints on the `themechange` event. `'light'` or `'dark'` pins it. |
| `level` | none | Not an option: use `setLevel()`. Until you call it, each state runs its own built-in energy curve. |
| `speed` | `1` | Multiplier on the animation clock. |
| `colorFrom`, `colorTo` | per orb | Hex colours (`#rgb` or `#rrggbb`). The error state blends to rose whatever you pass. |
| `label` | `'Assistant orb'` | Accessible name. The state is appended: "Assistant orb, listening". |

### Returned handle

| Method | Notes |
| --- | --- |
| `setState(state)` | Cross-fades. Safe to call every time your assistant changes phase. |
| `setLevel(v)` | `0..1`. `null` hands control back to the built-in curve. |
| `destroy()` | Idempotent. |

`VoiceOrbs.STATES` and `VoiceOrbs.ORBS` list the contract and the orbs.

### Behaviour

- **One scheduler.** Every orb on the page shares one `requestAnimationFrame` loop. An orb that is offscreen
  (IntersectionObserver) or in a hidden tab is removed from it.
- **No per-frame allocation** in the hot path: typed arrays, bucketed fills and cached gradients, rebuilt
  only when the palette, theme or error/disabled blend changes. Device pixel ratio is capped at 2.
- **Reduced motion.** Under `prefers-reduced-motion: reduce` an orb paints one calm pose per state and does
  not animate. Listening, speaking and the rest still look different, because each state has its own resting
  level.
- **Accessible.** `role="img"` with a label that tracks the state; the canvas itself is `aria-hidden`.
- **Zero network requests**, no fonts, no CDN.

---

## Upstream and licence

Ported from [VoiceOrbs](https://github.com/amunozdev/voiceorbs) by Alexis Munoz (amunozdev),
**MIT**, copyright (c) 2026 Alexis Munoz. Gallery: <https://voiceorbs.vercel.app/>. Ported from commit
`8b2799917734f52c9293a489e08982ca5b0187e9` (2026-09-28). The full licence text is in the header of
`voice-orbs.js`. Keep it there.

Upstream is a React and Next.js project; this folder reimplements five of its orbs and keeps the state
tables, timings and the 7-state contract.

---

## Changes from upstream

- **Light theme actually works.** Upstream Particles and Waveform Ring draw with additive (`lighter`)
  blending, which disappears on a white page. In light theme these now use normal blending with ink
  mixed 30% toward black, a higher alpha floor on far-side particles, and a soft halo instead of an additive
  glow on the ring. Dark theme is unchanged.
- **Theme follows the page.** Upstream reads a `dark` class or the OS scheme. Here `theme: 'auto'` follows
  `data-theme`, then the OS, and repaints on `themechange`.
- **Disabled is drawn, not filtered.** Upstream greys the disabled state with a CSS `filter: grayscale()`
  and `opacity` on the host, which makes the compositor re-filter a live canvas. Here the ink is
  desaturated and dimmed in the canvas, and it cross-fades like any other state.
- **Retimed state blending.** Upstream enters active states at rate 14 (about 0.2 s), which reads as a cut.
  Here it is 10 (about 0.3 s), settling to idle at 4 (about 0.75 s) and error at 12, so the change of state is
  visible as a change.
- **Size-aware detail.** Upstream draws the same geometry and fixed pixel stroke widths at every size.
  Dot, segment, sample and bar counts now scale down with size (Particles 720 dots to about 160, Equalizer
  7 bars to 5 under about 65 px), minimum stroke widths are enforced, ring strokes scale with size, and
  small Particles fill more of their box.
- **Reduced-motion poses, shared.** One resting level per state drives all five orbs (upstream spreads it
  across per-orb tables and CSS rules), so a static frame still tells listening from idle from error, and
  state changes snap instead of blending.
- **State labels.** The accessible name updates with the state ("Assistant orb, thinking"). Upstream keeps
  one label.
- **One scheduler.** Upstream runs a requestAnimationFrame loop per orb. Here there is one loop for the
  page; a wall of 48 orbs in the demo costs one callback per frame.
- **CSS orbs redrawn on canvas.** Equalizer and Pulse are pure CSS upstream (custom properties, keyframes,
  `clip-path`, blur filters). They are reimplemented as canvas painters: blurred glows become cached radial
  gradients, keyframes become piecewise curves, and nothing relies on `filter`.
- **Input validation.** Unknown orbs, states, sizes and non-hex colours throw a message naming the valid
  values.
- **Generic names.** The upstream "Siri Wave Line" is `wave` here, to avoid a product name as an API id.

## Not ported

- **Nebula Orb** (React Three Fiber and GLSL), and **Mercury, Dither, Grain and Plasma** (the Paper Design
  shader package): heavy third-party libraries, no cheap raw-canvas route.
- **Siri Sheet, Iridescent Flow, Aura Field**: hand-written WebGL fragment shaders. They would work, but
  need `http:` and a WebGL context; left for a later pass.
- **Gooey** (SVG turbulence filters), **Galaxy** (about 29 KB of canvas), and the CSS **Halo, Glass,
  Aurora, Minimal, Edge Glow**: left out to keep the file small. Minimal is one disc; Glass and Aurora lean
  on blur and conic-gradient stacks.
- Upstream's **live waveform input** for Waveform Ring (microphone time-domain samples), the Vapi,
  ElevenLabs, LiveKit and OpenAI Realtime adapters, the audio cue and haptic hook, and the `OrbPill` wrapper.
  The level contract covers the amplitude; adapters belong in the host app.

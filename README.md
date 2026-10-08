# Orb Loaders

A collection of loading indicators — orbs, spinners, progress animations — found around the web and
vendored here as **self-contained, dependency-free drop-ins**. One folder per loader, each with its
own demo page, its own licence note, and no build step between you and using it.

The point is to stop re-hunting for the same animation every time a project needs a loading state.
Copy the folder, load the file, mount it.

**Live catalogue:** <https://boazcstrike.github.io/orb-loaders/>, or open [`index.html`](index.html)
locally. The pages follow the OS light/dark setting and carry a toggle that overrides it; every
loader is shown in whichever theme you pick.

---

## Catalogue

17 loaders in four groups. Sizes are the drop-in files only: raw, and gzip including the licence
header. Every upstream is credited in [`docs/references.md`](docs/references.md).

Demo links: `https://boazcstrike.github.io/orb-loaders/loaders/<loader>/`.

### AI and agent indicators

| Loader | Live demo | What it is | Upstream | Tech | Size | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [`thinking-orbs`](loaders/thinking-orbs/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/thinking-orbs/) | Nine animated "thinking" states — working, searching, solving, listening, connecting, weaving, composing, breathing, shaping | Jakub Antalik | Vanilla JS, canvas 2D, UMD | 34.8 KB · 11.2 KB gzip | MIT |
| [`thinking-orbs-extended`](loaders/thinking-orbs-extended/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/thinking-orbs-extended/) | Eight more orb states — syncing, evolving, building, hypercube, conjuring, conjuring static, assembling, blooming | Mvkweb's SolidJS port of Jakub Antalik's orbs | Vanilla JS, canvas 2D, UMD | 34.1 KB · 11.5 KB gzip | MIT |
| [`agent-thinking`](loaders/agent-thinking/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/agent-thinking/) | Collapsible reasoning stream that folds into "Thought for 6s" | solid-thinking-orbs | Vanilla JS + CSS, UMD | 19.7 KB · 7.1 KB gzip | MIT |
| [`web-search`](loaders/web-search/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/web-search/) | Live source discovery: dots, spinning globe, tick, "Searched N sources" | solid-thinking-orbs | Vanilla JS + CSS, UMD | 23.9 KB · 8.2 KB gzip | MIT |
| [`think-shimmer`](loaders/think-shimmer/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/think-shimmer/) | Five "thinking" text indicators — sweep, typing dots, verb cycle, thought header, step chain — each with a done transition | Ant Design X `Think` (Ant Group) | Vanilla JS + CSS, UMD | 26.9 KB · 9.2 KB gzip | MIT |
| [`voice-orbs`](loaders/voice-orbs/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/voice-orbs/) | Five audio-reactive voice-assistant orbs on one seven-state contract | voiceorbs (Alexis Muñoz) | Vanilla JS, canvas 2D, UMD | 49.5 KB · 14.9 KB gzip | MIT |

### Orbs and globes

| Loader | Live demo | What it is | Upstream | Tech | Size | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [`globe-orb`](loaders/globe-orb/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/globe-orb/) | Dotted globe — searching, connecting, syncing, idle, inline | cobe (Shu Ding) | Vanilla JS, WebGL, UMD | 37.9 KB · 13.6 KB gzip | MIT |
| [`particle-orbs`](loaders/particle-orbs/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/particle-orbs/) | Four WebGL particle orbs — ember, drift, swarm, bloom | sketch-threejs (Yoichi Kobayashi, Tokyo) | Vanilla JS, WebGL, UMD | 38.1 KB · 12.1 KB gzip | MIT |
| [`doodle-orbs`](loaders/doodle-orbs/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/doodle-orbs/) | Six generative orbs — ring wave, spiral galaxy, petals, orbits, grid sphere, arc rings | Inspired by css-doodle (Yuan Chuan) | Vanilla JS, DOM + CSS keyframes | 14.9 KB · 5.9 KB gzip | MIT |

### Busy states

| Loader | Live demo | What it is | Upstream | Tech | Size | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [`metal-ring`](loaders/metal-ring/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/metal-ring/) | Liquid-metal ring around a button or chip while it is busy; six presets, CSS fallback | solid-thinking-orbs | Vanilla JS, WebGL, UMD | 43.1 KB · 13.5 KB gzip | MIT |
| [`border-beam`](loaders/border-beam/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/border-beam/) | Travelling or breathing glow border; four modes, four palettes | solid-thinking-orbs | CSS + vanilla JS | 28.1 KB · 8.7 KB gzip | MIT |

### CSS spinners

| Loader | Live demo | What it is | Upstream | Tech | Size | Licence |
| --- | --- | --- | --- | --- | --- | --- |
| [`three-dots`](loaders/three-dots/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/three-dots/) | Eight single-element dot loaders | three-dots (Zongbin, Beijing) | CSS | 12.2 KB · 3.5 KB gzip | MIT |
| [`css-spinners`](loaders/css-spinners/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/css-spinners/) | Eight classic spinners | loading.io (Taipei) | CSS | 10.8 KB · 2.7 KB gzip | CC0 |
| [`css-loaders`](loaders/css-loaders/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/css-loaders/) | Eight single-element ring and orb loaders | cssloaders (Vineeth TR, India) | CSS | 11.4 KB · 3.8 KB gzip | MIT |
| [`vue-spinners`](loaders/vue-spinners/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/vue-spinners/) | Eight spinners extracted from vue-spinner, no Vue | vue-spinner (greyby, Beijing), after Halogen (Yuanyan Cao) | CSS + tiny JS | 16.7 KB · 5.5 KB gzip | MIT |
| [`spinkit`](loaders/spinkit/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/spinkit/) | Eight SpinKit spinners | SpinKit (Tobias Ahlin); Android port by ybq (Beijing) | CSS | 13.5 KB · 3.6 KB gzip | MIT |
| [`activity-indicators`](loaders/activity-indicators/) | [Open demo](https://boazcstrike.github.io/orb-loaders/loaders/activity-indicators/) | Eight loaders.css animations | loaders.css (Connor Atherton); iOS port by Vinh Nguyen | CSS | 14.3 KB · 3.7 KB gzip | MIT |

Each folder README lists what changed from upstream under **Changes from upstream**.

---

## Quick start

No install, no bundler required. Every loader is a plain file.

```html
<script src="loaders/thinking-orbs/thinking-orb.js"></script>

<div id="loader"></div>

<script>
  const orb = ThinkingOrb.mount(document.getElementById('loader'), {
    state: 'breathing',   // any of the nine
    size: 96,
    palette: 'violet',    // violet | cyan | magenta | jade | slate | mono
    theme: 'light',       // 'light' | 'dark'
    zoom: true,           // scale the tuned design up; leave off at/below 64px
    speed: 1,
    label: 'Loading'
  });

  // when the wait ends — this stops the requestAnimationFrame loop
  orb.destroy();
</script>
```

The files are UMD, so a bundler import works the same way:

```js
const ThinkingOrb = require('./loaders/thinking-orbs/thinking-orb.js');
```

Run the demos locally with any static server:

```bash
npx -y serve .
# then open http://localhost:3000
```

---

## Repository layout

```
orb-loaders/
├── index.html                    # catalogue — links every loader's demo
├── README.md
├── LICENSE                       # MIT, for this repo's own code
├── docs/
│   └── references.md             # every upstream, its author and licence; reference-only links
├── assets/
│   ├── glass.css                 # shared page chrome — tokens, surfaces, header
│   └── theme.js                  # light/dark toggle, remembers the choice
└── loaders/
    └── <loader-name>/
        ├── README.md             # what it is, options, upstream + licence
        ├── index.html            # standalone demo page
        └── <loader-name>.js|.css # the drop-in file(s)
```

`archive/` is gitignored. It holds local study copies of work whose licence does not allow
republishing, so it never reaches GitHub.

---

## Adding a loader

1. Create `loaders/<loader-name>/` and drop the self-contained file in it.
2. Keep the upstream attribution and licence **in the file header**. Do not strip it.
3. Add `index.html` — a standalone demo that loads the file by relative path and works when opened
   straight from disk. No CDN, no external requests.
4. Add `loaders/<loader-name>/README.md`: what it is, the options, the upstream project, the licence.
5. Add a row to the table above, with its live demo link
   (`https://boazcstrike.github.io/orb-loaders/loaders/<loader-name>/`), and a card to the root
   `index.html`.
6. Add the upstream to [`docs/references.md`](docs/references.md).

**Rules for anything vendored here:**

- **No runtime dependencies.** If it needs a framework, port it or leave it out.
- **No network requests.** No CDN fonts, no remote assets. It has to work offline.
- **Cheap enough to show a wall of them.** A demo page runs a dozen or more at once. Watch for
  per-frame string or object allocation, and keep `backdrop-filter` off anything sitting over a live
  animation — it re-blurs its backdrop on every repaint underneath.
- **Attribution stays.** Every loader keeps the original author's name and licence.
- **Nothing proprietary.** No client branding, no private logos, no colour tokens lifted from
  someone's brand system. Palettes here are generic.
- **Respect `prefers-reduced-motion`.** A loader that ignores it is not finished.

---

## Licence

The repository's own code — the catalogue page, the scaffolding, the docs — is [MIT](LICENSE).

Each vendored loader carries its **own** upstream licence, stated in its file header and in its
folder README. [`docs/references.md`](docs/references.md) lists every upstream, its author and its
licence in one table.

# Orb Loaders

A collection of loading indicators — orbs, spinners, progress animations — found around the web and
vendored here as **self-contained, dependency-free drop-ins**. One folder per loader, each with its
own demo page, its own licence note, and no build step between you and using it.

The point is to stop re-hunting for the same animation every time a project needs a loading state.
Copy the folder, load the file, mount it.

**Live catalogue:** open [`index.html`](index.html) in a browser.

---

## Catalogue

| Loader | What it is | Tech | Size | Licence |
| --- | --- | --- | --- | --- |
| [`thinking-orbs`](loaders/thinking-orbs/) | Nine animated "thinking" states — working, searching, solving, listening, connecting, weaving, composing, breathing, shaping | Vanilla JS, canvas 2D, UMD | 32 KB raw · ~6.6 KB min+gzip | MIT |

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
    palette: 'jade',      // 'jade' | 'slate' | 'mono'
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
└── loaders/
    └── <loader-name>/
        ├── README.md             # what it is, options, upstream + licence
        ├── index.html            # standalone demo page
        └── <loader-name>.js      # the drop-in file
```

---

## Adding a loader

1. Create `loaders/<loader-name>/` and drop the self-contained file in it.
2. Keep the upstream attribution and licence **in the file header**. Do not strip it.
3. Add `index.html` — a standalone demo that loads the file by relative path and works when opened
   straight from disk. No CDN, no external requests.
4. Add `loaders/<loader-name>/README.md`: what it is, the options, the upstream project, the licence.
5. Add a row to the table above and a card to the root `index.html`.

**Rules for anything vendored here:**

- **No runtime dependencies.** If it needs a framework, port it or leave it out.
- **No network requests.** No CDN fonts, no remote assets. It has to work offline.
- **Attribution stays.** Every loader keeps the original author's name and licence.
- **Nothing proprietary.** No client branding, no private logos, no colour tokens lifted from
  someone's brand system. Palettes here are generic.
- **Respect `prefers-reduced-motion`.** A loader that ignores it is not finished.

---

## Licence

The repository's own code — the catalogue page, the scaffolding, the docs — is [MIT](LICENSE).

Each vendored loader carries its **own** upstream licence, stated in its file header and in its
folder README. `thinking-orbs` is MIT (Jakub Antalik,
[Jakubantalik/thinking-orbs](https://github.com/Jakubantalik/thinking-orbs)).

# Web Search Radar

A live "searching the web" indicator: a query headline, then sources turning up one by one, each
going from a dotted placeholder to a spinning globe to a tick. Plain DOM, CSS and inline SVG, no
framework, no network.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/web-search/>, or open
[`index.html`](index.html) locally: playground, four variants, a size ladder, an in-context chat
example and a copyable snippet.

| File | What |
| --- | --- |
| `web-search.js` | The drop-in. UMD, global `WebSearchRadar`, ~15.6 KB raw (~5.6 KB gzipped). |
| `web-search.css` | Scoped styles, every class prefixed `wsr-`, ~8.3 KB raw. |
| `index.html` | Standalone demo page. Loads both files by relative path; works from disk. |

Upstream's README calls this a "radar"; the component is a source list with a rotating-globe
progress glyph. That concept is kept, with a faint radar ping added (see below).

---

## Variants

One component, configured by options (each shown on the demo page):

| Variant | Options | Behaviour |
| --- | --- | --- |
| Default | `{}` | Three sources, loops. |
| Starts closed | `{ defaultOpen: false }` | Headline only; the reader opens the list. A compact status line. |
| Custom sources | `{ sites: [...] }` | Any number of rows, each with its own `discover` / `finish` time. |
| Links | `sites[i].href` | A row with an `href` becomes a real link with a hover arrow. |
| One-shot | `{ loop: false }` | Runs once and settles on "Searched N sources". |

---

## Usage

```html
<link rel="stylesheet" href="web-search.css">
<script src="web-search.js"></script>

<div id="search-status"></div>
<script>
  const search = WebSearchRadar.mount(document.getElementById('search-status'), {
    query: 'token verification best practices',
    sites: [
      { title: 'Verifying tokens safely', url: 'docs.example.org/guides',
        discover: 600, finish: 2400,                 // ms from start
        href: 'https://docs.example.org/guides' }    // optional
    ],
    size: 13,
    loop: true
  });

  search.destroy();   // stops the clock, removes nodes and listeners
</script>
```

The host is a bare element. The block inherits your text colour and font, so it themes itself in
light and dark with no option.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `query` | sample query | Shown in the headline. Set as text, never as HTML. Truncates with an ellipsis. |
| `sites` | three sample rows | `{ title, url, discover?, finish?, href? }`. `discover` defaults to `600 + i * 1000` ms, `finish` to `2400 + i * 1600` ms, and a row always loads for at least 400 ms. `href` is used only if it starts with `http://` or `https://`. |
| `size` | `13` | Font size in px. The globe, tick, spacing and rail are in `em` and scale with it. |
| `width` | `540` | Maximum width: number (px) or any CSS width. |
| `color` | inherited | Any CSS colour. The ink is derived from `currentColor`. |
| `defaultOpen` | `true` | Start with the list expanded. |
| `loop` | `true` | Restart 2.8 s after finishing. Ignored under `prefers-reduced-motion`. |

Returns `{ destroy() }`.

### Behaviour

- **Pausable clock.** One timer, no animation-frame loop. The clock, the CSS loops and the SVG globes
  all stop when the block is offscreen or the tab is hidden.
- **Globes exist only while loading.** Each row builds its globe when it starts loading and removes
  it after the fade out, so a finished list holds no running SVG animation.
- **Accessible.** The caret is a real button with `aria-expanded`; a visually hidden
  `role="status"` announces "Searching" and, once, "Search complete, N sources". Decorative SVG is
  `aria-hidden`. Collapsed content is `inert`.
- **Reduced motion.** The sources still progress (that is information), but nothing moves: a still
  globe, no shimmer, no ping, no slide, no loop.

---

## Upstream and licence

Ported from [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs)
(`WebSearch` component) - **MIT**. Live upstream demo: <https://solid-thinking-orbs.vercel.app>.

- Jakub Antalik: original thinking-orbs concept and React implementation.
- Mvkweb: SolidJS port, the component translated here.
- Alex Brinza: credited as creator on the upstream site (<https://x.com/a_brinza>).

The full MIT notice is in the header of `web-search.js`. Keep it there.

---

## Changes from upstream

- **No Solid, no Tailwind, no CSS modules.** `createSignal` / `<For>` replaced by direct DOM updates;
  the CSS module became plain scoped CSS with a `wsr-` prefix, sized in `em` from one font size.
- **No hardcoded greys.** Upstream used fixed `#a1a1a1` for secondary text (about 2.6:1 on white).
  Ink is now `currentColor` with opacity steps, and the tick colour is `#15803d` on light (5:1) and
  `#4ade80` on dark, so it reads in both themes and follows the page.
- **The headline reports the result.** When the last source lands, "Searching" becomes "Searched" and
  a "· 3 sources" count appears. Upstream stayed on "Searching" forever.
- **Radar ping.** A faint ring leaves the globe of the row that is loading (1.8 s, eased), nodding to
  the "radar" in upstream's description and separating "loading" from "done" at 12 px, where a thin
  stroke globe alone is easy to miss.
- **Rows only look clickable if they are.** Upstream showed a pointer cursor and hover arrow on rows
  that did nothing. Now a row is a link only when you give it an `href`.
- **Staggered entrance.** Rows rise 4 px in 60 ms steps on mount instead of all at once; on loop they
  reset through their state transitions rather than re-running the entrance.
- **Cheaper globes.** Upstream ran every row's twelve SMIL animations from mount, including invisible
  ones. Globes are built when a row starts loading, removed after it finishes, and paused offscreen.
- **Shimmer is a mask.** One slow sweep that rests between passes (2.7 s), no colour needed, so it
  works on any background.
- **Pausable timeline.** Upstream used chained `setTimeout`s that kept running offscreen and in
  background tabs. The timeline now runs on a clock that pauses with visibility.
- **Reduced motion keeps the progress.** Upstream only removed the shimmer and entrance. Now the
  globe is still, the ping is gone and nothing loops, while pending / loading / done still change.
- **Screen readers.** State announced once instead of silent; the toggle has `aria-expanded`;
  collapsed content is `inert`.
- **Generic sample content.** Titles and URLs use reserved example domains; no brand names.
- **`size`, `width`, `color`, `defaultOpen`** are new options.

# Agent Thinking

A collapsible "Thinking for 4s…" block that streams an agent's reasoning line by line, then folds
itself into "Thought for 6s". Plain DOM and CSS, no framework, no network.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/agent-thinking/>, or open
[`index.html`](index.html) locally: playground, four variants, a size ladder, an in-context chat
example and a copyable snippet.

| File | What |
| --- | --- |
| `agent-thinking.js` | The drop-in. UMD, global `AgentThinking`, ~14.7 KB raw (~5 KB gzipped). |
| `agent-thinking.css` | Scoped styles, every class prefixed `ath-`, ~5 KB raw. |
| `index.html` | Standalone demo page. Loads both files by relative path; works from disk. |

---

## Variants

Same component, configured by options (each is shown on the demo page):

| Variant | Options | Behaviour |
| --- | --- | --- |
| Default | `{}` | Streams, then folds into "Thought for Ns". |
| Stay open | `{ autoCollapse: false }` | Keeps the whole stream visible after it finishes. |
| No timer | `{ showTimer: false }` | Plain "Thinking…" / "Thought". |
| Starts closed | `{ defaultOpen: false }` | Header only until the reader opens it. |
| Looping | `{ loop: true }` | Rests for 2.8 s after finishing, then replays. Useful for previews. |

---

## Usage

```html
<link rel="stylesheet" href="agent-thinking.css">
<script src="agent-thinking.js"></script>

<div id="reasoning"></div>
<script>
  const thinking = AgentThinking.mount(document.getElementById('reasoning'), {
    sentences: ['Reading the request…', 'Checking the tests…'],  // omit for a sample stream
    delays: [800, 1000],   // ms before each line appears
    size: 13,
    autoCollapse: true,
    showTimer: true,
    onComplete: () => showAnswer()
  });

  thinking.destroy();      // stops the clock, removes nodes and listeners
</script>
```

The host is a bare element. The block inherits your text colour and font, so it themes itself in
light and dark with no option.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `sentences` | sample stream | Array of strings. Each is clamped to two lines. Set as text, never as HTML. |
| `delays` | `[700, 900, 800, 850, 800, 900]` | ms to wait before each line; missing entries fall back to the defaults. |
| `size` | `13` | Font size in px. Line height, clamp, viewport cap and fade depth all scale from it. |
| `width` | `360` | Number (px) or any CSS width. Always capped at `max-width: 100%`. |
| `color` | inherited | Any CSS colour. Everything else is derived from `currentColor`. |
| `defaultOpen` | `true` | Start expanded. |
| `autoCollapse` | `true` | Fold when reasoning ends. |
| `showTimer` | `true` | Show "for Ns". |
| `loop` | `false` | Replay after a rest. |
| `reserveSpace` | `true` | Keep the block's full height while collapsed, so content below does not jump. Turn off for inline use. |
| `label` | `'Reasoning'` | Accessible name of the scrollable stream. |
| `onComplete` | none | Called once per run, when reasoning ends. Also fires under `prefers-reduced-motion` (just after `mount` returns) and in a background tab. |

Returns `{ destroy() }`.

### Behaviour

- **Wall clock.** One timer, no animation-frame loop. It wakes only when a line or a whole second
  is due and keeps running when the block is scrolled offscreen or the tab is hidden, so the lines,
  the elapsed time and `onComplete` stay on schedule. Only the shimmer pauses; the current state is
  rendered when the block is visible again.
- **Accessible.** The header is a real button with `aria-expanded`. A visually hidden
  `role="status"` announces "Thinking" and "Finished thinking" only; the ticking timer is
  `aria-hidden`. Collapsed content is `inert`.
- **Reduced motion.** Renders the finished reasoning at once: no shimmer, slide, fade or collapse
  animation. `onComplete` still fires, on the next tick after `mount` returns.

---

## Upstream and licence

Ported from [solid-thinking-orbs](https://github.com/Mvkweb/solid-thinking-orbs)
(`AgentThinking` component) - **MIT**. Live upstream demo: <https://solid-thinking-orbs.vercel.app>.

- Jakub Antalik: original thinking-orbs concept and React implementation.
- Mvkweb: SolidJS port, the component translated here.
- Alex Brinza: credited as creator on the upstream site (<https://x.com/a_brinza>).

The full MIT notice is in the header of `agent-thinking.js`. Keep it there.

---

## Changes from upstream

- **No Solid, no Tailwind, no CSS modules.** Signals and `<For>` replaced by direct DOM updates;
  the CSS module became plain scoped CSS with an `ath-` prefix.
- **No hardcoded greys.** Upstream used fixed `#a1a1a1` / `#737373`, which is about 2.6:1 on white. Ink
  is now `currentColor` with opacity steps, so text clears 4.5:1 in both themes and follows the page.
- **The live line is emphasised.** The newest line is full ink while it streams; earlier lines sit at
  62 % and ease down over 600 ms, so the eye is led to what is being said now. Upstream rendered all
  lines the same.
- **The stream follows the newest line.** Upstream left the open viewport scrolled to the top, so
  line five and six were hidden below a fade. Now it smooth-scrolls to the end, lets go the moment
  the reader scrolls up, and takes over again when they return to the bottom.
- **Easing and rhythm.** Lines rise 6 px as they fade in (460 ms, ease-out quint) instead of a bare
  opacity change; the shimmer is one slow sweep that rests between passes (2.4 s), implemented as a
  mask so it needs no colour.
- **Drift-free tabular timer.** Upstream counted `setInterval` ticks, which drift and keep counting in
  a background tab. The timer is read from a wall clock that keeps advancing offscreen and when the
  tab is hidden (only the shimmer pauses), and uses tabular numerals so the header does not jitter
  each second.
- **Size is one option.** Upstream was fixed at 13 px / 360 px. `size` scales line height, clamp,
  viewport cap and fade together, so it works from 11 px in a side panel to 20 px as a hero.
- **Reduced motion shows the result.** Upstream skipped straight to done but still animated its
  collapse; now nothing animates at all.
- **Screen readers.** Upstream gave the button a fixed "Toggle thought" label and no state
  announcement. The toggle now reads "Thinking" / "Thought" with `aria-expanded`, state changes are
  announced once, and the collapsed region is `inert`.
- **Looping, `reserveSpace`, `color`, `width`, `label`** are new; sample text is generic (no
  product or library names).

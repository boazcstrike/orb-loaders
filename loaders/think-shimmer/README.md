# Think Shimmer

Five text and status indicators for "the model is thinking", in one CSS file and one dependency-free
JS file. Based on the `Think` component from [Ant Design X](https://github.com/ant-design/x). Every
variant has a real "done" transition, follows `currentColor`, scales from a single `size`, and stops
animating when it is offscreen.

**Demo:** <https://boazcstrike.github.io/orb-loaders/loaders/think-shimmer/>, or open
[`index.html`](index.html) locally: all five variants with Finish/Restart, a size ladder, an in-chat
sequence, an inline-button example, and a copyable snippet.

| File | What |
| --- | --- |
| `think-shimmer.css` | All styling and motion. 12.9 KB raw, ~4.3 KB gzipped. |
| `think-shimmer.js` | UMD. Builds the DOM, owns state and timers. 14 KB raw, ~4.9 KB gzipped. |
| `index.html` | Standalone demo page. Loads both by relative path; works from disk. |

---

## Variants

| `variant` | Looks like | Done transition |
| --- | --- | --- |
| `shimmer` | Text with a soft highlight sweeping across it (upstream `blink`) | Sweep stops, text swaps, a check slides in on the left |
| `dots` | Three dots hopping in a pill (upstream Bubble loading) | Dots shrink away, a check draws itself in the same spot, pill tints |
| `cycle` | A slow-turning spark and a verb that changes every 2.2 s | Spark turns into a check, final text swaps in |
| `thought` | Collapsible header: spinner, title, chevron, body (upstream Think) | Spinner turns into a check, title swaps; the body keeps its open state |
| `steps` | Vertical step chain: pending, working, done (upstream ThoughtChain, shrunk) | The remaining steps tick done in sequence, connectors fill |

---

## Usage

```html
<link rel="stylesheet" href="think-shimmer.css">
<script src="think-shimmer.js"></script>
<div id="status"></div>
<script>
  const t = ThinkShimmer.mount(document.getElementById('status'), {
    variant: 'thought',
    text: 'Thinking…',
    size: 14,
    content: 'Checking the figures against last quarter…'
  });

  t.setText('Reading the report…');
  t.done('Thought for 4s');   // spinner -> check, sweep stops
  t.destroy();                // removes nodes, timers, observers
</script>
```

The ink is the host's CSS `color`; set it on the host or any ancestor. Set `--ts-done` the same way
to tint the finished check.

### Options

| Option | Default | Notes |
| --- | --- | --- |
| `variant` | `'shimmer'` | `shimmer` \| `dots` \| `cycle` \| `thought` \| `steps`. Anything else throws. |
| `size` | `14` | Pixels. Sets one font-size; icon, dots, gaps and bubble are all in `em`. |
| `text` | per variant | Initial text. For `dots` it is only the accessible status text. |
| `doneText` | per variant | Text after `done()` when `done()` gets no argument. |
| `texts` | four verbs | `cycle`: the rotation. `text`, if given, replaces the first. |
| `interval` | `2200` | ms between `cycle` verbs, or between auto-advanced `steps`. |
| `content` | none | `thought`: the body text. Without it the header is not a button. |
| `expanded` | `true` | `thought`: initial open state. |
| `steps` | three steps | `steps`: labels, first one starts active. |
| `autoAdvance` | `true` | `steps`: walk the chain on a timer. Last step stays active until `done()`. |

### Returned handle

| Method | Does |
| --- | --- |
| `setText(text)` | Swaps the visible text (`dots`: the screen-reader text; `steps`: the active step). |
| `done([text])` | Runs the done transition. Calling it again only swaps the text. |
| `destroy()` | Removes the nodes, clears timers, disconnects observers. Safe to call twice. |
| `next()` | `steps` only. Advance one step by hand (use with `autoAdvance: false`). |

### Behaviour

- **Frames:** sweep, hop, spin and rotation are CSS animations. Each loader pauses them (and its JS
  timers) while scrolled offscreen or the tab is hidden.
- **Accessibility:** the root has `role="status"`, except `thought`, where only the title is live so
  the body is not re-announced. Icons are `aria-hidden`. The `thought` header is a real `<button>`
  with `aria-expanded` and `aria-controls`.
- **`prefers-reduced-motion: reduce`:** no sweep (plain dim text), no hop (three dots at stepped
  opacity), no spin. Spinner, spark and dots fade slowly instead. State changes still show, instantly.
- **Zero network requests**, no fonts, no images.

---

## Changes from upstream

Upstream is React + antd + cssinjs, so none of its code runs here; the motion and structure are ported
by hand and then reworked.

- **Sweep easing:** upstream's `blink` is a 1 s `linear` slide of a 50%-wide band. Here the band is a
  soft 3-stop gradient on a 300%-wide layer that starts and ends fully offscreen, on a 2.2 s
  ease-in-out. It accelerates across the text and rests between passes, so it reads as a breath rather
  than a conveyor belt.
- **Contrast in both themes:** the resting ink is `currentColor` at 62%, which holds about 5:1 on the
  light and dark glass surfaces. Upstream's default blink colour is the antd description grey, which
  is not theme-aware.
- **No brand blue:** all colour is `currentColor` or a `color-mix` of it. Upstream's dots use
  `colorPrimary`.
- **Typing dots:** upstream hops 4 px for 0.2 s of a 2 s linear cycle. Here each dot also scales and
  fades in with the hop, rests for 70% of a 1.3 s cycle, and sits in a tinted pill so it reads as a
  message bubble.
- **A done state for everything:** upstream `Think` only changes its icon; the dots and text have no
  finished state. Here the spinner draws a check (stroke-dash reveal), the dots dissolve into one, the
  shimmer slides one in, and the step chain fills its connectors.
- **Spinner:** upstream uses a plain `LoadingOutlined` wheel. Here the arc length breathes while it
  turns, so it never reads as a stuck rotation.
- **Collapse:** upstream measures `scrollHeight` in JS to animate the body. Here a `grid-template-rows`
  `0fr` to `1fr` transition does it in CSS, with `visibility` flipped after the transition so a closed
  body leaves the tab order and the accessibility tree.
- **Text swaps:** new text rises 0.3 em, de-blurs and fades in (Web Animations API), instead of
  snapping.
- **Two additions:** the `cycle` verb variant and the `steps` chain, a trimmed ThoughtChain that
  advances on its own.
- **Sizing:** everything is in `em` off one `size`, so the same markup works at 12 px inline and 40 px
  as a hero line. Upstream's sizes come from antd tokens (14 px text, 16 px icon).
- **Reduced motion and offscreen pausing:** upstream has neither.

---

## Upstream and licence

Adapted from [Ant Design X](https://github.com/ant-design/x) by Ant Group / Ant UED
(docs: <https://x.ant.design/components/think>). **MIT**: `packages/x/package.json` declares
`"license": "MIT"` and `packages/x/LICENSE` carries the notice, copyright (c) 2015-present Ant UED.
The full notice is in the header of both `think-shimmer.css` and `think-shimmer.js`. Keep it there.

Studied: `components/think` (Think, its `blink` token pair), `components/style/motion/blink.ts`,
`components/bubble` (loading dots), `components/thought-chain`. The think icon glyph is not copied; the
spark and check here are drawn fresh.

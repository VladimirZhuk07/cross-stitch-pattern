# Design

## Context

See proposal.md (Why). Today `styles/main.css` has two breakpoints: below 72rem the legend
wraps under settings and frame (`max-height: 40vh`); below 48rem everything stacks in one
column with the full settings form on top and the frame at its desktop `min-height: 320px`.
Controls are sized for a mouse (zoom buttons about 36 × 30 px). The viewport meta tag is
already `width=device-width, initial-scale=1`, and the file input already has
`accept="image/*"`, but the native file box ("No file chosen") is visible. `src/ui/viewer.js`
already re-fits the canvas through a `ResizeObserver` and keeps the view centred when the
frame changes size, so the frame may grow and shrink freely.

Parallel changes touch nearby files: add-pinch-zoom adds one `touch-action` rule to
`main.css` and edits `viewer-input.js`; raise-pattern-limits edits the settings input
`min`/`max` attributes and the limit constants; tile-large-pattern-rendering edits layer files.

## Goals / Non-Goals

**Goals:** a compact layout decided by CSS alone; collapsible settings and legend with
accessible toggles; summary texts computed in `core/` and unit-tested; desktop and medium
layouts pixel-identical except the `Choose image` button; edits localized for easy rebases.

**Non-Goals:** no JavaScript that measures the window or moves elements between containers;
no remembered panel state; no new gestures on the canvas; no change to `main.js`.

## Decisions

### 1. Breakpoints and layouts (CSS only, screen only)

| Layout | Media condition | Typical devices | Arrangement |
|---|---|---|---|
| Wide | `width ≥ 72rem` (1152 px) | desktop | settings 16rem · frame · legend 24rem (unchanged) |
| Medium | `48rem ≤ width < 72rem` | iPad portrait/landscape, small laptop | settings · frame, legend below at ≤ 40vh (unchanged) |
| Compact portrait | `width < 48rem` (768 px) | phones portrait (360–430 px) | one column, frame fills the rest |
| Compact landscape | `height < 30rem` (480 px) and `width < 60rem` (960 px), landscape | phones landscape (667–932 × 360–430) | frame + rail, panels in a side column |

The compact block is
`@media screen and (width < 48rem), screen and (height < 30rem) and (width < 60rem)`; the
landscape block follows it and adds `and (orientation: landscape)`. Both are scoped to
`screen`: a printed A4/Letter page is narrower than 48rem and must not get collapsed panels.
The 60rem cap keeps short desktop windows (e.g. 1400 × 450) in their normal layout. The two
existing `max-width: 48rem` blocks are replaced by the compact block; the 72rem block stays.
Range syntax (`width < 48rem`) is used for readability (Chrome 104, Safari 16.4, Firefox 63).

A separate `@media (pointer: coarse)` block enlarges controls to 44 px on touch tablets in
the medium and wide layouts without changing their arrangement.

Compact portrait (375 × 667, panels collapsed, ≈ 340 px frame):

```
+-----------------------------------+
| Cross-Stitch Patt…  [Choose image]|  header, 44 px button, safe-area padded
+-----------------------------------+
| Settings                        v |  toggle, aria-expanded="false"
| 100 × 67 · max 24 colors · 14 ct… |  summary (core), wraps if needed
| Pattern ready: 100 × 67, 18 DMC…  |  generation status (hidden when empty)
+-----------------------------------+
| [ Original ][DMC colors][ Chart ] |  segmented, 44 px, equal widths
+-----------------------------------+
|                                   |
|              frame                |  grid row 1fr, min 10rem
|          (canvas, 100dvh)         |
|                                   |
+-----------------------------------+
| photo.jpg — 1200 ×  [-] 100% [+][Fit]  status wraps | zoom 44 px
| 800 px                            |
+-----------------------------------+
| Legend · 18 colors              v |  toggle; expanded body ≤ 40dvh, scrolls
+-----------------------------------+
```

Compact landscape (667 × 375):

```
+---------------------------------------------------------------+
| Cross-Stitch Pattern Maker                     [Choose image] |
+-------------------------+-------------+-----------------------+
|                         | [Original ] | Settings            v |
|          frame          | [DMC colors]| 100 × 67 · max 24 …   |
|   (full height below    | [  Chart  ] |-----------------------|
|        header)          | [-] 100% [+]| Legend · 18 colors  v |
|                         | [   Fit   ] |  (rows scroll here    |
|                         | status text |   when expanded)      |
+-------------------------+-------------+-----------------------+
          1fr               rail 10rem      side column 14rem
```

Alternatives: switching layouts in JavaScript with `matchMedia` (rejected: layout logic in
two places, and moving DOM nodes loses focus); floating zoom buttons over the canvas
(rejected: they would sit inside the viewer's pointer handling, which add-pinch-zoom is
changing, and cover the image).

### 2. Workspace as a CSS grid in compact layouts

In compact layouts `.workspace` becomes a grid and `.toolbar` gets `display: contents`, so the
layer switcher, the zoom controls, the frame and the status line become grid items placed by
`grid-template-areas`: portrait `"view view" "frame frame" "status zoom"` with rows
`auto 1fr auto`; landscape `"frame view" "frame zoom" "frame status"` with columns
`1fr 10rem`. `display: contents` is applied only to the toolbar `div`, which has no role; the
`fieldset` and the zoom `role="group"` keep their own boxes and semantics. DOM order and tab
order do not change. In landscape `.app-main` is a grid too: `"work settings" "work legend"`,
columns `1fr 14rem`, rows `auto 1fr`, the settings and legend areas scrolling on their own.

### 3. Frame height

In compact layouts `body` uses `min-height: 100vh; min-height: 100dvh` (the first line is the
fallback) instead of `height: 100%`; `.app-main` and `.workspace` grow, and the frame's grid
row is `1fr` with `.viewer { min-height: 10rem }`. When panels are expanded and the content is
taller than the screen, the page scrolls; it can be scrolled by dragging anything except the
frame (the frame owns its touches). Panels toggle instantly, without animation, so the canvas
is resized once, not on every animation frame. Desktop keeps `height: 100%` and the 320 px
frame minimum.

### 4. Collapsible panels: a toggle button plus CSS, not `<details>`

Markup (fields wrapped, never rewritten, so raise-pattern-limits' attribute edits rebase):

```
<form class="settings collapsible" data-role="settings" novalidate>
  <button class="collapsible__toggle" type="button" data-action="toggle-settings"
          aria-expanded="false" aria-controls="settings-body">
    <span class="collapsible__title">Settings</span>
    <span class="collapsible__summary" data-role="settings-summary">…</span>
  </button>
  <div class="collapsible__body" id="settings-body"> fieldset + size output (unchanged) </div>
  generation-status output (unchanged, stays outside the body, always visible)
</form>

<section class="legend collapsible" data-role="legend" … hidden>
  <button class="collapsible__toggle" … data-action="toggle-legend" aria-controls="legend-body">
    Legend + <span data-role="legend-summary">
  <h2 class="legend__title" id="legend-title">Legend</h2>   (visually hidden in compact)
  <div class="collapsible__body legend__body" id="legend-body"> empty text + table </div>
  row template (unchanged)
</section>
```

Outside the compact block `.collapsible__toggle { display: none }`, so desktop is unchanged.
Inside it, one rule hides a collapsed body:
`.collapsible:has(> .collapsible__toggle[aria-expanded="false"]) > .collapsible__body { display: none }`.
`aria-expanded` is the single source of truth; resizing to desktop ignores it, resizing back
re-applies it. `:has()` is already used in `main.css`.

Alternative: `<details>/<summary>` (rejected: its content cannot be forced open on desktop
with CSS in all target browsers — `::details-content` is too new — so JS would have to sync
`open` with a media query; `summary` also cannot hold the fieldset legend semantics cleanly).

### 5. Panel state lives in the DOM, not the store

Whether a panel is open is view-only state that no other module reads, so it is kept in the
toggle's `aria-expanded` attribute instead of the app store. Every load starts collapsed
(markup default). New ui module `src/ui/collapsible.js` (layer `ui/`):
`setupCollapsible(toggle)` flips `aria-expanded` between `"true"` and `"false"` on `click`
(native buttons fire `click` for Enter and Space). `setupSettingsForm` and `setupLegend` call
it for their own toggle, so `main.js` is not edited.

### 6. Summary texts in core

Both functions are pure and live next to the texts they belong with:

- `formatSettingsSummary(size, settings)` in `src/core/generation-settings.js`.
  `size` is `{ width, height }` in stitches (from `stitchGridSize`, computed by
  `describeSize` in `src/ui/settings-form.js`) or `null` without an image; `settings` is the
  existing Settings shape (`targetWidth`, `maxColors`, `fabricCount`). Returns a string:
  `100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in`, `Width 100 · max 24 colors · 14 ct`
  without an image, `100 × 4995 · too large · max 24 colors · 14 ct` when a side exceeds
  `MAX_GRID_SIDE`, `max 1 color` for one color. Inches come from `finishedSize` in
  `./pattern.js` with the same one-decimal rounding as `formatPatternSize`.
- `formatLegendSummary(colorCount)` in `src/core/legend-rows.js`: `18 colors`, `1 color`,
  `no stitches` for 0.

Inches only (not cm) keep the summary to one line on most phones; the full inches-and-cm text
is in the expanded panel. The UI keeps using its existing `isTooLarge` flag for the error
color. Core stays pure: no DOM, no new imports beyond `core/`.

### 7. Touch targets and controls

A token `--touch-target: 2.75rem` (44 px) is applied as `min-height`/`min-width` in the
compact and coarse-pointer blocks to: the file-picker button, the toggles, view segments,
zoom buttons, settings inputs and select. In compact layouts the view switcher becomes a
segmented control: the radio dot and the `View` caption are visually hidden (clip pattern,
still read by screen readers), each option `flex: 1`, the checked option gets a 2 px accent
border and bold text, and `:has(:focus-visible)` draws the focus ring on the option. The zoom
level output shrinks from 4.5rem to 3.5rem. Settings inputs keep `font: inherit` (16 px), so
iOS does not zoom on focus.

### 8. Image chooser button

On every width the `.file-picker` label is styled as a button and the native input is visually
hidden with the clip pattern (still focusable and in the tab order);
`.file-picker:has(.file-picker__input:focus-visible)` shows the focus ring. `accept="image/*"`
stays and no `capture` attribute is added: `capture` would force the camera and hide the
gallery. iOS hands HEIC photos over as JPEG for `image/*`.
Alternative: a `<button>` that calls `input.click()` (rejected: needs JS for something the
label already does).

### 9. Viewport and safe areas

The meta tag becomes `width=device-width, initial-scale=1, viewport-fit=cover`; without
`viewport-fit=cover` iOS letterboxes landscape pages and reports zero insets. `body` gets
`padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
env(safe-area-inset-left)` (0 on desktop) and `text-size-adjust: 100%` (with the `-webkit-`
prefix) to stop iOS enlarging text in landscape. Page zoom is never disabled
(accessibility); the frame already blocks browser gestures with `touch-action: none`.

### 10. Text wrapping and print

`.status`, `.settings__size`, `.settings__status` and `.legend__cell--name` get
`overflow-wrap: anywhere` so file names without spaces wrap. `.settings__status:empty` is
hidden in compact layouts to save a line. `print.css` hides `.collapsible__toggle`.

## Risks / Trade-offs

- [Older Safari (< 16.4) ignores range media syntax and gets the desktop layout squeezed] →
  acceptable for a static hobby app; the old layout still works, just not optimized.
- [Expanded panels plus a 10rem frame exceed short screens] → the page scrolls; the frame
  keeps 160 px; toggles stay reachable above and below it.
- [Resizing the canvas when a panel opens costs a redraw of large patterns] → instant
  toggles (one resize); rendering speed belongs to tile-large-pattern-rendering.
- [`display: contents` on the toolbar] → only on a role-less `div`; the fieldset and group
  keep their boxes, so no accessibility semantics are lost.
- [Conflicts with parallel changes] → main.css edits are new sections at the end plus removal
  of the two 48rem blocks; settings-form.js and generation-settings.js get appended code;
  tests use `MAX_GRID_SIDE + 1` instead of a literal 500 for the too-large summary.
- [No real-phone test of iOS] → the dev server binds 127.0.0.1 only; Android can be tested
  through `chrome://inspect` port forwarding; iPhone checks rely on DevTools emulation unless
  the user tests a deployed build.

## Migration Plan

Static files only: deploy with the rest of the site; roll back by reverting the commits.

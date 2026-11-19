# Design

## Context

- The Chart layer (`src/ui/layers/chart-layer.js`) paints in this order: cell colors (pictures
  from `createPatternPicture` in `src/ui/layers/pattern-picture.js`), the empty hatch, numbers,
  grid lines, then rulers. Only visible cells are painted.
- Cell pictures are one level-0 picture up to 2048 stitches per side. Larger patterns use a
  pyramid of averaged levels with 512 px tiles, built row by row within
  `BUILD_BUDGET_STITCHES` per frame and kept within `TILE_CACHE_BUDGET_BYTES`.
  `detailLevel` rounds `log2(1 / devicePxPerStitch)`, so a picture pixel is 0.71–1.41 device
  px. Below one device px per stitch the layer draws smoothed. A lone stitch of one color in
  an averaged or smoothed pixel fades to a fraction of its strength; that is fine for tints but
  would lose a highlight.
- The viewer repaints on an animation frame from `store.getState()` and only when a field in
  `needsPaint` changed. The layer switcher re-renders its radios from `state.activeLayer` on
  every state change.
- Legend rows are rebuilt from the template only when `state.pattern` changes.

## Goals / Non-Goals

**Goals:**
- One more state field and one overlay picture. No change to the cell-color pictures or their
  budgets.
- A highlight that reuses the tiling machinery, so huge patterns stay within the frame and
  memory rules.

**Non-Goals:**
- Highlighting on the DMC colors layer. The overlay is drawn by the Chart layer only, but it is
  built so that a later Progress layer can draw it too.

## Decisions

### D1. State: `highlightedColor`

`state.highlightedColor` holds the selected legend index (`0 … N − 1`) or `null`. It starts
`null` (`src/ui/app-state.js`) and is written only by `src/ui/legend.js`:
- a row click sets it to `toggleHighlight(current, index)`;
- Esc sets it to `null`;
- a new pattern (`state.pattern !== previous.pattern`) sets it to `null` in the same store
  round. The viewer paints on the next animation frame from the final state, so a stale index
  is never drawn. As a guard, the chart also ignores an index ≥ `pattern.legend.length`.

When a color is selected, and only then, the legend writes
`{ highlightedColor, activeLayer: 'chart' }` in one `setState` if the active layer is not
`chart`. The layer switcher already reflects `activeLayer` from the store. The viewer adds
`highlightedColor` to `needsPaint`.

*Alternative:* store `{ pattern, index }` to bind the selection to its pattern. Rejected: one
plain number is simpler, and the clear-on-new-pattern round plus the length guard cover the same
case.

### D2. Pure rules in `src/core/highlight.js` (core, pure)

- `HIGHLIGHT_COLOR = '#B00000'` and `HIGHLIGHT_NUMBER_COLOR = '#FFFFFF'`.
  - White on `#B00000`: 7.38:1.
  - `#B00000` against the darkest possible tint (relative luminance 0.436, see
    `chart-tint.js`): 3.42:1, above the 3:1 WCAG non-text contrast.
  - `#C00000` gave only 2.999:1 against that tint, so it was rejected.
  - A filled cell beats an outline: an outline disappears in cells of a few pixels, a fill
    stays visible down to one device pixel.
- `toggleHighlight(current, legendIndex)` returns `null` when they are equal, otherwise
  `legendIndex`. It throws `RangeError` for a negative or non-integer index.
- `highlightLevel(devicePxPerStitch, maxLevel)` returns
  `min(maxLevel, max(0, ceil(log2(1 / devicePxPerStitch))))`. Rounding **up**, unlike
  `detailLevel`, makes one picture pixel cover 1 to < 2 device px. Drawn without smoothing,
  every pixel then lands on at least one whole device pixel and never more than 2 × 2. The
  input is validated like `detailLevel`.
- `HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE = 256`. This is the overlay's single-picture/overview
  limit. Every overview level is then at most 256 px per side, so its pixels stay at least one
  device px in any frame of 256 device px or more. The cell pictures use 2048, and a 2048-wide
  level-0 overlay at Fit would need smoothing (0.36 device px per stitch) and fade.
- `fillHighlightRows(grid, legendIndex, level, region, rowStart, rowEnd, out)` has the same
  shape and validation as `fillLevelRows` in `level-pixels.js`. A pixel is opaque
  `HIGHLIGHT_COLOR` when **any** stitch of its 2^level block (inside the pattern) has
  `legendIndex`, and `0, 0, 0, 0` otherwise. It returns the stitches read. It stops scanning a
  block at its first match, so it reads no more stitches than `fillLevelRows`. The validation
  of `level-pixels.js` (`assertFillInput`) is exported and reused instead of copied.

### D3. `createPatternPicture` options (ui, `pattern-picture.js`)

Three optional additions; existing callers stay unchanged:
- `fillRows(pattern, level, region, rowStart, rowEnd, out)`. When given, it replaces
  `colorTableOf` + `fillLevelRows`.
- `levelFor(devicePxPerStitch, maxLevel)` (default `detailLevel`).
- The returned object gains `release()`, which frees every canvas at once, as a pattern change
  already does.

The overlay is a second picture cache inside the Chart layer:
`createPatternPicture({ createCellCanvas, fillRows: (p, …) => fillHighlightRows(p, index, …), levelFor: highlightLevel, limits: { singlePictureMaxSide: HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE, cacheBudgetBytes: HIGHLIGHT_CACHE_BUDGET_BYTES } })`.
It is created when a color is selected and released (`release()`) when the selection or the
pattern changes or is cleared. Its build budget is the same `BUILD_BUDGET_STITCHES` per frame,
so the highlight never reads more per frame than the cell colors do.
`HIGHLIGHT_CACHE_BUDGET_BYTES = 16 MiB` (in `highlight.js`). Visible tiles are always kept, as
for cell pictures.

### D4. Chart layer paint order (ui, `chart-layer.js`)

1. Cell colors (unchanged).
2. **Highlight overlay**: `imageSmoothingEnabled = false`, then `overlay.draw(…)`. It covers the
   tints of the selected cells; empty cells are never selected.
3. Hatch (unchanged).
4. Numbers: one pass in the normal font and black for all non-selected cells, then one pass in
   `bold` with the same size in `#FFFFFF` for the selected cells. Both are skipped below the
   number threshold.
5. Grid lines and rulers (unchanged).

`render` returns `true` while either picture is incomplete.

### D5. Legend markup and events (ui, `legend.js`, `index.html`)

- In the row template the number `<span class="legend__number">` becomes a
  `<button type="button" class="legend__number" data-action="highlight-color" aria-pressed="false">`.
  Each `<tr>` gets `data-legend-index`.
- `aria-label` comes from the new pure `formatHighlightLabel(row)` in `core/legend-rows.js`,
  e.g. `Highlight color 2, DMC 321 Red`. It contains the visible number (WCAG "label in
  name") and is set with `setAttribute`, never as markup.
- There is one delegated `click` listener on the rows container. `closest('[data-legend-index]')`
  finds the index. It covers a click on the button (Enter and Space click a native button), a
  click elsewhere in the row, and taps.
- Esc is a `keydown` listener on the document that acts only while `highlightedColor !== null`.
  It does not call `preventDefault`, so other Esc behaviour is untouched.
- On a `highlightedColor` change only `aria-pressed` and the row class `legend__row--selected`
  are updated. Rows are not rebuilt.
- CSS: `.legend__row--selected` gets bold text and `box-shadow: inset 3px 0 0 var(--color-accent)`
  on its first cell. Its `.legend__number` gets a `#B00000` background with a bold white
  number. Rows get `cursor: pointer`. The button keeps the focus ring.

## Risks / Trade-offs

- [More canvas memory while a color is selected] → The overlay has its own 16 MiB budget. It
  exists only while a color is selected and is released on clear.
- [Two pictures build in the same frames, so up to twice the stitches are read per frame] →
  This happens only during the first frames after selecting a color or zooming. The overlay
  fill is a compare per stitch, cheaper than the tint average.
- [Esc also clears the highlight while the user edits a settings field] → It is harmless,
  because the highlight is a viewing aid. The spec only requires that Esc does nothing without
  a selection.
- [Auto-switching to Chart could surprise a user on DMC colors] → It happens only on selecting,
  never on clearing, and the Chart is the only layer that shows the result.

## Migration Plan

Nothing is stored, so there is nothing to migrate.

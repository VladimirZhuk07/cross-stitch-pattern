# Tasks

## 1. Highlight rules (core)

- [x] 1.1 Write failing `tests/unit/core/highlight.test.js` for the constants and `toggleHighlight`:
  - `HIGHLIGHT_COLOR` is `#B00000` and `HIGHLIGHT_NUMBER_COLOR` is `#FFFFFF`;
  - WCAG contrast (computed in the test from `hexToRgb`/`srgbToLinear`) of white on `HIGHLIGHT_COLOR` is ≥ 7.3, and of `HIGHLIGHT_COLOR` against luminance 0.436 is ≥ 3.4;
  - `toggleHighlight(null, 2)` → 2, `(2, 2)` → null, `(2, 0)` → 0;
  - `(null, -1)` and `(null, 1.5)` throw `RangeError` naming the value.

  Verify it fails because the module is missing.
- [x] 1.2 Create `src/core/highlight.js` with the two colours and `toggleHighlight`, with a header comment pointing to the stitch-chart spec; verify 1.1 passes
- [ ] 1.3 Add failing tests for `highlightLevel(devicePxPerStitch, maxLevel)`:
  - `(1, 5)` → 0; `(2, 5)` → 0; `(0.9, 5)` → 1; `(0.5, 5)` → 1; `(0.49, 5)` → 2; `(0.18, 5)` → 3; `(0.18, 2)` → 2 (clamped);
  - `0`, `-1`, `NaN` throw `RangeError` like `detailLevel`;
  - `HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE` is 256 and `HIGHLIGHT_CACHE_BUDGET_BYTES` is 16 MiB.

  Verify they fail.
- [ ] 1.4 Implement `highlightLevel` and the two constants (reuse the level validation of `tile-pyramid.js`, exporting it if needed); verify 1.3 passes and `tests/unit/core/tile-pyramid.test.js` still passes
- [ ] 1.5 Add failing tests for `fillHighlightRows(grid, legendIndex, level, region, rowStart, rowEnd, out)`:
  - with the 3 × 2 pattern (index 1 at (0, 0) and (2, 1)), level 0, index 1: pixels (0, 0) and (2, 1) are `176, 0, 0, 255` and the other four are `0, 0, 0, 0`;
  - at level 1 a 4 × 4 grid with one index-3 stitch at (3, 3) gives pixel (1, 1) opaque `#B00000` and pixels (0, 0), (1, 0), (0, 1) transparent;
  - a 5 × 5 grid at level 1 handles the partial edge blocks;
  - rows outside `rowStart … rowEnd` are untouched;
  - it returns no more stitches read than `fillLevelRows` for the same call;
  - an index not in the pattern gives an all-transparent region;
  - a wrong `out` length, an invalid level and a region outside the level throw the same `RangeError`s as `fillLevelRows`.

  Verify they fail.
- [ ] 1.6 Implement `fillHighlightRows`, exporting and reusing `assertFillInput` from `level-pixels.js`; verify 1.5 passes and `tests/unit/core/level-pixels.test.js` still passes
- [ ] 1.7 Add failing tests to `tests/unit/core/legend-rows.test.js` for `formatHighlightLabel(row)`: the row of `321` "Red" number 2 → `Highlight color 2, DMC 321 Red`; `BLANC` "White" number 10 → `Highlight color 10, DMC BLANC White`; the name `<b>Red</b>` is kept literally. Then implement it; verify `npm run test:unit` passes

## 2. Overlay picture (ui)

- [ ] 2.1 Add failing tests to `tests/integration/pattern-picture.test.js`:
  - with `fillRows` given, the picture is filled by it and `colorTableOf` is not needed;
  - with `levelFor` given, it decides the level: a 4000 × 4000 pattern at 0.18 device px per stitch with `levelFor: highlightLevel` and `singlePictureMaxSide: 256` builds level-3 tiles;
  - `release()` sets every built canvas to 0 × 0 and the next `draw` builds again;
  - existing tests unchanged.

  Verify the new tests fail.
- [ ] 2.2 Implement the `fillRows`, `levelFor` options and `release()` in `src/ui/layers/pattern-picture.js` and update its doc comment; verify `tests/integration/pattern-picture.test.js` passes

## 3. Chart layer (ui)

- [ ] 3.1 Add failing tests to `tests/integration/chart-layer.test.js` (render with `highlightedColor` in the state):
  - 3 × 2 pattern in 20 px cells with `highlightedColor: 1`: a second cell picture is drawn after the tint picture with smoothing off, whose pixels at (0, 0) and (2, 1) are `#B00000`; the texts `2` are bold, `#FFFFFF`, 9 px; the texts `1` are normal and black;
  - `highlightedColor: null` draws exactly what it draws today (one picture, no bold text);
  - 10 px cells draw the overlay but no text;
  - `highlightedColor: 5` on a 2-color pattern (stale index) draws no overlay;
  - changing `highlightedColor` from 1 to 0 releases the old overlay canvases (width 0) and builds a new one;
  - `render` returns `true` while the overlay is still being built.

  Verify they fail.
- [ ] 3.2 Implement D4 in `src/ui/layers/chart-layer.js` (overlay cache per pattern + index, release on change, number passes) and update its header comment's paint order; verify 3.1 and the whole file pass
- [ ] 3.3 Add `highlightedColor` to `needsPaint` in `src/ui/viewer.js`, and add `highlightedColor: null` to `createInitialState` with its description in the header of `src/ui/app-state.js`; verify `npm run test:integration` passes

## 4. Legend selection (markup, ui, CSS)

- [ ] 4.1 Add failing checks to `tests/integration/legend-markup.test.js`: the row template's number is `<button type="button" class="legend__number" data-action="highlight-color" aria-pressed="false" data-field="number">`, and the `<tr>` of the template has no `data-legend-index` (it is set per row); then change `index.html`; verify the markup tests pass
- [ ] 4.2 Write failing `tests/integration/legend-highlight.test.js` that drives `setupLegend` with a minimal fake DOM (template clone, `closest`, `classList`, `setAttribute`, document `keydown`) and the real store. Cover:
  - click row 2 → `highlightedColor` 1, `aria-pressed` true on row 2, row class `legend__row--selected`;
  - click row 1 → 0 and the classes move;
  - click row 1 again → null;
  - with `activeLayer: 'dmc'` a click sets `activeLayer: 'chart'`, and clearing does not change the layer;
  - Esc clears; Esc without a selection writes no state;
  - a new pattern clears the selection, the new rows start unpressed, and `aria-label` is `Highlight color 2, DMC 321 Red`.

  If a fake DOM turns out to be too large for `legend.js`, extract the decision logic into a pure helper in `core/highlight.js` and test that instead; tell the user.

  Verify the file fails.
- [ ] 4.3 Implement D5 in `src/ui/legend.js` (`data-legend-index`, `aria-label`, delegated click, document Esc, clear on a new pattern, switch to Chart, update without rebuilding); update its header comment; verify 4.2 passes
- [ ] 4.4 Add the selected-row CSS from D5 to `styles/main.css` (button reset so the number box looks as before, `cursor: pointer` on rows, `.legend__row--selected` bold text, the 3 px inset accent edge, `#B00000` number box with a bold white number, focus ring on the button); verify in the browser at 1440 × 900 that unselected rows look as on `main` and the selected row matches the spec

## 5. Verification

- [ ] 5.1 Run `npm run test:unit`; all tests pass
- [ ] 5.2 Run `npm run test:integration`; all tests pass
- [ ] 5.3 Browser smoke check with `node scripts/serve.js`:
  - 1440 × 900, photo at width 100: on Chart, click a legend row. Its cells turn red with bold white numbers (zoom in to see numbers) and stay red at Fit, where numbers are hidden. Click another row: the highlight moves. Click it again: no highlight. Select, then press Esc: cleared.
  - On `DMC colors`, click a row: the view switches to Chart, highlighted. Switch to Original and back: still highlighted. Change the width: the selection is gone.
  - Keyboard: Tab to a number button. Enter selects and Space clears; a focus ring is visible.
  - Width 4000 on a large photo: select the least-used color at Fit. Its stitches are visible as red dots, and zooming in shows the same stitches as red cells. No console errors.
  - 375 × 667: expand the legend and tap a row. The view switches to Chart with the highlight.
- [ ] 5.4 Run `openspec validate add-legend-highlight --strict`; it passes

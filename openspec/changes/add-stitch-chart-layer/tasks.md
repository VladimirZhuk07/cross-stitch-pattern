# Tasks

## 1. Fit margin 24 px

- [x] 1.1 In `tests/unit/core/viewport.test.js`, update the five fit-dependent tests to a 24 px margin: wide image → scale 0.476, offset (24, 162); small image → scale 9.52, offset (24, 162); tall 500 × 1000 image → scale 0.752, offset (312, 24); `zoomLimits` for 2000 × 1000 → minScale 0.238; the "fit needs more than 64" test uses frame 1048 × 800 (available 1000 × 752 → fit 100, limits 50 / 100); rename "16 px" in test names and comments; verify `node --test tests/unit/core/viewport.test.js` fails
- [x] 1.2 Set `FIT_MARGIN = 24` in `src/core/viewport.js` (update its comment); verify `node --test tests/unit/core/viewport.test.js` passes

## 2. Chart geometry (core)

- [x] 2.1 Write failing tests in `tests/unit/core/chart-layout.test.js` for `chartCellGeometry` (content 1024 × 682.5, grid 100 × 67 → cellWidth 10.24, cellHeight ≈ 10.18657, cellSize = cellHeight; 24 × 20 cells → cellSize 20), `cellCenter` (content 0, 0, 60 × 40, grid 3 × 2: (0, 0) → (10, 10), (2, 1) → (50, 30)) and `visibleCellRange` (100 × 100 grid, 10 px cells, content top-left (−95, −40), frame 400 × 300 → columns 9–50, rows 4–34 half-open; 300 × 300 grid, 20 px cells at (0, 0) → columns 0–20, rows 0–15; content at (500, 0) and at (−2000, 0) → empty column range; fully fitted grid → whole grid; grid width 0 or 1.5 → `RangeError` with the value); verify `npm run test:unit` fails because the module is missing
- [ ] 2.2 Create `src/core/chart-layout.js` with a header comment (pure, CSS px units, the shapes CellGeometry and CellRange in plain words) and implement `chartCellGeometry`, `cellCenter`, `visibleCellRange`; verify 2.1 passes
- [ ] 2.3 Write failing tests for `numberFontSize`: 20 → 12, 50 → 30, 14 → 8.4, 13.9 → `null`, 7.52 → `null`, 18.359375 → ≈ 11.0156; −1 and `NaN` throw `RangeError`; verify they fail
- [ ] 2.4 Implement `numberFontSize` with the named constants `NUMBER_FONT_FRACTION = 0.6` and `MIN_NUMBERED_CELL_SIZE = 14`; verify 2.3 passes
- [ ] 2.5 Write failing tests for `gridLines` (range 0–23 of 23 at 10 px → bold 0, 10, 20, 23 and 20 thin; range 0–12 of 12 → bold 0, 10, 12 and 10 thin; same at 3 px → bold only; 4 px → thin included; range 8–12 of 100 → 8, 9 thin, 10 bold, 11, 12 thin), `chartLineWidths` (ratios 1, 1.25, 2, 3 → thin 1, 1, 2, 3 and bold 2, 2, 4, 6; ratio 0 throws `RangeError`) and `snapLine` (10.3 at width 1 ratio 1 → 10.5; width 2 ratio 1 → 10; width 2 ratio 2 → 10.5; width 1 ratio 1.25 → 10; width 1 ratio 2 → 10.25); verify they fail
- [ ] 2.6 Implement `gridLines`, `chartLineWidths`, `snapLine` with `MAJOR_LINE_STEP = 10` and `MIN_THIN_LINE_CELL_SIZE = 4`; verify 2.5 passes

## 3. Rulers and centre marker (core)

- [ ] 3.1 Write failing tests for `RULER_SIZE` (equals `FIT_MARGIN`, 24), `rulerPlacement` (content (24, 162) → top 138, left 0; (−300, −120) → top 0, left 0; (24, 100) → top 76, left 0), `rulerLabels` ((0, 100, 10) → 10…100; (8, 50, 10) → 10…50; (0, 67, 10) → 10…60; (0, 5, 10) → []; step 0 throws `RangeError`), `rulerLabelStep` ((3.2, 17) → 10; (1.6, 17) → 20; (0.5, 17) → 50; (0.01, 17) → 500; (10, 17) → 10), `rulerFontSize` (12 → 10; 16 → 10; 20 → 8; 40 → 7) and `chartCenter` (100 × 67 → column 50, row 33.5; 1 × 1 → 0.5, 0.5); verify they fail
- [ ] 3.2 Implement them with the named constants of design D2 (`RULER_FONT_SIZE = 10`, `MIN_RULER_FONT_SIZE = 7`, `RULER_LABEL_ROOM = 16`, `RULER_LABEL_STEPS`, `RULER_LABEL_GAP = 4`, `CENTER_MARKER_DEPTH = 5`, `CENTER_MARKER_WIDTH = 8`) and a plain-text comment on every export; verify 3.1 passes and `chart-layout.js` stays under ~300 lines with functions under ~40 lines (split rulers into `chart-rulers.js` otherwise and update design.md)

## 4. Legend rows (core)

- [ ] 4.1 Write failing tests in `tests/unit/core/legend-rows.test.js` for `legendRows`: the 3 × 2 pattern → `[{ number: '1', code: '310', name: 'Black', hex: '#000000', stitchCount: '3' }, { number: '2', code: '321', name: 'Red', hex: '#C72B3B', stitchCount: '2' }]`; a 12345-stitch entry → `'12,345'`; a 1 234 567-stitch entry → `'1,234,567'`; an all-empty 2 × 2 pattern → `[]`; a name `<b>Red</b>` is returned unchanged; the pattern is not modified; verify `npm run test:unit` fails
- [ ] 4.2 Create `src/core/legend-rows.js` (LegendRow described in plain words, `Intl.NumberFormat('en-US')`); verify 4.1 passes

## 5. Chart layer (ui)

- [ ] 5.1 Add `tests/helpers/recording-context.js` (a fake 2D context recording `fillRect`, `rect`, `fill`, `moveTo`, `lineTo`, `stroke`, `fillText` with the current `font`/`fillStyle`/`strokeStyle`/`lineWidth`; `measureText` returns width = 0.55 × font size per character) and write failing `tests/integration/chart-layer.test.js` cases: 3 × 2 pattern, content 0, 0, 60 × 40 → `fillText` of `2`, `1`, `1`, `1`, `2` at (10, 10), (30, 10), (50, 10), (30, 30), (50, 30) in black at `12px`; no text at (10, 30) and a `#E0E0E0` fill covering it; same pattern with 13.9 px cells → no cell numbers; 300 × 300 pattern without empty cells, 20 px cells, frame 400 × 300 → exactly 300 cell numbers; content at (500, 0) in a 400 × 300 frame → no drawing call; `createChartLayer().isAvailable` unchanged; verify they fail against the stub
- [ ] 5.2 Replace `src/ui/layers/chart-layer.js`: header comment (follows the contract in `../viewer.js`, paint order of design D6), per-pattern cache of number strings keyed by `state.pattern`, white grid area, merged empty-cell runs filled once, numbers with `textAlign = 'center'`, `textBaseline = 'middle'`; verify the 5.1 cases and `tests/integration/view-layers.test.js` pass
- [ ] 5.3 Add failing integration cases for lines and rulers: 23 × 12 pattern at 10 px, ratio 1 → 4 bold + 20 thin vertical and 3 bold + 10 thin horizontal segments, bold `#000000` width 2, thin `#A0A0A0` width 1; at 3 px cells no thin line; 100 × 67 pattern, content (24, 100), 1000 × 670, frame 1048 × 870 → ruler labels `10`…`100` at x 124…1024 and `10`…`60` at y 200…700, no `0` or `67`, two centre triangles with tips at (524, 100) and (24, 435); content at (−300, −120) → a 24 × 24 corner fill at (0, 0); verify they fail
- [ ] 5.4 Implement snapped thin and bold line paths (visible extent only), rulers (sticky placement, shared label step from measured widths, `rulerFontSize`), centre triangles and the corner square; verify 5.3 and all of `npm run test:integration` pass and `chart-layer.js` stays under ~300 lines

## 6. Legend panel (ui)

- [ ] 6.1 Add failing cases to a new `tests/integration/legend-markup.test.js`: `index.html` no longer contains the comment `Legend: added here by add-stitch-chart-layer.`; it has a `section` with `data-role="legend"` and `hidden`, column headers `No.`, `Color`, `DMC`, `Name`, `Stitches` in order, a `tbody data-role="legend-rows"`, a `data-role="legend-empty"` paragraph with `This pattern has no stitches.`, and a `template data-role="legend-row-template"` whose `data-field` values are `number`, `swatch`, `code`, `name`, `stitchCount` in order; verify they fail
- [ ] 6.2 Replace the legend marker in `index.html` with the markup of design D7 (swatch `aria-hidden="true"`); verify 6.1 passes
- [ ] 6.3 Create `src/ui/legend.js` with `setupLegend(root, store)`: re-render only when `state.pattern` identity changes, hide while `pattern` is null, show the empty text for a legend without entries, clone template rows from `legendRows`, `textContent` only, `--swatch` via `style.setProperty`, `replaceChildren`; verify by reading that no `innerHTML` is used and nothing runs at import time
- [ ] 6.4 Add a `/* Legend */` block at the end of `styles/main.css`: `.legend` panel (`flex: 0 0 20rem`, own scroll), `.legend[hidden] { display: none; }`, table with right-aligned tabular stitch counts, `.legend__swatch` using `var(--swatch)` with a 1 px `var(--color-border)` border, `.legend__number` styled like a chart cell (white, bordered, black), wrap below the frame under 60rem; only existing tokens, no IDs; verify by reading
- [ ] 6.5 In `src/main.js`, add `import { setupLegend } from './ui/legend.js';` and a final group `// The legend next to the frame.` + `setupLegend(document, store);`; change the `styles/print.css` header comment to say printing comes with a later print/export change; verify `npm run test:integration` passes (the served-site test now crawls `legend.js`)

## 7. Verification

- [ ] 7.1 Run `npm run test:unit`; all tests pass (show output)
- [ ] 7.2 Run `npm run test:integration`; all tests pass (show output)
- [ ] 7.3 Browser smoke check. Precondition: `add-pattern-generation` is merged into `main` and this branch is rebased onto it (until then `state.pattern` is always null and the Chart layer cannot be selected). Run `node scripts/serve.js`, open the printed URL, load a photo and a PNG with transparency, generate a pattern, then check:
  - Fitted view: 24 px margin; `Chart` shows white cells, bold lines every 10 stitches and around the grid, thin lines only if cells ≥ 4 px, no numbers if cells < 14 px; transparent areas are grey without numbers; rulers above and left of the grid with 10, 20, … and no overlapping labels; triangles at the centre column and row
  - Zoom in until cells are ≥ 14 px: numbers appear, centred, black, the same size for 1- and 2-digit numbers, matching the legend; switching to `DMC colors` and back shows each number over the block of its color (cells aligned)
  - Pan so the grid's top-left leaves the frame: rulers stick to the top and left frame edges with a blank corner; labels follow the visible lines
  - Browser zoom 125 % and 200 % (devicePixelRatio 1.25 / 2): lines stay sharp, no blurred or doubled lines
  - A 300 × 300 pattern zoomed to ~20 px cells: drag-panning for a few seconds feels smooth (DevTools Performance: paints under 16 ms); otherwise implement the glyph-atlas fallback of design D6 via `/opsx:update`
  - Legend: visible on all three layers, rows in number order with number, swatch, DMC code, name and stitch count with separators; a `BLANC` swatch has a visible border; loading a new image hides it; below 60rem window width it moves under the frame
  - DevTools Console has no errors; Network shows only the app's own files
- [ ] 7.4 Run `openspec validate add-stitch-chart-layer --strict`; it reports the change is valid

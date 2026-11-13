# Design

## Context

See proposal.md for the motivation and `specs/stitch-chart/spec.md` for the behavior.

- The view frame (`src/ui/viewer.js`) calls the active layer's `render(ctx, frame, state)`
  with a cleared context scaled to CSS px and `frame = { width, height, pixelRatio,
  viewport, content }`. `content` is the image rectangle on screen; a W × H stitch grid
  covers it exactly (column c spans c/W … (c+1)/W). The stub `src/ui/layers/chart-layer.js`
  is replaced; the contract and `viewer.js` stay unchanged.
- `Pattern` (`src/core/pattern.js`): `width`, `height`, `cells` (`Int16Array`, row-major,
  0-based legend index or `EMPTY_CELL` = −1), `legend` (`{ number, code, name, hex,
  stitchCount }` in number order). The printed number of a cell is `cells[i] + 1`; at most
  99 colors, so at most 2 digits.
- `state.pattern` stays `null` in the running app until `add-pattern-generation` merges.
  Everything here is tested with patterns built by `buildPattern`.
- The fit margin is 16 CSS px (`FIT_MARGIN` in `src/core/viewport.js`).

## Goals / Non-Goals

**Goals:**
- All chart geometry (which cells are visible, which lines are bold, where labels go, font
  sizes, pixel snapping) is pure, unit-tested core code; the layer only issues canvas calls.
- Paint cost proportional to the visible area, not the pattern size.
- No change to the view-layer contract or `viewer.js`.

**Non-Goals:**
- Printing/export rendering (a later change can reuse `chart-layout.js` with its own frame).
- Hit-testing cells or legend interaction (the highlight follow-up adds it).

## Module map

| Module | Layer | Responsibility |
|---|---|---|
| `src/core/chart-layout.js` | core (new) | geometry and drawing rules of the chart; imports only `FIT_MARGIN` from `./viewport.js` |
| `src/core/legend-rows.js` | core (new) | `legendRows(pattern)`: legend entries → display texts |
| `src/ui/layers/chart-layer.js` | ui (replaced) | `createChartLayer()`; canvas calls only |
| `src/ui/legend.js` | ui (new) | `setupLegend(root, store)`: renders the legend panel |
| `src/core/viewport.js` | core (edited) | `FIT_MARGIN` 16 → 24 |
| `index.html`, `styles/main.css`, `src/main.js` | ui / root (edited) | legend markup at the marker, legend CSS block, one import + one setup line |

Both new core modules use no DOM, canvas, timers or globals, import only from `core/`, and run
in Node tests. `chart-layer.js` uses only the `ctx` it is given (no `document`), so an
integration test can render it into a recording fake context.

## Data shapes

All plain objects, described in plain words next to the creating function (no type
annotations). Units are CSS px unless stated otherwise.

- **CellGeometry** (`chartCellGeometry(content, grid)` in `chart-layout.js`):
  `{ cellWidth, cellHeight, cellSize }`; `cellWidth = content.width / grid.width`,
  `cellHeight = content.height / grid.height`, `cellSize` = the smaller of the two.
  `grid` is anything with integer `width`, `height` ≥ 1 (a Pattern works).
- **CellRange** (`visibleCellRange(content, frame, grid)`): `{ columnStart, columnEnd,
  rowStart, rowEnd }`, half-open integer ranges clamped to 0…W and 0…H. Empty when
  `columnStart === columnEnd` or `rowStart === rowEnd`. Formula: `start = clamp(floor((0 −
  content.x) / cellWidth))`, `end = clamp(ceil((frame.width − content.x) / cellWidth))`,
  same for rows. The visible stitch boundaries are `columnStart … columnEnd` inclusive.
- **GridLine** (`gridLines(start, end, count, cellSize)`): list of `{ index, isBold }` for
  boundary indexes `start … end`; bold when `index % 10 === 0` or `index === count`; thin
  ones omitted when `cellSize < 4`.
- **LineWidths** (`chartLineWidths(pixelRatio)`): `{ thin, bold }` in **device** px;
  `thin = max(1, round(pixelRatio))`, `bold = 2 × thin`.
- **RulerPlacement** (`rulerPlacement(content)`): `{ top, left }`: y of the top ruler's top
  edge = `max(0, content.y − RULER_SIZE)`, x of the left ruler's left edge =
  `max(0, content.x − RULER_SIZE)`.
- **ChartCenter** (`chartCenter(grid)`): `{ column: W / 2, row: H / 2 }` in stitches from
  the top-left (may be x.5).
- **LegendRow** (`legendRows(pattern)` in `legend-rows.js`): `{ number, code, name, hex,
  stitchCount }`, all strings: `'1'`, `'310'`, `'Black'`, `'#000000'`, `'12,345'`.

Scalar helpers: `cellCenter(content, grid, column, row)` → `{ x, y }`;
`numberFontSize(cellSize)` → `0.6 × cellSize`, or `null` below 14; `snapLine(position,
widthDevicePx, pixelRatio)` → CSS coordinate of the line centre; `rulerLabelStep(cellSize,
widestLabelWidth)` → 10/20/50/100/200/500; `rulerLabels(start, end, step)` → multiples of
`step` in `max(start, 1) … end`; `rulerFontSize(widestRowLabelWidth)` → 10 px, shrunk to fit
16 px of label room, at least 7. Invalid input at these boundaries (grid size not a positive
integer, negative or non-finite cell size, pixel ratio ≤ 0, step not positive) throws
`RangeError` with the received value.

## Decisions

### D1. Rulers next to the grid, sticky at the frame edge; fit margin 24 px
`content` is exactly the image rectangle, so labels must live outside it or on top of it.
Chosen: a 24 px ruler band directly above and left of the grid that sticks to the frame edge
once the grid edge scrolls out (like spreadsheet headers). At fit the band lies entirely in
the margin, so no cell is covered; zoomed in, row/column numbers stay readable wherever the
user pans. `RULER_SIZE` is defined as `FIT_MARGIN`, and `FIT_MARGIN` becomes 24: three-digit
row labels at 10 px (~17 px) plus the 5 px centre triangle and padding do not fit in 16 px.
This is the only edit to a shared module: one constant and its comment, the expectations of
the five fit-dependent tests in `viewport.test.js`, and the MODIFIED fit requirement.
`viewer.js` is not touched.
*Alternatives:* keep 16 px and shrink row labels to ~8 px (legible only on high-DPI screens);
labels in the margin only (vanish as soon as the user zooms in, which is exactly when they
are needed); rulers fixed at the frame edges (cover 8 px of the fitted grid).

### D2. Ruler layout
Top ruler: labels centred on their line in the outer part of the band; the centre triangle
(8 px wide, 5 px deep, tip on the grid edge) in the inner 5 px. Left ruler: labels
right-aligned 2 px before the triangle area, vertically centred on their line; label room
24 − 5 − 2 − 1 = 16 px. Font 10 px `system-ui, sans-serif`; if the widest row label
(`String` of the largest labelled row) measures wider than 16 px, both rulers use
`rulerFontSize` (≥ 7 px). The label step uses `ctx.measureText` of the largest label value
(both axes) and is shared by both rulers so the counts line up. Background `#F6F4F0`
(the page background), text `#1F1F1F`, triangle `#000000`; a blank square covers the corner
when both rulers are drawn at the same place. Rulers span only the visible extent of the grid.

### D3. Numbers: one size per frame, threshold 14 px
`fontSize = 0.6 × cellSize`: two digits at ~0.55 em each take ~66 % of the cell width, digit
height ~0.7 em takes ~42 % of the height, so numbers never touch the lines. Sizing always for
two digits keeps `1` and `99` the same size, which reads more evenly. Below 14 px cells the
font would be under 8.4 px, which is illegible on a 1× screen, so numbers are skipped and only
the grid shows; zooming in 1–3 steps reveals them. Text: `textAlign = 'center'`,
`textBaseline = 'middle'` at `cellCenter`, black. *Alternative:* scale to the digit count of
the legend (bigger numbers for ≤ 9 colors). Rejected: one rule is simpler to read and test.

### D4. Empty cells: light grey, no number
The chart has no color, so a flat light grey (`#E0E0E0`) is unmistakably "no stitch", stays
visible in black-and-white print and is one path fill. It also keeps the shape of the motif
visible at low zoom where numbers are hidden. *Alternative:* diagonal hatch. Rejected for now:
needs a pattern tile per pixel ratio for little gain; easy to swap later.

### D5. Lines crisp at any pixel ratio
Line widths are whole device pixels (`chartLineWidths`). `snapLine` converts a boundary
position to device px, then centres odd widths on `floor(p) + 0.5` and even widths on
`round(p)`, and converts back by dividing by the ratio (the viewer's transform scales by it).
Cell fills are not snapped; the lines drawn on top hide their anti-aliased edges. Thin lines
`#A0A0A0`, bold lines `#000000`, drawn as one path per weight, thin first so bold wins at
crossings. Every line spans only the visible part of the grid.

### D6. Visible range per frame, no bitmap cache
Paint order: white rectangle (visible part of the grid) → empty cells (per visible row,
consecutive empty cells merged into one `rect`, one `fill`) → numbers (one `font` set, one
`fillText` per visible stitched cell) → thin lines → bold lines → rulers, triangles, corner.
Cost: scanning the visible range is at most W × H reads (90 000 at fit for 300 × 300, under
a few ms), and numbers only appear at ≥ 14 px cells, so a 1600 × 1000 frame shows at most
~116 × 73 ≈ 8 500 of them, whatever the pattern size. The viewer already coalesces repaints
to one per animation frame.
*Alternative:* render the whole chart once into an offscreen bitmap per pattern and blit it.
Rejected: 300 × 300 at 14 px and 2× DPR is 8400 × 8400 device px (~280 MB), and every zoom
step would need a new render; tiles would fix memory but add invalidation logic. The only
per-pattern cache in the layer closure is the list of number strings, keyed by `state.pattern`
identity (allowed by the contract). If the smoke check shows jank, the documented fallback is
a glyph atlas (numbers 1..N pre-rendered at the current font size and pixel ratio, drawn with
`drawImage`) inside `chart-layer.js`, introduced via `/opsx:update`.

### D7. Legend panel
`index.html` replaces the marker with `<section class="legend" data-role="legend"
aria-labelledby="legend-title" hidden>`: an `h2` "Legend", a `<table data-role="legend-table">` (hidden with the empty text; columns No., Color,
DMC, Name, Stitches; `th scope="col"`), an empty `tbody data-role="legend-rows"`, a
`<p data-role="legend-empty" hidden>This pattern has no stitches.</p>` and a
`<template data-role="legend-row-template">` whose cells carry `data-field="number|swatch|
code|name|stitchCount"`. `setupLegend` re-renders only when `state.pattern` identity changes:
clones one row per `legendRows` entry, sets `textContent`, sets the swatch with
`style.setProperty('--swatch', hex)` (swatch `aria-hidden="true"`; the text columns carry the
information) and `replaceChildren` on the tbody. No `innerHTML`. The panel sits right of the
workspace (`flex: 0 0 20rem`, scrolls on its own); below 60rem it wraps under the frame. The
number cell is styled like a chart cell (white, bordered, black number) to link legend and
chart. Shown on all layers while a pattern exists: it is the shopping list for the DMC
colors view too, and switching layers does not shift the frame. Rows have no actions in this
change; the highlight follow-up attaches one delegated listener on the tbody.
`legendRows` formats counts with `Intl.NumberFormat('en-US')`, deterministic and matching the
English UI.

### D8. Shared-file edits are localized
`main.js`: one import line and a new final group `// The legend next to the frame.` +
`setupLegend(document, store);`. `index.html`: only the legend marker line. `main.css`: one
new `/* Legend */` block at the end (including the narrow-screen wrap). `print.css`: its
comment no longer promises printing in this change. `add-pattern-generation` also edits
`main.js` imports, so a trivial conflict on adjacent import lines is possible at rebase.

## Risks / Trade-offs

- [Up to ~8 500 `fillText` per paint may drop frames while panning on slow machines] →
  measured in the smoke check; glyph-atlas fallback (D6) is local to `chart-layer.js`.
- [Font metrics differ per platform] → ruler labels are measured at runtime; `rulerFontSize`
  and the label-step rule take the measured width, so labels never overlap or overflow.
- [Fit margin change touches the archived pattern-viewer spec and its tests] → one constant,
  five test expectations; no other change in flight edits `viewport.js`. If
  `add-dmc-preview-layer` adds pattern-viewer requirements, they merge independently.
- [Rulers cover up to 24 px of the grid when zoomed in] → the user can pan; covered cells are
  never lost, and the corner square keeps the overlap tidy.
- [Cells are not exactly square (aspect up to ~1.005)] → `cellSize` is the smaller side, so
  numbers always fit.
- [No real pattern in the app until `add-pattern-generation` merges] → the integration test
  renders hand-built patterns into a recording context; the smoke check runs after rebasing
  onto a `main` that contains it.

## Migration Plan

None. Rollback is reverting the change's commits; the stub layer returns.

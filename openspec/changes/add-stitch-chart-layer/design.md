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
- `add-pattern-generation` is merged; the layout is settings | workspace | legend. Tests
  still use hand-built patterns (`buildPattern`).
- The fit margin was 16 CSS px (`FIT_MARGIN` in `src/core/viewport.js`).
- `src/core/color.js` converts sRGB to Lab (`rgbToLab`) but has no way back.
- Browser feedback on the first implementation: at Fit (cells about 8.6 px) the chart was an
  empty white grid, and the 20rem legend wrapped names onto 3-4 lines. The user decided:
  cells are always a pale tint of their DMC color with numbers on top from 14 px; the legend
  is about 24rem wide and denser.

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
| `src/core/chart-tint.js` | core (new) | `paleTint(hex)`, `contrastRatio(hexA, hexB)`, `tintedCellPixels(pattern)` |
| `src/core/color.js` | core (edited) | new export `labToLinearRgb(lab)`, the inverse of `linearRgbToLab` |
| `src/core/legend-rows.js` | core (new) | `legendRows(pattern)`: legend entries → display texts |
| `src/ui/layers/chart-layer.js` | ui (replaced) | `createChartLayer(options)`; cell image, hatch, numbers, grid lines |
| `src/ui/layers/chart-rulers.js` | ui (new) | `drawRulers(...)`: rulers, centre triangles, corner square (split out to keep the layer under ~300 lines) |
| `src/ui/legend.js` | ui (new) | `setupLegend(root, store)`: renders the legend panel |
| `src/core/viewport.js` | core (edited) | `FIT_MARGIN` 16 → 24 |
| `index.html`, `styles/main.css`, `src/main.js` | ui / root (edited) | legend markup at the marker, legend CSS block, one import + one setup line |

The new core modules use no DOM, canvas, timers or globals, import only from `core/`, and run
in Node tests. `chart-layer.js` uses only the `ctx` it is given plus one small cell canvas made
by `options.createCellCanvas(width, height)` (default `new OffscreenCanvas(width, height)`), so
an integration test can render it into a recording fake context with a fake cell canvas.
`main.js` keeps calling `createChartLayer()` without options.

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
  tint, stitchCount }`, all strings: `'1'`, `'310'`, `'Black'`, `'#000000'`, `'#B0B0B0'`,
  `'12,345'`.
- **Tinted cell pixels** (`tintedCellPixels(pattern)` in `chart-tint.js`): a new
  `Uint8ClampedArray` of W × H × 4 bytes, RGBA, row-major, one pixel per cell: the pale tint
  of the cell's legend color, or `#E0E0E0` (`EMPTY_CELL_COLOR`) for empty cells; alpha 255.
  Ready for `ImageData`.
- **Lab to linear RGB** (`labToLinearRgb(lab)` in `color.js`): `{ r, g, b }` linear channels,
  unclamped (values outside 0-1 mean "outside sRGB").

Scalar helpers: `cellCenter(content, grid, column, row)` → `{ x, y }`;
`numberFontSize(cellSize)` → `0.6 × cellSize`, or `null` below 14;
`isEmptyHatchVisible(cellSize)` → `cellSize ≥ 6`; `snapLine(position,
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
(the page background), text `#1F1F1F`, triangle `#000000`; a blank 24 × 24 square is always drawn
where the rulers meet (`rulerPlacement` left, top): it joins them at fit and hides labels that
would collide when both stick to the frame edges. Rulers span only the visible extent of the
grid. Constants: `RULER_PADDING = 1`, `RULER_MARKER_GAP = 2`, `RULER_LABEL_ROOM` derived from
them. The integration test renders into `tests/helpers/recording-context.js`, a fake 2D
context that records texts, fills and strokes.

### D3. Numbers: one size per frame, threshold 14 px
`fontSize = 0.6 × cellSize`: two digits at ~0.55 em each take ~66 % of the cell width, digit
height ~0.7 em takes ~42 % of the height, so numbers never touch the lines. Sizing always for
two digits keeps `1` and `99` the same size, which reads more evenly. Below 14 px cells the
font would be under 8.4 px, which is illegible on a 1× screen, so numbers are skipped and only
the grid shows; zooming in 1–3 steps reveals them. Text: `textAlign = 'center'`,
`textBaseline = 'middle'` at `cellCenter`, black. *Alternative:* scale to the digit count of
the legend (bigger numbers for ≤ 9 colors). Rejected: one rule is simpler to read and test.

### D4. Empty cells: light grey with a hatch line, no number
Empty cells are `#E0E0E0` without a number. With tinted cells a flat grey alone is not enough:
neutral greys map into the same band (`318` → `#E1E1E1`, ΔE00 0.2 from `#E0E0E0`; `415` →
`#EBEBED`, 2.7). So from 6 px cells each visible empty cell gets one diagonal `#909090` line
(bottom-left to top-right, thin line width), all in one stroke path per paint. Texture, not
color, then says "no stitch". Below 6 px the diagonals would merge into grey and the segment
count grows (a 1600 × 1000 frame at 6 px has at most 44 000 cells), so only the flat grey
remains; zooming in one or two steps shows the hatch. *Alternatives:* white empty cells (too
close to the `BLANC`/`B5200` tints `#F6F5F4`/`#F6F6F6`); a darker grey below the tint band
(L* < 72) reads as a dark stitched area; a `createPattern` hatch tile (a tile per pixel ratio
and a second canvas, for the same look).

### D5. Lines crisp at any pixel ratio
Line widths are whole device pixels (`chartLineWidths`). `snapLine` converts a boundary
position to device px, then centres odd widths on `floor(p) + 0.5` and even widths on
`round(p)`, and converts back by dividing by the ratio (the viewer's transform scales by it).
Cell fills are not snapped; the lines drawn on top hide their anti-aliased edges. Thin lines
`#A0A0A0`, bold lines `#000000`, drawn as one path per weight, thin first so bold wins at
crossings. Every line spans only the visible part of the grid.

### D6. Visible range per frame; one small cell image per pattern
Paint order: cell image (tints and empty grey) → empty-cell hatch → numbers (one `font` set,
one `fillText` per visible stitched cell) → thin lines → bold lines → rulers, triangles,
corner. The cell image is a W × H canvas with **one pixel per cell** (`tintedCellPixels`, put
once per pattern with `createImageData`/`putImageData`), drawn with
`imageSmoothingEnabled = false` from the visible source sub-rectangle (`columnStart`,
`rowStart`, visible columns, visible rows) onto the matching part of the content rectangle.
Nearest-neighbour scaling maps cell c exactly onto c/W … (c+1)/W, the alignment rule of the
other layers. One `drawImage` replaces up to 90 000 `fillRect`s at fit, and the image is tiny
(300 × 300 × 4 B = 360 KB). Numbers only appear at ≥ 14 px cells, so a 1600 × 1000 frame
shows at most about 116 × 73 ≈ 8 500 of them, whatever the pattern size. The viewer coalesces
repaints to one per animation frame.
*Alternative:* `fillRect` per run of equal cells: 40 000+ calls per paint at fit for a photo.
*Alternative:* render the whole chart (numbers and lines too) into a bitmap per pattern.
Rejected: 300 × 300 at 14 px and 2× DPR is 8400 × 8400 device px (~280 MB), and every zoom
step would need a new render. Per-pattern caches in the layer closure, keyed by
`state.pattern` identity (allowed by the contract): the cell canvas and the number strings.
If the smoke check shows jank, the fallback is a glyph atlas (numbers 1..N pre-rendered and
drawn with `drawImage`) inside `chart-layer.js`, introduced via `/opsx:update`.

### D7. Legend panel (24rem, compact)
`index.html` replaces the marker with `<section class="legend" data-role="legend"
aria-labelledby="legend-title" hidden>`: an `h2` "Legend", a `<table data-role="legend-table">` (hidden with the empty text; columns No., Color,
DMC, Name, Stitches; `th scope="col"`), an empty `tbody data-role="legend-rows"`, a
`<p data-role="legend-empty" hidden>This pattern has no stitches.</p>` and a
`<template data-role="legend-row-template">` whose cells carry `data-field="number|swatch|
code|name|stitchCount"`. `setupLegend` re-renders only when `state.pattern` identity changes:
clones one row per `legendRows` entry, sets `textContent`, sets the swatch with
`style.setProperty('--swatch', hex)`, the number box with
`style.setProperty('--tint', tint)` (swatch `aria-hidden="true"`; the text columns carry the
information) and `replaceChildren` on the tbody. No `innerHTML`. The panel sits right of the
workspace (`flex: 0 0 24rem`, scrolls on its own; compact rows: `0.875rem` text,
`0.125rem` vertical cell padding, `1.5rem` number box and swatch, so the name column gets
about 10rem and the longest DMC names take at most 2 lines); below 72rem (three
columns settings | frame | legend no longer fit) it wraps to its own row under the settings
and frame, at most 40vh high; below 48rem the settings form stacks everything in one column
and the legend rule switches wrapping off again. The
number box is styled like a chart cell (pale tint background, thin border, black number) to
link legend and chart. At 72rem the frame keeps 72 − 16 − 24 − 4 = 28rem. Shown on all layers while a pattern exists: it is the shopping list for the DMC
colors view too, and switching layers does not shift the frame. Rows have no actions in this
change; the highlight follow-up attaches one delegated listener on the tbody.
`legendRows` formats counts with `Intl.NumberFormat('en-US')`, deterministic and matching the
English UI.

### D9. Pale tints in CIELAB
`paleTint(hex)`: convert to Lab (`rgbToLab`), set `L' = 72 + 0.25 × L*`, scale `a*` and `b*`
by 0.6, convert back (`labToLinearRgb`); if a channel leaves 0-1, binary-search (20 steps)
the largest chroma factor ≤ 0.6 that stays inside sRGB, keeping L' and the hue. Round to
8-bit `#RRGGBB`. Why Lab: L' ≥ 72 means relative luminance Y ≥ 0.436, so black text has a
contrast of at least (0.436 + 0.05) / 0.05 ≈ 9.7:1 by construction (9.68 after the 8-bit
rounding of 310), well above WCAG AAA 7:1; lightness order and hue are kept, so dark colors
stay apart (310 vs 939 navy: ΔE00 13.7).
*Alternative:* mix with white in linear RGB (`1 − t × (1 − c)`), which needs no inverse Lab.
At t = 0.45 (contrast ≥ 12) dark colors collapse: 310, 939 and 336 become `#C4C4C4`,
`#C4C5CA` and `#C5C7CF`, and over palette pairs the median ΔE00 keeps 0.32 of its original
value versus 0.56 for the Lab band.
*Trade-off:* compressing L* into 25 units and scaling chroma by 0.6 makes neighbours such as
`939`/`336` (ΔE00 2.9) hard to tell apart by tint alone; numbers carry the information, the
tint gives orientation. Sample outputs: 310 → `#B0B0B0`, 939 → `#B8BADB`, 336 → `#BBC0E9`,
321 → `#FFC0BB`, 307 → `#FFF2B0`, BLANC → `#F6F5F4`, B5200 → `#F6F6F6`, 318 → `#E1E1E1`.
`contrastRatio` follows WCAG 2 (relative luminance from `srgbToLinear`,
`(L1 + 0.05) / (L2 + 0.05)`). `labToLinearRgb` uses the inverse of the Lindbloom sRGB matrix
already cited in `color.js` and the inverse CIE f-function.

### D8. Shared-file edits are localized
`color.js`: one added export `labToLinearRgb` with tests; existing functions unchanged.
`main.js`: one import line and a new final group `// The legend next to the frame.` +
`setupLegend(document, store);`. `index.html`: only the legend marker line. `main.css`: one
new `/* Legend */` block at the end (including the narrow-screen wrap). `print.css`: its
comment no longer promises printing in this change. `add-pattern-generation` also edits
`main.js` imports, so a trivial conflict on adjacent import lines is possible at rebase.

## Risks / Trade-offs

- [Up to ~8 500 `fillText` per paint may drop frames while panning on slow machines] →
  measured in the smoke check; glyph-atlas fallback (D6) is local to `chart-layer.js`.
- [Below 6 px cells, empty cells and tints of mid greys (e.g. `318`) look the same] → the
  hatch appears from 6 px; a fitted 100-stitch-wide pattern already has cells of about 9 px.
- [`OffscreenCanvas` support] → available in all current evergreen browsers (Safari ≥ 16.4).
- [Tints of similar DMC colors are hard to tell apart] → numbers, legend and the DMC colors
  layer carry the exact color; a black-and-white print version is a later change.
- [Font metrics differ per platform] → ruler labels are measured at runtime; `rulerFontSize`
  and the label-step rule take the measured width, so labels never overlap or overflow.
- [Fit margin change touches the archived pattern-viewer spec and its tests] → one constant,
  five test expectations; no other change in flight edits `viewport.js`. If
  `add-dmc-preview-layer` adds pattern-viewer requirements, they merge independently.
- [Rulers cover up to 24 px of the grid when zoomed in] → the user can pan; covered cells are
  never lost, and the corner square keeps the overlap tidy.
- [Cells are not exactly square (aspect up to ~1.005)] → `cellSize` is the smaller side, so
  numbers always fit.
- [Browser behavior is not tested in Node] → the integration test renders hand-built patterns
  into a recording context with a fake cell canvas; the smoke check covers the browser.

## Migration Plan

None. Rollback is reverting the change's commits; the stub layer returns.

# Design

## Context

See proposal.md for the motivation and `specs/large-pattern-rendering/spec.md` for the
behavior.

- **View-layer contract** (`src/ui/viewer.js`): the viewer calls the active layer's
  `render(ctx, frame, state)` synchronously inside one `requestAnimationFrame`, with `ctx`
  scaled to CSS px and `frame = { width, height, pixelRatio, viewport, content }`. It
  repaints only when image, pattern, layer, viewport or frame size change. A layer cannot
  ask for another frame, change state or add listeners.
- **DMC colors layer** (`dmc-layer.js`): builds one W × H `OffscreenCanvas` per pattern with
  `patternToStitchImage` and draws it whole into `frame.content` with one `drawImage`;
  smoothing only when `isStitchSmallerThanDevicePixel` (`pattern-image.js`).
- **Chart layer** (`chart-layer.js`): builds one W × H cell canvas of tints
  (`tintedCellPixels`) through the injected `options.createCellCanvas`, and draws only the
  visible sub-rectangle (`visibleCellRange`) with smoothing always off. Hatches (cells ≥ 6 px),
  numbers (cells ≥ 14 px) and thin lines (cells ≥ 4 px) loop over visible cells only, so they
  are bounded by the frame area. `gridLines` loops over every visible boundary (10001 per axis
  at Fit of 10000 × 10000) and makes every 10th bold: 1000 bold lines 0.75 px apart.
- **Browser limits** (approximate; vendors do not publish exact values): iOS Safari refuses
  canvases above 16,777,216 px (4096 × 4096) and fails once all canvases of a page exceed
  about 384 MB (less on older devices); Chrome and Firefox allow sides up to 32,767 px.
  A 10000 × 10000 RGBA bitmap is 100 megapixels, 400 MB.
- **Parallel changes**: `raise-pattern-limits` raises the generation maximum and changes the
  number-font functions of `chart-layout.js`; `add-pinch-zoom` works in `viewer-input.js`.

## Goals / Non-Goals

**Goals:**
- One shared, pure-core-driven picture pipeline for both layers that works for any W × H.
- Memory per layer bounded by a constant (plus the current frame's visible set), canvas size
  bounded by 2048 × 2048, building work per frame bounded by a constant.
- Patterns up to 2048 per side render exactly as today (same picture, same pixels).

**Non-Goals:**
- Faster pattern generation, bigger limits, 3-digit numbers (`raise-pattern-limits`).
- Building pictures in a Web Worker (the job design below leaves room for it).
- Printing or exporting large patterns.

## Module map

| Module | Layer | Responsibility |
|---|---|---|
| `src/core/tile-pyramid.js` | core (new) | geometry of levels and tiles: `SINGLE_PICTURE_MAX_SIDE`, `TILE_SIZE`, `overviewLevel`, `levelSize`, `tileCount`, `tileRegion`, `regionCells`, `detailLevel`, `visibleTiles`, `pictureDrawRects`; the max side and tile size are optional last parameters defaulting to the constants |
| `src/core/level-pixels.js` | core (new) | `colorTable(hexes, emptyHex)`, `fillLevelRows(grid, table, level, region, rowStart, rowEnd, out)` |
| `src/core/tile-budget.js` | core (new) | `TILE_CACHE_BUDGET_BYTES`, `BUILD_BUDGET_STITCHES`, `tilesToEvict(entries, budgetBytes, keepKeys)`, `rowsWithinBudget(stitchesPerRow, budgetLeft, rowsLeft)`, `buildPlan(jobs, budgetStitches)` |
| `src/core/chart-layout.js` | core (edited) | new `MIN_MAJOR_LINE_SPACING`, `majorLineStep(cellSize)`; `gridLines` uses it; `rulerLabelStep` continues 1-2-5 without end; new `leftRulerWidth(widestRowLabelWidth)`; `rulerPlacement(content, leftWidth = RULER_SIZE)`. Number functions untouched |
| `src/ui/layers/pattern-picture.js` | ui (new) | `createPatternPicture({ createCellCanvas, colorTableOf, limits })`: per-pattern canvases, build jobs within the frame budget, drawing, eviction, release. `limits` (`{ singlePictureMaxSide, tileSize, cacheBudgetBytes, buildBudgetStitches }`, defaults = the core constants) exists only so tests can use small patterns |
| `src/ui/layers/chart-rulers.js` | ui (edited) | measures the widest row label in the chosen font, sizes the left ruler with `leftRulerWidth`, places it with `rulerPlacement`, draws the corner square as wide as the left ruler |
| `src/ui/layers/dmc-layer.js` | ui (edited) | uses `pattern-picture.js` with stitch colors (empty = transparent); returns `true` while incomplete; accepts `options.createCellCanvas` |
| `src/ui/layers/chart-layer.js` | ui (edited) | cell colors through `pattern-picture.js` with tints (empty = `#E0E0E0`), sharpness rule; returns `true` while incomplete |
| `src/ui/viewer.js` | ui (edited, minimal) | contract: `render` may return `true` = "call me again next frame"; the rAF callback then schedules one more paint |

The three new core modules use no DOM, canvas, timers or globals and import only from
`core/` (`tile-pyramid.js` and `tile-budget.js` import nothing; `level-pixels.js` imports
`hexToRgb` from `color.js`, `EMPTY_CELL` from `pattern.js` and `levelSize` from
`tile-pyramid.js` to validate its region). `pattern-image.js` keeps
`patternToStitchImage` (spec'd, for later export) and `isStitchSmallerThanDevicePixel`
(now used by both layers). `main.js` keeps calling both factories without options.

## Data shapes

Plain objects, described in plain words next to the creating function. "Picture px" are
pixels of a level picture; level k pixel (i, j) covers stitches i·2^k … (i+1)·2^k − 1.

- **Grid**: anything with positive integer `width`, `height` (a Pattern works); building
  also reads `cells` (row-major, legend index or −1).
- **LevelSize** (`levelSize(grid, level)`): `{ width: ceil(W / 2^k), height: ceil(H / 2^k) }`.
- **TileRegion** (`tileRegion(grid, level, column, row)`): `{ x, y, width, height }` in picture
  px of level k: `x = column × 512`, width up to 512, clipped to the level size. The
  overview's region is the whole level-M picture.
- **CellRect** (`regionCells(grid, level, region)`): the stitches a region covers,
  `{ x, y, width, height }`, clipped to the pattern (so the last picture pixel of a level may
  cover fewer than 2^k stitches).
- **TileAddress** (`visibleTiles(grid, level, range)`): list of `{ column, row }` in row-major
  order, for the CellRange from `visibleCellRange` (chart-layout.js). Empty for an empty range.
- **DrawRects** (`pictureDrawRects(content, grid, level, region, cellRect, pixelRatio)`):
  `{ source, destination }`. `source` in picture px relative to the region's top-left,
  fractional only where a partial edge pixel is trimmed (`cellRect / 2^k − region origin`);
  `destination` in CSS px: `content.x + cellRect.x × cellWidth` etc., every edge that is not
  an outer edge of the content rectangle rounded to the nearest device px
  (`round(position × pixelRatio) / pixelRatio`).
- **ColorTable** (`colorTable(hexes, emptyHex)`): `Uint8ClampedArray` of
  `(hexes.length + 1) × 4` bytes RGBA. Entry 0 is the empty-cell color (`emptyHex` opaque,
  or 0, 0, 0, 0 when `emptyHex` is `null`); entry i + 1 is `hexes[i]` with alpha 255, so a
  cell value v (−1 … N−1) is looked up at `(v + 1) × 4` without a branch.
- **fillLevelRows** writes rows `rowStart … rowEnd − 1` of a region into `out`
  (`region.width × region.height × 4` bytes, an `ImageData.data`) and returns the number of
  stitches read. Throws `RangeError` for a negative or non-integer level, a region outside
  the level, rows outside the region, or an `out` of the wrong length.
- **BuildJob / BuildStep** (`buildPlan(jobs, budgetStitches)` in `tile-budget.js`): jobs are
  `{ key, stitchesPerRow, rowsLeft }` in build order; the result lists `{ key, rows }` for
  every job that gets rows this frame, filling the budget in order with `rowsWithinBudget`
  (a job that starts with budget left gets at least one row). The ui runs exactly this plan.
- **EvictionEntry** (input of `tilesToEvict`): `{ key, bytes, lastDrawn }`; `lastDrawn` is
  the layer's frame counter. Returns the keys to release, oldest `lastDrawn` first (ties in
  input order), skipping `keepKeys`, until the remaining total ≤ budget.

## Decisions

### D1. One picture up to 2048 per side; tiles plus overview above
A pattern with both sides ≤ 2048 keeps a single level-0 picture: ≤ 4,194,304 px = 16 MiB,
a quarter of Safari's per-canvas limit, and identical to today, so small patterns keep their
pixels and their tests. Above that, levels are tiled and level M (the first level ≤ 2048 per
side) is the overview. For 10000 × 10000: M = 3, 1250 × 1250 px, 6.25 MiB.
*Alternatives:* 4096 (64 MiB per picture, 128 MiB for both layers before any tile: too close
to phone limits); tiling everything (more paths and test churn for no benefit).

### D2. Tile size 512 × 512
One tile = 1 MiB and 262,144 level-0 stitches, so 2 level-0 tiles fit one frame's build
budget (D6). Worst-case visible tiles (D3: visible picture px ≤ 2 × frame device px, plus one
partial tile per axis):

| Frame (CSS px @ ratio) | 256 | **512** | 1024 |
|---|---|---|---|
| 1000 × 800 @ 2 (desktop) | 130 (33 MiB) | **42 (42 MiB)** | 16 (64 MiB) |
| 390 × 600 @ 3 (phone) | 88 (22 MiB) | **30 (30 MiB)** | 12 (48 MiB) |
| 1600 × 900 @ 1 | 60 (15 MiB) | **24 (24 MiB)** | 12 (48 MiB) |

512 keeps memory close to 256 with a third of the draw calls and seams; 1024 wastes up to
50 % more memory on partly visible tiles and a single tile needs half a frame's budget.

### D3. Detail level k = round(log2(1 / device px per stitch)), clamped to 0 … M
One level pixel then covers 0.71 … 1.41 device px: the browser scales by at most √2 either
way, and the visible picture is at most 2 × the frame's device pixels. This is the GPU
"nearest mip level" rule. *Alternatives:* floor (never magnify, sharpest, but up to 4 × the
device pixels: 72 tiles = 72 MiB on the desktop frame); ceil (never minify, ≤ 1 × device
pixels, but up to 2 × blur, e.g. a level-1 picture at 0.9 device px per stitch). Levels
above M are not built: the browser's high-quality downscaling of the ≤ 2048² overview is what
small patterns already rely on.

### D4. Exact box average in 8-bit sRGB, premultiplied for transparency
A level-k pixel averages all its stitches (4^k reads), opacity-weighted for the DMC colors
layer. This matches what the browser's smoothed downscaling does for small patterns (it
filters stored sRGB values, premultiplied), so a large pattern at Fit looks like a small one.
*Alternatives:* averaging in linear light (physically better, but large patterns would then
look lighter than small ones drawn by the browser); sampling a fixed number of stitches per
pixel (bounded cost, but aliases: a 1-stitch checkerboard sampled at even offsets turns solid
black instead of grey).

### D5. Intermediate levels instead of only overview + level 0
Between the overview and level 0 (10000²: 0.18 … 0.7 device px per stitch) the only other
options are level-0 tiles scaled down up to 8 × (up to 64 × the device pixels: the whole
400 MB pattern) or the overview magnified up to 4 × (blurry). Levels 1 … M − 1 are tiled
exactly like level 0, so they cost no extra code.

### D6. Build budget: 524,288 stitches per frame, resumable jobs
Building is the only work that grows with the pattern. A **job** fills one tile (or the
overview) row by row with `fillLevelRows`; each frame gets `BUILD_BUDGET_STITCHES = 2^19`
reads, shared out by `buildPlan` (at least one row for the job that starts with budget
left, so building always progresses). Order:
visible tiles of the current level in row-major order, then the overview. Every picture
uploads each new band of rows (`putImageData` dirty rectangle), so the overview appears row by
row; a tile is drawn only once complete (one code path for both, same bytes uploaded). Jobs for tiles that left the view
are dropped. Measured in Node 22 (V8, as in Chrome) on the development machine after
optimizing the loops: about 2-3 ns per stitch at level 0 (a 32-bit copy per stitch), 7-8 ns at
level 1 (only 4 stitches per averaged pixel, so the per-pixel work dominates), 4-5 ns at
level 2 and 3 ns at level 3. The first plan (2^21 stitches, from an estimate of 1-2 ns) would
have cost up to 17 ms per frame on desktop; 2^19 costs at most about 4.5 ms on desktop and,
assuming phones are 2-3 times slower, about 9-13 ms there. 10000²: overview in 209 frames
(about 3.5 s at 60 fps, shown row by row); level-0 tiles 2 per frame; a level-1 tile takes
2 frames, a level-2 tile 8. The browser smoke step re-checks the timing; the constant stays the
one knob.
*Alternatives:* building synchronously (simplest, but one frame would read up to 100 M
stitches, 150-400 ms on desktop and more on phones, at Fit and whenever the level changes);
a Web Worker (no main-thread cost, but needs a worker protocol, asynchronous bitmaps and the
same repaint request; a follow-up can move `fillLevelRows` behind the same job interface).

### D7. "Call me again": render returns true
Progressive building needs further frames without user input. The contract gains one rule:
`render` returns `true` when its picture is incomplete; `viewer.js` then schedules one more
paint through its existing `schedulePaint`. About 5 lines (comment, `paint` returns the
value, the rAF callback re-schedules). Layers returning nothing behave as today.
*Alternatives:* a layer-owned rAF loop (needs the canvas, bypasses the viewer); a state flag
(render must not change state).

### D8. Cache: 48 MiB per layer, least recently drawn first, never the current frame
`pattern-picture.js` keeps a `Map` key → `{ canvas, bytes, lastDrawn }` (key
`level:column:row`). After drawing, `tilesToEvict` with the keys drawn in this frame as
`keepKeys` decides what to release; a released canvas gets `width = height = 0`, which frees
WebKit's backing store at once instead of at garbage collection. 48 MiB covers the worst
visible set of the desktop (42) and phone (30) frames of D2, so panning back and forth does
not rebuild. Per layer: ≤ 48 MiB tiles + ≤ 16 MiB overview; both layers ≤ 128 MiB plus the
frame canvas (≤ 13 MiB on the phone frame), well under iOS Safari's total. A new pattern
(new object identity) releases every canvas and job of the old one first.

### D9. Seamless tiles by snapping inner edges
Canvas `drawImage` anti-aliases fractional destination edges; two neighbors that both cover
half of a device pixel leave a lighter seam. Inner tile edges are rounded to device pixels
(moving a stitch by at most half a device pixel), outer content edges stay exact, so single
pictures draw exactly as today and nothing leaks outside the content rectangle. The source
rectangle trims a partial last picture pixel (fractional source width) for the same reason.
A pending tile's overview stand-in uses the same destination rectangle.

### D10. Drawing the single picture and the overview
Both draw the visible cell range only: source `range / 2^M`, destination the range on screen
(the Chart's current call, now shared). The DMC colors layer moves from "whole image into
`content`" to this form: same screen pixels; its tests adapt the expected `drawImage`
arguments, and the far-zoom test moves its content partly into the frame (fully outside
now draws nothing, as in the Chart). Smoothing: both layers use
`isStitchSmallerThanDevicePixel`; the Chart drops its always-off rule, which dropped whole
stitches below one device pixel.

### D11. Chart lines and ruler labels at any size
`majorLineStep(cellSize)` = first of 10, 100, 1000, … with `step × cellSize ≥ 8`: a 2 CSS px
bold line every ≥ 8 px covers ≤ 25 %, the same density as a 1 px thin line at the 4 px
thin-line threshold; powers of ten keep bold lines on the 10-stitch grid. When thin lines are
hidden `gridLines` jumps from multiple to multiple (plus borders), so at most
`frame size / 8 + 2` lines per axis are produced; with thin lines the visible boundaries
are ≤ frame size / 4. `rulerLabelStep` continues 10, 20, 50, … × 10^n without end and throws
`RangeError` for a cell size ≤ 0 (which would never satisfy the condition). Label steps stay
independent of the bold step (labels may sit between 1000-lines, e.g. at 1500).

### D12. Worst-case work per frame (10000 × 10000, any zoom)
- Building: ≤ 524,288 stitches read (or one row more), ≤ 2 tile uploads of 1 MiB.
- DMC colors: ≤ 42 tile `drawImage` calls (desktop frame) + ≤ 42 overview stand-ins.
- Chart: the same, plus numbers ≤ frame area / 14² (cells ≥ 14 px), hatch checks
  ≤ frame area / 6², thin lines ≤ frame / 4 per axis, bold lines ≤ frame / 8 + 2, labels
  ≤ frame / (label width + 4). At Fit: one overview `drawImage`, 22 bold lines, ~20 labels, no
  cell read once the overview is complete.

### D13. Tests stay light
No test allocates a large pattern. The big-size numbers of the specs (levels and tiles of
10000², 9 visible tiles, 2 tiles per frame, 209 overview frames, evicting T2 and
T3, seam positions) are checked in the pure core functions with sizes only: the geometry of
`tile-pyramid.js` and a frame-by-frame simulation of `buildPlan`. Pixels are checked on
small real patterns (2 × 2, 3 × 1, 2050 × 2). The ui picture code is exercised on small
patterns with small injected `limits` (for example a 40 × 40 pattern, max side 16, tile 8,
budget 64 stitches), which drive the same code paths as 10000² with the defaults. The
layers' Fit checks use a 2050 × 2050 pattern (8 MB, overview level 1, real defaults); "no
cell read" swaps `cells` for a throwing proxy after the overview completes. Integration
tests extend `tests/helpers/recording-context.js` (the fake cell canvas records
`putImageData` dirty rectangles and size resets); the DMC colors test moves from global
`OffscreenCanvas`/`ImageData` stubs to `options.createCellCanvas`. A one-off script outside
the repository (in the system temp directory, not committed) renders the real 10000² pattern
through `pattern-picture.js` with fake canvases to confirm the 209 frames and 2 tiles per frame and
to time a frame's build in Node.

### D14. A left ruler wide enough for 5-digit row labels
The left ruler has 16 CSS px for labels. `rulerFontSize` shrinks the font to fit, but not
below 7 px; `10000` at 7 px measures about 19.25 px. Chosen: after the font is set, the left
ruler is `max(24, ceil(widest row label + 5 + 2 + 1))` CSS px (`leftRulerWidth`), so labels
of any length fit at a legible size; `rulerPlacement` places it at
`max(0, content.x − leftWidth)`. Up to 4-digit rows (and the 24 px fit margin of every
existing pattern) nothing changes. For 10000 rows the ruler is 28 px; at Fit it covers the
grid's left 4 px (about 53 stitch columns of a fitted 10000² pattern, a sub-pixel sliver
each), the same way both rulers already cover the grid once it is panned. The triangle stays
on the ruler's inner edge and the corner square takes the ruler's width; the top ruler keeps
24 px (its labels run along it, and the label step already spaces them).
*Alternatives:* a smaller minimum font (`10000` would need 5.8 px, illegible on 1× screens);
rotated row labels (fit at 10 px, but sideways digits are harder to read and to match with
the column numbers); a larger `FIT_MARGIN` (affects every layer and pattern; excluded by the
user).

## Implementation notes

- `chart-layout.js` grew from 289 to 355 lines (`majorLineStep`, `leftRulerWidth`, sparse
  `gridLines`), past the ~300-line guideline. It was not split, to keep the rebase onto
  `raise-pattern-limits` (which edits the same file) small; moving the ruler functions into
  their own core module is a possible follow-up.
- `tintedCellPixels` (`chart-tint.js`) is no longer used by app code; tests still use it as
  the reference for level-0 chart pixels. `patternToStitchImage` likewise (spec'd for export).
- `fillLevelRows` rounds averages half up with `Math.round` before storing (the
  Uint8ClampedArray would round halves to even); the spec says "nearest integer".

## Risks / Trade-offs

- [Build speed is measured in Node, not yet in browsers or on phones] → the smoke step
  times frames with the browser's performance panel; `BUILD_BUDGET_STITCHES` is the only knob.
- [A 10000² overview takes about 3.5 s to complete] → it appears row by row while the view
  stays responsive; 2^20 would halve that at the cost of about 9 ms (desktop) to 25 ms
  (phone) per frame while level-1 tiles are built.
- [iOS memory limits vary by device] → budgets are constants; released canvases are shrunk
  to 0 × 0; two layers stay ≤ 128 MiB.
- [Blur while tiles are pending] → at most one frame for a typical pan (≤ 8 new level-0
  tiles per frame); the overview stand-in avoids empty holes.
- [Inner tile edges move up to half a device pixel] → invisible at ≥ 1 device px per
  stitch compared with grid-line snapping, which already moves lines by the same amount.
- [Smoothing across a tile edge clamps to that tile's pixels at levels ≥ 1] → affects a
  sub-pixel-wide band only where a stitch is below one device pixel.
- [`chart-layout.js` and `tests/integration/chart-layer.test.js` are also edited by
  `raise-pattern-limits`, which merges first] → different functions (`gridLines`,
  `rulerLabelStep`, `rulerPlacement`, `leftRulerWidth` here; number font functions there);
  rebase before archive and re-run the suite.
- [A 28 px left ruler covers 4 px of a fitted 10000-row grid] → only for ≥ 5-digit row
  counts, and the same as a sticky ruler while panning (D14).
- [Tests run small sizes, not the real 10000²] → the size-only core tests pin every
  large-size number, the limits are injected into the same code, and the temp script
  checks the real size once (D13).
- [The rAF loop could spin if a job never finished] → every frame completes at least one row;
  integration tests assert the layer stops asking once complete.

## Migration Plan

No data or format changes. Rollback = revert the change; small patterns are unaffected
either way.

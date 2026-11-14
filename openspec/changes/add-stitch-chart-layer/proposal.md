# Proposal: add-stitch-chart-layer

## Why

The Chart view is still a stub. A stitcher needs the real chart: each stitch as a cell
with its legend number, a counting grid, row/column numbers, a centre mark, and a
legend mapping each number to a DMC floss.

## What Changes

- The `Chart` layer draws the pattern in the shared frame, aligned with the other layers:
  cells in a pale tint of their DMC color (readable under black text) with
  black numbers 1..N, centred, sized for two digits; below 14 CSS px cells, no numbers.
- Empty (no-stitch) cells are light grey, hatched from 6 CSS px, without a number.
- Thin line every stitch (hidden below 4 CSS px cells), bold line every 10 stitches and
  around the grid, snapped to device pixels so lines stay crisp.
- Rulers on the top and left grid edges: numbers every 10 stitches (20, 50, … when labels
  would overlap), triangles at the centre column and row. They sit next to the grid and
  stick to the frame edge when the grid edge scrolls out of view.
- The fit margin grows from 16 to 24 CSS px for all layers so a ruler fits beside the
  fitted grid (one shared constant).
- Only visible cells are drawn; a 300 × 300 pattern pans smoothly.
- A compact 24rem legend panel beside the frame, on every layer while a pattern exists:
  one row per color with number (on its tint), swatch, DMC code, name and stitch count.

User-visible: `Chart` shows a numbered chart instead of "not available yet"; a legend
appears once a pattern exists; fitted images keep a 24 CSS px margin.

## Out of scope

- Printing, PDF and PNG export (later change).
- Pattern generation and settings (`add-pattern-generation`); the DMC colors layer
  (`add-dmc-preview-layer`).
- Editing stitches; highlighting a color's cells from its legend row (possible follow-up).

## Capabilities

### New Capabilities

- `stitch-chart`: the numbered chart layer (cells, numbers, grid, rulers, centre marker,
  empty cells, visible-range drawing) and the legend panel.

### Modified Capabilities

- `pattern-viewer`: "Content can be fitted to the frame" uses a 24 CSS px margin.

## Impact

- New: `src/core/chart-layout.js`, `src/core/chart-tint.js`, `src/core/legend-rows.js`,
  `src/ui/legend.js`, tests. `src/core/color.js` gains `labToLinearRgb`.
- Replaced: `src/ui/layers/chart-layer.js` (stub).
- Edited: `src/core/viewport.js` and its test (fit margin), `index.html` (legend marker),
  `styles/main.css` (legend block), `src/main.js` (one import, one setup line),
  `styles/print.css` (comment).
- No new dependencies.

# Proposal: tile-large-pattern-rendering

## Why

Patterns of up to 10000 × 10000 stitches are coming (`raise-pattern-limits`). The DMC colors
and Chart layers paint from one bitmap with a pixel per stitch: at that size it is 400 MB and
far above the iOS Safari canvas limit (16.7 megapixels). At Fit the Chart also draws bold
lines every 10 stitches less than 1 px apart, turning the grid black.

## What Changes

- Patterns up to 2048 stitches per side keep today's single picture. Larger ones are drawn
  from 512 × 512 tiles built only where visible, kept in a 48 MiB cache per layer (least
  recently drawn evicted first), plus one averaged overview of at most 2048 × 2048 px.
  The detail level (1 pixel = 1, 2 × 2, 4 × 4, … stitches) follows the zoom; any pattern
  size works.
- Building is spread over frames (at most 2,097,152 stitches read per frame): the view stays
  responsive, a huge pattern appears row by row within about a second, and pending tiles
  show the overview meanwhile.
- Tiles meet without seams; hard block edges stay while a stitch is at least 1 device pixel.
  Chart cell colors follow the same sharpness rule as the DMC colors layer.
- Chart: when 10 stitches are less than 8 CSS px apart, bold lines go every 100 (1000, …)
  stitches; ruler label steps continue past 500 (1000, 2000, 5000, …).

User-visible: very large patterns show in both layers on desktop and phones; zoomed-out
charts of large patterns keep a readable grid.

## Out of scope

- Generation limits and speed, 3-digit cell numbers (`raise-pattern-limits`); 5-digit row
  labels in the 24 px ruler.
- Pinch zoom, mobile layout, printing/export, building tiles in a Web Worker.

## Capabilities

### New Capabilities

- `large-pattern-rendering`: how both pattern layers turn a pattern of any size into
  pictures (single picture, tiles, detail levels, overview), memory and per-frame limits,
  progressive building, seamless tiles.

### Modified Capabilities

- `dmc-preview`: "Redraws reuse the stitch image" lets evicted tiles be rebuilt.
- `stitch-chart`: bold line step grows when lines crowd; ruler label steps beyond 500;
  "Only visible cells are drawn" gains a 10000 × 10000 Fit scenario.

## Impact

- New: core `tile-pyramid.js`, `level-pixels.js`, `tile-budget.js`; ui
  `layers/pattern-picture.js` shared by both layers.
- Edited: `dmc-layer.js`, `chart-layer.js`; `src/core/chart-layout.js`
  (`gridLines`, `rulerLabelStep`, new `majorLineStep`; number functions untouched);
  `src/ui/viewer.js` (a layer may ask for another frame, about 5 lines); tests.
- No new dependencies.

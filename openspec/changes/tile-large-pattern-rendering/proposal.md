# Proposal: tile-large-pattern-rendering

## Why

Patterns of up to 10000 × 10000 stitches are coming (`raise-pattern-limits`). The DMC colors
and Chart layers paint from one bitmap with a pixel per stitch: at that size it is 400 MB and
far above the iOS Safari canvas limit (16.7 megapixels). At Fit the Chart's bold lines
(every 10 stitches) are under 1 px apart and turn the grid black.

## What Changes

- Patterns up to 2048 stitches per side keep today's single picture. Larger ones are drawn
  from 512 × 512 tiles built only where visible, kept in a 48 MiB cache per layer (least
  recently drawn evicted first), plus one averaged overview of at most 2048 × 2048 px.
  The detail level (1 pixel = 1, 2 × 2, 4 × 4, … stitches) follows the zoom; any pattern
  size works.
- Building is spread over frames (at most 524,288 stitches read per frame): the view stays
  responsive, a huge pattern appears row by row (about 3.5 s for 10000 × 10000), and pending
  tiles show the overview meanwhile.
- Tiles meet without seams; hard block edges stay while a stitch is at least 1 device pixel.
  Chart cell colors follow the same sharpness rule as the DMC colors layer.
- Chart: when 10 stitches are less than 8 CSS px apart, bold lines go every 100 (1000, …)
  stitches; ruler label steps continue past 500 (1000, 2000, 5000, …); the left ruler
  widens when 5-digit row labels (`10000`) would not fit its 24 px.

User-visible: very large patterns show in both layers on desktop and phones; their charts
keep a readable grid and rulers.

## Out of scope

- Generation limits and speed, 3-digit cell numbers (`raise-pattern-limits`).
- Pinch zoom, mobile layout, printing/export, Web Worker tile building.

## Capabilities

### New Capabilities

- `large-pattern-rendering`: how both pattern layers turn a pattern of any size into
  pictures (single picture, tiles, detail levels, overview), memory and per-frame limits,
  progressive building, seamless tiles.

### Modified Capabilities

- `dmc-preview`: "Redraws reuse the stitch image" lets evicted tiles be rebuilt.
- `stitch-chart`: bold line step grows when lines crowd; ruler label steps beyond 500;
  "Only visible cells are drawn" gains a 10000 × 10000 Fit scenario; the left ruler may be
  wider than 24 px.

## Impact

- New: core `tile-pyramid.js`, `level-pixels.js`, `tile-budget.js`; ui
  `layers/pattern-picture.js` shared by both layers.
- Edited: `dmc-layer.js`, `chart-layer.js`, `chart-rulers.js`; `src/core/chart-layout.js`
  (`gridLines`, `rulerLabelStep`, `rulerPlacement`, new `majorLineStep`, `leftRulerWidth`;
  number functions untouched);
  `src/ui/viewer.js` (a layer may ask for another frame, about 5 lines); tests.
- No new dependencies.

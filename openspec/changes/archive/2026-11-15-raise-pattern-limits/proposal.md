# Proposal

## Why

Enthusiasts stitch huge, finely shaded patterns (e.g. a 3200 × 4000 px gold-gradient render),
but the app caps patterns at 500 stitches per side and 99 colors and downscales every image to
2048 px. Raising them needs a pipeline that fits in browser memory.

## What Changes

- **Colors:** max colors 1–489, the whole DMC palette (derived from the palette size).
- **Grid:** up to 10000 stitches per side (was 500).
- **Decode cap:** at most 16,777,216 pixels (4096 × 4096) and 10000 px per side instead of
  2048 px; a 3200 × 4000 image is used at full size.
- **Pipeline:** grid rows are averaged in a streaming pass (no per-cell float arrays);
  k-means runs on a seeded sample of at most 65,536 stitched cells, then every cell gets its
  nearest centre by an exact, faster search. Deterministic; small grids give today's patterns.
- **Worker:** progress messages; a superseded or stopped job terminates the worker.
- User-visible:
  - The form accepts width 10–10000 and max colors 1–489.
  - A note says when the grid is wider than the image ("adds no detail").
  - Patterns over 4,000,000 stitches start only with a **Generate** button.
  - While generating, the status shows step and percent; a **Stop** button stops the job.
  - Chart numbers are always sized for 3 digits (0.45 × cell size) and appear from 19 CSS px
    cells (was 14). Legend number boxes fit 3 digits.
  - Max zoom lets a stitch reach 64 CSS px on any pattern (6400 % stays the minimum cap).

## Capabilities

### New Capabilities
(none)

### Modified Capabilities
- `pattern-model`: color limit 99 → 489 (DMC palette size).
- `pattern-generation`: grid limit, sampling, progress, confirmation, stopping, form ranges.
- `image-import`: new decode cap.
- `stitch-chart`: 3-digit number size and threshold; legend number box width.
- `pattern-viewer`: max zoom follows the pattern's cell size.

## Impact

- core: `pattern.js`, `stitch-grid.js`, `kmeans.js`, `pattern-generator.js`,
  `generation-settings.js`, `image-size.js`, `viewport.js`, `chart-layout.js` (constants), new
  `nearest-centre.js` and `reservoir-sample.js`.
- workers, io, ui: handler, worker client, image loader, pattern generation, settings form,
  app state, `main.js`, one line in `viewer-input.js`; `index.html` settings form; small CSS.
- `.claude/rules/domain.md`: the "at most 99 colors" line.
- No dependencies, no network.

## Out of scope

- Fast drawing of huge patterns in the DMC/Chart layers (`tile-large-pattern-rendering`),
  pinch zoom (`add-pinch-zoom`), mobile layout (`improve-mobile-layout`), printing, export.
- Follow-up: confetti cleanup (isolated single stitches, common in gradients).

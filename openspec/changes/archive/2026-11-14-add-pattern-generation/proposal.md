# Proposal

## Why

The app can load an image and has a pattern model and DMC matching, but nothing turns the
image into a `Pattern` yet, so the DMC colors and Chart layers stay disabled. This change is
the only producer of `state.pattern`, which the parallel changes `add-dmc-preview-layer` and
`add-stitch-chart-layer` consume.

## What Changes

- Read the loaded image into an RGBA pixel buffer once per image (io).
- Resize the pixels to a stitch grid by area averaging in linear RGB; the width comes from the
  settings, the height follows the image's aspect ratio (whole image, no cropping). Mostly
  transparent cells become empty (core).
- Reduce the grid to at most the chosen number of colors with seeded, deterministic k-means in
  CIELAB, match each cluster centre to the nearest DMC floss by CIEDE2000, and build the
  `Pattern` (clusters on the same DMC code merge) (core).
- Run the pipeline in a module Web Worker with an `id`-tagged message protocol and
  transferred buffers; stale results are discarded (workers, io).
- User-visible: a **Pattern settings** form left of the view frame with target width in
  stitches, maximum colors and fabric count. It always shows the resulting stitch dimensions
  and finished size in inches and centimetres for the chosen fabric. A pattern is generated
  automatically when an image loads and again shortly after width or color count changes;
  a status line shows "Generating pattern…", the result, or the error. When a pattern exists,
  the `DMC colors` and `Chart` options become selectable.

## Capabilities

### New Capabilities
- `pattern-generation`: turning a decoded image plus user settings into a `Pattern` —
  grid resize, transparency, color reduction, DMC mapping, determinism, the worker protocol,
  and the settings form with its size display and generation status.

### Modified Capabilities
(none — image import already clears the pattern on a new image; the viewer already enables
the pattern layers when `state.pattern` is set.)

## Impact

- New modules in `src/core/`, `src/io/`, `src/workers/`, `src/ui/` (listed in design.md),
  with unit and integration tests.
- Small, localized edits: `index.html` (settings marker), `src/main.js` (one setup group),
  `src/ui/app-state.js`, `src/ui/status.js`, `styles/main.css`.
- No new dependencies, no network access.

## Out of scope

Floyd–Steinberg dithering (a later change: it needs a per-cell ΔE00 search and a UI toggle),
rendering of the DMC colors and Chart layers, the legend UI, export/print/JSON, persistence and
`localStorage`, custom or limited palettes, symbols, and editing stitches.

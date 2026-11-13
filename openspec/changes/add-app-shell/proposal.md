# Proposal

## Why

The repository has rules and a workflow but no application yet. Every later change
(DMC matching, pattern model, generation, DMC preview, stitch chart) needs a page to live
in, a way to load an image, and one shared view frame to draw into. Building that shell
first, with a fixed plug-in point for view layers, lets the wave-2 changes work in
parallel without editing the same lines.

## What Changes

- New single page `index.html` with plain CSS (`styles/`), loading `./src/main.js`.
- Image import: file picker plus drag-and-drop onto the frame. Decoding is local via
  `createImageBitmap`; images whose long side exceeds 2048 px are downscaled and the user
  is told so. Unsupported or corrupt files show a clear error and keep the previous image.
- One view frame (a single canvas) that shows exactly one layer at a time. Zoom (wheel,
  buttons, keys) and pan (drag, arrow keys) are shared by all layers and kept when the
  user switches layers. Rendering is crisp on high-DPI screens.
- Layer switcher with three slots: **Original**, **DMC colors**, **Chart**. Only Original
  renders in this change; the other two are disabled until a pattern exists
  (`state.pattern` stays `null` here) and are backed by stub modules that later changes
  replace file-for-file.
- Small state store (`getState`, `setState`, `subscribe`).
- Dev server `scripts/serve.js` (node:http, configurable port and base path) and a
  served-site integration test that catches non-relative or broken URLs.

User-visible behavior: the user can open or drop an image, see it fitted in the frame,
zoom and pan it, and see (disabled) DMC and Chart view options.

## Out of scope

Pattern generation and its settings form (target width, max colors, fabric count),
resizing to a stitch grid, color math, DMC palette data, DMC-preview and chart rendering,
the legend, export and printing of the chart, persistence (JSON, `localStorage`), pinch
zoom, and extracting raw pixels for processing.

## Capabilities

### New Capabilities
- `image-import`: choosing or dropping an image, local decoding, the decode-size cap with
  user notice, and errors for unsupported or corrupt files.
- `pattern-viewer`: the shared frame, layer switching and availability, shared zoom/pan,
  high-DPI rendering, and one content rectangle for all layers.

### Modified Capabilities
- None.

## Impact

- New: `index.html`, `styles/`, `src/main.js`, `src/ui/`, `src/io/image-loader.js`,
  `src/core/image-size.js`, `src/core/viewport.js`, `scripts/serve.js`, tests.
- No dependencies, no build step. No files owned by parallel changes (`src/core/types.js`,
  `src/core/pattern.js`, `src/core/color.js`, `src/core/dmc-match.js`, `src/data/`,
  `src/workers/`).

# Proposal

## Why

Once a pattern exists, the user needs to see what the finished embroidery will look like.
The `DMC colors` layer slot exists in the shared frame but only draws a "not available yet"
note.

## What Changes

- Replace the stub `src/ui/layers/dmc-layer.js` with the real layer: it shows the current
  pattern as solid color blocks, one block per stitch, in the legend entry's DMC hex color.
  The blocks exactly cover the shared content rectangle, aligned with the other layers.
- Blocks have hard edges at every zoom; neighboring stitches are never blended. Only when
  one stitch is smaller than one device pixel (far zoomed out) is the picture averaged, so
  no stitch silently disappears.
- Empty cells (no stitch) are transparent: the frame background shows through, exactly as
  transparent areas look in the Original layer. They never look like white (`BLANC`).
- New pure core module `src/core/pattern-image.js`: Pattern → RGBA pixels, one pixel per
  stitch (empty = fully transparent). The layer builds this once per pattern and reuses it
  while the user zooms, pans or switches layers.

User-visible behavior: after a pattern has been generated, choosing `DMC colors` shows the
image as crisp DMC-colored stitch blocks, without grid lines, instead of a note.

## Out of scope

Pattern generation and its settings (target size, max colors, fabric count, dithering), the
Chart layer and its grid lines and numbers, the legend, export (PNG, JSON) and printing,
editing stitches, a checkerboard or other marker for empty cells, and any change to the
viewer, layer switcher, app state or `main.js`.

## Capabilities

### New Capabilities
- `dmc-preview`: how a pattern is shown in DMC colors: one solid block per stitch, color
  from the legend, transparent empty cells, sharpness rules, and reuse across redraws.

### Modified Capabilities
- None. Availability of the `DMC colors` option and the shared content rectangle are
  already specified in `pattern-viewer` and do not change.

## Impact

- Changed: `src/ui/layers/dmc-layer.js` (same export `createDmcLayer`, same contract).
- New: `src/core/pattern-image.js`, `tests/unit/core/pattern-image.test.js`,
  `tests/integration/dmc-preview-layer.test.js`.
- Depends on `src/core/pattern.js` (Pattern shape) and `src/core/color.js` (`hexToRgb`).
- The real app only has a pattern once add-pattern-generation lands; until then the layer
  is covered by tests with hand-built patterns.

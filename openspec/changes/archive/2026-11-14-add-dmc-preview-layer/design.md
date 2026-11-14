# Design: add-dmc-preview-layer

## Context

See proposal.md (Why) for the motivation and `specs/dmc-preview/spec.md` for the behavior.

- `src/ui/viewer.js` defines the view-layer contract: a layer is
  `{ id, isAvailable(state), render(ctx, frame, state) }`. `render` is synchronous, gets a
  cleared context already scaled to CSS px, and `frame.content` (the image rectangle on
  screen, in CSS px) that every layer must paint exactly. Layers may cache drawings in their
  factory closure, keyed by the identity of `state.pattern`.
- The viewer clears the canvas to transparent before each paint; the frame element's CSS
  background (`--color-frame`, `#E4E1DB`) shows wherever nothing is drawn.
- `src/core/pattern.js` creates the Pattern: `width`, `height`, `cells` (row-major
  `Int16Array`, 0-based legend index or `EMPTY_CELL` -1) and `legend` entries with uppercase
  `hex` `#RRGGBB`. `src/core/color.js` exports `hexToRgb`.
- add-pattern-generation (#4) fills `state.pattern`; it is not on `main` yet, so in the real
  app `state.pattern` is always `null` until #4 lands. add-stitch-chart-layer (#6) replaces
  the sibling stub `chart-layer.js` in parallel; this change touches no shared file.

## Goals / Non-Goals

**Goals:**
- One `drawImage` per paint, whatever the pattern size, so panning stays smooth.
- Stitch blocks that line up with the content rectangle and the other layers exactly.
- All per-cell logic in `core/`, unit-tested in Node.

**Non-Goals:**
- No grid lines, numbers, center marker or hover info (Chart layer / later changes).
- No fallback for browsers without `OffscreenCanvas` (all current evergreen browsers have it).
- No change to the viewer contract, app state, `main.js` or `index.html`.

## Layers

| Module | Layer | Notes |
|---|---|---|
| `src/core/pattern-image.js` | core | pure; imports only `./color.js` and `./pattern.js` (`EMPTY_CELL`) |
| `src/ui/layers/dmc-layer.js` | ui | replaces the stub; same export `createDmcLayer`, id `'dmc'` |
| `tests/unit/core/pattern-image.test.js` | test | mirrors the core module |
| `tests/integration/dmc-preview-layer.test.js` | test | pattern → layer → canvas calls, with stub `OffscreenCanvas`/`ImageData` |

`core/` stays pure: no DOM, `OffscreenCanvas`, `ImageData` or timers; input and output are
plain data and typed arrays. Only `dmc-layer.js` touches canvas APIs.

## Data shape (created by `src/core/pattern-image.js`)

**StitchImage**, returned by `patternToStitchImage(pattern)`; described in a comment next
to that function:
- `width`, `height`: the pattern's size in stitches (= pixels).
- `data`: a new `Uint8ClampedArray` of `width × height × 4` bytes, row-major, 4 bytes
  (red, green, blue, alpha, each 0–255) per stitch. Stitched cell = its legend hex color with
  alpha 255; empty cell = `0, 0, 0, 0`.

It has the same fields as the browser's `ImageData`, so the layer can call
`new ImageData(image.data, image.width, image.height)` without copying. It can later be
reused by a PNG export.

## Decisions

### D1. Pure conversion in core: `patternToStitchImage(pattern)`
Converts each legend entry's hex to RGB once (with `hexToRgb`) into a small lookup, then
fills `data` in one loop over the cells, writing into the preallocated output. Validates at
the boundary: `cells.length === width × height` and every cell is `-1` or a valid legend
index (RangeError naming the position and value). Does not modify the pattern.
*Alternative:* converting inside the layer — rejected, it would be untestable without a
browser (testing.md: extract testable logic into `core/`).

### D2. Draw a cached W × H bitmap scaled into the content rectangle
On the first render of a pattern the layer puts the StitchImage into a `width × height`
`OffscreenCanvas`, then every paint is one
`ctx.drawImage(bitmap, content.x, content.y, content.width, content.height)`.
- *vs. one `fillRect` per cell:* 90 000 calls per frame for a 300 × 300 pattern during
  every pan step, and adjacent rectangles at fractional CSS coordinates are anti-aliased
  separately, leaving faint background-colored seams between stitches.
- *vs. `putImageData` on the frame canvas:* it ignores the transform and cannot scale.
- *vs. `createImageBitmap`:* asynchronous, but `render` must be synchronous.
`OffscreenCanvas` is used instead of a detached `<canvas>` so the layer creates no DOM node.
Memory: 4 bytes per stitch (360 KB for 300 × 300), one pattern at a time.

### D3. Smoothing rule
`ctx.imageSmoothingEnabled = false` when one stitch is at least 1 device pixel in both
directions, i.e. `content.width × pixelRatio ≥ pattern.width` and
`content.height × pixelRatio ≥ pattern.height`; otherwise `true` with
`imageSmoothingQuality = 'high'`. Nearest-neighbor scaling gives hard block edges at any
zoom (the point of the preview). Below one device pixel per stitch it would drop whole
stitches arbitrarily and shimmer while panning, so smoothed downscaling is the better
approximation there. The check is a pure core helper
`isStitchSmallerThanDevicePixel(pattern, content, pixelRatio)` in `pattern-image.js`, so
the boundary (968 stitches in 484 CSS px at ratio 2) is unit-tested.
This mirrors the Original layer, which also turns smoothing off from 100 % up.

### D4. Cache keyed by pattern identity
The factory closure keeps `cachedPattern` and `cachedBitmap`. If
`state.pattern !== cachedPattern`, it rebuilds both; otherwise it reuses the bitmap. Zoom,
pan, resize and layer switching only change the viewport, not the pattern object, so they
never rebuild. Patterns are immutable (pattern.js: cells are read-only), so identity is a
safe key.

### D5. Empty cells: transparent, no marker
Alpha 0 means the cell is not painted and the frame background `#E4E1DB` shows, exactly
like transparent pixels in the Original layer, and clearly different from `BLANC`
`#FFFFFF`. *Alternative:* a checkerboard — rejected for now: more code, and it visually
competes with small light stitches. Can be added later without changing the StitchImage.

### D6. No grid lines
The preview shows the finished look; lines would tint every stitch, especially small ones.
The Chart layer (#6) owns grid lines and numbers per ui.md.

### D7. Integration test without a browser
The test replaces `globalThis.OffscreenCanvas` and `globalThis.ImageData` (neither exists in
Node) with small recording stubs (restored in `after()`) and passes a fake 2D context that records `drawImage` arguments and the smoothing
flag. That checks the real layer module against real `buildPattern` output: content
rectangle, smoothing boundary, cache reuse and rebuild, fully empty pattern, no other
drawing calls. Real pixels are checked in the browser smoke step.

## Risks / Trade-offs

- [A DMC color close to `#E4E1DB` can be mistaken for an empty cell] → the Chart layer and
  legend identify every stitch; a checkerboard can be added later (D5).
- [Browsers place nearest-neighbor edges within half a device pixel of the exact grid line
  when `content.x` is fractional] → accepted; still aligned with the Chart layer within one
  device pixel, and the spec only requires pixels fully inside a stitch to be pure.
- [No pattern in the real app until #4 lands] → behavior is covered by unit and integration
  tests with hand-built patterns; the browser smoke check runs after rebasing onto #4.
- [The stub-based integration test could drift from real canvas behavior] → it checks only
  calls and arguments; pixel results are checked in the smoke step.

## Migration Plan

Drop-in replacement of the stub file; no state or format changes. Rollback: revert the
commits.

// View layer 2: the pattern in DMC colors, one solid block per stitch. Follows the view-layer
// contract in ../viewer.js. Behavior: openspec/specs/dmc-preview/spec.md and, for large
// patterns, openspec/specs/large-pattern-rendering/spec.md.
//
// The pattern is drawn from pictures with one pixel per stitch (or, zoomed out on a large
// pattern, one averaged pixel per block of stitches), built and cached by ./pattern-picture.js
// and scaled into frame.content with drawImage. Unlike one fillRect per cell this leaves no
// anti-aliased seams between neighbouring stitches and keeps panning smooth.
// Empty cells are transparent pixels, so the frame background shows through them.

import { isStitchSmallerThanDevicePixel } from '../../core/pattern-image.js';
import { colorTable } from '../../core/level-pixels.js';
import { visibleCellRange } from '../../core/chart-layout.js';
import { createPatternPicture } from './pattern-picture.js';

/**
 * Creates the DMC colors layer. It is available once a pattern exists (state.pattern is not null).
 * Pictures are kept per pattern object, so zoom, pan, resize and layer switching reuse them.
 * options.createCellCanvas(width, height)  makes the canvases the pictures live in; defaults to
 *   an OffscreenCanvas. Tests pass a fake.
 * Returns a view layer { id: 'dmc', isAvailable, render }; render returns true while the
 * pictures it needs are still being built (see the contract in ../viewer.js).
 */
export function createDmcLayer(options = {}) {
  const picture = createPatternPicture({
    createCellCanvas: options.createCellCanvas ?? createOffscreenCanvas,
    colorTableOf: stitchColors,
  });

  return {
    id: 'dmc',
    isAvailable: (state) => state.pattern !== null,
    render(ctx, frame, state) {
      const { pattern } = state;
      if (pattern === null) {
        return false;
      }
      const { content, pixelRatio } = frame;
      // Hard block edges at every zoom; only below one device pixel per stitch would
      // nearest-neighbor scaling drop whole stitches, so smooth there instead.
      const isSmoothing = isStitchSmallerThanDevicePixel(pattern, content, pixelRatio);
      ctx.imageSmoothingEnabled = isSmoothing;
      if (isSmoothing) {
        ctx.imageSmoothingQuality = 'high';
      }
      const isComplete = picture.draw(ctx, frame, pattern, visibleCellRange(content, frame, pattern));
      return !isComplete;
    },
  };
}

function createOffscreenCanvas(width, height) {
  return new OffscreenCanvas(width, height);
}

// Each legend color as it is; empty cells transparent.
function stitchColors(pattern) {
  return colorTable(pattern.legend.map((entry) => entry.hex), null);
}

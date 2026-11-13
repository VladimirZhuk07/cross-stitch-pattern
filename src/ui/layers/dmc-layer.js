// View layer 2: the pattern in DMC colors, one solid block per stitch. Follows the view-layer
// contract in ../viewer.js. Behavior: openspec/specs/dmc-preview/spec.md.
//
// The pattern is turned into a small bitmap with one pixel per stitch once, then every paint
// scales that bitmap into frame.content with a single drawImage. One call per paint keeps
// panning smooth for large patterns, and unlike one fillRect per cell it leaves no
// anti-aliased seams between neighboring stitches.
// Empty cells are transparent pixels, so the frame background shows through them.

import { isStitchSmallerThanDevicePixel, patternToStitchImage } from '../../core/pattern-image.js';

/**
 * Creates the DMC colors layer. It is available once a pattern exists (state.pattern is not null).
 * It keeps the bitmap of the last pattern it drew and rebuilds it only for a different pattern
 * object, so zoom, pan, resize and layer switching reuse it.
 * Returns a view layer { id: 'dmc', isAvailable, render }.
 */
export function createDmcLayer() {
  let cachedPattern = null;
  let cachedBitmap = null;

  function bitmapFor(pattern) {
    if (pattern !== cachedPattern) {
      cachedBitmap = createStitchBitmap(pattern);
      cachedPattern = pattern;
    }
    return cachedBitmap;
  }

  return {
    id: 'dmc',
    isAvailable: (state) => state.pattern !== null,
    render(ctx, frame, state) {
      const { pattern } = state;
      if (pattern === null) {
        return;
      }
      const { content, pixelRatio } = frame;
      // Hard block edges at every zoom; only below one device pixel per stitch would
      // nearest-neighbor scaling drop whole stitches, so smooth there instead.
      const isSmoothing = isStitchSmallerThanDevicePixel(pattern, content, pixelRatio);
      ctx.imageSmoothingEnabled = isSmoothing;
      if (isSmoothing) {
        ctx.imageSmoothingQuality = 'high';
      }
      ctx.drawImage(bitmapFor(pattern), content.x, content.y, content.width, content.height);
    },
  };
}

/** Returns an OffscreenCanvas of pattern.width × pattern.height px, one pixel per stitch. */
function createStitchBitmap(pattern) {
  const stitchImage = patternToStitchImage(pattern);
  const bitmap = new OffscreenCanvas(stitchImage.width, stitchImage.height);
  const imageData = new ImageData(stitchImage.data, stitchImage.width, stitchImage.height);
  bitmap.getContext('2d').putImageData(imageData, 0, 0);
  return bitmap;
}

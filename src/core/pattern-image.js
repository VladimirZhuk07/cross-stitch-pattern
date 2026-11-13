// The pattern as a picture: one pixel per stitch in its DMC color, for the DMC colors view
// layer (and later image export). The authoritative description is
// openspec/specs/dmc-preview/spec.md.

import { hexToRgb } from './color.js';
import { EMPTY_CELL } from './pattern.js';

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;

// StitchImage, created here:
//   width, height  the pattern's size in stitches, which is also its size in pixels.
//   data           a new Uint8ClampedArray of width × height × 4 bytes, row-major
//                  (stitch x, y starts at byte (y * width + x) * 4), holding red, green,
//                  blue, alpha (0–255) per stitch. A stitched cell has its legend hex color
//                  and alpha 255; an empty cell is 0, 0, 0, 0 (fully transparent).
//   It has the same fields as the browser's ImageData, so it can be wrapped without copying.

// Returns the StitchImage of a Pattern (see ./pattern.js); does not modify the pattern.
// Throws RangeError when the cell count is not width × height or a cell is neither
// EMPTY_CELL nor an index into the legend.
export function patternToStitchImage(pattern) {
  const { width, height, cells, legend } = pattern;
  if (cells.length !== width * height) {
    throw new RangeError(`cells must have width × height = ${width * height} entries, got ${cells.length}`);
  }
  // Converting each legend color once keeps the per-cell loop to plain array reads.
  const legendRgb = legend.map((entry) => hexToRgb(entry.hex));
  const data = new Uint8ClampedArray(cells.length * BYTES_PER_PIXEL);
  for (let i = 0; i < cells.length; i++) {
    const legendIndex = cells[i];
    if (legendIndex === EMPTY_CELL) {
      continue; // the buffer starts as zeros: transparent
    }
    if (!Number.isInteger(legendIndex) || legendIndex < 0 || legendIndex >= legend.length) {
      throw new RangeError(
        `cell ${i} has value ${String(legendIndex)}, expected ${EMPTY_CELL} or a legend index 0–${legend.length - 1}`,
      );
    }
    const { r, g, b } = legendRgb[legendIndex];
    const offset = i * BYTES_PER_PIXEL;
    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = OPAQUE;
  }
  return { width, height, data };
}

// True when one stitch of `pattern` ({ width, height } in stitches) would be smaller than one
// device pixel in either direction when the pattern fills `content` ({ width, height } in
// CSS px) on a screen with `pixelRatio` device px per CSS px.
// The DMC colors layer draws hard block edges (no smoothing) unless this is true: below one
// device pixel per stitch, nearest-neighbor scaling would drop whole stitches arbitrarily,
// so smoothed downscaling is the better picture there.
export function isStitchSmallerThanDevicePixel(pattern, content, pixelRatio) {
  return content.width * pixelRatio < pattern.width
    || content.height * pixelRatio < pattern.height;
}

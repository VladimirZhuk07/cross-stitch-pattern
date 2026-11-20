// Sizes of the pictures on the workbook's Summary sheet: how large the PNGs are and how large
// they are shown. Pure. Design D7 of add-excel-export.

/**
 * The size of a picture of size { width, height } (positive numbers, px) scaled down so its
 * longer side is at most maxSide px, keeping the aspect ratio. Never enlarges. Returns
 * { width, height } in whole px, each at least 1. Throws RangeError for non-positive input.
 */
export function fitInside(size, maxSide) {
  checkSize(size, maxSide);
  const scale = Math.min(1, maxSide / Math.max(size.width, size.height));
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/**
 * Whole pixels per stitch for the picture of a pattern of size { width, height } (stitches),
 * so its longer side is at most maxSide px: max(1, floor(maxSide / longer side)).
 * Whole pixels keep the block edges sharp. Throws RangeError for non-positive input.
 */
export function stitchBlockSize(size, maxSide) {
  checkSize(size, maxSide);
  return Math.max(1, Math.floor(maxSide / Math.max(size.width, size.height)));
}

function checkSize(size, maxSide) {
  for (const [field, value] of [['width', size.width], ['height', size.height], ['maxSide', maxSide]]) {
    if (!(value > 0) || !Number.isFinite(value)) {
      throw new RangeError(`${field} must be a positive number, got ${String(value)}`);
    }
  }
}

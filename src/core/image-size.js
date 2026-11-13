// Size limit for decoded images. Pure: no browser APIs.

/**
 * Computes the size an image is used at when its longer side may be at most maxSide pixels.
 * The aspect ratio is kept; the shorter side is rounded to the nearest whole pixel, at least 1.
 * Images whose longer side is maxSide or less keep their size.
 *
 * width, height  decoded image size in pixels (positive integers)
 * maxSide        largest allowed length of the longer side in pixels (positive integer)
 *
 * Returns a capped size { width, height, isDownscaled }: the size to use, in whole pixels ≥ 1,
 * and whether it is smaller than the input.
 * Throws RangeError if any argument is not a positive integer.
 */
export function capImageSize(width, height, maxSide) {
  assertPositiveInteger('width', width);
  assertPositiveInteger('height', height);
  assertPositiveInteger('maxSide', maxSide);

  const longSide = Math.max(width, height);
  if (longSide <= maxSide) {
    return { width, height, isDownscaled: false };
  }

  const ratio = maxSide / longSide;
  if (width >= height) {
    return { width: maxSide, height: Math.max(1, Math.round(height * ratio)), isDownscaled: true };
  }
  return { width: Math.max(1, Math.round(width * ratio)), height: maxSide, isDownscaled: true };
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

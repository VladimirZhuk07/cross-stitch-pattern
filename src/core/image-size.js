// Size limit for decoded images. Pure: no browser APIs.

/**
 * Computes the size an image is used at when it may have at most limits.maxPixels pixels and
 * no side longer than limits.maxSide pixels. The aspect ratio is kept; images within both
 * limits keep their size.
 *
 * Downscaling: s = min(maxSide / long side, √(maxPixels / (width × height))); the new long
 * side is floor(long side × s), lowered by 1 while the area still exceeds maxPixels (rounding
 * the short side up can push it over); the short side is short × newLong / long, rounded to
 * the nearest whole pixel, at least 1.
 *
 * width, height  decoded image size in pixels (positive integers)
 * limits         decode limits { maxSide, maxPixels }: longest allowed side in pixels and
 *                largest allowed pixel count (positive integers)
 *
 * Returns a capped size { width, height, isDownscaled }: the size to use, in whole pixels ≥ 1,
 * and whether it is smaller than the input.
 * Throws RangeError if any argument is not a positive integer.
 */
export function capImageSize(width, height, limits) {
  assertPositiveInteger('width', width);
  assertPositiveInteger('height', height);
  assertPositiveInteger('maxSide', limits.maxSide);
  assertPositiveInteger('maxPixels', limits.maxPixels);

  const { maxSide, maxPixels } = limits;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  if (longSide <= maxSide && width * height <= maxPixels) {
    return { width, height, isDownscaled: false };
  }

  const areaScale = Math.sqrt(maxPixels / (width * height));
  let newLong = Math.min(maxSide, Math.floor(longSide * areaScale));
  let newShort = shortSideFor(newLong, longSide, shortSide);
  while (newLong > 1 && newLong * newShort > maxPixels) {
    newLong -= 1;
    newShort = shortSideFor(newLong, longSide, shortSide);
  }
  if (width >= height) {
    return { width: newLong, height: newShort, isDownscaled: true };
  }
  return { width: newShort, height: newLong, isDownscaled: true };
}

function shortSideFor(newLong, longSide, shortSide) {
  return Math.max(1, Math.round((shortSide * newLong) / longSide));
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer, got ${value}`);
  }
}

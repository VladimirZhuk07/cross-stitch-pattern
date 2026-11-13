// The stitch grid: how many stitches an image becomes, and the area averaging that turns
// image pixels into one color and coverage value per stitch.
// The authoritative description is openspec/specs/pattern-generation/spec.md.

// Neither side of a grid may exceed this many stitches: 500 × 500 = 250 000 cells keeps
// the worst-case generation time at a few seconds.
export const MAX_GRID_SIDE = 500;

// Size of a stitch grid for an image, in stitches. The width is the chosen target width;
// the height follows the image's aspect ratio, so the grid covers the whole image with
// (almost) square cells: height = round(targetWidth × imageHeight / imageWidth), at least 1.
// This is the alignment rule the viewer relies on (src/ui/viewer.js).
// imageWidth, imageHeight  size of the image the app works with (after the decode cap), px
// targetWidth              stitches per row, positive integer (may exceed the image width)
// Returns GridSize { width, height }. The height is NOT limited to MAX_GRID_SIDE; callers
// check it, so the UI can explain the problem. Throws RangeError for non-positive or
// non-integer arguments.
export function stitchGridSize(imageWidth, imageHeight, targetWidth) {
  checkImageSize(imageWidth, imageHeight);
  checkPositiveInteger('targetWidth', targetWidth);
  return { width: targetWidth, height: gridHeight(imageWidth, imageHeight, targetWidth) };
}

// The largest target width (at most MAX_GRID_SIDE) whose grid height is at most
// MAX_GRID_SIDE for an image of this size, or 0 if not even a width of 1 fits (an image
// 500.5 times taller than wide). Throws RangeError for invalid image sizes.
export function maxTargetWidth(imageWidth, imageHeight) {
  checkImageSize(imageWidth, imageHeight);
  // round(W × h / w) ≤ 500 exactly when W × h / w < 500.5; the loop guards against
  // floating-point error at the boundary.
  let width = Math.min(MAX_GRID_SIDE, Math.ceil(((MAX_GRID_SIDE + 0.5) * imageWidth) / imageHeight) - 1);
  while (width > 0 && gridHeight(imageWidth, imageHeight, width) > MAX_GRID_SIDE) {
    width -= 1;
  }
  return Math.max(0, width);
}

function gridHeight(imageWidth, imageHeight, targetWidth) {
  return Math.max(1, Math.round((targetWidth * imageHeight) / imageWidth));
}

function checkImageSize(imageWidth, imageHeight) {
  checkPositiveInteger('imageWidth', imageWidth);
  checkPositiveInteger('imageHeight', imageHeight);
}

function checkPositiveInteger(field, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${field} must be a positive integer, got ${String(value)}`);
  }
}

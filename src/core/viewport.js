// Viewport math for the shared view frame. Pure: no DOM, no canvas.
//
// Coordinates
//   World coordinates are pixels of the decoded (capped) image: the image covers
//   x 0…image width, y 0…image height. Screen coordinates are CSS pixels relative to the
//   frame's top-left corner.
//
// Shapes (plain objects; the pattern-viewer spec is authoritative)
//   Viewport    { scale, offsetX, offsetY }
//               scale   CSS px per image px, > 0 (1 = zoom 100 %)
//               offsetX, offsetY  screen position of the image's top-left corner, CSS px
//               A world point (x, y) is drawn at (offsetX + x · scale, offsetY + y · scale).
//   Size        { width, height }
//   Point       { x, y }
//   Rect        { x, y, width, height }
//   ZoomLimits  { minScale, maxScale }
//   Sizes, points and rectangles are in CSS px unless a function says otherwise.

/** Empty space kept around the image when it is fitted to the frame, in CSS px per side. */
export const FIT_MARGIN = 16;

/** Highest zoom in CSS px per image px (6400 %), unless fitting itself needs more. */
export const MAX_SCALE = 64;

/** How far out the user may zoom, as a fraction of the fit scale. */
const MIN_SCALE_OF_FIT = 0.5;

/** Smallest area left for the image when the frame is narrower than both margins, CSS px. */
const MIN_AVAILABLE = 1;

/**
 * Returns the viewport that shows the whole content as large as possible inside the frame,
 * keeping FIT_MARGIN CSS px free on each side, centered.
 * content  { width, height } of the image in image px (positive)
 * frame    { width, height } of the frame in CSS px (positive)
 * Throws RangeError if a size is not a positive number.
 */
export function fitViewport(content, frame) {
  assertPositiveSize('content', content);
  assertPositiveSize('frame', frame);

  const scale = fitScale(content, frame);
  return {
    scale,
    offsetX: (frame.width - content.width * scale) / 2,
    offsetY: (frame.height - content.height * scale) / 2,
  };
}

/**
 * Returns the allowed zoom range { minScale, maxScale } for this content in this frame:
 * from half the fit scale up to the larger of MAX_SCALE and the fit scale.
 * content, frame  as for fitViewport.
 * Throws RangeError if a size is not a positive number.
 */
export function zoomLimits(content, frame) {
  assertPositiveSize('content', content);
  assertPositiveSize('frame', frame);

  const fit = fitScale(content, frame);
  return { minScale: fit * MIN_SCALE_OF_FIT, maxScale: Math.max(MAX_SCALE, fit) };
}

function fitScale(content, frame) {
  const availableWidth = Math.max(MIN_AVAILABLE, frame.width - 2 * FIT_MARGIN);
  const availableHeight = Math.max(MIN_AVAILABLE, frame.height - 2 * FIT_MARGIN);
  return Math.min(availableWidth / content.width, availableHeight / content.height);
}

function assertPositiveSize(name, size) {
  assertPositiveNumber(`${name}.width`, size.width);
  assertPositiveNumber(`${name}.height`, size.height);
}

function assertPositiveNumber(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number, got ${value}`);
  }
}

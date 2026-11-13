// The stitch grid: how many stitches an image becomes, and the area averaging that turns
// image pixels into one color and coverage value per stitch.
// The authoritative description is openspec/specs/pattern-generation/spec.md.

import { srgbToLinear } from './color.js';

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

// A cell whose average alpha (0–1) is below this has no stitch: a stitch either exists or
// not, so a cell is stitched once at least half of its area is covered.
export const EMPTY_ALPHA_THRESHOLD = 0.5;

const MAX_BYTE = 255;
const CHANNELS = 4;

// Linear-light value of every sRGB byte, computed once instead of per pixel.
const LINEAR_OF_BYTE = buildLinearTable();

// Averages the pixels of an image into a stitch grid (area averaging, one cell = one stitch).
// image  pixel image { width, height, pixels }: pixels is a Uint8ClampedArray (or Uint8Array)
//        of width × height × 4 bytes, RGBA, row-major, sRGB, straight (not premultiplied)
//        alpha. Created by readImagePixels in src/io/image-pixels.js.
// size   GridSize { width, height } in stitches (see stitchGridSize).
// Cell (c, r) covers the image rectangle x from c × imageWidth / width to (c + 1) × imageWidth
// / width (and likewise for y); every pixel counts with the area it shares with the cell, so
// fractional pixels at cell edges count partly.
// Returns StitchGrid { width, height, linearRgb, alpha }:
//   linearRgb  Float64Array of 3 × width × height linear-light values 0–1 (r, g, b per cell,
//              row-major): the alpha-weighted mean, so the color of transparent pixels does
//              not tint the cell; 0 for a cell without any alpha.
//   alpha      Float64Array of width × height mean alpha values 0–1 over the cell area.
// Averaging happens in linear RGB because light mixes linearly; averaging sRGB values
// would make every mixed cell too dark.
// Does not modify the input. Throws TypeError if pixels is not a byte array, RangeError for
// invalid sizes or a pixel buffer whose length is not width × height × 4.
export function resizeToGrid(image, size) {
  checkPixelImage(image);
  checkPositiveInteger('grid width', size.width);
  checkPositiveInteger('grid height', size.height);
  const columnSpans = overlapSpans(image.width, size.width);
  const rowSpans = overlapSpans(image.height, size.height);
  const cellCount = size.width * size.height;
  const linearRgb = new Float64Array(cellCount * 3);
  const alpha = new Float64Array(cellCount);
  for (let row = 0; row < size.height; row++) {
    for (let column = 0; column < size.width; column++) {
      averageCell(image, rowSpans[row], columnSpans[column], row * size.width + column, linearRgb, alpha);
    }
  }
  return { width: size.width, height: size.height, linearRgb, alpha };
}

// Writes the averages of one cell into the output arrays linearRgbOut and alphaOut.
function averageCell(image, rowSpan, columnSpan, cell, linearRgbOut, alphaOut) {
  const { pixels, width: imageWidth } = image;
  let areaSum = 0;
  let alphaSum = 0;
  let red = 0;
  let green = 0;
  let blue = 0;
  for (let j = 0; j < rowSpan.weights.length; j++) {
    const rowStart = (rowSpan.first + j) * imageWidth;
    for (let i = 0; i < columnSpan.weights.length; i++) {
      const area = rowSpan.weights[j] * columnSpan.weights[i];
      const offset = (rowStart + columnSpan.first + i) * CHANNELS;
      const weight = area * (pixels[offset + 3] / MAX_BYTE);
      areaSum += area;
      alphaSum += weight;
      red += weight * LINEAR_OF_BYTE[pixels[offset]];
      green += weight * LINEAR_OF_BYTE[pixels[offset + 1]];
      blue += weight * LINEAR_OF_BYTE[pixels[offset + 2]];
    }
  }
  alphaOut[cell] = alphaSum / areaSum;
  if (alphaSum > 0) {
    linearRgbOut[cell * 3] = red / alphaSum;
    linearRgbOut[cell * 3 + 1] = green / alphaSum;
    linearRgbOut[cell * 3 + 2] = blue / alphaSum;
  }
}

// For each of cellCount cells along one axis of sourceSize pixels: the first pixel the cell
// touches and the length (in pixels, 0–1) of its overlap with each touched pixel.
// The same spans serve every row (or column), which keeps the averaging separable.
function overlapSpans(sourceSize, cellCount) {
  const spans = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const start = (cell * sourceSize) / cellCount;
    const end = ((cell + 1) * sourceSize) / cellCount;
    const first = Math.floor(start);
    const last = Math.min(sourceSize, Math.ceil(end)) - 1;
    const weights = new Float64Array(last - first + 1);
    for (let pixel = first; pixel <= last; pixel++) {
      weights[pixel - first] = Math.min(end, pixel + 1) - Math.max(start, pixel);
    }
    spans.push({ first, weights });
  }
  return spans;
}

function buildLinearTable() {
  const table = new Float64Array(MAX_BYTE + 1);
  for (let byte = 0; byte <= MAX_BYTE; byte++) {
    table[byte] = srgbToLinear(byte);
  }
  return table;
}

function checkPixelImage(image) {
  checkImageSize(image.width, image.height);
  const { pixels } = image;
  if (!(pixels instanceof Uint8ClampedArray || pixels instanceof Uint8Array)) {
    throw new TypeError(`pixels must be a Uint8ClampedArray or Uint8Array of RGBA bytes, got ${Object.prototype.toString.call(pixels)}`);
  }
  const expected = image.width * image.height * CHANNELS;
  if (pixels.length !== expected) {
    throw new RangeError(
      `pixels must have width × height × 4 = ${expected} bytes for a ${image.width} × ${image.height} image, got ${pixels.length}`,
    );
  }
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

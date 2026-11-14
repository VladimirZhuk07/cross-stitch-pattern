// The stitch grid: how many stitches an image becomes, and the area averaging that turns
// image pixels into one color and coverage value per stitch.
// The authoritative description is openspec/specs/pattern-generation/spec.md.

import { srgbToLinear } from './color.js';

// Neither side of a grid may exceed this many stitches. 10000 × 10000 = 100 M cells is the
// largest pattern generation can hold in a browser: the pipeline keeps about 4 bytes per
// cell (see ./pattern-generator.js), about 0.5 GB at this size.
export const MAX_GRID_SIDE = 10000;

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
// more than 10000.5 times taller than wide). Throws RangeError for invalid image sizes.
export function maxTargetWidth(imageWidth, imageHeight) {
  checkImageSize(imageWidth, imageHeight);
  // round(W × h / w) ≤ MAX_GRID_SIDE exactly when W × h / w < MAX_GRID_SIDE + 0.5; the loop guards against
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

// Prepares row-by-row area averaging of an image into a stitch grid (one cell = one stitch).
// image  pixel image { width, height, pixels }: pixels is a Uint8ClampedArray (or Uint8Array)
//        of width × height × 4 bytes, RGBA, row-major, sRGB, straight (not premultiplied)
//        alpha. Created by readImagePixels in src/io/image-pixels.js.
// size   GridSize { width, height } in stitches (see stitchGridSize).
// Cell (c, r) covers the image rectangle x from c × imageWidth / width to (c + 1) × imageWidth
// / width (and likewise for y); every pixel counts with the area it shares with the cell, so
// fractional pixels at cell edges count partly.
// Returns averageRow(row, out): writes the cell averages of grid row `row` (0-based) into
// `out`, a Float64Array of at least 4 × size.width numbers owned by the caller, and returns
// nothing. Per cell in turn:
//   linear r, g, b  0–1, the alpha-weighted mean, so the color of transparent pixels does not
//                   tint the cell; 0 for a cell without any alpha
//   alpha           0–1, the mean alpha over the cell area
// Rows may be averaged in any order and as often as needed; nothing per cell is kept, so the
// memory used is independent of the grid height (a column accumulator of 4 × image width).
// Averaging happens in linear RGB because light mixes linearly; averaging sRGB values
// would make every mixed cell too dark.
// Does not modify the image. Throws TypeError if pixels is not a byte array, RangeError for
// invalid sizes or a pixel buffer whose length is not width × height × 4.
export function createGridAverager(image, size) {
  checkPixelImage(image);
  checkPositiveInteger('grid width', size.width);
  checkPositiveInteger('grid height', size.height);
  const columnSpans = overlapSpans(image.width, size.width);
  const rowSpans = overlapSpans(image.height, size.height);
  const columnSums = new Float64Array(image.width * CHANNELS);

  return function averageRow(row, out) {
    sumRowSpanPerColumn(image, rowSpans, row, columnSums);
    const rowExtent = rowSpans.extent[row];
    for (let column = 0; column < size.width; column++) {
      averageCellFromColumns(columnSums, columnSpans, column, rowExtent, out);
    }
  };
}

// The separable first step: for every image column, the sums over the source rows that grid
// row `row` overlaps, each pixel weighted by its row overlap and its alpha. Writes
// columnSumsOut as alpha-weighted linear r, g, b and the weighted alpha per column.
function sumRowSpanPerColumn(image, rowSpans, row, columnSumsOut) {
  const { pixels, width: imageWidth } = image;
  columnSumsOut.fill(0);
  const first = rowSpans.first[row];
  const start = rowSpans.offset[row];
  const end = rowSpans.offset[row + 1];
  for (let j = start; j < end; j++) {
    const rowWeight = rowSpans.weights[j];
    let offset = (first + j - start) * imageWidth * CHANNELS;
    for (let x = 0; x < imageWidth; x++, offset += CHANNELS) {
      const weight = rowWeight * (pixels[offset + 3] / MAX_BYTE);
      const sum = x * CHANNELS;
      columnSumsOut[sum] += weight * LINEAR_OF_BYTE[pixels[offset]];
      columnSumsOut[sum + 1] += weight * LINEAR_OF_BYTE[pixels[offset + 1]];
      columnSumsOut[sum + 2] += weight * LINEAR_OF_BYTE[pixels[offset + 2]];
      columnSumsOut[sum + 3] += weight;
    }
  }
}

// The second step: combines the column sums a cell overlaps and writes its 4 averages to out.
function averageCellFromColumns(columnSums, columnSpans, column, rowExtent, out) {
  const first = columnSpans.first[column];
  const start = columnSpans.offset[column];
  const end = columnSpans.offset[column + 1];
  let red = 0;
  let green = 0;
  let blue = 0;
  let alphaSum = 0;
  for (let i = start; i < end; i++) {
    const columnWeight = columnSpans.weights[i];
    const sum = (first + i - start) * CHANNELS;
    red += columnWeight * columnSums[sum];
    green += columnWeight * columnSums[sum + 1];
    blue += columnWeight * columnSums[sum + 2];
    alphaSum += columnWeight * columnSums[sum + 3];
  }
  const cell = column * CHANNELS;
  out[cell + 3] = alphaSum / (rowExtent * columnSpans.extent[column]);
  if (alphaSum > 0) {
    out[cell] = red / alphaSum;
    out[cell + 1] = green / alphaSum;
    out[cell + 2] = blue / alphaSum;
    return;
  }
  out[cell] = 0;
  out[cell + 1] = 0;
  out[cell + 2] = 0;
}

// For each of cellCount cells along one axis of sourceSize pixels: the first pixel it touches
// (first[cell]), the lengths of its overlap with each touched pixel (weights[offset[cell]] to
// weights[offset[cell + 1] − 1], in pixels, 0–1) and their sum, the cell's extent (extent[cell]).
// Flat typed arrays instead of one object per cell keep 10000 cells cheap.
function overlapSpans(sourceSize, cellCount) {
  const first = new Int32Array(cellCount);
  const offset = new Int32Array(cellCount + 1);
  const extent = new Float64Array(cellCount);
  const weights = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const start = (cell * sourceSize) / cellCount;
    const end = ((cell + 1) * sourceSize) / cellCount;
    const firstPixel = Math.floor(start);
    const lastPixel = Math.min(sourceSize, Math.ceil(end)) - 1;
    first[cell] = firstPixel;
    offset[cell] = weights.length;
    let cellExtent = 0;
    for (let pixel = firstPixel; pixel <= lastPixel; pixel++) {
      const weight = Math.min(end, pixel + 1) - Math.max(start, pixel);
      weights.push(weight);
      cellExtent += weight;
    }
    extent[cell] = cellExtent;
  }
  offset[cellCount] = weights.length;
  return { first, offset, extent, weights: Float64Array.from(weights) };
}

function buildLinearTable() {
  const table = new Float64Array(MAX_BYTE + 1);
  for (let byte = 0; byte <= MAX_BYTE; byte++) {
    table[byte] = srgbToLinear(byte);
  }
  return table;
}

// Checks that image is a pixel image as described at createGridAverager: positive integer width
// and height, and a Uint8ClampedArray or Uint8Array of exactly width × height × 4 bytes.
// Returns nothing. Throws TypeError for a missing image or pixels that are not a byte array,
// RangeError for invalid sizes or a buffer of the wrong length.
export function checkPixelImage(image) {
  if (image === null || typeof image !== 'object') {
    throw new TypeError(`image must be a pixel image { width, height, pixels }, got ${String(image)}`);
  }
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

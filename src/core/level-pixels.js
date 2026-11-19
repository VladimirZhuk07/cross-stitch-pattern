// Pixels of the pictures the DMC colors and Chart layers draw from: one pixel per stitch at
// level 0, one averaged pixel per 2^k × 2^k block of stitches at level k (see
// ./tile-pyramid.js). Pure: no DOM, no canvas. The authoritative description is
// openspec/specs/large-pattern-rendering/spec.md ("Level pixels average their stitches").

import { hexToRgb } from './color.js';
import { EMPTY_CELL } from './pattern.js';
import { levelSize } from './tile-pyramid.js';

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;

// ColorTable, created here:
//   a Uint8ClampedArray of (number of colors + 1) × 4 bytes, RGBA. Entry 0 is the color of
//   empty cells; entry i + 1 is legend color i. A cell value v (EMPTY_CELL = −1 or a legend
//   index 0 … N − 1) is therefore found at byte (v − EMPTY_CELL) × 4 = (v + 1) × 4, with no
//   branch for empty cells.

/**
 * Returns the ColorTable for a list of legend colors.
 * hexes     '#RRGGBB' per legend entry in legend order, any letter case (e.g. the legend hex
 *           for the DMC colors layer, its pale tint for the Chart layer)
 * emptyHex  '#RRGGBB' for empty cells (opaque), or null for fully transparent empty cells
 * Throws (from hexToRgb) if a color is malformed.
 */
export function colorTable(hexes, emptyHex) {
  const table = new Uint8ClampedArray((hexes.length + 1) * BYTES_PER_PIXEL);
  if (emptyHex !== null) {
    writeOpaque(table, 0, emptyHex);
  }
  for (let i = 0; i < hexes.length; i++) {
    writeOpaque(table, (i + 1) * BYTES_PER_PIXEL, hexes[i]);
  }
  return table;
}

/**
 * Writes rows rowStart … rowEnd − 1 of a region of the level-`level` picture of a pattern into
 * `out` (written in place, other rows untouched) and returns the number of stitches read.
 * A level-0 pixel is its stitch's table color. A level-k pixel averages the stitches of its
 * 2^k × 2^k block that lie inside the pattern (exact box average, design D4): alpha is the
 * mean alpha, and red, green and blue are weighted by alpha (premultiplied), so transparent
 * empty cells thin a block out instead of darkening it; a block without opaque stitches is
 * 0, 0, 0, 0. Averages are of the stored 8-bit sRGB values, like the browser's own smoothed
 * downscaling, rounded to the nearest integer (halves up).
 * grid      a Pattern (./pattern.js): width, height, row-major cells (legend index or −1)
 * table     ColorTable from colorTable
 * level     detail level, integer ≥ 0
 * region    { x, y, width, height } in picture px of that level (a TileRegion of
 *           ./tile-pyramid.js), inside the level picture
 * rowStart, rowEnd  region rows to fill, 0 ≤ rowStart ≤ rowEnd ≤ region.height
 * out       Uint8ClampedArray of region.width × region.height × 4 bytes (an ImageData.data)
 * Throws RangeError for an invalid level, a region outside the level, rows outside the region,
 * or an `out` of the wrong length.
 */
export function fillLevelRows(grid, table, level, region, rowStart, rowEnd, out) {
  assertFillInput(grid, level, region, rowStart, rowEnd, out);
  if (level === 0) {
    return copyStitchRows(grid, table, region, rowStart, rowEnd, out);
  }
  const blockSide = 2 ** level;
  const weighted = premultipliedTable(table);
  // Per output pixel of one row: premultiplied red, green, blue and alpha sums.
  const sums = new Float64Array(region.width * 4);
  const firstColumn = region.x * blockSide;
  const endColumn = Math.min(grid.width, (region.x + region.width) * blockSide);
  let read = 0;
  for (let row = rowStart; row < rowEnd; row++) {
    sums.fill(0);
    const firstCellRow = (region.y + row) * blockSide;
    const endCellRow = Math.min(grid.height, firstCellRow + blockSide);
    // Walk the band of stitch rows in memory order, one block-wide segment per pixel.
    for (let cellRow = firstCellRow; cellRow < endCellRow; cellRow++) {
      addRowSegments(grid.cells, cellRow * grid.width, firstColumn, endColumn, blockSide, weighted, sums);
    }
    const bandRows = endCellRow - firstCellRow;
    read += bandRows * (endColumn - firstColumn);
    writeAveragedRow(sums, bandRows, firstColumn, endColumn, blockSide, out, row * region.width * BYTES_PER_PIXEL);
  }
  return read;
}

// Adds the stitches firstColumn … endColumn − 1 of one stitch row to the sums of their pixels.
// Hot loop: local accumulators per block-wide segment, no division or allocation per stitch.
function addRowSegments(cells, rowOffset, firstColumn, endColumn, blockSide, weighted, sums) {
  let pixel = 0;
  let segmentStart = rowOffset + firstColumn;
  const rowEnd = rowOffset + endColumn;
  while (segmentStart < rowEnd) {
    const segmentEnd = segmentStart + blockSide < rowEnd ? segmentStart + blockSide : rowEnd;
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    for (let index = segmentStart; index < segmentEnd; index++) {
      const entry = (cells[index] - EMPTY_CELL) << 2;
      red += weighted[entry];
      green += weighted[entry + 1];
      blue += weighted[entry + 2];
      alpha += weighted[entry + 3];
    }
    sums[pixel] += red;
    sums[pixel + 1] += green;
    sums[pixel + 2] += blue;
    sums[pixel + 3] += alpha;
    pixel += 4;
    segmentStart = segmentEnd;
  }
}

// The ColorTable with red, green and blue multiplied by alpha, for opacity-weighted sums.
function premultipliedTable(table) {
  const weighted = new Float64Array(table.length);
  for (let entry = 0; entry < table.length; entry += BYTES_PER_PIXEL) {
    const alpha = table[entry + 3];
    weighted[entry] = table[entry] * alpha;
    weighted[entry + 1] = table[entry + 1] * alpha;
    weighted[entry + 2] = table[entry + 2] * alpha;
    weighted[entry + 3] = alpha;
  }
  return weighted;
}

// Level 0: one stitch per pixel, so each pixel is a straight copy of its table entry, done
// four bytes at a time through 32-bit views of the same memory (byte order does not matter:
// both views read and write the same bytes). ImageData.data always starts on a 4-byte boundary.
function copyStitchRows(grid, table, region, rowStart, rowEnd, out) {
  const colors = new Uint32Array(table.buffer, table.byteOffset, table.length / BYTES_PER_PIXEL);
  const pixels = new Uint32Array(out.buffer, out.byteOffset, out.length / BYTES_PER_PIXEL);
  for (let row = rowStart; row < rowEnd; row++) {
    const cellOffset = (region.y + row) * grid.width + region.x;
    const pixelOffset = row * region.width;
    for (let column = 0; column < region.width; column++) {
      pixels[pixelOffset + column] = colors[grid.cells[cellOffset + column] - EMPTY_CELL];
    }
  }
  return (rowEnd - rowStart) * region.width;
}

// Turns one row of sums into averaged RGBA pixels; a block's stitch count is its width
// (clipped at the pattern's right edge) times the rows of the band.
function writeAveragedRow(sums, bandRows, firstColumn, endColumn, blockSide, out, rowOffset) {
  let offset = rowOffset;
  let pixel = 0;
  for (let segmentStart = firstColumn; segmentStart < endColumn; segmentStart += blockSide) {
    const stitchCount = (Math.min(endColumn, segmentStart + blockSide) - segmentStart) * bandRows;
    const alphaSum = sums[pixel + 3];
    if (alphaSum === 0) {
      out[offset] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
      out[offset + 3] = 0;
    } else {
      // Rounded here (half up) so the stores are plain integers, much faster than letting
      // the Uint8ClampedArray round fractional values.
      const toColor = 1 / alphaSum;
      out[offset] = Math.round(sums[pixel] * toColor);
      out[offset + 1] = Math.round(sums[pixel + 1] * toColor);
      out[offset + 2] = Math.round(sums[pixel + 2] * toColor);
      out[offset + 3] = Math.round(alphaSum / stitchCount);
    }
    offset += BYTES_PER_PIXEL;
    pixel += 4;
  }
}

/**
 * Checks the input of a level-picture filler (fillLevelRows, or fillHighlightRows in
 * ./highlight.js): the level is valid for the grid, region lies inside the level picture,
 * 0 ≤ rowStart ≤ rowEnd ≤ region.height, and out has region.width × region.height × 4 bytes.
 * Throws RangeError naming the wrong value.
 */
export function assertFillInput(grid, level, region, rowStart, rowEnd, out) {
  const size = levelSize(grid, level);
  const isInside = Number.isInteger(region.x) && Number.isInteger(region.y)
    && Number.isInteger(region.width) && Number.isInteger(region.height)
    && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0
    && region.x + region.width <= size.width && region.y + region.height <= size.height;
  if (!isInside) {
    throw new RangeError(
      `region (${region.x}, ${region.y}, ${region.width} × ${region.height}) is outside the level-${level} picture of ${size.width} × ${size.height}`,
    );
  }
  if (!Number.isInteger(rowStart) || !Number.isInteger(rowEnd) || rowStart < 0 || rowStart > rowEnd || rowEnd > region.height) {
    throw new RangeError(`rowStart … rowEnd must lie in 0 … ${region.height}, got rowStart ${rowStart}, rowEnd ${rowEnd}`);
  }
  const expectedLength = region.width * region.height * BYTES_PER_PIXEL;
  if (out.length !== expectedLength) {
    throw new RangeError(`out must have ${expectedLength} bytes, got ${out.length}`);
  }
}

function writeOpaque(table, offset, hex) {
  const { r, g, b } = hexToRgb(hex);
  table[offset] = r;
  table[offset + 1] = g;
  table[offset + 2] = b;
  table[offset + 3] = OPAQUE;
}

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
 * downscaling, and are rounded by the Uint8ClampedArray.
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
  // Per output pixel of one row: premultiplied red, green, blue, alpha sums and stitch count.
  const sums = new Float64Array(region.width * 4);
  const counts = new Float64Array(region.width);
  const firstColumn = region.x * blockSide;
  const endColumn = Math.min(grid.width, (region.x + region.width) * blockSide);
  let read = 0;
  for (let row = rowStart; row < rowEnd; row++) {
    sums.fill(0);
    counts.fill(0);
    const firstCellRow = (region.y + row) * blockSide;
    const endCellRow = Math.min(grid.height, firstCellRow + blockSide);
    // Walk the block band row by row in memory order; each stitch adds to its pixel's sums.
    for (let cellRow = firstCellRow; cellRow < endCellRow; cellRow++) {
      const rowOffset = cellRow * grid.width;
      for (let cellColumn = firstColumn; cellColumn < endColumn; cellColumn++) {
        const color = (grid.cells[rowOffset + cellColumn] - EMPTY_CELL) * BYTES_PER_PIXEL;
        const pixel = Math.floor((cellColumn - firstColumn) / blockSide);
        const alpha = table[color + 3];
        sums[pixel * 4] += table[color] * alpha;
        sums[pixel * 4 + 1] += table[color + 1] * alpha;
        sums[pixel * 4 + 2] += table[color + 2] * alpha;
        sums[pixel * 4 + 3] += alpha;
        counts[pixel] += 1;
      }
    }
    read += (endCellRow - firstCellRow) * (endColumn - firstColumn);
    writeAveragedRow(sums, counts, out, row * region.width * BYTES_PER_PIXEL);
  }
  return read;
}

// Level 0: one stitch per pixel, so each pixel is a straight copy of its table entry.
function copyStitchRows(grid, table, region, rowStart, rowEnd, out) {
  for (let row = rowStart; row < rowEnd; row++) {
    const cellOffset = (region.y + row) * grid.width + region.x;
    let offset = row * region.width * BYTES_PER_PIXEL;
    for (let column = 0; column < region.width; column++) {
      const color = (grid.cells[cellOffset + column] - EMPTY_CELL) * BYTES_PER_PIXEL;
      out[offset] = table[color];
      out[offset + 1] = table[color + 1];
      out[offset + 2] = table[color + 2];
      out[offset + 3] = table[color + 3];
      offset += BYTES_PER_PIXEL;
    }
  }
  return (rowEnd - rowStart) * region.width;
}

function writeAveragedRow(sums, counts, out, rowOffset) {
  for (let pixel = 0; pixel < counts.length; pixel++) {
    const offset = rowOffset + pixel * BYTES_PER_PIXEL;
    const alphaSum = sums[pixel * 4 + 3];
    if (alphaSum === 0) {
      out[offset] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
      out[offset + 3] = 0;
      continue;
    }
    out[offset] = sums[pixel * 4] / alphaSum;
    out[offset + 1] = sums[pixel * 4 + 1] / alphaSum;
    out[offset + 2] = sums[pixel * 4 + 2] / alphaSum;
    out[offset + 3] = alphaSum / counts[pixel];
  }
}

function assertFillInput(grid, level, region, rowStart, rowEnd, out) {
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

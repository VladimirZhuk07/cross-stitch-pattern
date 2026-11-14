// Pixels of the pictures the DMC colors and Chart layers draw from: one pixel per stitch at
// level 0, one averaged pixel per 2^k × 2^k block of stitches at level k (see
// ./tile-pyramid.js). Pure: no DOM, no canvas. The authoritative description is
// openspec/specs/large-pattern-rendering/spec.md ("Level pixels average their stitches").

import { hexToRgb } from './color.js';

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;

// ColorTable, created here:
//   a Uint8ClampedArray of (number of colors + 1) × 4 bytes, RGBA. Entry 0 is the color of
//   empty cells; entry i + 1 is legend color i. A cell value v (EMPTY_CELL = −1 or a legend
//   index 0 … N − 1) is therefore found at byte (v + 1) × 4, with no branch for empty cells.

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

function writeOpaque(table, offset, hex) {
  const { r, g, b } = hexToRgb(hex);
  table[offset] = r;
  table[offset + 1] = g;
  table[offset + 2] = b;
  table[offset + 3] = OPAQUE;
}

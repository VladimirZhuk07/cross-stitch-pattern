// Highlighting the cells of one legend color on the chart. Pure: no DOM, no canvas.
// The authoritative description is openspec/specs/stitch-chart/spec.md ("One legend color can
// be selected", "Highlighted cells are red with white numbers", "Highlighted stitches stay
// visible at every zoom"); the choices are explained in design D2 of add-legend-highlight.

import { hexToRgb } from './color.js';
import { assertFillInput } from './level-pixels.js';
import { assertLevelInput } from './tile-pyramid.js';

/**
 * Fill of highlighted cells. White text on it has a WCAG contrast of 7.4:1, and it has at least
 * 3.4:1 against every pale chart tint (the tints keep relative luminance ≥ 0.436, see
 * ./chart-tint.js). #C00000 would reach only 3.0:1 against the darkest tint.
 */
export const HIGHLIGHT_COLOR = '#B00000';

/** Numbers in highlighted cells: white, drawn bold. */
export const HIGHLIGHT_NUMBER_COLOR = '#FFFFFF';

/**
 * The selection after the user chooses a legend color.
 * current      the selected legend index, or null for none
 * legendIndex  the legend index that was chosen, integer ≥ 0
 * Returns null when legendIndex is already selected (choosing it again clears the selection),
 * otherwise legendIndex. Throws RangeError when legendIndex is not an integer ≥ 0.
 */
export function toggleHighlight(current, legendIndex) {
  if (!Number.isInteger(legendIndex) || legendIndex < 0) {
    throw new RangeError(`legendIndex must be an integer ≥ 0, got ${String(legendIndex)}`);
  }
  return current === legendIndex ? null : legendIndex;
}

/**
 * Largest side, in px, of a highlight picture that is drawn whole (the overview). Smaller than
 * the 2048 of the cell pictures: an overview of at most 256 px keeps its pixels at least one
 * device pixel wide in any frame of 256 device px or more, so it never needs smoothing.
 */
export const HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE = 256;

/** Memory for built highlight tiles (visible tiles are kept even beyond it). */
export const HIGHLIGHT_CACHE_BUDGET_BYTES = 16 * 1024 * 1024;

/**
 * The pyramid level whose pictures the highlight is drawn from at a zoom.
 * devicePxPerStitch  on-screen size of a stitch in device px, > 0
 * maxLevel           the overview level, integer ≥ 0
 * Returns min(maxLevel, max(0, ceil(log2(1 / devicePxPerStitch)))). Rounding up (where the
 * cell pictures round to the nearest level) makes one picture pixel cover 1 to under 2 device
 * px, so drawn without smoothing every highlighted block shows at full strength.
 * Throws RangeError for a stitch size that is not a positive number or an invalid maxLevel.
 */
export function highlightLevel(devicePxPerStitch, maxLevel) {
  assertLevelInput(devicePxPerStitch, maxLevel);
  const level = Math.ceil(Math.log2(1 / devicePxPerStitch));
  return Math.min(maxLevel, Math.max(0, level));
}

const BYTES_PER_PIXEL = 4;
const OPAQUE = 255;

/**
 * Writes rows rowStart … rowEnd − 1 of a region of the level-`level` highlight picture of a
 * pattern into `out` (written in place, other rows untouched) and returns the number of
 * stitches read. A pixel is opaque HIGHLIGHT_COLOR when any stitch of its 2^level × 2^level
 * block (inside the pattern) has legendIndex, and 0, 0, 0, 0 otherwise: unlike the averaged
 * cell pictures (./level-pixels.js), a single highlighted stitch is never thinned out. The
 * returned count is the stitches covered by the rows, as fillLevelRows counts them, so both
 * share one build budget; a block is actually scanned only up to its first match.
 * grid         a Pattern (./pattern.js): width, height, row-major cells
 * legendIndex  the highlighted legend index (an index not in the pattern highlights nothing)
 * level, region, rowStart, rowEnd, out  as for fillLevelRows in ./level-pixels.js
 * Throws RangeError for an invalid level, a region outside the level, rows outside the region,
 * or an `out` of the wrong length.
 */
export function fillHighlightRows(grid, legendIndex, level, region, rowStart, rowEnd, out) {
  assertFillInput(grid, level, region, rowStart, rowEnd, out);
  const { r, g, b } = hexToRgb(HIGHLIGHT_COLOR);
  const blockSide = 2 ** level;
  let read = 0;
  for (let row = rowStart; row < rowEnd; row++) {
    const firstCellRow = (region.y + row) * blockSide;
    const endCellRow = Math.min(grid.height, firstCellRow + blockSide);
    let offset = row * region.width * BYTES_PER_PIXEL;
    for (let column = 0; column < region.width; column++) {
      const firstCellColumn = (region.x + column) * blockSide;
      const endCellColumn = Math.min(grid.width, firstCellColumn + blockSide);
      const isFound = blockHasIndex(grid, legendIndex, firstCellRow, endCellRow, firstCellColumn, endCellColumn);
      out[offset] = isFound ? r : 0;
      out[offset + 1] = isFound ? g : 0;
      out[offset + 2] = isFound ? b : 0;
      out[offset + 3] = isFound ? OPAQUE : 0;
      offset += BYTES_PER_PIXEL;
    }
    const firstColumn = region.x * blockSide;
    read += (endCellRow - firstCellRow) * (Math.min(grid.width, (region.x + region.width) * blockSide) - firstColumn);
  }
  return read;
}

// True when a stitch of one block (rows firstRow … endRow − 1, columns firstColumn …
// endColumn − 1) has legendIndex; stops at the first match. Hot loop: no allocation.
function blockHasIndex(grid, legendIndex, firstRow, endRow, firstColumn, endColumn) {
  for (let row = firstRow; row < endRow; row++) {
    const rowOffset = row * grid.width;
    for (let cell = rowOffset + firstColumn; cell < rowOffset + endColumn; cell++) {
      if (grid.cells[cell] === legendIndex) {
        return true;
      }
    }
  }
  return false;
}

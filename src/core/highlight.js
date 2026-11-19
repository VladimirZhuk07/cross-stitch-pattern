// Highlighting the cells of one legend color on the chart. Pure: no DOM, no canvas.
// The authoritative description is openspec/specs/stitch-chart/spec.md ("One legend color can
// be selected", "Highlighted cells are red with white numbers", "Highlighted stitches stay
// visible at every zoom"); the choices are explained in design D2 of add-legend-highlight.

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

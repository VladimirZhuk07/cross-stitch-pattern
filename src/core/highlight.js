// Highlighting the cells of one legend color on the chart. Pure: no DOM, no canvas.
// The authoritative description is openspec/specs/stitch-chart/spec.md ("One legend color can
// be selected", "Highlighted cells are red with white numbers", "Highlighted stitches stay
// visible at every zoom"); the choices are explained in design D2 of add-legend-highlight.

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

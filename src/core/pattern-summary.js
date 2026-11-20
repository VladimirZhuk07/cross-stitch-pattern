// The facts about a pattern that the exports show on their summary page or sheet. Pure.

const COUNT_FORMAT = new Intl.NumberFormat('en-US');

/**
 * A Pattern's summary: { width, height, totalStitches, colorCount } — size in stitches, the
 * number of stitched cells, and the number of legend colors.
 */
export function summarizePattern(pattern) {
  let totalStitches = 0;
  for (const entry of pattern.legend) {
    totalStitches += entry.stitchCount;
  }
  return { width: pattern.width, height: pattern.height, totalStitches, colorCount: pattern.legend.length };
}

/**
 * The summary as [label, value] text pairs in display order, e.g.
 * [['Size', '100 × 67 stitches'], ['Stitches', '6,700'], ['Colors', '21 DMC colors']]
 * ('1 DMC color' for one color).
 */
export function summaryLines(summary) {
  const colors = summary.colorCount === 1 ? '1 DMC color' : `${COUNT_FORMAT.format(summary.colorCount)} DMC colors`;
  return [
    ['Size', `${COUNT_FORMAT.format(summary.width)} × ${COUNT_FORMAT.format(summary.height)} stitches`],
    ['Stitches', COUNT_FORMAT.format(summary.totalStitches)],
    ['Colors', colors],
  ];
}

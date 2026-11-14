// Turns a pattern's legend into the texts shown in the legend panel. Pure: no DOM.
// The authoritative description is openspec/specs/stitch-chart/spec.md.

import { paleTint } from './chart-tint.js';

// The UI is in English; a fixed locale keeps the output the same in every browser.
const STITCH_COUNT_FORMAT = new Intl.NumberFormat('en-US');

// Returns one LegendRow per legend entry of a Pattern (see ./pattern.js), in number order.
// LegendRow, all fields strings, to be inserted as text (never as markup):
//   number       the legend number as printed in the chart cells, '1'..'489'.
//   code, name   DMC code and name, unchanged.
//   hex          '#RRGGBB', for the swatch.
//   tint         '#RRGGBB', the pale tint the chart fills this color's cells with
//                (see ./chart-tint.js), for the number box.
//   stitchCount  the stitch count with thousands separators, e.g. '12,345'.
// Returns an empty list for a pattern without stitches. Does not modify the pattern.
export function legendRows(pattern) {
  const rows = [];
  for (const entry of pattern.legend) {
    rows.push({
      number: String(entry.number),
      code: entry.code,
      name: entry.name,
      hex: entry.hex,
      tint: paleTint(entry.hex),
      stitchCount: STITCH_COUNT_FORMAT.format(entry.stitchCount),
    });
  }
  return rows;
}

// Short text for the collapsed Legend button on phones: '18 colors', '1 color', or
// 'no stitches' for a pattern without stitches. colorCount is the number of legend entries.
// Throws RangeError for a count that is not a whole number of at least 0.
export function formatLegendSummary(colorCount) {
  if (!Number.isInteger(colorCount) || colorCount < 0) {
    throw new RangeError(`colorCount must be a whole number of at least 0, got ${String(colorCount)}`);
  }
  if (colorCount === 0) {
    return 'no stitches';
  }
  return colorCount === 1 ? '1 color' : `${colorCount} colors`;
}

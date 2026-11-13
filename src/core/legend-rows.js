// Turns a pattern's legend into the texts shown in the legend panel. Pure: no DOM.
// The authoritative description is openspec/specs/stitch-chart/spec.md.

// The UI is in English; a fixed locale keeps the output the same in every browser.
const STITCH_COUNT_FORMAT = new Intl.NumberFormat('en-US');

// Returns one LegendRow per legend entry of a Pattern (see ./pattern.js), in number order.
// LegendRow, all fields strings, to be inserted as text (never as markup):
//   number       the legend number as printed in the chart cells, '1'..'99'.
//   code, name   DMC code and name, unchanged.
//   hex          '#RRGGBB', for the swatch.
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
      stitchCount: STITCH_COUNT_FORMAT.format(entry.stitchCount),
    });
  }
  return rows;
}

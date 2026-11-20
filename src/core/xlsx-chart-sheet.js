// The Chart worksheet (xl/worksheets/sheet1.xml): one square cell per stitch holding its legend
// number. Pure. Written as a generator of text chunks, because at the 1,000,000-cell cap the
// sheet is about 34 MB of XML and should never become one string. Design D5–D6 of
// add-excel-export; element order follows CT_Worksheet (ECMA-376 Part 1, §18.3.1.99).

import { EMPTY_CELL } from './pattern.js';
import { XML_DECLARATION, SPREADSHEETML_NAMESPACE, WORKSHEET_PAGE_MARGINS, columnName } from './xml.js';

// 24 px with Calibri 11 at 96 dpi: trunc((2.714 × 7 + 5) / 7 × 256) / 256 = 877 / 256 (design D5).
export const CHART_COLUMN_WIDTH = '3.42578125';
// 18 pt = 24 px at 96 dpi.
export const CHART_ROW_HEIGHT_PT = 18;

// Rows are yielded in batches of at least this many characters: few enough chunks to keep the
// per-chunk cost low, small enough that no chunk grows large.
const MIN_BATCH_CHARACTERS = 65_536;

/**
 * Yields the XML of the Chart sheet of pattern (a Pattern, see ./pattern.js) in chunks: the
 * head (up to <sheetData>), batches of whole rows, then the tail. Joined they form the part.
 * Pattern cell (x, y) is the cell in column x + 1, row y + 1: its legend number as a numeric
 * value, or no value for an empty cell, styled with styles.chartCellStyle (./xlsx-styles.js).
 * Throws RangeError (from columnName) for a pattern wider than 16,384 stitches.
 */
export function* chartSheetXml(pattern, styles) {
  const { width, height, cells } = pattern;
  const columnNames = [];
  for (let x = 0; x < width; x++) {
    columnNames.push(columnName(x + 1));
  }
  yield `${XML_DECLARATION}<worksheet xmlns="${SPREADSHEETML_NAMESPACE}">`
    + `<dimension ref="A1:${columnNames[width - 1]}${height}"/>`
    + '<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>'
    + `<sheetFormatPr defaultRowHeight="${CHART_ROW_HEIGHT_PT}" customHeight="1"/>`
    + `<cols><col min="1" max="${width}" width="${CHART_COLUMN_WIDTH}" customWidth="1"/></cols>`
    + '<sheetData>';

  let batch = '';
  for (let y = 0; y < height; y++) {
    const rowNumber = y + 1;
    batch += `<row r="${rowNumber}" ht="${CHART_ROW_HEIGHT_PT}" customHeight="1">`;
    for (let x = 0; x < width; x++) {
      const legendIndex = cells[y * width + x];
      const reference = `${columnNames[x]}${rowNumber}`;
      const style = styles.chartCellStyle(legendIndex, x, y, width, height);
      batch += legendIndex === EMPTY_CELL
        ? `<c r="${reference}" s="${style}"/>`
        : `<c r="${reference}" s="${style}"><v>${legendIndex + 1}</v></c>`;
    }
    batch += '</row>';
    if (batch.length >= MIN_BATCH_CHARACTERS) {
      yield batch;
      batch = '';
    }
  }
  if (batch !== '') {
    yield batch;
  }
  yield `</sheetData>${WORKSHEET_PAGE_MARGINS}</worksheet>`;
}

// The Legend worksheet (xl/worksheets/sheet3.xml): one row per DMC color with its number, a
// swatch, code, name and stitch count. Pure. Design D8 of add-excel-export.

import { BOLD_STYLE, COUNT_STYLE } from './xlsx-styles.js';
import { XML_DECLARATION, SPREADSHEETML_NAMESPACE, WORKSHEET_PAGE_MARGINS, inlineStringCell } from './xml.js';

const HEADERS = ['No.', 'Color', 'DMC', 'Name', 'Stitches'];
// Characters per column; D fits the longest DMC name (29 characters).
const COLUMN_WIDTHS = [6, 8, 9, 32, 12];

/**
 * The Legend sheet's XML for pattern (a Pattern, see ./pattern.js), styled with styles
 * (WorkbookStyles from ./xlsx-styles.js). Row 1 holds the bold headers; row i + 2 holds legend
 * entry i. Codes stay text ('310', 'B5200'), and Excel's "number stored as text" warning is
 * turned off for them.
 */
export function legendSheetXml(pattern, styles) {
  const rows = [`<row r="1">${HEADERS.map((text, index) => inlineStringCell(`${'ABCDE'[index]}1`, text, BOLD_STYLE)).join('')}</row>`];
  pattern.legend.forEach((entry, legendIndex) => {
    const row = legendIndex + 2;
    rows.push(`<row r="${row}">`
      + `<c r="A${row}" s="${styles.legendNumberStyle(legendIndex)}"><v>${entry.number}</v></c>`
      + `<c r="B${row}" s="${styles.swatchStyle(legendIndex)}"/>`
      + inlineStringCell(`C${row}`, entry.code)
      + inlineStringCell(`D${row}`, entry.name)
      + `<c r="E${row}" s="${COUNT_STYLE}"><v>${entry.stitchCount}</v></c>`
      + '</row>');
  });
  const lastRow = pattern.legend.length + 1;
  const columns = COLUMN_WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`);
  // An empty sqref would be invalid, so the element is left out without colors.
  const ignoredErrors = pattern.legend.length === 0
    ? ''
    : `<ignoredErrors><ignoredError sqref="C2:C${lastRow}" numberStoredAsText="1"/></ignoredErrors>`;
  return `${XML_DECLARATION}<worksheet xmlns="${SPREADSHEETML_NAMESPACE}">`
    + `<dimension ref="A1:E${lastRow}"/>`
    + '<sheetViews><sheetView workbookViewId="0"/></sheetViews>'
    + '<sheetFormatPr defaultRowHeight="15"/>'
    + `<cols>${columns.join('')}</cols>`
    + `<sheetData>${rows.join('')}</sheetData>`
    + WORKSHEET_PAGE_MARGINS
    + ignoredErrors
    + '</worksheet>';
}

// Small helpers for writing XML and SpreadsheetML by hand: text escaping and cell references
// such as 'C2'. Pure.

// Every character outside XML 1.0's Char production (W3C XML 1.0, §2.2): control characters
// other than tab, LF and CR, lone surrogates, U+FFFE and U+FFFF. A file containing one is not
// well-formed, so such characters are dropped rather than escaped (they have no escape).
const FORBIDDEN_XML_CHARACTERS = /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const SPECIAL_CHARACTERS = /[&<>"']/g;

/** Excel's last column is XFD (ECMA-376 Part 1, §18.3.1.3 limits). */
export const MAX_COLUMN_NUMBER = 16384;

const LETTERS = 26;
const CODE_OF_A = 65;

/**
 * Text made safe for XML element content and attribute values: & < > " ' become entities,
 * characters that XML 1.0 forbids are removed. text  any string.
 */
export function escapeXml(text) {
  return text.replace(FORBIDDEN_XML_CHARACTERS, '').replace(SPECIAL_CHARACTERS, (character) => ESCAPES[character]);
}

/**
 * The spreadsheet name of a column: 1 → 'A', 26 → 'Z', 27 → 'AA', 16384 → 'XFD'
 * (bijective base 26). columnNumber  integer 1–16384. Throws RangeError otherwise.
 */
export function columnName(columnNumber) {
  if (!Number.isInteger(columnNumber) || columnNumber < 1 || columnNumber > MAX_COLUMN_NUMBER) {
    throw new RangeError(`column number must be an integer from 1 to ${MAX_COLUMN_NUMBER}, got ${String(columnNumber)}`);
  }
  let name = '';
  let rest = columnNumber;
  while (rest > 0) {
    const letterIndex = (rest - 1) % LETTERS;
    name = String.fromCharCode(CODE_OF_A + letterIndex) + name;
    rest = Math.floor((rest - 1) / LETTERS);
  }
  return name;
}

/**
 * The reference of a cell: cellReference(3, 2) → 'C2'.
 * column  1-based column number (1–16384); row  1-based row number.
 * Throws RangeError for a bad column (see columnName).
 */
export function cellReference(column, row) {
  return `${columnName(column)}${row}`;
}

/** The first line of every part of the workbook package. */
export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** SpreadsheetML main namespace (ECMA-376 Part 1, §18). */
export const SPREADSHEETML_NAMESPACE = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

/** Namespace of r:id attributes that point to package relationships. */
export const RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Excel's default page margins in inches; every worksheet writes them after its sheetData. */
export const WORKSHEET_PAGE_MARGINS = '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>';

/**
 * A worksheet cell holding text as an inline string (no shared-strings part needed).
 * reference  e.g. 'A1'; text  any string (escaped here); style  cell format index or omitted.
 * Leading or trailing spaces are kept with xml:space="preserve".
 */
export function inlineStringCell(reference, text, style = null) {
  const styleAttribute = style === null ? '' : ` s="${style}"`;
  const space = text.trim() === text ? '' : ' xml:space="preserve"';
  return `<c r="${reference}"${styleAttribute} t="inlineStr"><is><t${space}>${escapeXml(text)}</t></is></c>`;
}

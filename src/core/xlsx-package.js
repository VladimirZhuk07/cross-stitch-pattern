// The parts of the Excel workbook package (Office Open XML, ECMA-376 Part 2 packaging): the
// fixed content types and relationships plus the three sheets, the styles, the drawing and the
// two pictures. Pure. The list is handed to buildZip (./zip.js). Design D3 of add-excel-export.

import { EMPTY_CELL } from './pattern.js';
import { summarizePattern, summaryLines } from './pattern-summary.js';
import { workbookStyles } from './xlsx-styles.js';
import { chartSheetXml } from './xlsx-chart-sheet.js';
import { summaryLayout, summarySheetXml, summaryDrawingXml } from './xlsx-summary-sheet.js';
import { legendSheetXml } from './xlsx-legend-sheet.js';
import { XML_DECLARATION, SPREADSHEETML_NAMESPACE, RELATIONSHIPS_NAMESPACE } from './xml.js';

/** Media type of an .xlsx file, for the downloaded Blob. */
export const XLSX_MEDIA_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const OFFICE_TYPES = 'application/vnd.openxmlformats-officedocument';
const RELATIONSHIP_TYPES = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_RELATIONSHIPS_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/relationships';
const CONTENT_TYPES_NAMESPACE = 'http://schemas.openxmlformats.org/package/2006/content-types';
const SHEET_NAMES = ['Chart', 'Summary', 'Legend'];

const CONTENT_TYPES_XML = `${XML_DECLARATION}<Types xmlns="${CONTENT_TYPES_NAMESPACE}">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
  + '<Default Extension="xml" ContentType="application/xml"/>'
  + '<Default Extension="png" ContentType="image/png"/>'
  + `<Override PartName="/xl/workbook.xml" ContentType="${OFFICE_TYPES}.spreadsheetml.sheet.main+xml"/>`
  + SHEET_NAMES.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="${OFFICE_TYPES}.spreadsheetml.worksheet+xml"/>`).join('')
  + `<Override PartName="/xl/styles.xml" ContentType="${OFFICE_TYPES}.spreadsheetml.styles+xml"/>`
  + `<Override PartName="/xl/drawings/drawing1.xml" ContentType="${OFFICE_TYPES}.drawing+xml"/>`
  + '</Types>';

const WORKBOOK_XML = `${XML_DECLARATION}<workbook xmlns="${SPREADSHEETML_NAMESPACE}" xmlns:r="${RELATIONSHIPS_NAMESPACE}">`
  + '<bookViews><workbookView activeTab="0"/></bookViews>'
  + `<sheets>${SHEET_NAMES.map((name, index) => `<sheet name="${name}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets>`
  + '</workbook>';

/**
 * The 13 parts of the workbook of pattern (a Pattern, see ./pattern.js) with pictures
 * (WorkbookPictures, see ./xlsx-summary-sheet.js), as ZipFile objects for buildZip (./zip.js):
 * { name, content, shouldCompress }, in a fixed order with [Content_Types].xml first. XML
 * content is an iterable of strings (the Chart sheet a generator, so it can be read once);
 * the PNGs are the given bytes, stored uncompressed.
 * Throws TypeError or RangeError, naming the problem, for a malformed pattern or pictures.
 */
export function workbookFiles(pattern, pictures) {
  checkPattern(pattern);
  checkPictures(pictures);
  const styles = workbookStyles(pattern.legend);
  const layout = summaryLayout(pictures);
  const xml = (name, text) => ({ name, content: typeof text === 'string' ? [text] : text, shouldCompress: true });
  const png = (name, bytes) => ({ name, content: bytes, shouldCompress: false });
  return [
    xml('[Content_Types].xml', CONTENT_TYPES_XML),
    xml('_rels/.rels', relationshipsXml([['officeDocument', 'xl/workbook.xml']])),
    xml('xl/workbook.xml', WORKBOOK_XML),
    xml('xl/_rels/workbook.xml.rels', relationshipsXml([
      ...SHEET_NAMES.map((_, index) => ['worksheet', `worksheets/sheet${index + 1}.xml`]),
      ['styles', 'styles.xml'],
    ])),
    xml('xl/styles.xml', styles.xml),
    xml('xl/worksheets/sheet1.xml', chartSheetXml(pattern, styles)),
    xml('xl/worksheets/sheet2.xml', summarySheetXml(summaryLines(summarizePattern(pattern)), layout)),
    xml('xl/worksheets/sheet3.xml', legendSheetXml(pattern, styles)),
    xml('xl/worksheets/_rels/sheet2.xml.rels', relationshipsXml([['drawing', '../drawings/drawing1.xml']])),
    xml('xl/drawings/drawing1.xml', summaryDrawingXml(layout)),
    xml('xl/drawings/_rels/drawing1.xml.rels', relationshipsXml([['image', '../media/image1.png'], ['image', '../media/image2.png']])),
    png('xl/media/image1.png', pictures.original.png),
    png('xl/media/image2.png', pictures.dmc.png),
  ];
}

// relationships: [type name, target relative to the owning part's folder], numbered rId1….
function relationshipsXml(relationships) {
  const items = relationships.map(([type, target], index) => `<Relationship Id="rId${index + 1}" Type="${RELATIONSHIP_TYPES}/${type}" Target="${target}"/>`);
  return `${XML_DECLARATION}<Relationships xmlns="${PACKAGE_RELATIONSHIPS_NAMESPACE}">${items.join('')}</Relationships>`;
}

function checkPattern(pattern) {
  if (pattern === null || typeof pattern !== 'object' || !Array.isArray(pattern.legend)) {
    throw new TypeError(`pattern must be a Pattern with a legend, got ${String(pattern)}`);
  }
  const { width, height, cells, legend } = pattern;
  for (const [field, value] of [['width', width], ['height', height]]) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(`pattern ${field} must be a positive integer, got ${String(value)}`);
    }
  }
  if (cells?.length !== width * height) {
    throw new RangeError(`pattern cells must have width × height = ${width * height} entries, got ${String(cells?.length)}`);
  }
  for (let index = 0; index < cells.length; index++) {
    const value = cells[index];
    if (value !== EMPTY_CELL && !(Number.isInteger(value) && value >= 0 && value < legend.length)) {
      throw new RangeError(`pattern cell ${index} has value ${String(value)}, expected ${EMPTY_CELL} or 0–${legend.length - 1}`);
    }
  }
}

function checkPictures(pictures) {
  if (pictures === null || typeof pictures !== 'object') {
    throw new TypeError(`pictures must be { original, dmc }, got ${String(pictures)}`);
  }
  for (const key of ['original', 'dmc']) {
    const picture = pictures[key];
    if (!(picture?.png instanceof Uint8Array)) {
      throw new TypeError(`pictures.${key}.png must be a Uint8Array, got ${String(picture?.png)}`);
    }
    for (const field of ['width', 'height']) {
      if (!Number.isInteger(picture[field]) || picture[field] <= 0) {
        throw new RangeError(`pictures.${key}.${field} must be a positive integer, got ${String(picture[field])}`);
      }
    }
  }
}

// The workbook's styles part (xl/styles.xml) and the index of the cell format of every kind of
// cell the sheets write. Pure. Layout and reasons: design D4 of add-excel-export; element order
// follows CT_Stylesheet and CT_Border (ECMA-376 Part 1, §18.8).

import { EMPTY_CELL_COLOR, paleTint } from './chart-tint.js';
import { EMPTY_CELL } from './pattern.js';
import { XML_DECLARATION, SPREADSHEETML_NAMESPACE } from './xml.js';

/** Cell format of bold text (header labels, captions). */
export const BOLD_STYLE = 1;
/** Cell format of stitch counts: built-in number format 3, '#,##0'. */
export const COUNT_STYLE = 2;

const DEFAULT_STYLE_COUNT = 3; // default, bold, count
const THOUSANDS_NUMBER_FORMAT = 3;

const FONT_DEFAULT = 0;
const FONT_BOLD = 1;
const FONT_CHART_NUMBER = 2;
const FIRST_TINT_FILL = 3;
const EMPTY_FILL = 2;

// Chart borders: 16 variants v (bit 0 right medium, bit 1 bottom medium, bit 2 first column,
// bit 3 first row), each once without and once with the empty cell's diagonal.
const BORDER_VARIANTS = 16;
const RIGHT_IS_MEDIUM = 1;
const BOTTOM_IS_MEDIUM = 2;
const IS_FIRST_COLUMN = 4;
const IS_FIRST_ROW = 8;
const FIRST_CHART_BORDER = 1;
const FIRST_EMPTY_CHART_BORDER = FIRST_CHART_BORDER + BORDER_VARIANTS;
const GRID_STEP = 10; // the bold counting lines of the on-screen chart

const BLACK = 'FF000000';
const MEDIUM_LINE = { style: 'medium', rgb: BLACK };
const THIN_LINE = { style: 'thin', rgb: 'FFA0A0A0' };
const DIAGONAL_LINE = { style: 'thin', rgb: 'FF909090' };
const CENTRED = { horizontal: 'center', vertical: 'center' };

// WorkbookStyles, created by workbookStyles and read by the sheet writers:
//   fonts     [{ name, size (pt), isBold, rgb ('AARRGGBB' or null for automatic) }]
//   fills     [{ pattern: 'none' | 'gray125' | 'solid', rgb ('AARRGGBB', solid fills only) }]
//   borders   [{ left, right, top, bottom, diagonalUp }], each edge null or { style, rgb }
//   cellXfs   [{ numFmtId, fontId, fillId, borderId, alignment (null or { horizontal, vertical? }) }]
//   xml       the styles part as one string
//   chartCellStyle(legendIndex, x, y, width, height), legendNumberStyle(i), swatchStyle(i):
//             cell format indexes, see the comments below

/**
 * The styles of a workbook for legend (a Pattern's legend, see ./pattern.js, 0–489 entries).
 * Returns WorkbookStyles (described above). With N colors there are 3 + 2N + 16(N + 1) cell
 * formats: 8,821 for N = 489, far below Excel's 64,000.
 */
export function workbookStyles(legend) {
  const colorCount = legend.length;
  const fonts = [
    { name: 'Calibri', size: 11, isBold: false, rgb: null },
    { name: 'Calibri', size: 11, isBold: true, rgb: null },
    { name: 'Calibri', size: 9, isBold: false, rgb: BLACK },
  ];
  const fills = [
    { pattern: 'none' },
    { pattern: 'gray125' },
    solidFill(EMPTY_CELL_COLOR),
    ...legend.map((entry) => solidFill(paleTint(entry.hex))),
    ...legend.map((entry) => solidFill(entry.hex)),
  ];
  const borders = [noBorder(), ...chartBorders(false), ...chartBorders(true)];
  const cellXfs = cellFormats(colorCount);
  const firstChartStyle = DEFAULT_STYLE_COUNT + 2 * colorCount;

  return {
    fonts,
    fills,
    borders,
    cellXfs,
    xml: stylesXml(fonts, fills, borders, cellXfs),
    /**
     * Format of chart cell (x, y) (0-based) of a width × height chart whose value is legend
     * index legendIndex, or EMPTY_CELL (−1) for an empty cell.
     */
    chartCellStyle(legendIndex, x, y, width, height) {
      const slot = legendIndex === EMPTY_CELL ? 0 : legendIndex + 1;
      return firstChartStyle + BORDER_VARIANTS * slot + borderVariant(x, y, width, height);
    },
    /** Format of the number cell of legend index i on the Legend sheet: its tint, centred. */
    legendNumberStyle: (legendIndex) => DEFAULT_STYLE_COUNT + legendIndex,
    /** Format of the swatch cell of legend index i: filled with the real DMC color. */
    swatchStyle: (legendIndex) => DEFAULT_STYLE_COUNT + colorCount + legendIndex,
  };
}

function solidFill(hex) {
  return { pattern: 'solid', rgb: `FF${hex.slice(1).toUpperCase()}` };
}

function noBorder() {
  return { left: null, right: null, top: null, bottom: null, diagonalUp: null };
}

// Each grid line is drawn by exactly one cell (its right or bottom edge; the left and top
// edges only at the outer frame), so programs never have two different edges to reconcile.
function chartBorders(isEmptyCell) {
  const borders = [];
  for (let variant = 0; variant < BORDER_VARIANTS; variant++) {
    borders.push({
      left: (variant & IS_FIRST_COLUMN) !== 0 ? MEDIUM_LINE : null,
      right: (variant & RIGHT_IS_MEDIUM) !== 0 ? MEDIUM_LINE : THIN_LINE,
      top: (variant & IS_FIRST_ROW) !== 0 ? MEDIUM_LINE : null,
      bottom: (variant & BOTTOM_IS_MEDIUM) !== 0 ? MEDIUM_LINE : THIN_LINE,
      diagonalUp: isEmptyCell ? DIAGONAL_LINE : null,
    });
  }
  return borders;
}

function borderVariant(x, y, width, height) {
  let variant = 0;
  if ((x + 1) % GRID_STEP === 0 || x === width - 1) {
    variant |= RIGHT_IS_MEDIUM;
  }
  if ((y + 1) % GRID_STEP === 0 || y === height - 1) {
    variant |= BOTTOM_IS_MEDIUM;
  }
  if (x === 0) {
    variant |= IS_FIRST_COLUMN;
  }
  if (y === 0) {
    variant |= IS_FIRST_ROW;
  }
  return variant;
}

function cellFormats(colorCount) {
  const format = (fontId, fillId, borderId, alignment = null, numFmtId = 0) => ({ numFmtId, fontId, fillId, borderId, alignment });
  const formats = [
    format(FONT_DEFAULT, 0, 0),
    format(FONT_BOLD, 0, 0),
    format(FONT_DEFAULT, 0, 0, null, THOUSANDS_NUMBER_FORMAT),
  ];
  for (let index = 0; index < colorCount; index++) {
    formats.push(format(FONT_DEFAULT, FIRST_TINT_FILL + index, 0, { horizontal: 'center' }));
  }
  for (let index = 0; index < colorCount; index++) {
    formats.push(format(FONT_DEFAULT, FIRST_TINT_FILL + colorCount + index, 0));
  }
  for (let variant = 0; variant < BORDER_VARIANTS; variant++) {
    formats.push(format(FONT_CHART_NUMBER, EMPTY_FILL, FIRST_EMPTY_CHART_BORDER + variant, CENTRED));
  }
  for (let index = 0; index < colorCount; index++) {
    for (let variant = 0; variant < BORDER_VARIANTS; variant++) {
      formats.push(format(FONT_CHART_NUMBER, FIRST_TINT_FILL + index, FIRST_CHART_BORDER + variant, CENTRED));
    }
  }
  return formats;
}

function stylesXml(fonts, fills, borders, cellXfs) {
  return `${XML_DECLARATION}<styleSheet xmlns="${SPREADSHEETML_NAMESPACE}">`
    + list('fonts', fonts.map(fontXml))
    + list('fills', fills.map(fillXml))
    + list('borders', borders.map(borderXml))
    + list('cellStyleXfs', ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>'])
    + list('cellXfs', cellXfs.map(cellFormatXml))
    + list('cellStyles', ['<cellStyle name="Normal" xfId="0" builtinId="0"/>'])
    + '</styleSheet>';
}

function list(tag, children) {
  return `<${tag} count="${children.length}">${children.join('')}</${tag}>`;
}

function fontXml(font) {
  const bold = font.isBold ? '<b/>' : '';
  const color = font.rgb === null ? '' : `<color rgb="${font.rgb}"/>`;
  return `<font>${bold}<sz val="${font.size}"/>${color}<name val="${font.name}"/><family val="2"/></font>`;
}

function fillXml(fill) {
  if (fill.pattern !== 'solid') {
    return `<fill><patternFill patternType="${fill.pattern}"/></fill>`;
  }
  return `<fill><patternFill patternType="solid"><fgColor rgb="${fill.rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
}

function edgeXml(tag, edge) {
  return edge === null ? `<${tag}/>` : `<${tag} style="${edge.style}"><color rgb="${edge.rgb}"/></${tag}>`;
}

function borderXml(border) {
  const diagonal = border.diagonalUp === null ? '' : ' diagonalUp="1"';
  return `<border${diagonal}>${edgeXml('left', border.left)}${edgeXml('right', border.right)}`
    + `${edgeXml('top', border.top)}${edgeXml('bottom', border.bottom)}${edgeXml('diagonal', border.diagonalUp)}</border>`;
}

function cellFormatXml(format) {
  const applied = [
    format.numFmtId !== 0 ? ' applyNumberFormat="1"' : '',
    format.fontId !== 0 ? ' applyFont="1"' : '',
    format.fillId !== 0 ? ' applyFill="1"' : '',
    format.borderId !== 0 ? ' applyBorder="1"' : '',
    format.alignment !== null ? ' applyAlignment="1"' : '',
  ].join('');
  const attributes = `numFmtId="${format.numFmtId}" fontId="${format.fontId}" fillId="${format.fillId}" borderId="${format.borderId}" xfId="0"${applied}`;
  if (format.alignment === null) {
    return `<xf ${attributes}/>`;
  }
  const vertical = format.alignment.vertical === undefined ? '' : ` vertical="${format.alignment.vertical}"`;
  return `<xf ${attributes}><alignment horizontal="${format.alignment.horizontal}"${vertical}/></xf>`;
}

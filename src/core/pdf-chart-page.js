// The content stream of one PDF chart page: cells in their pale tints with black legend
// numbers, grey hatched empty cells, grid lines, rulers with absolute stitch numbers, the
// centre triangles, a header naming the page's area and the page number. Pure.
//
// The look follows the screen's Chart layer (openspec/specs/stitch-chart/spec.md) at print
// sizes; the geometry is design D4 of add-pdf-export. Positions are worked out in PDF points.

import { EMPTY_CELL } from './pattern.js';
import { EMPTY_CELL_COLOR, paleTint } from './chart-tint.js';
import { MAJOR_LINE_STEP, NUMBER_FONT_FRACTION, chartCenter } from './chart-layout.js';
import { pdfNumber } from './pdf-writer.js';
import { CAP_HEIGHT, FONT_REGULAR, fitText, textWidth } from './pdf-text.js';
import { POINTS_PER_MM, fillColor, lineWidth, pdfX, pdfY, strokeColor, textAt } from './pdf-content.js';
import { chartPageArea } from './pdf-page-plan.js';

/** The side of a chart cell: 3.2 mm, so 50 × 80 cells fill the printable part of A4. */
export const CELL_SIZE_MM = 3.2;
/** The grid's top-left corner in mm from the page's top-left corner, the same on every page. */
export const GRID_LEFT_MM = 30;
export const GRID_TOP_MM = 23;

const CELL = CELL_SIZE_MM * POINTS_PER_MM;
const GRID_X = pdfX(GRID_LEFT_MM);
const GRID_Y = pdfY(GRID_TOP_MM);
// The screen's number size rule: 0.45 × the cell, 4.08 pt.
const NUMBER_SIZE = Math.round(NUMBER_FONT_FRACTION * CELL * 100) / 100;
// Every digit is 556/1000 em wide in Helvetica (Adobe AFM), so a number's width is its length.
const DIGIT_WIDTH = textWidth('0', FONT_REGULAR, 1);
const HATCH_COLOR = '#909090';
const HATCH_WIDTH = 0.3;
const THIN_LINE_COLOR = '#A0A0A0';
const THIN_LINE_WIDTH = 0.3;
const BOLD_LINE_COLOR = '#000000';
const BOLD_LINE_WIDTH = 0.9;

// Rulers: labels 6 pt; column labels 2.3 mm above the grid, row labels ending at 27.7 mm.
const RULER_FONT_SIZE = 6;
const COLUMN_LABEL_BASELINE = GRID_Y + 2.3 * POINTS_PER_MM;
const ROW_LABEL_RIGHT = pdfX(27.7);
// Centre triangles: 2.4 mm wide, 1.5 mm deep, the tip on the grid edge.
const TRIANGLE_HALF_WIDTH = 1.2 * POINTS_PER_MM;
const TRIANGLE_DEPTH = 1.5 * POINTS_PER_MM;

// Header (8 pt, baseline 15.5 mm) and footer (9 pt, baseline 285 mm, centred at 110 mm).
const HEADER_SIZE = 8;
const HEADER_BASELINE_MM = 15.5;
const HEADER_NAME_WIDTH = 80 * POINTS_PER_MM;
const HEADER_RIGHT_MM = 190;
const FOOTER_SIZE = 9;
const FOOTER_BASELINE_MM = 285;
const FOOTER_CENTRE_MM = 110;

/**
 * The pale tint ('#RRGGBB', see ./chart-tint.js) of every legend entry of a Pattern, by legend
 * index. Computed once per document and passed to chartPageContent.
 */
export function legendTints(pattern) {
  return pattern.legend.map((entry) => paleTint(entry.hex));
}

/**
 * The content stream (ASCII text) of chart page pageNumber (1..plan.chartPages) of a Pattern
 * (./pattern.js) with its PdfPagePlan (./pdf-page-plan.js). fileName is the image file name
 * for the header; tints are legendTints(pattern). Throws RangeError for a bad page number.
 */
export function chartPageContent(pattern, plan, pageNumber, fileName, tints = legendTints(pattern)) {
  const area = chartPageArea(plan, pattern, pageNumber);
  return [
    cellFills(pattern, area, tints),
    emptyCellHatch(pattern, area),
    cellNumbers(pattern, area),
    gridLines(pattern, area),
    rulerLabels(area),
    centreTriangles(pattern, area),
    headerAndFooter(area, pageNumber, plan.chartPages, fileName),
  ].filter((block) => block !== '').join('\n');
}

// The cell at page column / row (0-based on the page) of the pattern.
function cellAt(pattern, area, pageColumn, pageRow) {
  return pattern.cells[(area.rowStart + pageRow) * pattern.width + area.columnStart + pageColumn];
}

function cellX(pageColumn) {
  return GRID_X + pageColumn * CELL;
}

function cellTopY(pageRow) {
  return GRID_Y - pageRow * CELL;
}

// One rectangle per horizontal run of equal cells, grouped by color so each color is set once.
// Merged runs are smaller and leave no hairline seams between touching rectangles.
function cellFills(pattern, area, tints) {
  const runsByValue = new Map();
  const columns = area.columnEnd - area.columnStart;
  for (let row = 0; row < area.rowEnd - area.rowStart; row++) {
    let runStart = 0;
    for (let column = 1; column <= columns; column++) {
      const value = cellAt(pattern, area, runStart, row);
      if (column < columns && cellAt(pattern, area, column, row) === value) {
        continue;
      }
      const rect = [cellX(runStart), cellTopY(row + 1), (column - runStart) * CELL, CELL];
      if (!runsByValue.has(value)) {
        runsByValue.set(value, []);
      }
      runsByValue.get(value).push(`${rect.map((number) => pdfNumber(number)).join(' ')} re`);
      runStart = column;
    }
  }
  const values = [...runsByValue.keys()].sort((a, b) => a - b);
  const blocks = [];
  for (const value of values) {
    const color = value === EMPTY_CELL ? EMPTY_CELL_COLOR : tints[value];
    blocks.push(`${fillColor(color)}\n${runsByValue.get(value).join('\n')}\nf`);
  }
  return blocks.join('\n');
}

// One diagonal per empty cell, bottom-left to top-right, in a single stroked path.
function emptyCellHatch(pattern, area) {
  const segments = [];
  for (let row = 0; row < area.rowEnd - area.rowStart; row++) {
    for (let column = 0; column < area.columnEnd - area.columnStart; column++) {
      if (cellAt(pattern, area, column, row) !== EMPTY_CELL) {
        continue;
      }
      const left = pdfNumber(cellX(column));
      const right = pdfNumber(cellX(column + 1));
      segments.push(`${left} ${pdfNumber(cellTopY(row + 1))} m ${right} ${pdfNumber(cellTopY(row))} l`);
    }
  }
  if (segments.length === 0) {
    return '';
  }
  return `${pdfNumber(HATCH_WIDTH)} w ${strokeColor(HATCH_COLOR)}\n${segments.join('\n')}\nS`;
}

// All numbers in one text block. Each row starts with an absolute Tm; each further number
// moves by Td from the one before. Positions are rounded to 0.01 pt before the differences are
// taken, so rounding errors never add up along a row.
function cellNumbers(pattern, area) {
  const lines = [];
  for (let row = 0; row < area.rowEnd - area.rowStart; row++) {
    const baseline = round(cellTopY(row) - CELL / 2 - (CAP_HEIGHT / 2) * NUMBER_SIZE);
    let previousX = null;
    for (let column = 0; column < area.columnEnd - area.columnStart; column++) {
      const value = cellAt(pattern, area, column, row);
      if (value === EMPTY_CELL) {
        continue;
      }
      const text = String(pattern.legend[value].number);
      const x = round(cellX(column) + CELL / 2 - (text.length * DIGIT_WIDTH * NUMBER_SIZE) / 2);
      const move = previousX === null
        ? `1 0 0 1 ${pdfNumber(x)} ${pdfNumber(baseline)} Tm`
        : `${pdfNumber(x - previousX)} 0 Td`;
      lines.push(`${move} (${text}) Tj`);
      previousX = x;
    }
  }
  if (lines.length === 0) {
    return '';
  }
  return `BT /${FONT_REGULAR} ${pdfNumber(NUMBER_SIZE)} Tf 0 g\n${lines.join('\n')}\nET`;
}

// Thin lines on every stitch boundary, bold ones on multiples of 10 and on the pattern's far
// edges. Each kind is one path; the bold path comes second, so bold wins where lines cross.
function gridLines(pattern, area) {
  const thin = [];
  const bold = [];
  const top = pdfNumber(GRID_Y);
  const bottom = pdfNumber(cellTopY(area.rowEnd - area.rowStart));
  const left = pdfNumber(GRID_X);
  const right = pdfNumber(cellX(area.columnEnd - area.columnStart));
  for (let column = area.columnStart; column <= area.columnEnd; column++) {
    const x = pdfNumber(cellX(column - area.columnStart));
    const lines = isBoldBoundary(column, pattern.width) ? bold : thin;
    lines.push(`${x} ${top} m ${x} ${bottom} l`);
  }
  for (let row = area.rowStart; row <= area.rowEnd; row++) {
    const y = pdfNumber(cellTopY(row - area.rowStart));
    const lines = isBoldBoundary(row, pattern.height) ? bold : thin;
    lines.push(`${left} ${y} m ${right} ${y} l`);
  }
  const blocks = [];
  if (thin.length > 0) {
    blocks.push(`${lineWidth(THIN_LINE_WIDTH)} ${strokeColor(THIN_LINE_COLOR)}\n${thin.join('\n')}\nS`);
  }
  blocks.push(`${lineWidth(BOLD_LINE_WIDTH)} ${strokeColor(BOLD_LINE_COLOR)}\n${bold.join('\n')}\nS`);
  return blocks.join('\n');
}

function isBoldBoundary(boundary, patternSide) {
  return boundary % MAJOR_LINE_STEP === 0 || boundary === patternSide;
}

// Absolute stitch counts at every boundary on the page that is a multiple of 10 (not 0):
// centred above the grid for columns, right-aligned left of it for rows.
function rulerLabels(area) {
  const lines = [];
  for (const boundary of labelledBoundaries(area.columnStart, area.columnEnd)) {
    const text = String(boundary);
    const centre = cellX(boundary - area.columnStart);
    const x = centre - textWidth(text, FONT_REGULAR, RULER_FONT_SIZE) / 2;
    lines.push(`1 0 0 1 ${pdfNumber(x)} ${pdfNumber(COLUMN_LABEL_BASELINE)} Tm (${text}) Tj`);
  }
  for (const boundary of labelledBoundaries(area.rowStart, area.rowEnd)) {
    const text = String(boundary);
    const x = ROW_LABEL_RIGHT - textWidth(text, FONT_REGULAR, RULER_FONT_SIZE);
    const baseline = cellTopY(boundary - area.rowStart) - (CAP_HEIGHT / 2) * RULER_FONT_SIZE;
    lines.push(`1 0 0 1 ${pdfNumber(x)} ${pdfNumber(baseline)} Tm (${text}) Tj`);
  }
  if (lines.length === 0) {
    return '';
  }
  return `BT /${FONT_REGULAR} ${pdfNumber(RULER_FONT_SIZE)} Tf 0 g\n${lines.join('\n')}\nET`;
}

function labelledBoundaries(start, end) {
  const boundaries = [];
  const first = Math.max(MAJOR_LINE_STEP, Math.ceil(start / MAJOR_LINE_STEP) * MAJOR_LINE_STEP);
  for (let boundary = first; boundary <= end; boundary += MAJOR_LINE_STEP) {
    boundaries.push(boundary);
  }
  return boundaries;
}

// Black triangles in the rulers pointing at the pattern's centre column (W / 2) and centre row
// (H / 2) where it lies on this page, edges included.
function centreTriangles(pattern, area) {
  const centre = chartCenter(pattern);
  const paths = [];
  if (centre.column >= area.columnStart && centre.column <= area.columnEnd) {
    const x = cellX(centre.column - area.columnStart);
    const base = GRID_Y + TRIANGLE_DEPTH;
    paths.push(trianglePath([x, GRID_Y], [x - TRIANGLE_HALF_WIDTH, base], [x + TRIANGLE_HALF_WIDTH, base]));
  }
  if (centre.row >= area.rowStart && centre.row <= area.rowEnd) {
    const y = cellTopY(centre.row - area.rowStart);
    const base = GRID_X - TRIANGLE_DEPTH;
    paths.push(trianglePath([GRID_X, y], [base, y + TRIANGLE_HALF_WIDTH], [base, y - TRIANGLE_HALF_WIDTH]));
  }
  if (paths.length === 0) {
    return '';
  }
  return `0 g\n${paths.join('\n')}\nf`;
}

function trianglePath(tip, corner, otherCorner) {
  const point = ([x, y]) => `${pdfNumber(x)} ${pdfNumber(y)}`;
  return `${point(tip)} m ${point(corner)} l ${point(otherCorner)} l h`;
}

// The file name (cut to 80 mm) and the page's columns and rows at the top, 'Page n of N' below.
function headerAndFooter(area, pageNumber, chartPages, fileName) {
  const name = fitText(fileName, FONT_REGULAR, HEADER_SIZE, HEADER_NAME_WIDTH);
  const range = `Columns ${area.columnStart + 1}–${area.columnEnd} · rows ${area.rowStart + 1}–${area.rowEnd}`;
  const footer = `Page ${pageNumber} of ${chartPages}`;
  return [
    textAt(name, FONT_REGULAR, HEADER_SIZE, GRID_LEFT_MM, HEADER_BASELINE_MM),
    textAt(range, FONT_REGULAR, HEADER_SIZE, HEADER_RIGHT_MM, HEADER_BASELINE_MM, 'right'),
    textAt(footer, FONT_REGULAR, FOOTER_SIZE, FOOTER_CENTRE_MM, FOOTER_BASELINE_MM, 'center'),
  ].join('\n');
}

function round(value) {
  return Math.round(value * 100) / 100;
}

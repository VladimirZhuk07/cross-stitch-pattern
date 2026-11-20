// The content stream of one PDF chart page: cells in their pale tints with black legend
// numbers, grey hatched empty cells, grid lines, rulers with absolute stitch numbers, the
// centre triangles, a header naming the page's area and the page number. Pure.
//
// The look follows the screen's Chart layer (openspec/specs/stitch-chart/spec.md) at print
// sizes; the geometry is design D4 of add-pdf-export. Positions are worked out in PDF points.

import { EMPTY_CELL } from './pattern.js';
import { EMPTY_CELL_COLOR, paleTint } from './chart-tint.js';
import { NUMBER_FONT_FRACTION } from './chart-layout.js';
import { pdfNumber } from './pdf-writer.js';
import { CAP_HEIGHT, FONT_REGULAR, textWidth } from './pdf-text.js';
import { POINTS_PER_MM, fillColor, pdfX, pdfY, strokeColor } from './pdf-content.js';
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

function round(value) {
  return Math.round(value * 100) / 100;
}

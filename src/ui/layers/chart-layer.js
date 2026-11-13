// View layer 3: the cross-stitch chart. Follows the view-layer contract in ../viewer.js.
//
// Every stitched cell is white with its legend number (1..N) in black; empty cells are light
// grey without a number. The layout rules (visible range, sizes, thresholds) live in
// ../../core/chart-layout.js; this module only turns them into canvas calls.
//
// Paint order, each step limited to the cells visible in the frame:
//   1. white rectangle under the visible cells
//   2. empty cells: consecutive empty cells of a row merged into one rect, filled once
//   3. numbers: one font for all, one fillText per visible stitched cell (skipped when the
//      cells are too small to read them)
// There is no bitmap cache: the work per paint depends on the visible area only. The one
// cached value is the list of number texts, kept per pattern (by object identity).

import { EMPTY_CELL } from '../../core/pattern.js';
import {
  chartCellGeometry,
  visibleCellRange,
  cellCenter,
  numberFontSize,
} from '../../core/chart-layout.js';

const CELL_COLOR = '#FFFFFF';
const EMPTY_CELL_COLOR = '#E0E0E0';
const NUMBER_COLOR = '#000000';
const FONT_FAMILY = 'system-ui, sans-serif';

/**
 * Creates the Chart layer. It is available once a pattern exists (state.pattern is not null).
 * Returns a view layer { id: 'chart', isAvailable, render }.
 */
export function createChartLayer() {
  let cachedPattern = null;
  let cachedNumberTexts = [];

  // The texts '1'..'N' of the legend numbers, indexed like pattern.legend.
  function numberTextsOf(pattern) {
    if (pattern !== cachedPattern) {
      cachedPattern = pattern;
      cachedNumberTexts = pattern.legend.map((entry) => String(entry.number));
    }
    return cachedNumberTexts;
  }

  return {
    id: 'chart',
    isAvailable: (state) => state.pattern !== null,
    render(ctx, frame, state) {
      const { pattern } = state;
      const { content } = frame;
      const range = visibleCellRange(content, frame, pattern);
      if (range.columnStart === range.columnEnd || range.rowStart === range.rowEnd) {
        return;
      }
      const geometry = chartCellGeometry(content, pattern);
      drawCells(ctx, pattern, content, geometry, range);
      drawNumbers(ctx, pattern, content, geometry, range, numberTextsOf(pattern));
    },
  };
}

function drawCells(ctx, pattern, content, geometry, range) {
  const { cellWidth, cellHeight } = geometry;
  ctx.fillStyle = CELL_COLOR;
  ctx.fillRect(
    content.x + range.columnStart * cellWidth,
    content.y + range.rowStart * cellHeight,
    (range.columnEnd - range.columnStart) * cellWidth,
    (range.rowEnd - range.rowStart) * cellHeight,
  );

  ctx.beginPath();
  for (let row = range.rowStart; row < range.rowEnd; row++) {
    addEmptyRuns(ctx, pattern, content, geometry, range, row);
  }
  ctx.fillStyle = EMPTY_CELL_COLOR;
  ctx.fill();
}

// Adds one rect per run of consecutive empty cells in the visible part of a row.
function addEmptyRuns(ctx, pattern, content, geometry, range, row) {
  const { cellWidth, cellHeight } = geometry;
  const rowOffset = row * pattern.width;
  const y = content.y + row * cellHeight;
  let runStart = -1;
  for (let column = range.columnStart; column <= range.columnEnd; column++) {
    const isEmpty = column < range.columnEnd && pattern.cells[rowOffset + column] === EMPTY_CELL;
    if (isEmpty && runStart === -1) {
      runStart = column;
    }
    if (!isEmpty && runStart !== -1) {
      ctx.rect(content.x + runStart * cellWidth, y, (column - runStart) * cellWidth, cellHeight);
      runStart = -1;
    }
  }
}

function drawNumbers(ctx, pattern, content, geometry, range, numberTexts) {
  const fontSize = numberFontSize(geometry.cellSize);
  if (fontSize === null) {
    return;
  }
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = NUMBER_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Column centres once per paint, so the loop below allocates nothing per cell.
  const columnCenters = new Float64Array(range.columnEnd - range.columnStart);
  for (let column = range.columnStart; column < range.columnEnd; column++) {
    columnCenters[column - range.columnStart] = cellCenter(content, pattern, column, 0).x;
  }
  for (let row = range.rowStart; row < range.rowEnd; row++) {
    const y = cellCenter(content, pattern, range.columnStart, row).y;
    const rowOffset = row * pattern.width;
    for (let column = range.columnStart; column < range.columnEnd; column++) {
      const legendIndex = pattern.cells[rowOffset + column];
      if (legendIndex !== EMPTY_CELL) {
        ctx.fillText(numberTexts[legendIndex], columnCenters[column - range.columnStart], y);
      }
    }
  }
}

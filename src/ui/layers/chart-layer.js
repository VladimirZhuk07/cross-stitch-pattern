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
//   4. thin lines, then bold lines (one path each, snapped to device pixels, so bold wins at
//      crossings)
//   5. rulers with row/column labels, the centre triangles, and the corner square
// There is no bitmap cache: the work per paint depends on the visible area only. The one
// cached value is the list of number texts, kept per pattern (by object identity).

import { EMPTY_CELL } from '../../core/pattern.js';
import {
  chartCellGeometry,
  visibleCellRange,
  cellCenter,
  numberFontSize,
  gridLines,
  chartLineWidths,
  snapLine,
  chartCenter,
  rulerPlacement,
  rulerLabels,
  rulerLabelStep,
  rulerFontSize,
  MAJOR_LINE_STEP,
  RULER_SIZE,
  RULER_FONT_SIZE,
  CENTER_MARKER_WIDTH,
  CENTER_MARKER_DEPTH,
  RULER_MARKER_GAP,
} from '../../core/chart-layout.js';

const CELL_COLOR = '#FFFFFF';
const EMPTY_CELL_COLOR = '#E0E0E0';
const NUMBER_COLOR = '#000000';
const THIN_LINE_COLOR = '#A0A0A0';
const BOLD_LINE_COLOR = '#000000';
const RULER_BACKGROUND = '#F6F4F0';
const RULER_TEXT_COLOR = '#1F1F1F';
const CENTER_MARKER_COLOR = '#000000';
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
      drawGridLines(ctx, frame.pixelRatio, pattern, content, geometry, range);
      drawRulers(ctx, frame, pattern, content, geometry, range);
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

// The visible part of the grid on screen: { left, right, top, bottom } in CSS px.
function visibleGridExtent(content, geometry, range) {
  return {
    left: content.x + range.columnStart * geometry.cellWidth,
    right: content.x + range.columnEnd * geometry.cellWidth,
    top: content.y + range.rowStart * geometry.cellHeight,
    bottom: content.y + range.rowEnd * geometry.cellHeight,
  };
}

function drawGridLines(ctx, pixelRatio, pattern, content, geometry, range) {
  const widths = chartLineWidths(pixelRatio);
  const columns = gridLines(range.columnStart, range.columnEnd, pattern.width, geometry.cellSize);
  const rows = gridLines(range.rowStart, range.rowEnd, pattern.height, geometry.cellSize);
  const lines = { content, geometry, extent: visibleGridExtent(content, geometry, range), columns, rows, pixelRatio };
  strokeLines(ctx, lines, false, widths.thin, THIN_LINE_COLOR);
  strokeLines(ctx, lines, true, widths.bold, BOLD_LINE_COLOR);
}

// Strokes the vertical, then the horizontal lines of one weight as a single path.
function strokeLines(ctx, lines, isBold, widthDevicePixels, color) {
  const { content, geometry, extent, columns, rows, pixelRatio } = lines;
  ctx.beginPath();
  for (const line of columns) {
    if (line.isBold === isBold) {
      const x = snapLine(content.x + line.index * geometry.cellWidth, widthDevicePixels, pixelRatio);
      ctx.moveTo(x, extent.top);
      ctx.lineTo(x, extent.bottom);
    }
  }
  for (const line of rows) {
    if (line.isBold === isBold) {
      const y = snapLine(content.y + line.index * geometry.cellHeight, widthDevicePixels, pixelRatio);
      ctx.moveTo(extent.left, y);
      ctx.lineTo(extent.right, y);
    }
  }
  ctx.lineWidth = widthDevicePixels / pixelRatio;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawRulers(ctx, frame, pattern, content, geometry, range) {
  const placement = rulerPlacement(content);
  const span = {
    left: Math.max(0, content.x),
    right: Math.min(frame.width, content.x + content.width),
    top: Math.max(0, content.y),
    bottom: Math.min(frame.height, content.y + content.height),
  };
  const step = chooseRulerFont(ctx, pattern, geometry.cellSize);
  const center = chartCenter(pattern);
  const ruler = { ctx, content, geometry, placement, span };

  drawTopRuler(ruler, rulerLabels(range.columnStart, range.columnEnd, step), content.x + center.column * geometry.cellWidth);
  drawLeftRuler(ruler, rulerLabels(range.rowStart, range.rowEnd, step), content.y + center.row * geometry.cellHeight);

  // The square where both rulers meet hides labels that would run into each other.
  ctx.fillStyle = RULER_BACKGROUND;
  ctx.fillRect(placement.left, placement.top, RULER_SIZE, RULER_SIZE);
}

// Sets the ruler font (shrunk if the widest row label does not fit) and returns the label
// step, measured with that font so neighbouring labels never overlap.
function chooseRulerFont(ctx, pattern, cellSize) {
  ctx.font = `${RULER_FONT_SIZE}px ${FONT_FAMILY}`;
  const widestRowLabel = String(largestLabel(pattern.height));
  const fontSize = rulerFontSize(ctx.measureText(widestRowLabel).width);
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  const widestLabel = String(largestLabel(Math.max(pattern.width, pattern.height)));
  return rulerLabelStep(cellSize, ctx.measureText(widestLabel).width);
}

// The largest multiple of MAJOR_LINE_STEP up to count (at least one step).
function largestLabel(count) {
  return Math.max(MAJOR_LINE_STEP, Math.floor(count / MAJOR_LINE_STEP) * MAJOR_LINE_STEP);
}

function drawTopRuler(ruler, labels, centerX) {
  const { ctx, content, geometry, placement, span } = ruler;
  ctx.fillStyle = RULER_BACKGROUND;
  ctx.fillRect(span.left, placement.top, span.right - span.left, RULER_SIZE);

  // Labels in the outer part of the band, the triangle in the inner CENTER_MARKER_DEPTH px.
  ctx.fillStyle = RULER_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelY = placement.top + (RULER_SIZE - CENTER_MARKER_DEPTH) / 2;
  for (const index of labels) {
    ctx.fillText(String(index), content.x + index * geometry.cellWidth, labelY);
  }

  if (centerX >= span.left && centerX <= span.right) {
    const tipY = placement.top + RULER_SIZE;
    fillTriangle(ctx, [
      { x: centerX - CENTER_MARKER_WIDTH / 2, y: tipY - CENTER_MARKER_DEPTH },
      { x: centerX + CENTER_MARKER_WIDTH / 2, y: tipY - CENTER_MARKER_DEPTH },
      { x: centerX, y: tipY },
    ]);
  }
}

function drawLeftRuler(ruler, labels, centerY) {
  const { ctx, content, geometry, placement, span } = ruler;
  ctx.fillStyle = RULER_BACKGROUND;
  ctx.fillRect(placement.left, span.top, RULER_SIZE, span.bottom - span.top);

  // Labels right-aligned just before the triangle area next to the grid edge.
  ctx.fillStyle = RULER_TEXT_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelRight = placement.left + RULER_SIZE - CENTER_MARKER_DEPTH - RULER_MARKER_GAP;
  for (const index of labels) {
    ctx.fillText(String(index), labelRight, content.y + index * geometry.cellHeight);
  }

  if (centerY >= span.top && centerY <= span.bottom) {
    const tipX = placement.left + RULER_SIZE;
    fillTriangle(ctx, [
      { x: tipX - CENTER_MARKER_DEPTH, y: centerY - CENTER_MARKER_WIDTH / 2 },
      { x: tipX - CENTER_MARKER_DEPTH, y: centerY + CENTER_MARKER_WIDTH / 2 },
      { x: tipX, y: centerY },
    ]);
  }
}

function fillTriangle(ctx, corners) {
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  ctx.lineTo(corners[1].x, corners[1].y);
  ctx.lineTo(corners[2].x, corners[2].y);
  ctx.closePath();
  ctx.fillStyle = CENTER_MARKER_COLOR;
  ctx.fill();
}

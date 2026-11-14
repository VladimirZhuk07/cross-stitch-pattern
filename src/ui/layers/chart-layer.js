// View layer 3: the cross-stitch chart. Follows the view-layer contract in ../viewer.js.
//
// Every stitched cell is filled with a pale tint of its DMC color and, when the cells are
// large enough, shows its legend number (1..N) in black; empty cells are light grey with a
// diagonal hatch and no number. The rules (visible range, sizes, thresholds, tints) live in
// ../../core/chart-layout.js and ../../core/chart-tint.js; this module only draws them.
//
// Paint order, each step limited to the cells visible in the frame:
//   1. the cell image: one pixel per cell (tints and empty grey), scaled up unsmoothed
//   2. the empty-cell hatch: one diagonal per visible empty cell, in one path
//   3. numbers: one font for all, one fillText per visible stitched cell (skipped when the
//      cells are too small to read them)
//   4. thin lines, then bold lines (one path each, snapped to device pixels, so bold wins at
//      crossings)
//   5. rulers with row/column labels, the centre triangles, and the corner square
//      (./chart-rulers.js)
// Cached per pattern (by object identity): the cell image and the number texts.

import { EMPTY_CELL } from '../../core/pattern.js';
import { tintedCellPixels } from '../../core/chart-tint.js';
import {
  chartCellGeometry,
  visibleCellRange,
  cellCenter,
  numberFontSize,
  isEmptyHatchVisible,
  gridLines,
  chartLineWidths,
  snapLine,
} from '../../core/chart-layout.js';
import { drawRulers } from './chart-rulers.js';

const HATCH_COLOR = '#909090';
const NUMBER_COLOR = '#000000';
const THIN_LINE_COLOR = '#A0A0A0';
const BOLD_LINE_COLOR = '#000000';
const FONT_FAMILY = 'system-ui, sans-serif';

/**
 * Creates the Chart layer. It is available once a pattern exists (state.pattern is not null).
 * options.createCellCanvas(width, height)  makes the small canvas that holds one pixel per
 *   cell; defaults to an OffscreenCanvas. Tests pass a fake.
 * Returns a view layer { id: 'chart', isAvailable, render }.
 */
export function createChartLayer(options = {}) {
  const createCellCanvas = options.createCellCanvas ?? createOffscreenCanvas;
  let cachedPattern = null;
  let cachedCellImage = null;
  let cachedNumberTexts = [];

  // The cell image and the number texts '1'..'N' (indexed like pattern.legend) of a pattern.
  function cachedDrawingsOf(pattern) {
    if (pattern !== cachedPattern) {
      cachedPattern = pattern;
      cachedCellImage = createCellImage(createCellCanvas, pattern);
      cachedNumberTexts = pattern.legend.map((entry) => String(entry.number));
    }
    return { cellImage: cachedCellImage, numberTexts: cachedNumberTexts };
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
      const { cellImage, numberTexts } = cachedDrawingsOf(pattern);
      drawCellImage(ctx, cellImage, content, geometry, range);
      drawEmptyHatch(ctx, frame.pixelRatio, pattern, content, geometry, range);
      drawNumbers(ctx, pattern, content, geometry, range, numberTexts);
      drawGridLines(ctx, frame.pixelRatio, pattern, content, geometry, range);
      drawRulers(ctx, frame, pattern, content, geometry, range);
    },
  };
}

function createOffscreenCanvas(width, height) {
  return new OffscreenCanvas(width, height);
}

// A width × height canvas with one pixel per cell in its chart color.
function createCellImage(createCellCanvas, pattern) {
  const canvas = createCellCanvas(pattern.width, pattern.height);
  const cellCtx = canvas.getContext('2d');
  const image = cellCtx.createImageData(pattern.width, pattern.height);
  image.data.set(tintedCellPixels(pattern));
  cellCtx.putImageData(image, 0, 0);
  return canvas;
}

// Scales the visible part of the cell image onto the matching part of the content rectangle.
// Without smoothing every image pixel becomes exactly one cell, aligned like the other layers.
function drawCellImage(ctx, cellImage, content, geometry, range) {
  const columns = range.columnEnd - range.columnStart;
  const rows = range.rowEnd - range.rowStart;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    cellImage,
    range.columnStart,
    range.rowStart,
    columns,
    rows,
    content.x + range.columnStart * geometry.cellWidth,
    content.y + range.rowStart * geometry.cellHeight,
    columns * geometry.cellWidth,
    rows * geometry.cellHeight,
  );
}

// One diagonal from the bottom-left to the top-right corner of every visible empty cell, so
// "no stitch" never looks like a grey floss tint.
function drawEmptyHatch(ctx, pixelRatio, pattern, content, geometry, range) {
  if (!isEmptyHatchVisible(geometry.cellSize)) {
    return;
  }
  const { cellWidth, cellHeight } = geometry;
  let hasEmptyCell = false;
  ctx.beginPath();
  for (let row = range.rowStart; row < range.rowEnd; row++) {
    const rowOffset = row * pattern.width;
    const top = content.y + row * cellHeight;
    for (let column = range.columnStart; column < range.columnEnd; column++) {
      if (pattern.cells[rowOffset + column] === EMPTY_CELL) {
        const left = content.x + column * cellWidth;
        ctx.moveTo(left, top + cellHeight);
        ctx.lineTo(left + cellWidth, top);
        hasEmptyCell = true;
      }
    }
  }
  if (!hasEmptyCell) {
    return;
  }
  ctx.lineWidth = chartLineWidths(pixelRatio).thin / pixelRatio;
  ctx.strokeStyle = HATCH_COLOR;
  ctx.stroke();
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

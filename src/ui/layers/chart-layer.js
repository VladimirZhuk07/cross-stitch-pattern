// View layer 3: the cross-stitch chart, and with showsProgress the Progress layer (layer 4, see
// ./progress-layer.js). Follows the view-layer contract in ../viewer.js.
//
// Every stitched cell is filled with a pale tint of its DMC color and, when the cells are
// large enough, shows its legend number (1..N) in black; empty cells are light grey with a
// diagonal hatch and no number. The cells of the legend color in state.highlightedColor are
// red with bold white numbers (../../core/highlight.js). The rules (visible range, sizes,
// thresholds, tints) live in
// ../../core/chart-layout.js and ../../core/chart-tint.js; this module only draws them.
//
// Paint order, each step limited to the cells visible in the frame:
//   1. the cell colors: pictures with one pixel per cell (tints and empty grey), or one
//      averaged pixel per block of cells when a large pattern is zoomed out, built and cached
//      by ./pattern-picture.js; hard edges from one device pixel per cell up, smoothed below
//   2. the highlight, while a color is selected: a second picture from ./pattern-picture.js,
//      red where its block holds a selected stitch and transparent elsewhere, at a level whose
//      pixels cover at least one device pixel, drawn without smoothing (never averaged away)
//   3. Progress only: the stitched cells in their DMC color (./stitched-picture.js), over the
//      highlight, so the highlight shows only the stitches still to do
//   4. the empty-cell hatch: one diagonal per visible empty cell, in one path
//   5. numbers: one fillText per visible non-empty cell, black for all but the selected color,
//      then bold white for the selected color (skipped when the cells are too small to read);
//      on Progress, stitched cells get no number
//   6. thin lines, then bold lines (one path each, snapped to device pixels, so bold wins at
//      crossings)
//   7. rulers with row/column labels, the centre triangles, and the corner square
//      (./chart-rulers.js)
//   8. Progress only, while the frame has keyboard focus: the marker around the centre cell
// Cached per pattern (by object identity): the cell pictures and the number texts; the
// highlight picture per pattern and selected color, released when either changes.
// render returns true while a picture is still being built (see ../viewer.js).

import { EMPTY_CELL } from '../../core/pattern.js';
import { paleTint, EMPTY_CELL_COLOR } from '../../core/chart-tint.js';
import { colorTable } from '../../core/level-pixels.js';
import { isStitchSmallerThanDevicePixel } from '../../core/pattern-image.js';
import {
  chartCellGeometry,
  visibleCellRange,
  cellCenter,
  numberFontSize,
  isEmptyHatchVisible,
  gridLines,
  chartLineWidths,
  snapLine,
  cellAtPoint,
} from '../../core/chart-layout.js';
import { HIGHLIGHT_NUMBER_COLOR } from '../../core/highlight.js';
import { drawRulers } from './chart-rulers.js';
import { createPatternPicture } from './pattern-picture.js';
import { createHighlightPicture, NO_HIGHLIGHT } from './highlight-picture.js';
import { createStitchedPicture } from './stitched-picture.js';

const HATCH_COLOR = '#909090';
const NUMBER_COLOR = '#000000';
const THIN_LINE_COLOR = '#A0A0A0';
const BOLD_LINE_COLOR = '#000000';
const FONT_FAMILY = 'system-ui, sans-serif';
// The keyboard marker: a white band under a black line, visible on any cell color.
const MARKER_OUTER = { color: '#FFFFFF', width: 4 };
const MARKER_INNER = { color: '#000000', width: 2 };

/**
 * Creates the Chart layer. It is available once a pattern exists (state.pattern is not null).
 * It highlights the cells of state.highlightedColor (a legend index or null, see ../app-state.js).
 * options.createCellCanvas(width, height)  makes the canvases that hold the cell colors;
 *   defaults to an OffscreenCanvas. Tests pass a fake.
 * options.id             the layer id (default 'chart')
 * options.showsProgress  true for the Progress layer: draws state.progress (stitched cells,
 *                        no numbers on them) and the keyboard marker (state.isFrameKeyboardFocused)
 * Returns a view layer { id, isAvailable, render, cellAt }. cellAt(point) is the cell
 * { column, row, index } under a frame point in the last painted frame, or null outside the
 * grid, on a ruler, or before the first paint.
 */
export function createChartLayer(options = {}) {
  const createCellCanvas = options.createCellCanvas ?? createOffscreenCanvas;
  const cellPicture = createPatternPicture({ createCellCanvas, colorTableOf: chartColors });
  const highlight = createHighlightPicture(createCellCanvas);
  const stitched = options.showsProgress === true ? createStitchedPicture(createCellCanvas) : null;
  let lastPaint = null;
  let cachedPattern = null;
  let cachedNumberTexts = [];

  // The number texts '1'..'N' (indexed like pattern.legend) of a pattern.
  function numberTextsOf(pattern) {
    if (pattern !== cachedPattern) {
      cachedPattern = pattern;
      cachedNumberTexts = pattern.legend.map((entry) => String(entry.number));
    }
    return cachedNumberTexts;
  }

  // The stitched bits to draw: those of state.progress when this is the Progress layer and the
  // progress belongs to the pattern shown, else null.
  function stitchedBitsOf(state) {
    const { progress } = state;
    const isShown = stitched !== null && progress !== null && progress !== undefined && progress.pattern === state.pattern;
    return isShown && progress.stitchedCount > 0 ? progress.bits : null;
  }

  return {
    id: options.id ?? 'chart',
    isAvailable: (state) => state.pattern !== null,
    cellAt: (point) => (lastPaint === null ? null : cellAtPoint(lastPaint.content, lastPaint.pattern, point, lastPaint.rulers)),
    render(ctx, frame, state) {
      const { pattern } = state;
      const { content } = frame;
      const range = visibleCellRange(content, frame, pattern);
      lastPaint = null;
      if (range.columnStart === range.columnEnd || range.rowStart === range.rowEnd) {
        return false;
      }
      const geometry = chartCellGeometry(content, pattern);
      const highlightIndex = highlight.select(pattern, state.highlightedColor);
      const stitchedBits = stitchedBitsOf(state);
      const areCellsComplete = drawCellColors(ctx, cellPicture, frame, pattern, range);
      const isHighlightComplete = highlight.draw(ctx, frame, pattern, range);
      const isStitchedComplete = drawStitched(ctx, stitched, frame, state, range);
      drawEmptyHatch(ctx, frame.pixelRatio, pattern, content, geometry, range);
      drawNumbers(ctx, { pattern, content, geometry, range, numberTexts: numberTextsOf(pattern), highlightIndex, stitchedBits });
      drawGridLines(ctx, frame.pixelRatio, pattern, content, geometry, range);
      const rulers = drawRulers(ctx, frame, pattern, content, geometry, range);
      lastPaint = { content, pattern, rulers };
      if (stitched !== null && state.isFrameKeyboardFocused === true) {
        drawCentreMarker(ctx, frame, pattern, geometry);
      }
      return !areCellsComplete || !isHighlightComplete || !isStitchedComplete;
    },
  };
}

// Progress only: updates and draws the stitched picture with the tints' smoothing rule.
function drawStitched(ctx, stitched, frame, state, range) {
  if (stitched === null) {
    return true;
  }
  stitched.update(state.pattern, state.progress ?? null);
  ctx.imageSmoothingEnabled = isStitchSmallerThanDevicePixel(state.pattern, frame.content, frame.pixelRatio);
  return stitched.draw(ctx, frame, state.pattern, range);
}

// The keyboard marker around the cell at the frame centre (the cell Space or Enter toggles).
function drawCentreMarker(ctx, frame, pattern, geometry) {
  const cell = cellAtPoint(frame.content, pattern, { x: frame.width / 2, y: frame.height / 2 });
  if (cell === null) {
    return;
  }
  const left = frame.content.x + cell.column * geometry.cellWidth;
  const top = frame.content.y + cell.row * geometry.cellHeight;
  for (const line of [MARKER_OUTER, MARKER_INNER]) {
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + geometry.cellWidth, top);
    ctx.lineTo(left + geometry.cellWidth, top + geometry.cellHeight);
    ctx.lineTo(left, top + geometry.cellHeight);
    ctx.lineTo(left, top);
    ctx.lineWidth = line.width;
    ctx.strokeStyle = line.color;
    ctx.stroke();
  }
}

function createOffscreenCanvas(width, height) {
  return new OffscreenCanvas(width, height);
}

// The pale tint of each legend color; empty cells light grey.
function chartColors(pattern) {
  return colorTable(pattern.legend.map((entry) => paleTint(entry.hex)), EMPTY_CELL_COLOR);
}

// Draws the cell colors of the visible cells; returns true when their pictures are complete.
// Hard cell edges from one device pixel per cell up, like the DMC colors layer; below that,
// nearest-neighbor scaling would drop whole cells, so the picture is smoothed.
function drawCellColors(ctx, cellPicture, frame, pattern, range) {
  const isSmoothing = isStitchSmallerThanDevicePixel(pattern, frame.content, frame.pixelRatio);
  ctx.imageSmoothingEnabled = isSmoothing;
  if (isSmoothing) {
    ctx.imageSmoothingQuality = 'high';
  }
  return cellPicture.draw(ctx, frame, pattern, range);
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

// Numbers in two passes: black for every non-empty cell but the highlighted color, then bold
// white for the highlighted color (highlightIndex, or NO_HIGHLIGHT for none). Cells whose bit is
// set in stitchedBits (the Progress layer's stitched cells, or null) get no number.
function drawNumbers(ctx, numbers) {
  const { pattern, content, geometry, range, numberTexts, highlightIndex, stitchedBits } = numbers;
  const fontSize = numberFontSize(geometry.cellSize);
  if (fontSize === null) {
    return;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Column centres once per paint, so the loops below allocate nothing per cell.
  const columnCenters = new Float64Array(range.columnEnd - range.columnStart);
  for (let column = range.columnStart; column < range.columnEnd; column++) {
    columnCenters[column - range.columnStart] = cellCenter(content, pattern, column, 0).x;
  }
  const cells = { pattern, content, range, numberTexts, columnCenters, stitchedBits };
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = NUMBER_COLOR;
  fillNumbers(ctx, cells, (legendIndex) => legendIndex !== EMPTY_CELL && legendIndex !== highlightIndex);
  if (highlightIndex !== NO_HIGHLIGHT) {
    ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
    ctx.fillStyle = HIGHLIGHT_NUMBER_COLOR;
    fillNumbers(ctx, cells, (legendIndex) => legendIndex === highlightIndex);
  }
}

// One fillText, in the current font and color, per visible cell that is not stitched and whose
// legend index passes isDrawn.
function fillNumbers(ctx, cells, isDrawn) {
  const { pattern, content, range, numberTexts, columnCenters, stitchedBits } = cells;
  for (let row = range.rowStart; row < range.rowEnd; row++) {
    const y = cellCenter(content, pattern, range.columnStart, row).y;
    const rowOffset = row * pattern.width;
    for (let column = range.columnStart; column < range.columnEnd; column++) {
      const cellIndex = rowOffset + column;
      const legendIndex = pattern.cells[cellIndex];
      const isStitched = stitchedBits !== null && (stitchedBits[cellIndex >> 3] & (1 << (cellIndex & 7))) !== 0;
      if (!isStitched && isDrawn(legendIndex)) {
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

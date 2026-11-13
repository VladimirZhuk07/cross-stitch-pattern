// Layout rules of the stitch chart (the Chart view layer): which cells are visible, where
// lines, numbers and ruler labels go, and how large they are. Pure: no DOM, no canvas.
// The authoritative description is openspec/specs/stitch-chart/spec.md.
//
// Units are CSS px unless a function says otherwise. Shared inputs:
//   content  { x, y, width, height }: the image rectangle on screen (see contentRect in
//            ./viewport.js). A W × H stitch grid covers all of it.
//   frame    { width, height }: the view frame.
//   grid     { width, height }: stitches per row and number of rows, positive integers
//            (a Pattern from ./pattern.js works as it is).
//
// Shapes created here:
//   CellGeometry  { cellWidth, cellHeight, cellSize } from chartCellGeometry:
//                 the on-screen size of one cell; cellSize is the smaller of the two sides.
//   CellRange     { columnStart, columnEnd, rowStart, rowEnd } from visibleCellRange:
//                 half-open integer ranges (columnStart ≤ c < columnEnd) clamped to 0…W and
//                 0…H. The range is empty when a start equals its end. The stitch boundaries
//                 (grid lines) bounding the visible cells are columnStart … columnEnd inclusive.

/**
 * Cell numbers are drawn at this fraction of the cell size. Two digits of about 0.55 em
 * then take about 66 % of the cell width and their height (about 0.7 em) about 42 % of the
 * cell height, so numbers 1…99 never touch the grid lines.
 */
export const NUMBER_FONT_FRACTION = 0.6;

/** Smallest cell size in CSS px that shows numbers; below it they would be under 8.4 px. */
export const MIN_NUMBERED_CELL_SIZE = 14;

/** Every MAJOR_LINE_STEP stitches the chart has a bold line, as on printed charts. */
export const MAJOR_LINE_STEP = 10;

/** Smallest cell size in CSS px with thin lines; below it they would merge into grey. */
export const MIN_THIN_LINE_CELL_SIZE = 4;

/**
 * Returns the CellGeometry of a grid drawn into the content rectangle:
 * cellWidth = content.width / grid.width, cellHeight = content.height / grid.height,
 * cellSize = the smaller of the two (cells are square only within rounding).
 * Throws RangeError if the grid size is not a pair of positive integers.
 */
export function chartCellGeometry(content, grid) {
  assertGridSize(grid);
  const cellWidth = content.width / grid.width;
  const cellHeight = content.height / grid.height;
  return { cellWidth, cellHeight, cellSize: Math.min(cellWidth, cellHeight) };
}

/**
 * Returns the screen point { x, y } at the centre of the cell at column, row (0-based)
 * of a grid drawn into the content rectangle.
 */
export function cellCenter(content, grid, column, row) {
  return {
    x: content.x + ((column + 0.5) * content.width) / grid.width,
    y: content.y + ((row + 0.5) * content.height) / grid.height,
  };
}

/**
 * Returns the CellRange of the cells that intersect the frame, so a layer draws only those.
 * A cell that merely touches the frame edge is not visible.
 * Throws RangeError if the grid size is not a pair of positive integers.
 */
export function visibleCellRange(content, frame, grid) {
  const { cellWidth, cellHeight } = chartCellGeometry(content, grid);
  const columns = visibleSpan(content.x, cellWidth, frame.width, grid.width);
  const rows = visibleSpan(content.y, cellHeight, frame.height, grid.height);
  return { columnStart: columns.start, columnEnd: columns.end, rowStart: rows.start, rowEnd: rows.end };
}

/**
 * Returns the font size in CSS px for the cell numbers, the same for every cell and for
 * one- and two-digit numbers: NUMBER_FONT_FRACTION × cellSize. Returns null when the cell
 * size is below MIN_NUMBERED_CELL_SIZE, meaning "draw no numbers, only the grid".
 * cellSize  CellGeometry.cellSize, CSS px (≥ 0)
 * Throws RangeError if cellSize is negative or not a finite number.
 */
export function numberFontSize(cellSize) {
  assertNonNegativeNumber('cellSize', cellSize);
  if (cellSize < MIN_NUMBERED_CELL_SIZE) {
    return null;
  }
  return NUMBER_FONT_FRACTION * cellSize;
}

/**
 * Returns the grid lines (stitch boundaries) start … end inclusive along one axis, in order,
 * as a list of { index, isBold }. A line is bold when its index is a multiple of
 * MAJOR_LINE_STEP or equals count (the far border); line 0 is the near border. Thin lines
 * are left out when cellSize is below MIN_THIN_LINE_CELL_SIZE.
 * start, end  boundary indexes, 0 ≤ start ≤ end ≤ count (e.g. columnStart, columnEnd)
 * count       number of cells along the axis (grid width or height), positive integer
 * cellSize    CellGeometry.cellSize, CSS px
 * Throws RangeError if count is not a positive integer or cellSize is negative.
 */
export function gridLines(start, end, count, cellSize) {
  assertPositiveInteger('count', count);
  assertNonNegativeNumber('cellSize', cellSize);
  const hasThinLines = cellSize >= MIN_THIN_LINE_CELL_SIZE;
  const lines = [];
  for (let index = start; index <= end; index++) {
    const isBold = index % MAJOR_LINE_STEP === 0 || index === count;
    if (isBold || hasThinLines) {
      lines.push({ index, isBold });
    }
  }
  return lines;
}

/**
 * Returns the line widths { thin, bold } in device px for a device pixel ratio:
 * thin = 1 CSS px rounded to whole device px (at least 1), bold = twice that, so lines look
 * equally heavy on every screen and always cover whole device pixels.
 * pixelRatio  device px per CSS px (> 0)
 * Throws RangeError if pixelRatio is not a positive number.
 */
export function chartLineWidths(pixelRatio) {
  assertPositiveNumber('pixelRatio', pixelRatio);
  const thin = Math.max(1, Math.round(pixelRatio));
  return { thin, bold: 2 * thin };
}

/**
 * Returns the CSS px coordinate at which to centre a line so it covers whole device pixels
 * and stays crisp: a line of odd device width is centred on the middle of the device pixel
 * that contains position, an even one on the device pixel edge nearest to position.
 * position          the exact boundary position, CSS px
 * widthDevicePixels the line width in device px (from chartLineWidths)
 * pixelRatio        device px per CSS px (> 0)
 * Throws RangeError if pixelRatio is not a positive number.
 */
export function snapLine(position, widthDevicePixels, pixelRatio) {
  assertPositiveNumber('pixelRatio', pixelRatio);
  const devicePosition = position * pixelRatio;
  const isOddWidth = widthDevicePixels % 2 === 1;
  const snapped = isOddWidth ? Math.floor(devicePosition) + 0.5 : Math.round(devicePosition);
  return snapped / pixelRatio;
}

// The cells k with gridStart + k · cellLength < frameLength and
// gridStart + (k + 1) · cellLength > 0, clamped to 0…count.
function visibleSpan(gridStart, cellLength, frameLength, count) {
  const start = clamp(Math.floor((0 - gridStart) / cellLength), 0, count);
  const end = clamp(Math.ceil((frameLength - gridStart) / cellLength), 0, count);
  return { start, end: Math.max(start, end) };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function assertGridSize(grid) {
  assertPositiveInteger('grid.width', grid.width);
  assertPositiveInteger('grid.height', grid.height);
}

function assertPositiveNumber(name, value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number, got ${String(value)}`);
  }
}

function assertNonNegativeNumber(name, value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a number ≥ 0, got ${String(value)}`);
  }
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive integer, got ${String(value)}`);
  }
}

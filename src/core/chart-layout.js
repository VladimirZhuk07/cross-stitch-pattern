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

import { FIT_MARGIN } from './viewport.js';

/**
 * Cell numbers are drawn at this fraction of the cell size, sized for 3 digits in every
 * pattern (up to 489 colors), so the size does not jump when a pattern passes 99 colors.
 * Three digits of about 0.55 em then take about 74 % of the cell width and their height
 * (about 0.7 em) about 32 % of the cell height, so numbers 1…489 never touch the grid lines.
 */
export const NUMBER_FONT_FRACTION = 0.45;

/**
 * Smallest cell size in CSS px that shows numbers: 8.55 px text, no smaller than the earlier
 * 8.4 px floor, with about 2.4 px between a 3-digit number and each cell edge.
 */
export const MIN_NUMBERED_CELL_SIZE = 19;

/**
 * Smallest cell size in CSS px at which empty cells get a diagonal hatch line. Smaller cells
 * would turn the lines into grey noise (and many segments), so they keep only their fill.
 */
export const MIN_HATCH_CELL_SIZE = 6;

/** Every MAJOR_LINE_STEP stitches the chart has a bold line, as on printed charts. */
export const MAJOR_LINE_STEP = 10;

/**
 * Smallest distance between bold lines in CSS px. A 2 CSS px bold line every 8 px covers at
 * most 25 % of the grid, the same density as a 1 px thin line at MIN_THIN_LINE_CELL_SIZE;
 * closer bold lines would merge into a black mass when a large pattern is zoomed out.
 */
export const MIN_MAJOR_LINE_SPACING = 8;

// Bold line steps grow by this factor (10, 100, 1000, …) so they stay on the 10-stitch grid.
const MAJOR_STEP_GROWTH = 10;

/** Smallest cell size in CSS px with thin lines; below it they would merge into grey. */
export const MIN_THIN_LINE_CELL_SIZE = 4;

/**
 * Thickness of the rulers along the top and left grid edges, CSS px. Equal to the fit
 * margin, so at fit the rulers lie in the margin and cover no cell.
 */
export const RULER_SIZE = FIT_MARGIN;

/** Ruler label font size in CSS px, and the smallest size it may shrink to. */
export const RULER_FONT_SIZE = 10;
export const MIN_RULER_FONT_SIZE = 7;

/** The centre triangles: width along the ruler and depth into it from the grid edge, CSS px. */
export const CENTER_MARKER_WIDTH = 8;
export const CENTER_MARKER_DEPTH = 5;

/** Space between the ruler's outer edge and its labels, and between labels and triangles. */
export const RULER_PADDING = 1;
export const RULER_MARKER_GAP = 2;

/** Room for a row label across the left ruler: 24 − 5 − 2 − 1 = 16 CSS px. */
export const RULER_LABEL_ROOM = RULER_SIZE - CENTER_MARKER_DEPTH - RULER_MARKER_GAP - RULER_PADDING;

/**
 * Label every n stitches, n being the first step that leaves labels apart: these steps, then
 * the same 1, 2, 5 pattern for every further power of ten (1000, 2000, 5000, 10000, …).
 */
export const RULER_LABEL_STEPS = Object.freeze([10, 20, 50, 100, 200, 500]);

/** Smallest free space between two neighbouring ruler labels, CSS px. */
export const RULER_LABEL_GAP = 4;

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
 * one- to three-digit numbers: NUMBER_FONT_FRACTION × cellSize. Returns null when the cell
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
 * Returns true when empty cells of this size get their diagonal hatch line, i.e. from
 * MIN_HATCH_CELL_SIZE CSS px up. The hatch tells "no stitch" apart from grey floss tints.
 * cellSize  CellGeometry.cellSize, CSS px (≥ 0)
 * Throws RangeError if cellSize is negative or not a finite number.
 */
export function isEmptyHatchVisible(cellSize) {
  assertNonNegativeNumber('cellSize', cellSize);
  return cellSize >= MIN_HATCH_CELL_SIZE;
}

/**
 * Returns the step of the bold lines in stitches for a cell size: the first of 10, 100,
 * 1000, … whose lines are at least MIN_MAJOR_LINE_SPACING CSS px apart (10 for cells of
 * 0.8 px and more).
 * cellSize  CellGeometry.cellSize, CSS px (> 0)
 * Throws RangeError if cellSize is not a positive number.
 */
export function majorLineStep(cellSize) {
  assertPositiveNumber('cellSize', cellSize);
  let step = MAJOR_LINE_STEP;
  while (step * cellSize < MIN_MAJOR_LINE_SPACING) {
    step *= MAJOR_STEP_GROWTH;
  }
  return step;
}

/**
 * Returns the grid lines (stitch boundaries) start … end inclusive along one axis, in order,
 * as a list of { index, isBold }. A line is bold when its index is a multiple of the bold
 * step (majorLineStep(cellSize): 10, or 100, 1000, … for small cells) or equals count (the
 * far border); line 0 is the near border. Thin lines are left out when cellSize is below
 * MIN_THIN_LINE_CELL_SIZE; then only bold lines are visited, so the work follows the number
 * of lines, not the number of stitches.
 * start, end  boundary indexes, 0 ≤ start ≤ end ≤ count (e.g. columnStart, columnEnd)
 * count       number of cells along the axis (grid width or height), positive integer
 * cellSize    CellGeometry.cellSize, CSS px (> 0)
 * Throws RangeError if count is not a positive integer or cellSize is not positive.
 */
export function gridLines(start, end, count, cellSize) {
  assertPositiveInteger('count', count);
  const majorStep = majorLineStep(cellSize);
  if (cellSize < MIN_THIN_LINE_CELL_SIZE) {
    return boldGridLines(start, end, count, majorStep);
  }
  const lines = [];
  for (let index = start; index <= end; index++) {
    lines.push({ index, isBold: index % majorStep === 0 || index === count });
  }
  return lines;
}

// The bold lines start … end: multiples of majorStep, plus the far border.
function boldGridLines(start, end, count, majorStep) {
  const lines = [];
  for (let index = Math.ceil(start / majorStep) * majorStep; index <= end; index += majorStep) {
    lines.push({ index, isBold: true });
  }
  if (end === count && count % majorStep !== 0) {
    lines.push({ index: count, isBold: true });
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

/**
 * Returns where the rulers go, as { top, left }: top is the y of the top ruler's upper
 * edge, left the x of the left ruler's left edge. Each ruler sits directly outside its grid
 * edge and sticks to the frame edge (0) once that grid edge is scrolled out of view.
 */
export function rulerPlacement(content) {
  return {
    top: Math.max(0, content.y - RULER_SIZE),
    left: Math.max(0, content.x - RULER_SIZE),
  };
}

/**
 * Returns the line indexes to label, in order: the multiples of step from max(start, 1)
 * to end (line 0 is never labelled). The label text is the index itself, i.e. the number of
 * stitches counted from the top-left.
 * start, end  visible boundary indexes (e.g. columnStart, columnEnd)
 * step        label step from rulerLabelStep, positive integer
 * Throws RangeError if step is not a positive integer.
 */
export function rulerLabels(start, end, step) {
  assertPositiveInteger('step', step);
  const labels = [];
  const first = Math.max(step, Math.ceil(start / step) * step);
  for (let index = first; index <= end; index += step) {
    labels.push(index);
  }
  return labels;
}

/**
 * Returns how many stitches apart ruler labels are: the first step of 10, 20, 50, 100, 200,
 * 500, 1000, 2000, 5000, … (RULER_LABEL_STEPS, continued without end) whose length on screen
 * is at least the widest label plus RULER_LABEL_GAP. Both rulers use the same step so the
 * counts line up.
 * cellSize           CellGeometry.cellSize, CSS px (> 0)
 * widestLabelWidth   measured width of the widest label text, CSS px
 * Throws RangeError if cellSize is not a positive number (no step would ever be long enough).
 */
export function rulerLabelStep(cellSize, widestLabelWidth) {
  assertPositiveNumber('cellSize', cellSize);
  const neededLength = widestLabelWidth + RULER_LABEL_GAP;
  let steps = RULER_LABEL_STEPS;
  for (;;) {
    for (const step of steps) {
      if (step * cellSize >= neededLength) {
        return step;
      }
    }
    // The next decade of the 1, 2, 5 pattern: 1000, 2000, 5000, then 10000, 20000, 50000, …
    steps = steps.slice(-3).map((step) => step * MAJOR_STEP_GROWTH);
  }
}

/**
 * Returns the font size in CSS px for both rulers: RULER_FONT_SIZE, shrunk in proportion
 * when the widest row label would not fit in RULER_LABEL_ROOM, but not below
 * MIN_RULER_FONT_SIZE.
 * widestRowLabelWidth  measured width of the widest row label at RULER_FONT_SIZE, CSS px
 */
export function rulerFontSize(widestRowLabelWidth) {
  if (widestRowLabelWidth <= RULER_LABEL_ROOM) {
    return RULER_FONT_SIZE;
  }
  const shrunk = (RULER_FONT_SIZE * RULER_LABEL_ROOM) / widestRowLabelWidth;
  return Math.max(MIN_RULER_FONT_SIZE, shrunk);
}

/**
 * Returns the centre of the grid { column, row } in stitches from the top-left:
 * W / 2 and H / 2 (x.5 means the middle of a cell, a whole number a grid line).
 */
export function chartCenter(grid) {
  return { column: grid.width / 2, row: grid.height / 2 };
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

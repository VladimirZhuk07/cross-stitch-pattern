// The rulers of the Chart layer (./chart-layer.js): row/column counts every 10 stitches, the
// centre triangles and the corner square. Layout rules live in ../../core/chart-layout.js.

import {
  chartCenter,
  rulerPlacement,
  rulerLabels,
  rulerLabelStep,
  rulerFontSize,
  leftRulerWidth,
  MAJOR_LINE_STEP,
  RULER_SIZE,
  RULER_FONT_SIZE,
  CENTER_MARKER_WIDTH,
  CENTER_MARKER_DEPTH,
  RULER_MARKER_GAP,
} from '../../core/chart-layout.js';

const RULER_BACKGROUND = '#F6F4F0';
const RULER_TEXT_COLOR = '#1F1F1F';
const CENTER_MARKER_COLOR = '#000000';
const FONT_FAMILY = 'system-ui, sans-serif';

/**
 * Draws the rulers of the Chart layer: a band along the top and the left edge of the grid
 * with the stitch counts of every labelled bold line, the centre triangles, and the corner
 * square where both bands meet. Each band sits just outside its grid edge and sticks to the
 * frame edge once that grid edge is scrolled out of view (see ../../core/chart-layout.js).
 * The left band is RULER_SIZE wide, or wider when the widest row label (5 digits) needs it.
 * ctx       the frame's 2D context (CSS px units)
 * frame     the view frame { width, height, ... } from ../viewer.js
 * pattern   the Pattern being drawn (../../core/pattern.js)
 * content   the content rectangle; geometry, range from chartCellGeometry, visibleCellRange
 * Returns where the rulers were drawn, { top, left, leftWidth } (see rulerPlacement in
 * ../../core/chart-layout.js), so a click on a ruler can be told from a click on a cell.
 */
export function drawRulers(ctx, frame, pattern, content, geometry, range) {
  const { step, leftWidth } = chooseRulerFont(ctx, pattern, geometry.cellSize);
  const placement = rulerPlacement(content, leftWidth);
  const span = {
    left: Math.max(0, content.x),
    right: Math.min(frame.width, content.x + content.width),
    top: Math.max(0, content.y),
    bottom: Math.min(frame.height, content.y + content.height),
  };
  const center = chartCenter(pattern);
  const ruler = { ctx, content, geometry, placement, span, leftWidth };

  drawTopRuler(ruler, rulerLabels(range.columnStart, range.columnEnd, step), content.x + center.column * geometry.cellWidth);
  drawLeftRuler(ruler, rulerLabels(range.rowStart, range.rowEnd, step), content.y + center.row * geometry.cellHeight);

  // The square where both rulers meet hides labels that would run into each other.
  ctx.fillStyle = RULER_BACKGROUND;
  ctx.fillRect(placement.left, placement.top, leftWidth, RULER_SIZE);
  return { top: placement.top, left: placement.left, leftWidth };
}

// Sets the ruler font (shrunk if the widest row label does not fit) and returns
// { step, leftWidth }: the label step, measured with that font so neighbouring labels never
// overlap, and the left ruler's width, wide enough for the widest row label in that font.
function chooseRulerFont(ctx, pattern, cellSize) {
  ctx.font = `${RULER_FONT_SIZE}px ${FONT_FAMILY}`;
  const widestRowLabel = String(largestLabel(pattern.height));
  const fontSize = rulerFontSize(ctx.measureText(widestRowLabel).width);
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  const widestLabel = String(largestLabel(Math.max(pattern.width, pattern.height)));
  return {
    step: rulerLabelStep(cellSize, ctx.measureText(widestLabel).width),
    leftWidth: leftRulerWidth(ctx.measureText(widestRowLabel).width),
  };
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
  const { ctx, content, geometry, placement, span, leftWidth } = ruler;
  ctx.fillStyle = RULER_BACKGROUND;
  ctx.fillRect(placement.left, span.top, leftWidth, span.bottom - span.top);

  // Labels right-aligned just before the triangle area next to the grid edge.
  ctx.fillStyle = RULER_TEXT_COLOR;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const labelRight = placement.left + leftWidth - CENTER_MARKER_DEPTH - RULER_MARKER_GAP;
  for (const index of labels) {
    ctx.fillText(String(index), labelRight, content.y + index * geometry.cellHeight);
  }

  if (centerY >= span.top && centerY <= span.bottom) {
    const tipX = placement.left + leftWidth;
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

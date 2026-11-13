// Renders the Chart layer (src/ui/layers/chart-layer.js) with hand-built patterns into a
// recording fake context and checks what it draws (see openspec/specs/stitch-chart/spec.md).
// The layer uses only the context it is given, so this runs in Node.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createChartLayer } from '../../src/ui/layers/chart-layer.js';
import { createRecordingContext } from '../helpers/recording-context.js';
import { assertClose } from '../helpers/assert-close.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const BLANC = { code: 'BLANC', name: 'White', hex: '#FFFFFF' };
const EMPTY_FILL = '#E0E0E0';
const POSITION_TOLERANCE = 1e-9;

// Legend 1 = 310 (3 stitches), 2 = 321 (2 stitches); cells [1, 0, 0, -1, 0, 1].
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

function render(pattern, content, frameSize = { width: 400, height: 300 }, pixelRatio = 1) {
  const recording = createRecordingContext();
  const frame = {
    width: frameSize.width,
    height: frameSize.height,
    pixelRatio,
    viewport: { scale: 1, offsetX: content.x, offsetY: content.y },
    content,
  };
  createChartLayer().render(recording.ctx, frame, { pattern, activeLayer: 'chart' });
  return recording;
}

function cellNumbers(recording, fontSize) {
  return recording.texts.filter((text) => Math.abs(text.fontSize - fontSize) < 1e-9);
}

function coversRect(rect, x, y, width, height) {
  return rect.x <= x && rect.y <= y && rect.x + rect.width >= x + width && rect.y + rect.height >= y + height;
}

describe('chart layer: cells and numbers', () => {
  it('draws the numbers of the 3 × 2 pattern centred in their 20 px cells', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    const numbers = cellNumbers(recording, 12).map(({ text, x, y }) => ({ text, x, y }));
    assert.deepEqual(numbers, [
      { text: '2', x: 10, y: 10 },
      { text: '1', x: 30, y: 10 },
      { text: '1', x: 50, y: 10 },
      { text: '1', x: 30, y: 30 },
      { text: '2', x: 50, y: 30 },
    ]);
  });

  it('draws the numbers in black, centred horizontally and vertically', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    for (const number of cellNumbers(recording, 12)) {
      assert.equal(number.fillStyle, '#000000');
      assert.equal(number.textAlign, 'center');
      assert.equal(number.textBaseline, 'middle');
    }
  });

  it('fills the grid white and never with a DMC color', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    const white = recording.fills.filter((fill) => fill.fillStyle === '#FFFFFF');
    assert.ok(white.some((fill) => fill.rects.some((rect) => coversRect(rect, 0, 0, 60, 40))), 'white grid area');
    assert.ok(!recording.fills.some((fill) => fill.fillStyle === '#C72B3B'), 'no red fill');
  });

  it('fills the empty cell light grey and puts no number in it', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    const grey = recording.fills.filter((fill) => fill.fillStyle === EMPTY_FILL);
    assert.ok(grey.some((fill) => fill.rects.some((rect) => coversRect(rect, 0, 20, 20, 20))), 'grey cell (0, 1)');
    assert.ok(!recording.texts.some((text) => text.x === 10 && text.y === 30), 'no number in cell (0, 1)');
  });

  it('tells an empty cell from white floss', () => {
    const pattern = buildPattern({ width: 2, height: 1, cells: [0, -1], colors: [BLANC] });
    const recording = render(pattern, { x: 0, y: 0, width: 40, height: 20 });
    assert.deepEqual(cellNumbers(recording, 12).map(({ text, x, y }) => ({ text, x, y })), [{ text: '1', x: 10, y: 10 }]);
    const grey = recording.fills.filter((fill) => fill.fillStyle === EMPTY_FILL);
    assert.ok(grey.some((fill) => fill.rects.some((rect) => coversRect(rect, 20, 0, 20, 20))), 'grey cell (1, 0)');
    assert.ok(!grey.some((fill) => fill.rects.some((rect) => coversRect(rect, 0, 0, 20, 20))), 'BLANC cell not grey');
  });

  it('fills every cell of a pattern without stitches grey and draws no number', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const recording = render(pattern, { x: 0, y: 0, width: 40, height: 40 });
    const greyRects = recording.fills.filter((fill) => fill.fillStyle === EMPTY_FILL).flatMap((fill) => fill.rects);
    for (const [x, y] of [[0, 0], [20, 0], [0, 20], [20, 20]]) {
      assert.ok(greyRects.some((rect) => coversRect(rect, x, y, 20, 20)), `grey cell at ${x}, ${y}`);
    }
    assert.equal(cellNumbers(recording, 12).length, 0);
  });

  it('uses the smaller side of non-square cells for the number size', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 72, height: 40 });
    assert.equal(cellNumbers(recording, 12).length, 5);
  });

  it('draws no cell numbers when cells are 13.9 px', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 3 * 13.9, height: 2 * 13.9 });
    assert.equal(recording.texts.length, 0);
  });

  it('draws numbers at 8.4 px in 14 px cells', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 42, height: 28 });
    const numbers = recording.texts.filter((text) => Math.abs(text.fontSize - 8.4) < 1e-9);
    assert.equal(numbers.length, 5);
    assertClose(numbers[0].x, 7, POSITION_TOLERANCE, 'x of the first number');
  });
});

describe('chart layer: visible range', () => {
  it('draws exactly the 300 visible numbers of a zoomed 300 × 300 pattern', () => {
    const recording = render(solidPattern(300, 300), { x: 0, y: 0, width: 6000, height: 6000 });
    assert.equal(cellNumbers(recording, 12).length, 300);
  });

  it('draws nothing when the grid is right of the frame', () => {
    const recording = render(solidPattern(100, 100), { x: 500, y: 0, width: 1000, height: 1000 });
    assert.equal(recording.drawCallCount(), 0);
  });
});

describe('chart layer: availability', () => {
  it('is available only once a pattern exists', () => {
    const layer = createChartLayer();
    assert.equal(layer.isAvailable({ pattern: null }), false);
    assert.equal(layer.isAvailable({ pattern: threeByTwoPattern() }), true);
  });
});

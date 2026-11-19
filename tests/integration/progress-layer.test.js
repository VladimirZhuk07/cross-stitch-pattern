// Renders the Progress layer (src/ui/layers/progress-layer.js) into a recording fake context
// (see openspec/specs/stitch-progress/spec.md, "The Progress layer starts as the Chart",
// "Stitched cells show their DMC color", "Stitches can be marked with the keyboard",
// "The highlight shows the stitches still to do").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createProgress, toggleStitch } from '../../src/core/progress.js';
import { createChartLayer } from '../../src/ui/layers/chart-layer.js';
import { createProgressLayer } from '../../src/ui/layers/progress-layer.js';
import { createRecordingContext, createFakeCellCanvasFactory } from '../helpers/recording-context.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const CELLS_20 = { x: 0, y: 0, width: 60, height: 40 };
const FRAME = { width: 400, height: 300 };

// Legend index 0 = 310 at cells 1, 2, 4; index 1 = 321 at cells 0, 5; cell 3 empty.
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function frameFor(content, frameSize) {
  return { ...frameSize, pixelRatio: 1, viewport: { scale: 1, offsetX: content.x, offsetY: content.y }, content };
}

// A layer (Progress by default) with a fake canvas factory that renders states one after another.
function createTestLayer(create = createProgressLayer) {
  const factory = createFakeCellCanvasFactory();
  const layer = create({ createCellCanvas: factory.createCellCanvas });
  function renderState(state, content = CELLS_20, frameSize = FRAME) {
    const recording = createRecordingContext();
    layer.render(recording.ctx, frameFor(content, frameSize), { activeLayer: layer.id, highlightedColor: null, ...state });
    return recording;
  }
  return { layer, renderState, canvases: factory.canvases };
}

function pixelAt(canvas, column, row) {
  const offset = (row * canvas.width + column) * 4;
  return [...canvas.pixels.subarray(offset, offset + 4)];
}

// What a recording drew, without the canvas objects (which differ between layers).
function drawn(recording) {
  return {
    images: recording.images.map(({ args, imageSmoothingEnabled }) => ({ args, imageSmoothingEnabled })),
    texts: recording.texts,
    fills: recording.fills,
    strokes: recording.strokes,
  };
}

describe('progress layer: availability', () => {
  it('is the layer "progress", available exactly while a pattern exists', () => {
    const { layer } = createTestLayer();
    assert.equal(layer.id, 'progress');
    assert.equal(layer.isAvailable({ pattern: null }), false);
    assert.equal(layer.isAvailable({ pattern: threeByTwoPattern() }), true);
  });
});

describe('progress layer: cells', () => {
  it('draws exactly what the Chart draws while nothing is stitched', () => {
    const pattern = threeByTwoPattern();
    const progress = createProgress(pattern);
    const asProgress = createTestLayer().renderState({ pattern, progress });
    const asChart = createTestLayer(createChartLayer).renderState({ pattern, progress });
    assert.deepEqual(drawn(asProgress), drawn(asChart));
  });

  it('draws stitched cells in their DMC color over the tints, without a number', () => {
    const pattern = threeByTwoPattern();
    const progress = toggleStitch(createProgress(pattern), 5); // cell (2, 1), 321
    const recording = createTestLayer().renderState({ pattern, progress });
    assert.equal(recording.images.length, 2);
    const stitched = recording.images[1].image;
    assert.deepEqual(pixelAt(stitched, 2, 1), [0xC7, 0x2B, 0x3B, 255]);
    for (const [column, row] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]]) {
      assert.deepEqual(pixelAt(stitched, column, row), [0, 0, 0, 0], `cell (${column}, ${row})`);
    }
    const numbers = recording.texts.filter((text) => Math.abs(text.fontSize - 9) < 1e-9);
    assert.deepEqual(numbers.map(({ text, x, y }) => [text, x, y]), [['2', 10, 10], ['1', 30, 10], ['1', 50, 10], ['1', 30, 30]]);
  });

  it('shows the highlight only in cells that are not stitched', () => {
    const pattern = threeByTwoPattern();
    const progress = toggleStitch(createProgress(pattern), 5);
    const recording = createTestLayer().renderState({ pattern, progress, highlightedColor: 1 });
    assert.equal(recording.images.length, 3);
    assert.deepEqual(pixelAt(recording.images[1].image, 0, 0), [176, 0, 0, 255], 'highlight second');
    assert.deepEqual(pixelAt(recording.images[2].image, 2, 1), [0xC7, 0x2B, 0x3B, 255], 'stitched on top');
    const boldTwos = recording.texts.filter((text) => text.text === '2' && /bold/.test(text.font));
    assert.deepEqual(boldTwos.map(({ x, y, fillStyle }) => [x, y, fillStyle]), [[10, 10, '#FFFFFF']]);
  });

  it('refreshes one pixel for the next toggle instead of building a new picture', () => {
    const pattern = threeByTwoPattern();
    const { renderState, canvases } = createTestLayer();
    const first = toggleStitch(createProgress(pattern), 5);
    renderState({ pattern, progress: first });
    const canvasCount = canvases.length;
    const stitched = canvases.at(-1);
    const putsBefore = stitched.puts.length;
    renderState({ pattern, progress: toggleStitch(first, 0) });
    assert.equal(canvases.length, canvasCount);
    assert.equal(stitched.puts.length, putsBefore + 1);
    assert.deepEqual(pixelAt(stitched, 0, 0), [0xC7, 0x2B, 0x3B, 255]);
  });

  it('builds a new stitched picture for the progress of another pattern', () => {
    const { renderState, canvases } = createTestLayer();
    const firstPattern = threeByTwoPattern();
    renderState({ pattern: firstPattern, progress: toggleStitch(createProgress(firstPattern), 5) });
    const firstStitched = canvases.at(-1);
    const secondPattern = threeByTwoPattern();
    renderState({ pattern: secondPattern, progress: toggleStitch(createProgress(secondPattern), 0) });
    assert.deepEqual([firstStitched.width, firstStitched.height], [0, 0]);
    assert.deepEqual(pixelAt(canvases.at(-1), 0, 0), [0xC7, 0x2B, 0x3B, 255]);
  });

  it('ignores a progress that belongs to another pattern', () => {
    const pattern = threeByTwoPattern();
    const progress = toggleStitch(createProgress(threeByTwoPattern()), 5);
    assert.equal(createTestLayer().renderState({ pattern, progress }).images.length, 1);
  });

  it('is not affected on the Chart layer', () => {
    const pattern = threeByTwoPattern();
    const progress = toggleStitch(createProgress(pattern), 5);
    const recording = createTestLayer(createChartLayer).renderState({ pattern, progress });
    assert.equal(recording.images.length, 1);
    assert.ok(recording.texts.some((text) => text.text === '2' && text.x === 50 && text.y === 30));
  });
});

describe('progress layer: keyboard marker and cells under a point', () => {
  const FRAME_60 = { width: 60, height: 40 }; // centre (30, 20) = cell (1, 1)

  // The segments of a closed rectangle as the recording stores them.
  function rectangle(left, top, right, bottom) {
    return [
      { x1: left, y1: top, x2: right, y2: top },
      { x1: right, y1: top, x2: right, y2: bottom },
      { x1: right, y1: bottom, x2: left, y2: bottom },
      { x1: left, y1: bottom, x2: left, y2: top },
    ];
  }

  it('outlines the centre cell, white then black, while the frame has keyboard focus', () => {
    const pattern = threeByTwoPattern();
    const recording = createTestLayer().renderState({ pattern, progress: createProgress(pattern), isFrameKeyboardFocused: true }, CELLS_20, FRAME_60);
    const [white, black] = recording.strokes.slice(-2);
    assert.deepEqual([white.strokeStyle, white.lineWidth], ['#FFFFFF', 4]);
    assert.deepEqual([black.strokeStyle, black.lineWidth], ['#000000', 2]);
    assert.deepEqual(black.segments, rectangle(20, 20, 40, 40));
    assert.deepEqual(white.segments, rectangle(20, 20, 40, 40));
  });

  it('draws no marker without keyboard focus', () => {
    const pattern = threeByTwoPattern();
    const withFocus = createTestLayer().renderState({ pattern, progress: createProgress(pattern), isFrameKeyboardFocused: true }, CELLS_20, FRAME_60);
    const without = createTestLayer().renderState({ pattern, progress: createProgress(pattern), isFrameKeyboardFocused: false }, CELLS_20, FRAME_60);
    assert.equal(without.strokes.length, withFocus.strokes.length - 2);
  });

  it('finds the cell under a point from its last paint, never under a ruler', () => {
    const pattern = threeByTwoPattern();
    const { layer, renderState } = createTestLayer();
    assert.equal(layer.cellAt({ x: 50, y: 30 }), null, 'nothing painted yet');
    renderState({ pattern, progress: createProgress(pattern) });
    assert.deepEqual(layer.cellAt({ x: 50, y: 30 }), { column: 2, row: 1, index: 5 });
    assert.equal(layer.cellAt({ x: 50, y: 10 }), null, 'the top ruler covers the first row here');
    assert.equal(layer.cellAt({ x: 70, y: 30 }), null, 'outside the grid');
  });
});

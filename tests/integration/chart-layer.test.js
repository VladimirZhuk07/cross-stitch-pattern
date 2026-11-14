// Renders the Chart layer (src/ui/layers/chart-layer.js) with hand-built patterns into a
// recording fake context and checks what it draws (see openspec/specs/stitch-chart/spec.md).
// The layer uses only the context it is given and a cell canvas from an injected factory,
// so this runs in Node.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createChartLayer } from '../../src/ui/layers/chart-layer.js';
import { tintedCellPixels } from '../../src/core/chart-tint.js';
import { createRecordingContext, createFakeCellCanvasFactory } from '../helpers/recording-context.js';
import { assertClose } from '../helpers/assert-close.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const BLANC = { code: 'BLANC', name: 'White', hex: '#FFFFFF' };
const HATCH_COLOR = '#909090';
const POSITION_TOLERANCE = 1e-9;

// Legend 1 = 310 (3 stitches), 2 = 321 (2 stitches); cells [1, 0, 0, -1, 0, 1].
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

function frameFor(content, frameSize, pixelRatio) {
  return {
    width: frameSize.width,
    height: frameSize.height,
    pixelRatio,
    viewport: { scale: 1, offsetX: content.x, offsetY: content.y },
    content,
  };
}

// Renders a pattern once with a fresh layer; returns the recording plus the cell canvases made.
function render(pattern, content, frameSize = { width: 400, height: 300 }, pixelRatio = 1) {
  const recording = createRecordingContext();
  const factory = createFakeCellCanvasFactory();
  const layer = createChartLayer({ createCellCanvas: factory.createCellCanvas });
  layer.render(recording.ctx, frameFor(content, frameSize, pixelRatio), { pattern, activeLayer: 'chart' });
  recording.canvases = factory.canvases;
  return recording;
}

function hatchSegments(recording) {
  return recording.strokes.filter((stroke) => stroke.strokeStyle === HATCH_COLOR).flatMap((stroke) => stroke.segments);
}

function cellNumbers(recording, fontSize) {
  return recording.texts.filter((text) => Math.abs(text.fontSize - fontSize) < 1e-9);
}

describe('chart layer: cells and numbers', () => {
  it('draws the numbers of the 3 × 2 pattern centred in their 20 px cells', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    const numbers = cellNumbers(recording, 9).map(({ text, x, y }) => ({ text, x, y }));
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
    for (const number of cellNumbers(recording, 9)) {
      assert.equal(number.fillStyle, '#000000');
      assert.equal(number.textAlign, 'center');
      assert.equal(number.textBaseline, 'middle');
    }
  });

  it('draws the tinted cell image once, unsmoothed, over the whole 3 × 2 grid', () => {
    const pattern = threeByTwoPattern();
    const recording = render(pattern, { x: 0, y: 0, width: 60, height: 40 });
    assert.equal(recording.images.length, 1);
    const [drawn] = recording.images;
    assert.equal(drawn.imageSmoothingEnabled, false);
    assert.deepEqual(drawn.args, [0, 0, 3, 2, 0, 0, 60, 40]);
    assert.equal(recording.canvases.length, 1);
    assert.equal(drawn.image, recording.canvases[0]);
    assert.deepEqual([...recording.canvases[0].pixels], [...tintedCellPixels(pattern)]);
  });

  it('fills no white grid area and no cell with a full DMC color', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    assert.ok(!recording.fills.some((fill) => fill.fillStyle === '#FFFFFF'), 'no white fill');
    assert.ok(!recording.fills.some((fill) => fill.fillStyle === '#C72B3B'), 'no red fill');
  });

  it('hatches the empty cell from its bottom-left to its top-right corner and puts no number in it', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 60, height: 40 });
    assert.deepEqual(hatchSegments(recording), [{ x1: 0, y1: 40, x2: 20, y2: 20 }]);
    assert.ok(!recording.texts.some((text) => text.x === 10 && text.y === 30), 'no number in cell (0, 1)');
  });

  it('tells an empty cell from white floss', () => {
    const pattern = buildPattern({ width: 2, height: 1, cells: [0, -1], colors: [BLANC] });
    const recording = render(pattern, { x: 0, y: 0, width: 40, height: 20 });
    assert.deepEqual(cellNumbers(recording, 9).map(({ text, x, y }) => ({ text, x, y })), [{ text: '1', x: 10, y: 10 }]);
    assert.deepEqual(hatchSegments(recording), [{ x1: 20, y1: 20, x2: 40, y2: 0 }]);
  });

  it('hatches every cell of a pattern without stitches and draws no number', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const recording = render(pattern, { x: 0, y: 0, width: 40, height: 40 });
    assert.equal(hatchSegments(recording).length, 4);
    assert.equal(cellNumbers(recording, 9).length, 0);
  });

  it('hatches empty cells of 6 px but not of 5.9 px', () => {
    const at6 = render(threeByTwoPattern(), { x: 0, y: 0, width: 18, height: 12 });
    const below = render(threeByTwoPattern(), { x: 0, y: 0, width: 3 * 5.9, height: 2 * 5.9 });
    assert.equal(hatchSegments(at6).length, 1);
    assert.equal(hatchSegments(below).length, 0);
  });

  it('shows tints but no numbers in a fitted 100 × 100 pattern (7.52 px cells)', () => {
    const recording = render(solidPattern(100, 100), { x: 124, y: 24, width: 752, height: 752 }, { width: 1000, height: 800 });
    assert.equal(recording.images.length, 1);
    assert.deepEqual(recording.images[0].args, [0, 0, 100, 100, 124, 24, 752, 752]);
    const texts = recording.texts.map((text) => text.text);
    assert.ok(texts.every((text) => Number(text) % 10 === 0), `only ruler labels, got ${texts.join(' ')}`);
  });

  it('uses the smaller side of non-square cells for the number size', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 72, height: 40 });
    assert.equal(cellNumbers(recording, 9).length, 5);
  });

  it('draws no cell numbers when cells are 18.9 px', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 3 * 18.9, height: 2 * 18.9 });
    assert.equal(recording.texts.length, 0);
  });

  it('draws numbers at 8.55 px in 19 px cells', () => {
    const recording = render(threeByTwoPattern(), { x: 0, y: 0, width: 57, height: 38 });
    const numbers = recording.texts.filter((text) => Math.abs(text.fontSize - 8.55) < 1e-9);
    assert.equal(numbers.length, 5);
    assertClose(numbers[0].x, 9.5, POSITION_TOLERANCE, 'x of the first number');
  });
});

describe('chart layer: visible range', () => {
  it('draws exactly the 300 visible numbers of a zoomed 300 × 300 pattern', () => {
    const recording = render(solidPattern(300, 300), { x: 0, y: 0, width: 6000, height: 6000 });
    assert.equal(cellNumbers(recording, 9).length, 300);
  });

  it('draws only the visible part of the cell image of a panned 100 × 100 pattern', () => {
    const recording = render(solidPattern(100, 100), { x: -95, y: -40, width: 1000, height: 1000 });
    assert.deepEqual(recording.images[0].args, [9, 4, 41, 30, -5, 0, 410, 300]);
  });

  it('builds the cell image once per pattern', () => {
    const recording = createRecordingContext();
    const factory = createFakeCellCanvasFactory();
    const layer = createChartLayer({ createCellCanvas: factory.createCellCanvas });
    const content = { x: 0, y: 0, width: 60, height: 40 };
    const first = threeByTwoPattern();
    layer.render(recording.ctx, frameFor(content, { width: 400, height: 300 }, 1), { pattern: first });
    layer.render(recording.ctx, frameFor(content, { width: 400, height: 300 }, 1), { pattern: first });
    assert.equal(factory.canvases.length, 1);
    layer.render(recording.ctx, frameFor(content, { width: 400, height: 300 }, 1), { pattern: threeByTwoPattern() });
    assert.equal(factory.canvases.length, 2);
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

function isVertical(segment) {
  return segment.x1 === segment.x2;
}

function segmentsOf(recording, strokeStyle) {
  return recording.strokes.filter((stroke) => stroke.strokeStyle === strokeStyle).flatMap((stroke) => stroke.segments);
}

function hasTriangleWithTip(recording, x, y) {
  return recording.fills.some((fill) => fill.fillStyle === '#000000'
    && fill.polygons.some((polygon) => polygon.length === 3 && polygon.some((point) => point.x === x && point.y === y)));
}

describe('chart layer: grid lines', () => {
  const content = { x: 0, y: 0, width: 230, height: 120 };

  it('draws bold black lines every 10 stitches and around a 23 × 12 grid, 2 px wide', () => {
    const recording = render(solidPattern(23, 12), content);
    const bold = segmentsOf(recording, '#000000');
    assert.deepEqual(bold.filter(isVertical).map((segment) => segment.x1), [0, 100, 200, 230]);
    assert.deepEqual(bold.filter((segment) => !isVertical(segment)).map((segment) => segment.y1), [0, 100, 120]);
    assert.ok(recording.strokes.filter((stroke) => stroke.strokeStyle === '#000000').every((stroke) => stroke.lineWidth === 2));
  });

  it('draws thin grey lines between the other cells, 1 px wide and centred on device pixels', () => {
    const recording = render(solidPattern(23, 12), content);
    const thin = segmentsOf(recording, '#A0A0A0');
    assert.equal(thin.filter(isVertical).length, 20);
    assert.equal(thin.filter((segment) => !isVertical(segment)).length, 10);
    assert.equal(thin.filter(isVertical)[0].x1, 10.5);
    assert.ok(recording.strokes.filter((stroke) => stroke.strokeStyle === '#A0A0A0').every((stroke) => stroke.lineWidth === 1));
  });

  it('draws no thin lines in 3 px cells', () => {
    const recording = render(solidPattern(23, 12), { x: 0, y: 0, width: 69, height: 36 });
    assert.equal(segmentsOf(recording, '#A0A0A0').length, 0);
    assert.equal(segmentsOf(recording, '#000000').filter(isVertical).length, 4);
  });

  it('uses 2 and 4 device px lines at pixel ratio 2', () => {
    const recording = render(solidPattern(23, 12), content, { width: 400, height: 300 }, 2);
    const widths = recording.strokes.map((stroke) => `${stroke.strokeStyle} ${stroke.lineWidth}`).sort();
    assert.deepEqual(widths, ['#000000 2', '#A0A0A0 1']);
  });
});

describe('chart layer: rulers and centre marker', () => {
  const content = { x: 24, y: 100, width: 1000, height: 670 };
  const frameSize = { width: 1048, height: 870 };

  it('labels every 10th column in the top ruler, centred on the bold lines', () => {
    const recording = render(solidPattern(100, 67), content, frameSize);
    const top = recording.texts.filter((text) => text.y > 76 && text.y < 100);
    assert.deepEqual(top.map((text) => text.text), ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100']);
    assert.deepEqual(top.map((text) => text.x), [124, 224, 324, 424, 524, 624, 724, 824, 924, 1024]);
    assert.ok(top.every((text) => text.fontSize === 10 && text.textAlign === 'center'));
  });

  it('labels every 10th row in the left ruler, centred on the bold lines', () => {
    const recording = render(solidPattern(100, 67), content, frameSize);
    const left = recording.texts.filter((text) => text.x > 0 && text.x < 24);
    assert.deepEqual(left.map((text) => text.text), ['10', '20', '30', '40', '50', '60']);
    assert.deepEqual(left.map((text) => text.y), [200, 300, 400, 500, 600, 700]);
  });

  it('labels neither line 0 nor the far border 67', () => {
    const recording = render(solidPattern(100, 67), content, frameSize);
    const labels = recording.texts.map((text) => text.text);
    assert.ok(!labels.includes('0') && !labels.includes('67'));
  });

  it('marks the centre column and row with triangles pointing at the grid', () => {
    const recording = render(solidPattern(100, 67), content, frameSize);
    assert.ok(hasTriangleWithTip(recording, 524, 100), 'top triangle tip at (524, 100)');
    assert.ok(hasTriangleWithTip(recording, 24, 435), 'left triangle tip at (24, 435)');
  });

  it('points the triangles at the middle of a 1 × 1 grid', () => {
    const recording = render(solidPattern(1, 1), { x: 24, y: 100, width: 20, height: 20 }, frameSize);
    assert.ok(hasTriangleWithTip(recording, 34, 100), 'top triangle at x 34');
    assert.ok(hasTriangleWithTip(recording, 24, 110), 'left triangle at y 110');
  });

  it('sticks the rulers to the frame edges with a blank corner square when zoomed in', () => {
    const recording = render(solidPattern(100, 100), { x: -300, y: -120, width: 3000, height: 3000 });
    const corner = recording.fills.flatMap((fill) => fill.rects)
      .filter((rect) => rect.x === 0 && rect.y === 0 && rect.width === 24 && rect.height === 24);
    assert.equal(corner.length, 1);
  });
});

describe('chart layer: large patterns', () => {
  it('draws cell colors with hard edges at one device pixel per stitch', () => {
    const recording = render(solidPattern(968, 484), { x: 0, y: 0, width: 484, height: 242 }, { width: 500, height: 300 }, 2);
    assert.equal(recording.images[0].imageSmoothingEnabled, false);
  });

  it('smooths cell colors when a stitch is smaller than one device pixel', () => {
    const recording = render(solidPattern(1000, 500), { x: 0, y: 0, width: 484, height: 242 }, { width: 500, height: 300 }, 2);
    assert.equal(recording.images[0].imageSmoothingEnabled, true);
  });

  it('averages the tints of a 2 × 2 block into one overview pixel', () => {
    // 2050 × 2: overview level 1. Block 0 is 310, 321 / empty, 310.
    const cells = new Int16Array(2050 * 2);
    cells[1] = 1;
    cells[2050] = -1;
    const pattern = buildPattern({ width: 2050, height: 2, cells, colors: [BLACK, RED] });
    const factory = createFakeCellCanvasFactory();
    const layer = createChartLayer({ createCellCanvas: factory.createCellCanvas });
    const frame = frameFor({ x: 0, y: 0, width: 1025, height: 1 }, { width: 1100, height: 800 }, 1);
    let needsAnotherFrame = true;
    for (let draw = 0; draw < 10 && needsAnotherFrame; draw++) {
      needsAnotherFrame = layer.render(createRecordingContext().ctx, frame, { pattern });
    }
    assert.notEqual(needsAnotherFrame, true);
    const overview = factory.canvases.find((canvas) => canvas.width === 1025);
    assert.deepEqual([...overview.pixels.slice(0, 4)], [208, 192, 191, 255]);
  });

  it('draws a fitted 2050 × 2050 pattern from its overview, with a bounded grid and no cell reads', () => {
    const cells = new Int16Array(2050 * 2050);
    for (let i = 0; i < cells.length; i += 7) {
      cells[i] = -1;
    }
    const pattern = buildPattern({ width: 2050, height: 2050, cells, colors: [BLACK] });
    const factory = createFakeCellCanvasFactory();
    const layer = createChartLayer({ createCellCanvas: factory.createCellCanvas });
    const frame = frameFor({ x: 124, y: 24, width: 752, height: 752 }, { width: 1000, height: 800 }, 1);

    const answers = [];
    for (let draw = 0; draw < 9; draw++) {
      answers.push(layer.render(createRecordingContext().ctx, frame, { pattern }));
    }
    assert.deepEqual(answers.map((answer) => answer === true), [true, true, true, true, true, true, true, true, false]);

    pattern.cells = new Proxy(pattern.cells, {
      get() {
        throw new Error('a stitch was read');
      },
    });
    const recording = createRecordingContext();
    layer.render(recording.ctx, frame, { pattern });

    assert.equal(recording.images.length, 1);
    assert.equal(recording.images[0].image.width, 1025);
    assert.equal(hatchSegments(recording).length, 0);
    const bold = segmentsOf(recording, '#000000');
    assert.equal(bold.filter(isVertical).length, 22);
    assert.equal(bold.filter((segment) => !isVertical(segment)).length, 22);
    const labels = recording.texts.map((text) => Number(text.text));
    assert.ok(labels.length > 0 && labels.every((label) => label % 100 === 0), `labels every 100, got ${labels.join(' ')}`);
    assert.ok(labels.includes(100) && !labels.includes(50), 'label step 100');
  });
});

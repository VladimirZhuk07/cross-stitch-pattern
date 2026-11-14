// The DMC colors layer (src/ui/layers/dmc-layer.js) with real patterns from buildPattern.
// Node has no canvas, so the layer gets a fake cell canvas factory (tests/helpers) and render()
// gets a fake 2D context that records what it draws. Real pixels are checked in the browser
// smoke step of the change.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createDmcLayer } from '../../src/ui/layers/dmc-layer.js';
import { createFakeCellCanvasFactory } from '../helpers/recording-context.js';

// Hex values are test fixtures, not palette data.
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

// A 2D context that records drawImage calls, the smoothing flag at each call, and any other
// drawing call (which the DMC colors layer must not make).
function createRecordingContext() {
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    drawImageCalls: [],
    otherCalls: [],
    drawImage(image, ...args) {
      ctx.drawImageCalls.push({ image, args, isSmoothing: ctx.imageSmoothingEnabled });
    },
  };
  for (const name of ['fillRect', 'strokeRect', 'fillText', 'strokeText', 'stroke', 'fill', 'putImageData']) {
    ctx[name] = () => ctx.otherCalls.push(name);
  }
  return ctx;
}

function frameFor(content, pixelRatio = 1) {
  return {
    width: 1000,
    height: 800,
    pixelRatio,
    viewport: { scale: 1, offsetX: content.x, offsetY: content.y },
    content,
  };
}

function stateWith(pattern) {
  return { image: { width: 1, height: 1 }, pattern, activeLayer: 'dmc' };
}

// A layer with its own fake canvas factory: { layer, canvases }.
function createTestLayer() {
  const factory = createFakeCellCanvasFactory();
  return { layer: createDmcLayer({ createCellCanvas: factory.createCellCanvas }), canvases: factory.canvases };
}

const TWO_STITCHES = buildPattern({ width: 2, height: 1, cells: [0, 1], colors: [BLACK, RED] });

describe('DMC colors layer', () => {
  it('is available for a built pattern and not without one', () => {
    const layer = createDmcLayer();
    assert.equal(layer.id, 'dmc');
    assert.equal(layer.isAvailable(stateWith(TWO_STITCHES)), true);
    assert.equal(layer.isAvailable(stateWith(null)), false);
  });

  it('draws the stitch image once, exactly into the content rectangle, with hard edges', () => {
    const { layer, canvases } = createTestLayer();
    const ctx = createRecordingContext();
    layer.render(ctx, frameFor({ x: 10, y: 20, width: 200, height: 100 }), stateWith(TWO_STITCHES));

    assert.equal(canvases.length, 1);
    const bitmap = canvases[0];
    assert.equal(bitmap.width, 2);
    assert.equal(bitmap.height, 1);
    assert.equal(bitmap.puts.length, 1);
    assert.deepEqual([...bitmap.pixels], [0, 0, 0, 255, 199, 43, 59, 255]);

    assert.equal(ctx.drawImageCalls.length, 1);
    assert.equal(ctx.drawImageCalls[0].image, bitmap);
    assert.deepEqual(ctx.drawImageCalls[0].args, [0, 0, 2, 1, 10, 20, 200, 100]);
    assert.equal(ctx.drawImageCalls[0].isSmoothing, false);
  });

  it('draws no grid lines, text or other shapes', () => {
    const ctx = createRecordingContext();
    createTestLayer().layer.render(ctx, frameFor({ x: 16, y: 158, width: 968, height: 484 }), stateWith(TWO_STITCHES));
    assert.deepEqual(ctx.otherCalls, []);
  });

  it('keeps hard edges at exactly one device pixel per stitch', () => {
    const pattern = buildPattern({ width: 968, height: 484, cells: new Int16Array(968 * 484), colors: [BLACK] });
    const ctx = createRecordingContext();
    createTestLayer().layer.render(ctx, frameFor({ x: 0, y: 0, width: 484, height: 242 }, 2), stateWith(pattern));
    assert.equal(ctx.drawImageCalls[0].isSmoothing, false);
  });

  it('smooths when a stitch is smaller than one device pixel', () => {
    const pattern = buildPattern({ width: 1000, height: 500, cells: new Int16Array(1000 * 500), colors: [BLACK] });
    const ctx = createRecordingContext();
    createTestLayer().layer.render(ctx, frameFor({ x: 0, y: 0, width: 484, height: 242 }, 2), stateWith(pattern));
    assert.equal(ctx.drawImageCalls[0].isSmoothing, true);
    assert.equal(ctx.imageSmoothingQuality, 'high');
  });

  it('stretches a 100 × 67 grid over the whole content rectangle, aligned with the other layers', () => {
    const pattern = buildPattern({ width: 100, height: 67, cells: new Int16Array(100 * 67), colors: [BLACK] });
    const content = { x: 10, y: 20, width: 1024, height: 682.5 };
    const ctx = createRecordingContext();
    const { layer, canvases } = createTestLayer();
    layer.render(ctx, frameFor(content), stateWith(pattern));

    const { image, args } = ctx.drawImageCalls[0];
    assert.deepEqual([image.width, image.height], [100, 67]);
    const [sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height] = args;
    assert.equal(image, canvases[0]);
    assert.deepEqual([sourceX, sourceY, sourceWidth, sourceHeight], [0, 0, 100, 67]);
    assert.deepEqual([x, y, width, height], [10, 20, 1024, 682.5]);
    // One picture pixel per stitch, so stitch (0, 0) and (99, 66) span these CSS px:
    assert.ok(Math.abs(x + width / sourceWidth - 20.24) < 1e-9);
    assert.ok(Math.abs(y + height / sourceHeight - 30.19) < 0.01);
    assert.equal(x + width, 1034);
    assert.equal(y + height, 702.5);
  });

  it('keeps hard edges far zoomed in (64 × 64 CSS px per stitch)', () => {
    const ctx = createRecordingContext();
    createTestLayer().layer.render(ctx, frameFor({ x: -40, y: -20, width: 128, height: 64 }), stateWith(TWO_STITCHES));
    assert.equal(ctx.drawImageCalls[0].isSmoothing, false);
    assert.deepEqual(ctx.drawImageCalls[0].args, [0, 0, 2, 1, -40, -20, 128, 64]);
  });

  it('draws nothing when the content rectangle is outside the frame', () => {
    const ctx = createRecordingContext();
    createTestLayer().layer.render(ctx, frameFor({ x: -500, y: -300, width: 128, height: 64 }), stateWith(TWO_STITCHES));
    assert.equal(ctx.drawImageCalls.length, 0);
  });

  it('reuses the stitch image while zooming and panning the same pattern', () => {
    const { layer, canvases } = createTestLayer();
    const state = stateWith(TWO_STITCHES);
    const contents = [
      { x: 10, y: 20, width: 200, height: 100 },
      { x: -25, y: -12.5, width: 250, height: 125 },
      { x: -60, y: -30, width: 312.5, height: 156.25 },
      { x: -100, y: -120, width: 500, height: 250 },
      { x: 16, y: 158, width: 968, height: 484 },
    ];
    for (const content of contents) {
      const ctx = createRecordingContext();
      layer.render(ctx, frameFor(content), state);
      assert.deepEqual(ctx.drawImageCalls[0].args, [0, 0, 2, 1, content.x, content.y, content.width, content.height]);
    }
    assert.equal(canvases.length, 1);
  });

  it('builds a new stitch image when the state holds a new pattern', () => {
    const { layer, canvases } = createTestLayer();
    const content = { x: 0, y: 0, width: 100, height: 100 };
    const patternP = buildPattern({ width: 1, height: 1, cells: [0], colors: [BLACK] });
    const patternQ = buildPattern({ width: 1, height: 1, cells: [0], colors: [RED] });

    layer.render(createRecordingContext(), frameFor(content), stateWith(patternP));
    const ctx = createRecordingContext();
    layer.render(ctx, frameFor(content), stateWith(patternQ));

    assert.equal(canvases.length, 2);
    assert.deepEqual([...canvases[1].pixels], [199, 43, 59, 255]);
    assert.equal(ctx.drawImageCalls[0].image, canvases[1]);
  });

  it('renders a fully empty pattern as a transparent image without throwing', () => {
    const { layer, canvases } = createTestLayer();
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const ctx = createRecordingContext();
    layer.render(ctx, frameFor({ x: 0, y: 0, width: 200, height: 200 }), stateWith(pattern));
    assert.deepEqual([...canvases[0].pixels], new Array(16).fill(0));
    assert.equal(ctx.drawImageCalls.length, 1);
  });

  it('asks for no further frame once a small pattern is drawn', () => {
    const needsAnotherFrame = createTestLayer().layer.render(
      createRecordingContext(),
      frameFor({ x: 10, y: 20, width: 200, height: 100 }),
      stateWith(TWO_STITCHES),
    );
    assert.notEqual(needsAnotherFrame, true);
  });

  it('averages a large pattern into a transparent-aware overview', () => {
    // 2050 × 2: overview level 1. Block 0 is 310, 321 / 321, empty; block 1 is all empty.
    const cells = new Int16Array(2050 * 2);
    cells[1] = 1;
    cells[2] = -1;
    cells[3] = -1;
    cells[2050] = 1;
    cells[2051] = -1;
    cells[2052] = -1;
    cells[2053] = -1;
    const pattern = buildPattern({ width: 2050, height: 2, cells, colors: [BLACK, RED] });
    const { layer, canvases } = createTestLayer();
    const frame = frameFor({ x: 0, y: 0, width: 1025, height: 1 });
    let needsAnotherFrame = true;
    for (let draw = 0; draw < 10 && needsAnotherFrame; draw++) {
      needsAnotherFrame = layer.render(createRecordingContext(), frame, stateWith(pattern));
    }
    assert.notEqual(needsAnotherFrame, true);
    const overview = canvases.find((canvas) => canvas.width === 1025);
    assert.deepEqual([...overview.pixels.slice(0, 8)], [133, 29, 39, 191, 0, 0, 0, 0]);
  });
});

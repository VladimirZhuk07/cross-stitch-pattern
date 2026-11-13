// The DMC colors layer (src/ui/layers/dmc-layer.js) with real patterns from buildPattern.
// Node has no canvas, so OffscreenCanvas and ImageData are replaced by small recording stubs
// (restored in after()) and render() gets a fake 2D context that records what it draws.
// Real pixels are checked in the browser smoke step of the change.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createDmcLayer } from '../../src/ui/layers/dmc-layer.js';

// Hex values are test fixtures, not palette data.
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

const createdCanvases = [];

class FakeImageData {
  constructor(data, width, height) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

class FakeOffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.putImages = [];
    createdCanvases.push(this);
  }

  getContext() {
    return { putImageData: (image, x, y) => this.putImages.push({ image, x, y }) };
  }
}

// A 2D context that records drawImage calls, the smoothing flag at each call, and any other
// drawing call (which the DMC colors layer must not make).
function createRecordingContext() {
  const ctx = {
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    drawImageCalls: [],
    otherCalls: [],
    drawImage(...args) {
      ctx.drawImageCalls.push({ args, isSmoothing: ctx.imageSmoothingEnabled });
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

const TWO_STITCHES = buildPattern({ width: 2, height: 1, cells: [0, 1], colors: [BLACK, RED] });

describe('DMC colors layer', () => {
  const originals = {};

  before(() => {
    originals.OffscreenCanvas = globalThis.OffscreenCanvas;
    originals.ImageData = globalThis.ImageData;
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;
    globalThis.ImageData = FakeImageData;
  });

  after(() => {
    for (const name of ['OffscreenCanvas', 'ImageData']) {
      if (originals[name] === undefined) {
        delete globalThis[name];
      } else {
        globalThis[name] = originals[name];
      }
    }
  });

  it('is available for a built pattern and not without one', () => {
    const layer = createDmcLayer();
    assert.equal(layer.id, 'dmc');
    assert.equal(layer.isAvailable(stateWith(TWO_STITCHES)), true);
    assert.equal(layer.isAvailable(stateWith(null)), false);
  });

  it('draws the stitch image once, exactly into the content rectangle, with hard edges', () => {
    createdCanvases.length = 0;
    const ctx = createRecordingContext();
    createDmcLayer().render(ctx, frameFor({ x: 10, y: 20, width: 200, height: 100 }), stateWith(TWO_STITCHES));

    assert.equal(createdCanvases.length, 1);
    const bitmap = createdCanvases[0];
    assert.equal(bitmap.width, 2);
    assert.equal(bitmap.height, 1);
    assert.equal(bitmap.putImages.length, 1);
    assert.deepEqual([...bitmap.putImages[0].image.data], [0, 0, 0, 255, 199, 43, 59, 255]);

    assert.equal(ctx.drawImageCalls.length, 1);
    assert.deepEqual(ctx.drawImageCalls[0].args, [bitmap, 10, 20, 200, 100]);
    assert.equal(ctx.drawImageCalls[0].isSmoothing, false);
  });

  it('draws no grid lines, text or other shapes', () => {
    const ctx = createRecordingContext();
    createDmcLayer().render(ctx, frameFor({ x: 16, y: 158, width: 968, height: 484 }), stateWith(TWO_STITCHES));
    assert.deepEqual(ctx.otherCalls, []);
  });

  it('keeps hard edges at exactly one device pixel per stitch', () => {
    const pattern = buildPattern({ width: 968, height: 484, cells: new Int16Array(968 * 484), colors: [BLACK] });
    const ctx = createRecordingContext();
    createDmcLayer().render(ctx, frameFor({ x: 0, y: 0, width: 484, height: 242 }, 2), stateWith(pattern));
    assert.equal(ctx.drawImageCalls[0].isSmoothing, false);
  });

  it('smooths when a stitch is smaller than one device pixel', () => {
    const pattern = buildPattern({ width: 1000, height: 500, cells: new Int16Array(1000 * 500), colors: [BLACK] });
    const ctx = createRecordingContext();
    createDmcLayer().render(ctx, frameFor({ x: 0, y: 0, width: 484, height: 242 }, 2), stateWith(pattern));
    assert.equal(ctx.drawImageCalls[0].isSmoothing, true);
    assert.equal(ctx.imageSmoothingQuality, 'high');
  });

  it('reuses the stitch image while zooming and panning the same pattern', () => {
    createdCanvases.length = 0;
    const layer = createDmcLayer();
    const state = stateWith(TWO_STITCHES);
    const contents = [
      { x: 10, y: 20, width: 200, height: 100 },
      { x: -25, y: -12.5, width: 250, height: 125 },
      { x: -60, y: -30, width: 312.5, height: 156.25 },
      { x: -300, y: -120, width: 500, height: 250 },
      { x: 16, y: 158, width: 968, height: 484 },
    ];
    for (const content of contents) {
      const ctx = createRecordingContext();
      layer.render(ctx, frameFor(content), state);
      assert.deepEqual(ctx.drawImageCalls[0].args.slice(1), [content.x, content.y, content.width, content.height]);
    }
    assert.equal(createdCanvases.length, 1);
  });

  it('builds a new stitch image when the state holds a new pattern', () => {
    createdCanvases.length = 0;
    const layer = createDmcLayer();
    const content = { x: 0, y: 0, width: 100, height: 100 };
    const patternP = buildPattern({ width: 1, height: 1, cells: [0], colors: [BLACK] });
    const patternQ = buildPattern({ width: 1, height: 1, cells: [0], colors: [RED] });

    layer.render(createRecordingContext(), frameFor(content), stateWith(patternP));
    const ctx = createRecordingContext();
    layer.render(ctx, frameFor(content), stateWith(patternQ));

    assert.equal(createdCanvases.length, 2);
    assert.deepEqual([...createdCanvases[1].putImages[0].image.data], [199, 43, 59, 255]);
    assert.equal(ctx.drawImageCalls[0].args[0], createdCanvases[1]);
  });

  it('renders a fully empty pattern as a transparent image without throwing', () => {
    createdCanvases.length = 0;
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const ctx = createRecordingContext();
    createDmcLayer().render(ctx, frameFor({ x: 0, y: 0, width: 200, height: 200 }), stateWith(pattern));
    assert.deepEqual([...createdCanvases[0].putImages[0].image.data], new Array(16).fill(0));
    assert.equal(ctx.drawImageCalls.length, 1);
  });
});

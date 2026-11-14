// The shared pattern picture of the DMC colors and Chart layers (src/ui/layers/pattern-picture.js)
// with real patterns, a fake cell canvas factory and a recording context
// (openspec/specs/large-pattern-rendering/spec.md). Tiled cases use small patterns with small
// injected limits; they drive the same code as a 10000 × 10000 pattern with the defaults.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { patternToStitchImage } from '../../src/core/pattern-image.js';
import { colorTable } from '../../src/core/level-pixels.js';
import { visibleCellRange } from '../../src/core/chart-layout.js';
import { createPatternPicture } from '../../src/ui/layers/pattern-picture.js';
import { createRecordingContext, createFakeCellCanvasFactory } from '../helpers/recording-context.js';

// Hex values are test fixtures, not palette data.
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

function stitchColors(pattern) {
  return colorTable(pattern.legend.map((entry) => entry.hex), null);
}

function frameFor(content, frameSize = { width: 1100, height: 800 }, pixelRatio = 1) {
  return { ...frameSize, pixelRatio, viewport: { scale: 1, offsetX: content.x, offsetY: content.y }, content };
}

// A picture with a fake canvas factory; draw(pattern, frame) uses the frame's visible range.
function createTestPicture(limits) {
  const factory = createFakeCellCanvasFactory();
  const picture = createPatternPicture({ createCellCanvas: factory.createCellCanvas, colorTableOf: stitchColors, limits });
  function draw(pattern, frame, recording = createRecordingContext()) {
    const isComplete = picture.draw(recording.ctx, frame, pattern, visibleCellRange(frame.content, frame, pattern));
    return { isComplete, recording };
  }
  return { draw, canvases: factory.canvases };
}

function stripes(width, height) {
  const cells = new Int16Array(width * height);
  for (let i = 0; i < cells.length; i++) {
    cells[i] = i % 2;
  }
  return buildPattern({ width, height, cells, colors: [BLACK, RED] });
}

describe('pattern picture: single picture', () => {
  it('builds a 100 × 67 pattern in one frame and draws its visible range once', () => {
    const pattern = stripes(100, 67);
    const picture = createTestPicture();
    const { isComplete, recording } = picture.draw(pattern, frameFor({ x: 10, y: 20, width: 1024, height: 682.5 }));

    assert.equal(isComplete, true);
    assert.equal(picture.canvases.length, 1);
    const [canvas] = picture.canvases;
    assert.deepEqual([canvas.width, canvas.height], [100, 67]);
    assert.deepEqual(canvas.puts, [{ dx: 0, dy: 0, dirtyX: 0, dirtyY: 0, dirtyWidth: 100, dirtyHeight: 67 }]);
    assert.deepEqual([...canvas.pixels], [...patternToStitchImage(pattern).data]);
    assert.equal(recording.images.length, 1);
    assert.equal(recording.images[0].image, canvas);
    assert.deepEqual(recording.images[0].args, [0, 0, 100, 67, 10, 20, 1024, 682.5]);
  });

  it('spreads a picture over frames when the budget is smaller than the pattern', () => {
    const pattern = stripes(64, 64);
    const picture = createTestPicture({ buildBudgetStitches: 2048 });
    const frame = frameFor({ x: 0, y: 0, width: 640, height: 640 });

    const first = picture.draw(pattern, frame);
    assert.equal(first.isComplete, false);
    assert.deepEqual(picture.canvases[0].puts, [{ dx: 0, dy: 0, dirtyX: 0, dirtyY: 0, dirtyWidth: 64, dirtyHeight: 32 }]);

    const second = picture.draw(pattern, frame);
    assert.equal(second.isComplete, true);
    assert.deepEqual(picture.canvases[0].puts[1], { dx: 0, dy: 0, dirtyX: 0, dirtyY: 32, dirtyWidth: 64, dirtyHeight: 32 });
    assert.deepEqual([...picture.canvases[0].pixels], [...patternToStitchImage(pattern).data]);
    assert.equal(picture.canvases.length, 1);
  });

  it('releases the old picture when the pattern changes', () => {
    const picture = createTestPicture();
    const frame = frameFor({ x: 0, y: 0, width: 100, height: 100 });
    picture.draw(stripes(2, 2), frame);
    picture.draw(stripes(2, 2), frame);

    assert.equal(picture.canvases.length, 2);
    assert.deepEqual([picture.canvases[0].width, picture.canvases[0].height], [0, 0]);
    assert.deepEqual([picture.canvases[1].width, picture.canvases[1].height], [2, 2]);
  });

  it('builds and draws nothing when the grid is outside the frame', () => {
    const picture = createTestPicture();
    const { isComplete, recording } = picture.draw(stripes(100, 100), frameFor({ x: 500, y: 0, width: 1000, height: 1000 }, { width: 400, height: 300 }));
    assert.equal(isComplete, true);
    assert.equal(picture.canvases.length, 0);
    assert.equal(recording.images.length, 0);
  });
});

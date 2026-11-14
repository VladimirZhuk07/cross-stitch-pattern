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

// Small limits: a 40 × 40 pattern then has a 10 × 10 px overview (level 2, one pixel per
// 4 × 4 stitches, 160 stitches per overview row) and 5 × 5 level-0 tiles of 8 × 8 stitches.
const SMALL_LIMITS = { singlePictureMaxSide: 16, tileSize: 8, buildBudgetStitches: 512 };
const TILE_BYTES = 8 * 8 * 4;

function isTileCanvas(canvas) {
  return canvas.width === 8 && canvas.height === 8;
}

function liveTiles(canvases) {
  return canvases.filter(isTileCanvas);
}

// Content with 1 CSS px per stitch whose stitch (column, row) is at the frame's top-left.
function zoomedAt(column, row, frameSize, x = 0) {
  return frameFor({ x: x - column, y: -row, width: 40, height: 40 }, frameSize);
}

const FIT = frameFor({ x: 0, y: 0, width: 10, height: 10 }, { width: 10, height: 10 });

// Draws at Fit until the overview is complete; returns the number of draws.
function completeOverview(picture, pattern) {
  let draws = 0;
  let isComplete = false;
  while (!isComplete) {
    isComplete = picture.draw(pattern, FIT).isComplete;
    draws += 1;
  }
  return draws;
}

describe('pattern picture: tiles and overview', () => {
  it('builds the overview row by row at Fit, then reads no stitch any more', () => {
    const pattern = { ...stripes(40, 40) };
    const picture = createTestPicture(SMALL_LIMITS);
    assert.equal(completeOverview(picture, pattern), 4);
    const [overview] = picture.canvases;
    assert.deepEqual([overview.width, overview.height], [10, 10]);
    assert.deepEqual(overview.puts.map((put) => put.dirtyHeight), [3, 3, 3, 1]);

    pattern.cells = new Proxy(pattern.cells, {
      get() {
        throw new Error('a stitch was read');
      },
    });
    const { isComplete, recording } = picture.draw(pattern, FIT);
    assert.equal(isComplete, true);
    assert.equal(recording.images.length, 1);
    assert.equal(recording.images[0].image, overview);
  });

  it('builds 8 of 9 visible tiles in the first frame and the ninth in the second', () => {
    const pattern = stripes(40, 40);
    const picture = createTestPicture(SMALL_LIMITS);
    const frame = zoomedAt(8, 8, { width: 24, height: 24 });

    const first = picture.draw(pattern, frame);
    assert.equal(first.isComplete, false);
    assert.equal(picture.canvases.length, 8);
    assert.ok(picture.canvases.every(isTileCanvas));
    assert.equal(first.recording.images.length, 8);

    const second = picture.draw(pattern, frame);
    assert.equal(second.isComplete, false);
    assert.equal(liveTiles(picture.canvases).length, 9);
    const overview = picture.canvases.find((canvas) => canvas.width === 10);
    assert.equal(overview.puts.length, 1);
    assert.equal(overview.puts[0].dirtyHeight, 2);
    assert.equal(second.recording.images.length, 9);
  });

  it('meets neighbouring tiles on the same snapped device pixel edge', () => {
    const pattern = stripes(40, 40);
    const picture = createTestPicture({ ...SMALL_LIMITS, buildBudgetStitches: 4096 });
    const { recording } = picture.draw(pattern, zoomedAt(8, 8, { width: 23, height: 24 }, -0.3));
    const destinations = recording.images.filter((drawn) => isTileCanvas(drawn.image)).map((drawn) => drawn.args.slice(4));
    assert.equal(destinations.length, 9);
    for (let index = 0; index < destinations.length; index++) {
      const [x, y, width, height] = destinations[index];
      if (index % 3 < 2) {
        assert.equal(x + width, destinations[index + 1][0], `tile ${index} meets its right neighbour`);
        assert.ok(Number.isInteger(x + width), `inner edge ${x + width} is on a device pixel`);
      }
      if (index < 6) {
        assert.equal(y + height, destinations[index + 3][1], `tile ${index} meets the tile below`);
      }
    }
  });

  it('shows the overview in place of tiles that are not built yet', () => {
    const pattern = stripes(40, 40);
    const picture = createTestPicture({ ...SMALL_LIMITS, buildBudgetStitches: 64 });
    completeOverview(picture, pattern);
    const overview = picture.canvases[0];
    const frame = zoomedAt(8, 8, { width: 24, height: 24 });

    const pending = picture.draw(pattern, frame).recording.images;
    const standIns = pending.filter((drawn) => drawn.image === overview);
    assert.equal(pending.length, 9);
    assert.equal(standIns.length, 8);

    let complete;
    for (let draw = 0; draw < 8; draw++) {
      complete = picture.draw(pattern, frame);
    }
    assert.equal(complete.isComplete, true);
    const tileDestinations = complete.recording.images.map((drawn) => drawn.args.slice(4));
    assert.deepEqual(standIns.map((drawn) => drawn.args.slice(4)), tileDestinations.slice(1));
  });

  it('keeps at most the budget of tiles, releasing the least recently drawn first', () => {
    const pattern = stripes(40, 40);
    const picture = createTestPicture({ ...SMALL_LIMITS, buildBudgetStitches: 4096, cacheBudgetBytes: 12 * TILE_BYTES });
    const oneTile = { width: 8, height: 8 };
    const drawnCanvases = [];
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 5; column++) {
        const { recording } = picture.draw(pattern, zoomedAt(column * 8, row * 8, oneTile));
        drawnCanvases.push(recording.images[0].image);
        assert.ok(liveTiles(picture.canvases).length <= 12);
      }
    }
    assert.deepEqual(liveTiles(picture.canvases), drawnCanvases.slice(13));

    const canvasCount = picture.canvases.length;
    picture.draw(pattern, zoomedAt(32, 32, oneTile));
    assert.equal(picture.canvases.length, canvasCount, 'a kept tile is not rebuilt');

    const { recording } = picture.draw(pattern, zoomedAt(0, 0, oneTile));
    assert.equal(picture.canvases.length, canvasCount + 1, 'a released tile is rebuilt');
    assert.deepEqual([...recording.images[0].image.pixels], [...drawnCanvases[0].pixels]);
  });

  it('keeps every tile of a frame that shows more tiles than the budget', () => {
    const pattern = stripes(40, 40);
    const picture = createTestPicture({ ...SMALL_LIMITS, buildBudgetStitches: 4096, cacheBudgetBytes: 12 * TILE_BYTES });
    const { isComplete } = picture.draw(pattern, zoomedAt(0, 0, { width: 40, height: 40 }));
    assert.equal(isComplete, true);
    assert.equal(liveTiles(picture.canvases).length, 25);
  });

  it('keeps blocks of empty cells transparent in the overview', () => {
    const cells = new Int16Array(40 * 40);
    for (let i = 0; i < cells.length; i++) {
      const column = i % 40;
      cells[i] = column < 4 ? -1 : 0;
    }
    const pattern = buildPattern({ width: 40, height: 40, cells, colors: [RED] });
    const picture = createTestPicture(SMALL_LIMITS);
    completeOverview(picture, pattern);
    const pixels = picture.canvases[0].pixels;
    assert.deepEqual([...pixels.slice(0, 8)], [0, 0, 0, 0, 199, 43, 59, 255]);
  });
});

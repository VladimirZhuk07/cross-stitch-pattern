import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import {
  fitViewport,
  zoomLimits,
  zoomAt,
  wheelZoomFactor,
  panBy,
  recenterOnResize,
  contentRect,
  canvasBufferSize,
} from '../../../src/core/viewport.js';

const TOLERANCE = 1e-9;
const FRAME = { width: 1000, height: 800 };

describe('fitViewport', () => {
  it('fits a wide image into a landscape frame with a 24 px margin, centered', () => {
    const viewport = fitViewport({ width: 2000, height: 1000 }, FRAME);
    assertCloseFields(viewport, { scale: 0.476, offsetX: 24, offsetY: 162 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('enlarges a small image to fit', () => {
    const viewport = fitViewport({ width: 100, height: 50 }, FRAME);
    assertCloseFields(viewport, { scale: 9.52, offsetX: 24, offsetY: 162 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('fits a tall image by its height', () => {
    const viewport = fitViewport({ width: 500, height: 1000 }, FRAME);
    // available 952 × 752 → scale 0.752, image 376 × 752 → x (1000 − 376) / 2 = 312
    assertCloseFields(viewport, { scale: 0.752, offsetX: 312, offsetY: 24 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('rejects a frame of 0 width', () => {
    assert.throws(() => fitViewport({ width: 100, height: 50 }, { width: 0, height: 800 }), {
      name: 'RangeError',
      message: 'frame.width must be a positive number, got 0',
    });
  });

  it('rejects content of 0 height', () => {
    assert.throws(() => fitViewport({ width: 100, height: 0 }, FRAME), {
      name: 'RangeError',
      message: 'content.height must be a positive number, got 0',
    });
  });

  it('still returns a positive scale when the frame is smaller than the margins', () => {
    const viewport = fitViewport({ width: 100, height: 100 }, { width: 20, height: 20 });
    assert.ok(viewport.scale > 0, `expected a positive scale, got ${viewport.scale}`);
  });
});

describe('zoomLimits', () => {
  it('allows zooming out to half the fit scale and in to 64', () => {
    const limits = zoomLimits({ width: 2000, height: 1000 }, FRAME);
    assertCloseFields(limits, { minScale: 0.238, maxScale: 64 }, ['minScale', 'maxScale'], TOLERANCE);
  });

  it('raises the upper limit to the fit scale when fitting needs more than 64', () => {
    const limits = zoomLimits({ width: 10, height: 5 }, { width: 1048, height: 800 });
    // available 1000 × 752 → fit scale 100
    assertCloseFields(limits, { minScale: 50, maxScale: 100 }, ['minScale', 'maxScale'], TOLERANCE);
  });
});

/** World point shown at a screen point: the inverse of offset + world · scale. */
function worldAt(viewport, point) {
  return {
    x: (point.x - viewport.offsetX) / viewport.scale,
    y: (point.y - viewport.offsetY) / viewport.scale,
  };
}

describe('zoomAt', () => {
  const WIDE_LIMITS = { minScale: 0.1, maxScale: 64 };

  it('zooms by the factor and keeps the point under the anchor in place', () => {
    const viewport = zoomAt({ scale: 1, offsetX: 0, offsetY: 0 }, 1.25, { x: 100, y: 50 }, WIDE_LIMITS);
    assertCloseFields(viewport, { scale: 1.25, offsetX: -25, offsetY: -12.5 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('zooms around the frame center from 200 % to 250 %', () => {
    const before = { scale: 2, offsetX: -300, offsetY: -120 };
    const center = { x: 500, y: 400 };
    const after = zoomAt(before, 1.25, center, WIDE_LIMITS);
    assertCloseFields(after, { scale: 2.5 }, ['scale'], TOLERANCE);
    assertCloseFields(worldAt(after, center), worldAt(before, center), ['x', 'y'], TOLERANCE);
  });

  it('clamps at the upper limit and still keeps the anchor point fixed', () => {
    const before = { scale: 60, offsetX: 10, offsetY: 20 };
    const anchor = { x: 300, y: 200 };
    const after = zoomAt(before, 1.25, anchor, WIDE_LIMITS);
    assertCloseFields(after, { scale: 64 }, ['scale'], TOLERANCE);
    assertCloseFields(worldAt(after, anchor), worldAt(before, anchor), ['x', 'y'], TOLERANCE);
  });

  it('stays at the upper limit when zooming in further', () => {
    const viewport = zoomAt({ scale: 64, offsetX: 10, offsetY: 20 }, 1.25, { x: 0, y: 0 }, WIDE_LIMITS);
    assertCloseFields(viewport, { scale: 64, offsetX: 10, offsetY: 20 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('clamps at the lower limit', () => {
    const limits = { minScale: 0.242, maxScale: 64 };
    const viewport = zoomAt({ scale: 0.25, offsetX: 0, offsetY: 0 }, 0.8, { x: 0, y: 0 }, limits);
    assertCloseFields(viewport, { scale: 0.242 }, ['scale'], TOLERANCE);
  });

  it('rejects a factor of 0', () => {
    assert.throws(() => zoomAt({ scale: 1, offsetX: 0, offsetY: 0 }, 0, { x: 0, y: 0 }, WIDE_LIMITS), {
      name: 'RangeError',
      message: 'factor must be a positive number, got 0',
    });
  });
});

describe('wheelZoomFactor', () => {
  it('zooms in one step for a 100 px scroll up', () => {
    assertClose(wheelZoomFactor(-100), 1.25, TOLERANCE, 'factor');
  });

  it('zooms out one step for a 100 px scroll down', () => {
    assertClose(wheelZoomFactor(100), 0.8, TOLERANCE, 'factor');
  });

  it('does not zoom without scrolling', () => {
    assert.equal(wheelZoomFactor(0), 1);
  });
});

describe('panBy', () => {
  it('moves the image by the drag distance and keeps the scale', () => {
    const viewport = panBy({ scale: 0.484, offsetX: 16, offsetY: 158 }, 30, -20);
    assertCloseFields(viewport, { scale: 0.484, offsetX: 46, offsetY: 138 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });
});

describe('recenterOnResize', () => {
  it('keeps the point at the frame center centered when the frame gets narrower', () => {
    const viewport = recenterOnResize(
      { scale: 0.484, offsetX: 16, offsetY: 158 },
      { width: 1000, height: 800 },
      { width: 800, height: 800 },
    );
    assertCloseFields(viewport, { scale: 0.484, offsetX: -84, offsetY: 158 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });
});

describe('contentRect', () => {
  it('maps the image rectangle to screen coordinates', () => {
    const rect = contentRect({ scale: 0.5, offsetX: 10, offsetY: 20 }, { width: 2048, height: 1365 });
    assertCloseFields(rect, { x: 10, y: 20, width: 1024, height: 682.5 }, ['x', 'y', 'width', 'height'], TOLERANCE);
  });

  it('lets a 100 × 67 grid cover the rectangle exactly', () => {
    const rect = contentRect({ scale: 0.5, offsetX: 10, offsetY: 20 }, { width: 2048, height: 1365 });
    const columns = 100;
    const rows = 67;
    const firstCell = {
      left: rect.x,
      right: rect.x + rect.width / columns,
      top: rect.y,
      bottom: rect.y + rect.height / rows,
    };
    assertCloseFields(firstCell, { left: 10, right: 20.24, top: 20 }, ['left', 'right', 'top'], TOLERANCE);
    assertCloseFields(firstCell, { bottom: 30.19 }, ['bottom'], 0.005);
  });
});

describe('canvasBufferSize', () => {
  it('multiplies the CSS size by the device pixel ratio', () => {
    assert.deepEqual(canvasBufferSize({ width: 800, height: 600 }, 2), { width: 1600, height: 1200 });
  });

  it('rounds to whole device pixels for a fractional ratio', () => {
    assert.deepEqual(canvasBufferSize({ width: 801, height: 601 }, 1.25), { width: 1001, height: 751 });
  });

  it('returns 0 × 0 for a frame without size', () => {
    assert.deepEqual(canvasBufferSize({ width: 0, height: 0 }, 2), { width: 0, height: 0 });
  });

  it('rejects a pixel ratio of 0', () => {
    assert.throws(() => canvasBufferSize({ width: 800, height: 600 }, 0), {
      name: 'RangeError',
      message: 'pixelRatio must be a positive number, got 0',
    });
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import { fitViewport, zoomLimits, zoomAt, wheelZoomFactor } from '../../../src/core/viewport.js';

const TOLERANCE = 1e-9;
const FRAME = { width: 1000, height: 800 };

describe('fitViewport', () => {
  it('fits a wide image into a landscape frame with a 16 px margin, centered', () => {
    const viewport = fitViewport({ width: 2000, height: 1000 }, FRAME);
    assertCloseFields(viewport, { scale: 0.484, offsetX: 16, offsetY: 158 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('enlarges a small image to fit', () => {
    const viewport = fitViewport({ width: 100, height: 50 }, FRAME);
    assertCloseFields(viewport, { scale: 9.68, offsetX: 16, offsetY: 158 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
  });

  it('fits a tall image by its height', () => {
    const viewport = fitViewport({ width: 500, height: 1000 }, FRAME);
    // available 968 × 768 → scale 0.768, image 384 × 768 → x (1000 − 384) / 2 = 308
    assertCloseFields(viewport, { scale: 0.768, offsetX: 308, offsetY: 16 }, ['scale', 'offsetX', 'offsetY'], TOLERANCE);
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
    assertCloseFields(limits, { minScale: 0.242, maxScale: 64 }, ['minScale', 'maxScale'], TOLERANCE);
  });

  it('raises the upper limit to the fit scale when fitting needs more than 64', () => {
    const limits = zoomLimits({ width: 10, height: 5 }, { width: 1032, height: 800 });
    // available 1000 × 768 → fit scale 100
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

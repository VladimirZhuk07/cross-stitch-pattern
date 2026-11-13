import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertCloseFields } from '../../helpers/assert-close.js';
import { fitViewport, zoomLimits } from '../../../src/core/viewport.js';

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

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { capImageSize } from '../../../src/core/image-size.js';

// The app's decode limits (DECODE_LIMITS in src/io/image-loader.js).
const LIMITS = { maxSide: 10000, maxPixels: 16777216 };

function capped(width, height, isDownscaled) {
  return { width, height, isDownscaled };
}

describe('capImageSize', () => {
  it('keeps an image that is smaller than the cap', () => {
    assert.deepEqual(capImageSize(1200, 800, LIMITS), capped(1200, 800, false));
  });

  it('keeps a detailed 3200 × 4000 render (12.8 MP)', () => {
    assert.deepEqual(capImageSize(3200, 4000, LIMITS), capped(3200, 4000, false));
  });

  it('keeps an image exactly at the pixel cap', () => {
    assert.deepEqual(capImageSize(4096, 4096, LIMITS), capped(4096, 4096, false));
  });

  it('downscales a 24 MP photo to the largest size under the pixel cap', () => {
    const result = capImageSize(6000, 4000, LIMITS);
    assert.deepEqual(result, capped(5016, 3344, true));
    assert.ok(result.width * result.height <= LIMITS.maxPixels);
  });

  it('downscales an image just above the pixel cap', () => {
    assert.deepEqual(capImageSize(4097, 4096, LIMITS), capped(4096, 4095, true));
  });

  it('lowers the long side when rounding the short side up would exceed the cap', () => {
    // 4730 would give a short side of round(3547.5) = 3548 and 16,782,040 pixels.
    assert.deepEqual(capImageSize(8000, 6000, LIMITS), capped(4729, 3547, true));
  });

  it('keeps a tall image below both caps', () => {
    assert.deepEqual(capImageSize(100, 5000, LIMITS), capped(100, 5000, false));
  });

  it('caps a side longer than 10000 px', () => {
    assert.deepEqual(capImageSize(100, 20000, LIMITS), capped(50, 10000, true));
  });

  it('keeps at least one pixel on the short side of an extremely thin image', () => {
    assert.deepEqual(capImageSize(30000, 3, LIMITS), capped(10000, 1, true));
  });

  it('keeps a 1 × 1 image', () => {
    assert.deepEqual(capImageSize(1, 1, LIMITS), capped(1, 1, false));
  });

  it('rejects a width of 0', () => {
    assert.throws(() => capImageSize(0, 800, LIMITS), {
      name: 'RangeError',
      message: 'width must be a positive integer, got 0',
    });
  });

  it('rejects a fractional width', () => {
    assert.throws(() => capImageSize(12.5, 800, LIMITS), {
      name: 'RangeError',
      message: 'width must be a positive integer, got 12.5',
    });
  });

  it('rejects a negative height', () => {
    assert.throws(() => capImageSize(800, -1, LIMITS), {
      name: 'RangeError',
      message: 'height must be a positive integer, got -1',
    });
  });

  it('rejects a maximum side of 0', () => {
    assert.throws(() => capImageSize(800, 600, { maxSide: 0, maxPixels: 100 }), {
      name: 'RangeError',
      message: 'maxSide must be a positive integer, got 0',
    });
  });

  it('rejects a maximum pixel count of 0', () => {
    assert.throws(() => capImageSize(800, 600, { maxSide: 100, maxPixels: 0 }), {
      name: 'RangeError',
      message: 'maxPixels must be a positive integer, got 0',
    });
  });
});

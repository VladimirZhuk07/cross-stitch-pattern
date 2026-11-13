import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { capImageSize } from '../../../src/core/image-size.js';

const MAX_SIDE = 2048;

describe('capImageSize', () => {
  it('keeps an image that is smaller than the cap', () => {
    assert.deepEqual(capImageSize(1200, 800, MAX_SIDE), { width: 1200, height: 800, isDownscaled: false });
  });

  it('keeps an image whose long side equals the cap', () => {
    assert.deepEqual(capImageSize(2048, 2048, MAX_SIDE), { width: 2048, height: 2048, isDownscaled: false });
  });

  it('downscales a landscape image so the long side is the cap, rounding the short side', () => {
    assert.deepEqual(capImageSize(6000, 4000, MAX_SIDE), { width: 2048, height: 1365, isDownscaled: true });
  });

  it('downscales a portrait image so the long side is the cap, rounding the short side', () => {
    assert.deepEqual(capImageSize(100, 5000, MAX_SIDE), { width: 41, height: 2048, isDownscaled: true });
  });

  it('keeps at least one pixel on the short side of an extremely thin image', () => {
    assert.deepEqual(capImageSize(10000, 3, MAX_SIDE), { width: 2048, height: 1, isDownscaled: true });
  });

  it('keeps a 1 × 1 image', () => {
    assert.deepEqual(capImageSize(1, 1, MAX_SIDE), { width: 1, height: 1, isDownscaled: false });
  });

  it('rejects a width of 0', () => {
    assert.throws(() => capImageSize(0, 800, MAX_SIDE), {
      name: 'RangeError',
      message: 'width must be a positive integer, got 0',
    });
  });

  it('rejects a fractional width', () => {
    assert.throws(() => capImageSize(12.5, 800, MAX_SIDE), {
      name: 'RangeError',
      message: 'width must be a positive integer, got 12.5',
    });
  });

  it('rejects a negative height', () => {
    assert.throws(() => capImageSize(800, -1, MAX_SIDE), {
      name: 'RangeError',
      message: 'height must be a positive integer, got -1',
    });
  });

  it('rejects a maximum side of 0', () => {
    assert.throws(() => capImageSize(800, 600, 0), {
      name: 'RangeError',
      message: 'maxSide must be a positive integer, got 0',
    });
  });
});

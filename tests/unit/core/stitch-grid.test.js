import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GRID_SIDE, maxTargetWidth, stitchGridSize } from '../../../src/core/stitch-grid.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

describe('stitchGridSize', () => {
  it('follows the aspect ratio of a landscape image', () => {
    assert.deepEqual(stitchGridSize(1200, 800, 100), { width: 100, height: 67 });
  });

  it('matches the viewer alignment example for a capped 2048 × 1365 image', () => {
    assert.deepEqual(stitchGridSize(2048, 1365, 100), { width: 100, height: 67 });
  });

  it('follows the aspect ratio of a portrait image', () => {
    assert.deepEqual(stitchGridSize(800, 1200, 100), { width: 100, height: 150 });
  });

  it('keeps at least one row for a very wide image', () => {
    assert.deepEqual(stitchGridSize(2048, 1, 100), { width: 100, height: 1 });
  });

  it('reports heights above the limit instead of clamping them', () => {
    assert.deepEqual(stitchGridSize(41, 2048, 100), { width: 100, height: 4995 });
  });

  it('allows a grid wider than the image', () => {
    assert.deepEqual(stitchGridSize(1, 1, 3), { width: 3, height: 3 });
  });

  it('rejects image sizes that are not positive integers', () => {
    assertThrowsWith(() => stitchGridSize(0, 10, 10), RangeError, 'imageWidth', '0');
    assertThrowsWith(() => stitchGridSize(10, 12.5, 10), RangeError, 'imageHeight', '12.5');
  });

  it('rejects a target width that is not a positive integer', () => {
    assertThrowsWith(() => stitchGridSize(10, 10, 0), RangeError, 'targetWidth', '0');
  });
});

describe('maxTargetWidth', () => {
  it('is 500 stitches per side', () => {
    assert.equal(MAX_GRID_SIDE, 500);
  });

  it('finds the largest width whose height still fits', () => {
    assert.equal(maxTargetWidth(41, 2048), 10);
    assert.equal(stitchGridSize(41, 2048, 10).height, 500);
    assert.ok(stitchGridSize(41, 2048, 11).height > MAX_GRID_SIDE);
  });

  it('can be below any sensible form width for a very narrow image', () => {
    assert.equal(maxTargetWidth(10, 2048), 2);
  });

  it('is 0 when not even one stitch of width fits', () => {
    assert.equal(maxTargetWidth(1, 2048), 0);
  });

  it('is capped at the grid side limit for landscape images', () => {
    assert.equal(maxTargetWidth(1200, 800), 500);
  });

  it('rejects image sizes that are not positive integers', () => {
    assertThrowsWith(() => maxTargetWidth(0, 10), RangeError, 'imageWidth', '0');
  });
});

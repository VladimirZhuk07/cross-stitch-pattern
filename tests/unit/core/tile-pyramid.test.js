// Geometry of detail levels and tiles (openspec/specs/large-pattern-rendering/spec.md).
// Large sizes are checked with sizes only: no test allocates a large pattern.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';
import {
  SINGLE_PICTURE_MAX_SIDE,
  TILE_SIZE,
  overviewLevel,
  levelSize,
} from '../../../src/core/tile-pyramid.js';

const HUGE = { width: 10000, height: 10000 };

describe('tile pyramid constants', () => {
  it('keeps single pictures up to 2048 px per side and cuts 512 px tiles', () => {
    assert.equal(SINGLE_PICTURE_MAX_SIDE, 2048);
    assert.equal(TILE_SIZE, 512);
  });
});

describe('overviewLevel and levelSize', () => {
  it('gives a 10000 × 10000 pattern a 1250 × 1250 overview at level 3', () => {
    assert.equal(overviewLevel(HUGE), 3);
    assert.deepEqual(levelSize(HUGE, 3), { width: 1250, height: 1250 });
  });

  it('keeps a 2048 × 1000 pattern as one level-0 picture', () => {
    const grid = { width: 2048, height: 1000 };
    assert.equal(overviewLevel(grid), 0);
    assert.deepEqual(levelSize(grid, 0), { width: 2048, height: 1000 });
  });

  it('gives a 2049 × 2049 pattern a 1025 × 1025 overview at level 1', () => {
    const grid = { width: 2049, height: 2049 };
    assert.equal(overviewLevel(grid), 1);
    assert.deepEqual(levelSize(grid, 1), { width: 1025, height: 1025 });
  });

  it('rounds partial blocks up: 2049 × 10 at level 1 is 1025 × 5', () => {
    const grid = { width: 2049, height: 10 };
    assert.equal(overviewLevel(grid), 1);
    assert.deepEqual(levelSize(grid, 1), { width: 1025, height: 5 });
  });

  it('handles any size: 100000 × 3 has a 1563 × 1 overview at level 6', () => {
    const grid = { width: 100000, height: 3 };
    assert.equal(overviewLevel(grid), 6);
    assert.deepEqual(levelSize(grid, 6), { width: 1563, height: 1 });
  });

  it('keeps a 1 × 1 pattern at level 0', () => {
    assert.equal(overviewLevel({ width: 1, height: 1 }), 0);
    assert.deepEqual(levelSize({ width: 1, height: 1 }, 0), { width: 1, height: 1 });
  });

  it('accepts a smaller max side: 40 × 40 with 16 has a 10 × 10 overview at level 2', () => {
    const grid = { width: 40, height: 40 };
    assert.equal(overviewLevel(grid, 16), 2);
    assert.deepEqual(levelSize(grid, 2), { width: 10, height: 10 });
  });

  it('rejects a grid width of 0 or 1.5', () => {
    assertThrowsWith(() => overviewLevel({ width: 0, height: 5 }), RangeError, 'width', '0');
    assertThrowsWith(() => levelSize({ width: 1.5, height: 5 }, 0), RangeError, 'width', '1.5');
  });
});

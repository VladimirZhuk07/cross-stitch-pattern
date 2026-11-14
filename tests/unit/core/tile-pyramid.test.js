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
  tileCount,
  tileRegion,
  regionCells,
  detailLevel,
  visibleTiles,
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

describe('tileCount', () => {
  it('cuts the levels of a 10000 × 10000 pattern into 20², 10² and 5² tiles', () => {
    assert.deepEqual(tileCount(HUGE, 0), { columns: 20, rows: 20 });
    assert.deepEqual(tileCount(HUGE, 1), { columns: 10, rows: 10 });
    assert.deepEqual(tileCount(HUGE, 2), { columns: 5, rows: 5 });
  });

  it('cuts level 0 of a 2049 × 2049 pattern into 5 × 5 tiles', () => {
    assert.deepEqual(tileCount({ width: 2049, height: 2049 }, 0), { columns: 5, rows: 5 });
  });

  it('accepts a smaller tile size: 40 × 40 with 8 px tiles has 5 × 5 tiles', () => {
    assert.deepEqual(tileCount({ width: 40, height: 40 }, 0, 8), { columns: 5, rows: 5 });
  });
});

describe('tileRegion', () => {
  it('clips the last level-0 tile of a 10000 × 10000 pattern to 272 × 272 px', () => {
    assert.deepEqual(tileRegion(HUGE, 0, 19, 19), { x: 9728, y: 9728, width: 272, height: 272 });
  });

  it('places level-1 tile (9, 0) at x 4608 with 392 × 512 px', () => {
    assert.deepEqual(tileRegion(HUGE, 1, 9, 0), { x: 4608, y: 0, width: 392, height: 512 });
  });

  it('rejects a tile column beyond the level', () => {
    assertThrowsWith(() => tileRegion(HUGE, 0, 20, 0), RangeError, 'column', '20');
  });
});

describe('regionCells', () => {
  it('clips a level-1 region of a 3 × 1 grid to the 3 stitches it covers', () => {
    const cells = regionCells({ width: 3, height: 1 }, 1, { x: 0, y: 0, width: 2, height: 1 });
    assert.deepEqual(cells, { x: 0, y: 0, width: 3, height: 1 });
  });

  it('maps the whole level-3 overview of 10000 × 10000 to all stitches', () => {
    const cells = regionCells(HUGE, 3, { x: 0, y: 0, width: 1250, height: 1250 });
    assert.deepEqual(cells, { x: 0, y: 0, width: 10000, height: 10000 });
  });

  it('maps level-1 tile (9, 0) of 10000 × 10000 to stitch columns 9216 to 9999', () => {
    const cells = regionCells(HUGE, 1, tileRegion(HUGE, 1, 9, 0));
    assert.deepEqual(cells, { x: 9216, y: 0, width: 784, height: 1024 });
  });
});

describe('detailLevel', () => {
  it('draws the level-3 overview of 10000 × 10000 at Fit on a high-DPI screen (0.1504 px per stitch)', () => {
    assert.equal(detailLevel(0.1504, 3), 3);
  });

  it('stops at the overview level when the ideal level is coarser (0.0752 → 4 → 3)', () => {
    assert.equal(detailLevel(0.0752, 3), 3);
  });

  it('picks levels 2, 1, 0 and 0 at 0.3, 0.6, 0.75 and 2 device px per stitch', () => {
    assert.deepEqual([0.3, 0.6, 0.75, 2].map((pixels) => detailLevel(pixels, 3)), [2, 1, 0, 0]);
  });

  it('stays at level 0 for a single-picture pattern', () => {
    assert.equal(detailLevel(0.3, 0), 0);
  });

  it('rejects 0, −1 and NaN device px per stitch', () => {
    for (const value of [0, -1, NaN]) {
      assertThrowsWith(() => detailLevel(value, 3), RangeError, String(value));
    }
  });
});

describe('visibleTiles', () => {
  const middle = { columnStart: 5000, columnEnd: 6000, rowStart: 5000, rowEnd: 5800 };

  it('returns the 9 level-0 tiles around the middle of 10000 × 10000 in row-major order', () => {
    const expected = [];
    for (let row = 9; row <= 11; row++) {
      for (let column = 9; column <= 11; column++) {
        expected.push({ column, row });
      }
    }
    assert.deepEqual(visibleTiles(HUGE, 0, middle), expected);
  });

  it('returns 4 level-1 tiles for the same range', () => {
    assert.deepEqual(visibleTiles(HUGE, 1, middle), [
      { column: 4, row: 4 },
      { column: 5, row: 4 },
      { column: 4, row: 5 },
      { column: 5, row: 5 },
    ]);
  });

  it('returns all 25 level-2 tiles for the whole grid', () => {
    const whole = { columnStart: 0, columnEnd: 10000, rowStart: 0, rowEnd: 10000 };
    assert.equal(visibleTiles(HUGE, 2, whole).length, 25);
  });

  it('returns no tile for an empty range', () => {
    const empty = { columnStart: 10000, columnEnd: 10000, rowStart: 0, rowEnd: 800 };
    assert.deepEqual(visibleTiles(HUGE, 0, empty), []);
  });
});

// Unit tests for src/core/progress.js (see openspec/specs/stitch-progress/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { createProgress } from '../../../src/core/progress.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

// Legend 1 = 310 at cells 1, 2, 4; legend 2 = 321 at cells 0, 5; cell 3 empty.
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

describe('createProgress', () => {
  it('starts with no stitch marked, counting the non-empty cells', () => {
    const pattern = threeByTwoPattern();
    const progress = createProgress(pattern);
    assert.equal(progress.pattern, pattern);
    assert.deepEqual([...progress.bits], [0]);
    assert.equal(progress.stitchedCount, 0);
    assert.equal(progress.totalCount, 5);
    assert.equal(progress.version, 0);
    assert.equal(progress.lastToggled, null);
  });

  it('uses one bit per cell, rounded up to whole bytes', () => {
    assert.equal(createProgress(solidPattern(3, 3)).bits.length, 2);
    assert.equal(createProgress(solidPattern(8, 1)).bits.length, 1);
    assert.equal(createProgress(solidPattern(4, 4)).bits.length, 2);
  });

  it('has nothing to stitch in a pattern without stitches', () => {
    const empty = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    assert.equal(createProgress(empty).totalCount, 0);
  });

  it('does not modify the pattern', () => {
    const pattern = threeByTwoPattern();
    const before = [...pattern.cells];
    createProgress(pattern);
    assert.deepEqual([...pattern.cells], before);
  });
});

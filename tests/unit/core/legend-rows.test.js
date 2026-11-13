import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { legendRows } from '../../../src/core/legend-rows.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function singleColorPattern(stitchCount, name = 'Red') {
  return buildPattern({
    width: stitchCount,
    height: 1,
    cells: new Int16Array(stitchCount),
    colors: [{ code: '321', name, hex: '#C72B3B' }],
  });
}

describe('legendRows', () => {
  it('returns one row of display texts per legend entry, in number order', () => {
    assert.deepEqual(legendRows(threeByTwoPattern()), [
      { number: '1', code: '310', name: 'Black', hex: '#000000', stitchCount: '3' },
      { number: '2', code: '321', name: 'Red', hex: '#C72B3B', stitchCount: '2' },
    ]);
  });

  it('writes 12345 stitches as 12,345', () => {
    assert.equal(legendRows(singleColorPattern(12345))[0].stitchCount, '12,345');
  });

  it('writes 1234567 stitches as 1,234,567', () => {
    assert.equal(legendRows(singleColorPattern(1234567))[0].stitchCount, '1,234,567');
  });

  it('returns no rows for a pattern without stitches', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    assert.deepEqual(legendRows(pattern), []);
  });

  it('returns a name with markup unchanged, for insertion as text', () => {
    assert.equal(legendRows(singleColorPattern(1, '<b>Red</b>'))[0].name, '<b>Red</b>');
  });

  it('does not modify the pattern', () => {
    const pattern = threeByTwoPattern();
    const before = structuredClone(pattern);
    legendRows(pattern);
    assert.deepEqual(pattern, before);
  });
});

// Unit tests for src/core/pattern-summary.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { summarizePattern, summaryLines } from '../../../src/core/pattern-summary.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

describe('summarizePattern', () => {
  it('counts the stitched cells and the legend colors', () => {
    const pattern = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
    assert.deepEqual(summarizePattern(pattern), { width: 3, height: 2, totalStitches: 5, colorCount: 2 });
  });
});

describe('summaryLines', () => {
  it('writes size, stitches and colors with thousands separators', () => {
    assert.deepEqual(summaryLines({ width: 1200, height: 800, totalStitches: 960000, colorCount: 24 }), [
      ['Size', '1,200 × 800 stitches'],
      ['Stitches', '960,000'],
      ['Colors', '24 DMC colors'],
    ]);
  });

  it('writes one color in the singular', () => {
    assert.equal(summaryLines({ width: 1, height: 1, totalStitches: 1, colorCount: 1 })[2][1], '1 DMC color');
  });
});

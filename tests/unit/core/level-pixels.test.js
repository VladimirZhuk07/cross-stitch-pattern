// Pixels of detail-level pictures (openspec/specs/large-pattern-rendering/spec.md,
// "Level pixels average their stitches"). Hex values are test fixtures, not palette data.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colorTable, fillLevelRows } from '../../../src/core/level-pixels.js';
import { buildPattern } from '../../../src/core/pattern.js';
import { patternToStitchImage } from '../../../src/core/pattern-image.js';
import { paleTint, EMPTY_CELL_COLOR } from '../../../src/core/chart-tint.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const WHITE = { code: 'BLANC', name: 'White', hex: '#FFFFFF' };

// The tables the two layers use: DMC colors with transparent empty cells, chart tints with grey.
function stitchTable(pattern) {
  return colorTable(pattern.legend.map((entry) => entry.hex), null);
}

function tintTable(pattern) {
  return colorTable(pattern.legend.map((entry) => paleTint(entry.hex)), EMPTY_CELL_COLOR);
}

// Fills the whole level-`level` picture of a small pattern and returns its bytes.
function wholeLevel(pattern, table, level) {
  const side = 2 ** level;
  const region = { x: 0, y: 0, width: Math.ceil(pattern.width / side), height: Math.ceil(pattern.height / side) };
  const out = new Uint8ClampedArray(region.width * region.height * 4);
  const read = fillLevelRows(pattern, table, level, region, 0, region.height, out);
  return { pixels: [...out], read };
}

describe('colorTable', () => {
  it('puts a transparent empty entry first, then each color opaque', () => {
    const table = colorTable(['#000000', '#C72B3B'], null);
    assert.ok(table instanceof Uint8ClampedArray);
    assert.deepEqual([...table], [0, 0, 0, 0, 0, 0, 0, 255, 199, 43, 59, 255]);
  });

  it('makes the empty entry an opaque color when one is given', () => {
    assert.deepEqual([...colorTable(['#B0B0B0'], '#E0E0E0')], [224, 224, 224, 255, 176, 176, 176, 255]);
  });

  it('accepts lowercase hex', () => {
    assert.deepEqual([...colorTable(['#c72b3b'], null)], [0, 0, 0, 0, 199, 43, 59, 255]);
  });

  it('rejects a malformed color and names it', () => {
    assert.throws(() => colorTable(['000000'], null), (error) => error.message.includes('000000'));
  });
});

describe('fillLevelRows', () => {
  it('writes the stitch image at level 0', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, -1, 1, 0], colors: [BLACK, WHITE] });
    const { pixels, read } = wholeLevel(pattern, stitchTable(pattern), 0);
    assert.deepEqual(pixels, [...patternToStitchImage(pattern).data]);
    assert.equal(read, 4);
  });

  it('averages a 2 × 2 block with an empty cell, weighted by opacity', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 1, 1, -1], colors: [BLACK, RED] });
    assert.deepEqual(wholeLevel(pattern, stitchTable(pattern), 1).pixels, [133, 29, 39, 191]);
  });

  it('keeps a block of only empty cells fully transparent', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    assert.deepEqual(wholeLevel(pattern, stitchTable(pattern), 1).pixels, [0, 0, 0, 0]);
  });

  it('averages chart tints and the empty grey as opaque colors', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 1, -1, 0], colors: [BLACK, RED] });
    assert.deepEqual(wholeLevel(pattern, tintTable(pattern), 1).pixels, [208, 192, 191, 255]);
  });

  it('averages only the stitches inside the pattern at the right edge', () => {
    const pattern = buildPattern({ width: 3, height: 1, cells: [0, 0, 1], colors: [BLACK, RED] });
    const { pixels, read } = wholeLevel(pattern, stitchTable(pattern), 1);
    assert.deepEqual(pixels, [0, 0, 0, 255, 199, 43, 59, 255]);
    assert.equal(read, 3);
  });

  it('fills only the requested rows', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 0, 1, 1], colors: [BLACK, RED] });
    const out = new Uint8ClampedArray(16).fill(7);
    const read = fillLevelRows(pattern, stitchTable(pattern), 0, { x: 0, y: 0, width: 2, height: 2 }, 1, 2, out);
    assert.deepEqual([...out.slice(0, 8)], [7, 7, 7, 7, 7, 7, 7, 7]);
    assert.deepEqual([...out.slice(8)], [199, 43, 59, 255, 199, 43, 59, 255]);
    assert.equal(read, 2);
  });

  it('fills a region away from the top-left corner', () => {
    const pattern = buildPattern({ width: 4, height: 1, cells: [0, 0, 1, -1], colors: [BLACK, RED] });
    const out = new Uint8ClampedArray(4);
    fillLevelRows(pattern, stitchTable(pattern), 1, { x: 1, y: 0, width: 1, height: 1 }, 0, 1, out);
    assert.deepEqual([...out], [199, 43, 59, 128]);
  });

  it('does not modify the pattern', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 1, 1, -1], colors: [BLACK, RED] });
    const cellsBefore = [...pattern.cells];
    wholeLevel(pattern, stitchTable(pattern), 1);
    assert.deepEqual([...pattern.cells], cellsBefore);
  });

  it('rejects an invalid level, region, row range or output size', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 0, 0, 0], colors: [BLACK] });
    const table = stitchTable(pattern);
    const whole = { x: 0, y: 0, width: 2, height: 2 };
    const out = new Uint8ClampedArray(16);
    assertThrowsWith(() => fillLevelRows(pattern, table, -1, whole, 0, 2, out), RangeError, 'level', '-1');
    assertThrowsWith(() => fillLevelRows(pattern, table, 1.5, whole, 0, 2, out), RangeError, 'level', '1.5');
    assertThrowsWith(() => fillLevelRows(pattern, table, 0, { x: 1, y: 0, width: 2, height: 2 }, 0, 2, out), RangeError, 'region');
    assertThrowsWith(() => fillLevelRows(pattern, table, 0, whole, 0, 3, out), RangeError, 'rowEnd', '3');
    assertThrowsWith(() => fillLevelRows(pattern, table, 0, whole, 0, 2, new Uint8ClampedArray(12)), RangeError, '16', '12');
  });
});

describe('fillLevelRows with a stitched mask', () => {
  // Legend 1 = 310 (cells 1, 2, 4), legend 2 = 321 (cells 0, 5), cell 3 empty.
  const threeByTwo = () => buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });

  // A mask (Progress bits layout: bit i & 7 of byte i >> 3) with the given cells stitched.
  function maskOf(cellCount, stitchedCells) {
    const bits = new Uint8Array(Math.ceil(cellCount / 8));
    for (const cell of stitchedCells) {
      bits[cell >> 3] |= 1 << (cell & 7);
    }
    return bits;
  }

  function maskedLevel(pattern, table, level, mask) {
    const side = 2 ** level;
    const region = { x: 0, y: 0, width: Math.ceil(pattern.width / side), height: Math.ceil(pattern.height / side) };
    const out = new Uint8ClampedArray(region.width * region.height * 4);
    const read = fillLevelRows(pattern, table, level, region, 0, region.height, out, mask);
    return { pixels: [...out], read };
  }

  it('shows only the stitched cells at level 0, the others transparent', () => {
    const pattern = threeByTwo();
    const { pixels } = maskedLevel(pattern, stitchTable(pattern), 0, maskOf(6, [5]));
    assert.deepEqual(pixels, [
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0xC7, 0x2B, 0x3B, 255,
    ]);
  });

  it('averages a block by its stitched share at higher levels', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, 0, 0, 0], colors: [BLACK] });
    assert.deepEqual(maskedLevel(pattern, stitchTable(pattern), 1, maskOf(4, [3])).pixels, [0, 0, 0, 64]);
    assert.deepEqual(maskedLevel(pattern, stitchTable(pattern), 1, maskOf(4, [0, 1, 2, 3])).pixels, [0, 0, 0, 255]);
    assert.deepEqual(maskedLevel(pattern, stitchTable(pattern), 1, maskOf(4, [])).pixels, [0, 0, 0, 0]);
  });

  it('gives exactly the unmasked result for a null mask', () => {
    const pattern = threeByTwo();
    for (const level of [0, 1]) {
      assert.deepEqual(maskedLevel(pattern, tintTable(pattern), level, null), wholeLevel(pattern, tintTable(pattern), level));
    }
  });

  it('reads as many stitches with a mask as without', () => {
    const pattern = threeByTwo();
    for (const level of [0, 1]) {
      assert.equal(maskedLevel(pattern, stitchTable(pattern), level, maskOf(6, [0, 5])).read, wholeLevel(pattern, stitchTable(pattern), level).read);
    }
  });
});

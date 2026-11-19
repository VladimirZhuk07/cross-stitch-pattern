// Unit tests for src/core/highlight.js (see openspec/specs/stitch-chart/spec.md, "Highlighted
// cells are red with white numbers", "One legend color can be selected").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import { paleTint, contrastRatio } from '../../../src/core/chart-tint.js';
import {
  HIGHLIGHT_COLOR,
  HIGHLIGHT_NUMBER_COLOR,
  HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE,
  HIGHLIGHT_CACHE_BUDGET_BYTES,
  toggleHighlight,
  highlightLevel,
  fillHighlightRows,
} from '../../../src/core/highlight.js';
import { colorTable, fillLevelRows } from '../../../src/core/level-pixels.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

describe('highlight colors', () => {
  it('fills highlighted cells with #B00000 and writes their numbers in white', () => {
    assert.equal(HIGHLIGHT_COLOR, '#B00000');
    assert.equal(HIGHLIGHT_NUMBER_COLOR, '#FFFFFF');
  });

  it('keeps white numbers readable on the highlight (contrast ≥ 7.3)', () => {
    const contrast = contrastRatio(HIGHLIGHT_NUMBER_COLOR, HIGHLIGHT_COLOR);
    assert.ok(contrast >= 7.3, `contrast ${contrast}`);
  });

  it('stands out from the pale tint of every DMC color (contrast ≥ 3.4)', () => {
    for (const { code, hex } of DMC_COLORS) {
      const contrast = contrastRatio(paleTint(hex), HIGHLIGHT_COLOR);
      assert.ok(contrast >= 3.4, `DMC ${code}: contrast ${contrast}`);
    }
  });
});

describe('toggleHighlight', () => {
  it('selects a color when nothing is selected', () => {
    assert.equal(toggleHighlight(null, 2), 2);
  });

  it('clears the selection when the selected color is chosen again', () => {
    assert.equal(toggleHighlight(2, 2), null);
  });

  it('moves the selection to another color', () => {
    assert.equal(toggleHighlight(2, 0), 0);
  });

  it('rejects an index that is not a whole number ≥ 0, naming the value', () => {
    assert.throws(() => toggleHighlight(null, -1), (error) => error instanceof RangeError && /-1/.test(error.message));
    assert.throws(() => toggleHighlight(null, 1.5), (error) => error instanceof RangeError && /1\.5/.test(error.message));
  });
});

describe('highlightLevel', () => {
  it('uses one picture pixel per stitch from one device pixel per stitch up', () => {
    assert.equal(highlightLevel(1, 5), 0);
    assert.equal(highlightLevel(2, 5), 0);
  });

  it('rounds up, so a picture pixel always covers at least one device pixel', () => {
    assert.equal(highlightLevel(0.9, 5), 1);
    assert.equal(highlightLevel(0.5, 5), 1);
    assert.equal(highlightLevel(0.49, 5), 2);
    assert.equal(highlightLevel(0.18, 5), 3);
  });

  it('never goes above the overview level', () => {
    assert.equal(highlightLevel(0.18, 2), 2);
  });

  it('rejects a stitch size that is not a positive number', () => {
    for (const value of [0, -1, Number.NaN]) {
      assert.throws(() => highlightLevel(value, 5), RangeError, `for ${value}`);
    }
  });

  it('keeps overview pictures at most 256 px per side and the cache at 16 MiB', () => {
    assert.equal(HIGHLIGHT_SINGLE_PICTURE_MAX_SIDE, 256);
    assert.equal(HIGHLIGHT_CACHE_BUDGET_BYTES, 16 * 1024 * 1024);
  });
});

// A grid (the fields of a Pattern that the fillers read) from rows of legend indices, −1 empty.
function grid(rows) {
  return { width: rows[0].length, height: rows.length, cells: Int16Array.from(rows.flat()) };
}

// Fills a whole level of a grid; returns the RGBA bytes as one '#RRGGBBAA'-like string per pixel.
function highlightPixels(cellGrid, legendIndex, level) {
  const width = Math.ceil(cellGrid.width / 2 ** level);
  const height = Math.ceil(cellGrid.height / 2 ** level);
  const out = new Uint8ClampedArray(width * height * 4);
  fillHighlightRows(cellGrid, legendIndex, level, { x: 0, y: 0, width, height }, 0, height, out);
  const pixels = [];
  for (let offset = 0; offset < out.length; offset += 4) {
    pixels.push([...out.subarray(offset, offset + 4)].join(','));
  }
  return pixels;
}

const RED_PIXEL = '176,0,0,255';
const CLEAR_PIXEL = '0,0,0,0';

describe('fillHighlightRows', () => {
  it('marks exactly the stitches of the selected color at level 0', () => {
    // The 3 × 2 chart pattern: index 1 at (0, 0) and (2, 1), index 0 elsewhere, (0, 1) empty.
    const pattern = grid([[1, 0, 0], [-1, 0, 1]]);
    assert.deepEqual(highlightPixels(pattern, 1, 0), [RED_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL, RED_PIXEL]);
  });

  it('marks a whole block when any one of its stitches has the color', () => {
    const pattern = grid([
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [2, 2, 1, 1],
      [2, 2, 1, 3],
    ]);
    assert.deepEqual(highlightPixels(pattern, 3, 1), [CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL, RED_PIXEL]);
  });

  it('handles the partial blocks at the right and bottom edges', () => {
    const pattern = grid([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [4, 0, 0, 0, 4],
    ]);
    assert.deepEqual(highlightPixels(pattern, 4, 1), [
      CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL,
      CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL,
      RED_PIXEL, CLEAR_PIXEL, RED_PIXEL,
    ]);
  });

  it('fills only the requested rows', () => {
    const pattern = grid([[1, 1], [1, 1], [1, 1]]);
    const out = new Uint8ClampedArray(2 * 3 * 4).fill(7);
    fillHighlightRows(pattern, 1, 0, { x: 0, y: 0, width: 2, height: 3 }, 1, 2, out);
    assert.deepEqual([...out.subarray(0, 8)], [7, 7, 7, 7, 7, 7, 7, 7]);
    assert.deepEqual([...out.subarray(8, 16)], [176, 0, 0, 255, 176, 0, 0, 255]);
    assert.deepEqual([...out.subarray(16, 24)], [7, 7, 7, 7, 7, 7, 7, 7]);
  });

  it('fills a region away from the top-left corner', () => {
    const pattern = grid([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 5, 0],
      [0, 0, 0, 0],
    ]);
    const out = new Uint8ClampedArray(2 * 2 * 4);
    fillHighlightRows(pattern, 5, 0, { x: 2, y: 2, width: 2, height: 2 }, 0, 2, out);
    assert.deepEqual([...out], [176, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('counts the same stitches read as the cell colors for the same rows', () => {
    const pattern = grid([
      [1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0],
    ]);
    const table = colorTable(['#000000', '#FFFFFF'], null);
    for (const level of [0, 1, 2]) {
      const side = Math.ceil(5 / 2 ** level);
      const region = { x: 0, y: 0, width: side, height: side };
      const cellsRead = fillLevelRows(pattern, table, level, region, 0, side, new Uint8ClampedArray(side * side * 4));
      const highlightRead = fillHighlightRows(pattern, 1, level, region, 0, side, new Uint8ClampedArray(side * side * 4));
      assert.equal(highlightRead, cellsRead, `level ${level}`);
    }
  });

  it('leaves everything transparent for an index that is not in the pattern', () => {
    assert.deepEqual(highlightPixels(grid([[0, 1], [1, -1]]), 7, 0), [CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL, CLEAR_PIXEL]);
  });

  it('does not modify the grid', () => {
    const pattern = grid([[0, 1], [1, -1]]);
    const before = [...pattern.cells];
    highlightPixels(pattern, 1, 1);
    assert.deepEqual([...pattern.cells], before);
  });

  it('rejects an invalid level, region, row range or output size like fillLevelRows', () => {
    const pattern = grid([[0, 0], [0, 0]]);
    const whole = { x: 0, y: 0, width: 2, height: 2 };
    const out = new Uint8ClampedArray(16);
    assertThrowsWith(() => fillHighlightRows(pattern, 0, -1, whole, 0, 2, out), RangeError, 'level', '-1');
    assertThrowsWith(() => fillHighlightRows(pattern, 0, 1.5, whole, 0, 2, out), RangeError, 'level', '1.5');
    assertThrowsWith(() => fillHighlightRows(pattern, 0, 0, { x: 1, y: 0, width: 2, height: 2 }, 0, 2, out), RangeError, 'region');
    assertThrowsWith(() => fillHighlightRows(pattern, 0, 0, whole, 0, 3, out), RangeError, 'rowEnd', '3');
    assertThrowsWith(() => fillHighlightRows(pattern, 0, 0, whole, 0, 2, new Uint8ClampedArray(12)), RangeError, '16', '12');
  });
});

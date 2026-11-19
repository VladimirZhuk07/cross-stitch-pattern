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
} from '../../../src/core/highlight.js';

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

// Unit tests for src/core/highlight.js (see openspec/specs/stitch-chart/spec.md, "Highlighted
// cells are red with white numbers", "One legend color can be selected").

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import { paleTint, contrastRatio } from '../../../src/core/chart-tint.js';
import { HIGHLIGHT_COLOR, HIGHLIGHT_NUMBER_COLOR, toggleHighlight } from '../../../src/core/highlight.js';

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

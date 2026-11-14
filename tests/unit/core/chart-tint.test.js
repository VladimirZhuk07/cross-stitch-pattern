import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { hexToRgb, rgbToLab } from '../../../src/core/color.js';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import { paleTint, contrastRatio } from '../../../src/core/chart-tint.js';

// Expected tints: design D9 of add-stitch-chart-layer (L' = 72 + 0.25 L*, chroma × 0.6).
describe('paleTint', () => {
  it('turns 310 Black #000000 into the grey #B0B0B0', () => {
    assert.equal(paleTint('#000000'), '#B0B0B0');
  });

  it('keeps 939 Navy Blue Very Dark #1B2853 bluish: #B8BADB', () => {
    assert.equal(paleTint('#1B2853'), '#B8BADB');
  });

  it('turns 336 Navy Blue #253B73 into #BBC0E9', () => {
    assert.equal(paleTint('#253B73'), '#BBC0E9');
  });

  it('turns 321 Red #C72B3B into #FFC0BB', () => {
    assert.equal(paleTint('#C72B3B'), '#FFC0BB');
  });

  it('turns 307 Lemon #FDED54 into #FFF2B0', () => {
    assert.equal(paleTint('#FDED54'), '#FFF2B0');
  });

  it('turns BLANC #FCFBF8 into #F6F5F4', () => {
    assert.equal(paleTint('#FCFBF8'), '#F6F5F4');
  });

  it('turns B5200 #FFFFFF into #F6F6F6', () => {
    assert.equal(paleTint('#FFFFFF'), '#F6F6F6');
  });

  it('turns 318 Steel Gray Light #ABABAB into #E1E1E1', () => {
    assert.equal(paleTint('#ABABAB'), '#E1E1E1');
  });

  it('accepts lowercase hex', () => {
    assert.equal(paleTint('#c72b3b'), '#FFC0BB');
  });

  it('rejects hex without #', () => {
    assert.throws(() => paleTint('000000'), { message: /000000/ });
  });

  it('keeps every DMC tint in the L* band 72–97 with contrast ≥ 9.5 against black', () => {
    for (const { code, hex } of DMC_COLORS) {
      const tint = paleTint(hex);
      const { L } = rgbToLab(hexToRgb(tint));
      assert.ok(L >= 71.5 && L <= 97.5, `DMC ${code}: tint ${tint} has L* ${L}`);
      const contrast = contrastRatio(tint, '#000000');
      assert.ok(contrast >= 9.5, `DMC ${code}: tint ${tint} has contrast ${contrast}`);
    }
  });
});

// WCAG 2 contrast ratio: (L1 + 0.05) / (L2 + 0.05) of relative luminances.
describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    assertClose(contrastRatio('#000000', '#FFFFFF'), 21, 1e-9, 'contrast');
  });

  it('is 1 for black on black', () => {
    assertClose(contrastRatio('#000000', '#000000'), 1, 1e-9, 'contrast');
  });

  it('is about 4.478 for #777777 on white', () => {
    assertClose(contrastRatio('#777777', '#FFFFFF'), 4.478, 1e-3, 'contrast');
  });

  it('does not depend on the argument order', () => {
    assert.equal(contrastRatio('#FFFFFF', '#777777'), contrastRatio('#777777', '#FFFFFF'));
  });

  it('is about 9.68 for black on the 310 tint #B0B0B0', () => {
    assertClose(contrastRatio('#B0B0B0', '#000000'), 9.68, 5e-3, 'contrast');
  });
});

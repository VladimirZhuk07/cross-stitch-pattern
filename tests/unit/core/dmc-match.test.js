import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hexToRgb, rgbToLab } from '../../../src/core/color.js';
import { nearestDmcColor, prepareLabPalette } from '../../../src/core/dmc-match.js';
import { assertClose } from '../../helpers/assert-close.js';

// Small hand-written test palettes. Codes are deliberately not real DMC codes.
function blackWhitePalette() {
  return [
    { code: 'K', name: 'Test black', hex: '#000000' },
    { code: 'W', name: 'Test white', hex: '#FFFFFF' },
  ];
}

describe('prepareLabPalette', () => {
  it('keeps palette order and the code, name, and hex of each entry', () => {
    const prepared = prepareLabPalette(blackWhitePalette());
    assert.deepEqual(
      prepared.map(({ code, name, hex }) => ({ code, name, hex })),
      blackWhitePalette(),
    );
  });

  it('adds the Lab value of each hex color', () => {
    const prepared = prepareLabPalette(blackWhitePalette());
    assert.deepEqual(prepared[0].lab, rgbToLab(hexToRgb('#000000')));
    assert.deepEqual(prepared[1].lab, rgbToLab(hexToRgb('#FFFFFF')));
  });

  it('returns a frozen array of frozen entries', () => {
    const prepared = prepareLabPalette(blackWhitePalette());
    assert.ok(Object.isFrozen(prepared));
    for (const color of prepared) {
      assert.ok(Object.isFrozen(color));
      assert.ok(Object.isFrozen(color.lab));
    }
  });

  it('does not modify the input array or its entries', () => {
    const palette = blackWhitePalette();
    prepareLabPalette(palette);
    assert.deepEqual(palette, blackWhitePalette());
  });

  it('rejects an empty palette with a RangeError', () => {
    assert.throws(() => prepareLabPalette([]), RangeError);
  });

  it('rejects duplicate codes with an Error naming the code', () => {
    const palette = [
      { code: 'A', name: 'First', hex: '#000000' },
      { code: 'A', name: 'Second', hex: '#FFFFFF' },
    ];
    assert.throws(() => prepareLabPalette(palette), (error) => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes("'A'"), error.message);
      return true;
    });
  });

  it('rejects an invalid hex value with a TypeError', () => {
    const palette = [{ code: 'A', name: 'Broken', hex: '#12345' }];
    assert.throws(() => prepareLabPalette(palette), TypeError);
  });
});

describe('nearestDmcColor', () => {
  it('matches dark grey (30, 30, 30) to black with ΔE00 6.7765', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    const match = nearestDmcColor(rgbToLab({ r: 30, g: 30, b: 30 }), palette);
    assert.equal(match.color.code, 'K');
    assert.equal(match.index, 0);
    assertClose(match.deltaE, 6.7765, 1e-3, 'ΔE00 to K');
  });

  it('matches light grey (200, 200, 200) to white with ΔE00 12.1161', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    const match = nearestDmcColor(rgbToLab({ r: 200, g: 200, b: 200 }), palette);
    assert.equal(match.color.code, 'W');
    assert.equal(match.index, 1);
    assertClose(match.deltaE, 12.1161, 1e-3, 'ΔE00 to W');
  });

  it('returns the prepared-palette color itself, its index, and the ΔE00', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    const match = nearestDmcColor(rgbToLab({ r: 0, g: 0, b: 0 }), palette);
    assert.deepEqual(Object.keys(match).sort(), ['color', 'deltaE', 'index']);
    assert.equal(match.color, palette[0]);
    assert.equal(match.deltaE, 0);
  });

  it('breaks exact ties by the lowest palette index, every time', () => {
    const palette = prepareLabPalette([
      { code: 'X', name: 'Grey 1', hex: '#808080' },
      { code: 'Y', name: 'Grey 2', hex: '#808080' },
    ]);
    const grey = rgbToLab({ r: 128, g: 128, b: 128 });
    for (let run = 0; run < 100; run += 1) {
      const match = nearestDmcColor(grey, palette);
      assert.equal(match.color.code, 'X');
      assert.equal(match.index, 0);
    }
  });

  it('does not modify the input Lab color', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    const lab = Object.freeze({ L: 20, a: 1, b: -1 });
    nearestDmcColor(lab, palette);
    assert.deepEqual(lab, { L: 20, a: 1, b: -1 });
  });

  it('rejects a Lab color with a non-finite component', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    assert.throws(() => nearestDmcColor({ L: Number.POSITIVE_INFINITY, a: 0, b: 0 }, palette), TypeError);
  });

  it('rejects a Lab color with a missing component', () => {
    const palette = prepareLabPalette(blackWhitePalette());
    assert.throws(() => nearestDmcColor({ L: 50, a: 0 }, palette), TypeError);
  });
});

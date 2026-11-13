import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hexToRgb, rgbToLab } from '../../../src/core/color.js';
import { prepareLabPalette } from '../../../src/core/dmc-match.js';

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

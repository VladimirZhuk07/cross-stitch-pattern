import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb,
  linearRgbToLab,
  linearToSrgb,
  rgbToLab,
  srgbToLinear,
} from '../../../src/core/color.js';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';

const LAB_KEYS = ['L', 'a', 'b'];

describe('hexToRgb', () => {
  it('parses a lower-case #rrggbb string', () => {
    assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
  });

  it('parses an upper-case #RRGGBB string', () => {
    assert.deepEqual(hexToRgb('#FF8000'), { r: 255, g: 128, b: 0 });
  });

  for (const invalid of ['#fff', 'ff8000', '#gg0000']) {
    it(`rejects ${JSON.stringify(invalid)} with a TypeError naming the value`, () => {
      assert.throws(() => hexToRgb(invalid), (error) => {
        assert.ok(error instanceof TypeError);
        assert.ok(error.message.includes(invalid), error.message);
        return true;
      });
    });
  }

  it('rejects a number with a TypeError naming the value', () => {
    assert.throws(() => hexToRgb(42), (error) => {
      assert.ok(error instanceof TypeError);
      assert.ok(error.message.includes('42'), error.message);
      return true;
    });
  });
});

// Expected values follow the sRGB transfer function of IEC 61966-2-1:1999
// (linear = c / 12.92 for c <= 0.04045, else ((c + 0.055) / 1.055) ^ 2.4, with c = channel / 255).
describe('srgbToLinear', () => {
  const references = [
    [0, 0],
    [10, 0.0030353],
    [128, 0.2158605],
    [255, 1],
  ];
  for (const [channel, expected] of references) {
    it(`converts sRGB channel ${channel} to linear ${expected}`, () => {
      assertClose(srgbToLinear(channel), expected, 1e-6, `linear of ${channel}`);
    });
  }

  for (const invalid of [256, -1, Number.NaN]) {
    it(`rejects sRGB channel ${invalid} with a RangeError naming the value`, () => {
      assert.throws(() => srgbToLinear(invalid), (error) => {
        assert.ok(error instanceof RangeError);
        assert.ok(error.message.includes(String(invalid)), error.message);
        return true;
      });
    });
  }
});

describe('linearToSrgb', () => {
  it('round-trips every integer channel 0..255 within 1e-6', () => {
    for (let channel = 0; channel <= 255; channel += 1) {
      assertClose(linearToSrgb(srgbToLinear(channel)), channel, 1e-6, `round trip of ${channel}`);
    }
  });

  it('clamps a linear value slightly above 1 to 255', () => {
    assert.equal(linearToSrgb(1.0000001), 255);
  });

  it('clamps a linear value slightly below 0 to 0', () => {
    assert.equal(linearToSrgb(-0.0000001), 0);
  });

  it('rejects a NaN linear value with a RangeError naming the value', () => {
    assert.throws(() => linearToSrgb(Number.NaN), (error) => {
      assert.ok(error instanceof RangeError);
      assert.ok(error.message.includes('NaN'), error.message);
      return true;
    });
  });
});

// Reference Lab values (D65 white 0.95047 / 1 / 1.08883, sRGB matrix from Lindbloom, CIE
// epsilon 216/24389 and kappa 24389/27 — the same constants as src/core/color.js) from the
// chroma.js test suite, published rounded to 2 decimals:
// https://github.com/gka/chroma.js/blob/c6f893a6e3bb83b3b03d397ceffd326cf818cd02/test/io/rgb2lab.test.js
const CHROMA_JS_LAB_REFERENCES = [
  { name: 'black', rgb: { r: 0, g: 0, b: 0 }, lab: { L: 0, a: 0, b: 0 } },
  { name: 'white', rgb: { r: 255, g: 255, b: 255 }, lab: { L: 100, a: 0, b: 0 } },
  { name: 'gray', rgb: { r: 128, g: 128, b: 128 }, lab: { L: 53.59, a: 0, b: 0 } },
  { name: 'red', rgb: { r: 255, g: 0, b: 0 }, lab: { L: 53.24, a: 80.09, b: 67.2 } },
  { name: 'yellow', rgb: { r: 255, g: 255, b: 0 }, lab: { L: 97.14, a: -21.55, b: 94.48 } },
  { name: 'green', rgb: { r: 0, g: 255, b: 0 }, lab: { L: 87.73, a: -86.18, b: 83.18 } },
  { name: 'cyan', rgb: { r: 0, g: 255, b: 255 }, lab: { L: 91.11, a: -48.09, b: -14.13 } },
  { name: 'blue', rgb: { r: 0, g: 0, b: 255 }, lab: { L: 32.3, a: 79.19, b: -107.86 } },
  { name: 'magenta', rgb: { r: 255, g: 0, b: 255 }, lab: { L: 60.32, a: 98.23, b: -60.82 } },
];

// Two-decimal references: allow the rounding (0.005) plus a margin.
const LAB_REFERENCE_TOLERANCE = 0.01;

describe('rgbToLab', () => {
  for (const { name, rgb, lab } of CHROMA_JS_LAB_REFERENCES) {
    it(`converts sRGB ${name} to the published Lab value`, () => {
      assertCloseFields(rgbToLab(rgb), lab, LAB_KEYS, LAB_REFERENCE_TOLERANCE, `Lab of ${name}`);
    });
  }

  it('rejects channel 300 with a RangeError naming the value', () => {
    assert.throws(() => rgbToLab({ r: 300, g: 0, b: 0 }), (error) => {
      assert.ok(error instanceof RangeError);
      assert.ok(error.message.includes('300'), error.message);
      return true;
    });
  });

  it('does not modify its input', () => {
    const rgb = Object.freeze({ r: 10, g: 20, b: 30 });
    rgbToLab(rgb);
    assert.deepEqual(rgb, { r: 10, g: 20, b: 30 });
  });
});

describe('linearRgbToLab', () => {
  it('gives the same Lab as the sRGB path for grey 128', () => {
    const linearGrey = { r: 0.2158605, g: 0.2158605, b: 0.2158605 };
    const expected = rgbToLab({ r: 128, g: 128, b: 128 });
    assertCloseFields(linearRgbToLab(linearGrey), expected, LAB_KEYS, 1e-4, 'Lab of linear grey');
  });

  it('maps linear white (1, 1, 1) to Lab (100, 0, 0)', () => {
    const lab = linearRgbToLab({ r: 1, g: 1, b: 1 });
    assertCloseFields(lab, { L: 100, a: 0, b: 0 }, LAB_KEYS, 1e-4, 'Lab of linear white');
  });

  it('rejects a NaN channel with a RangeError', () => {
    assert.throws(() => linearRgbToLab({ r: Number.NaN, g: 0, b: 0 }), RangeError);
  });
});

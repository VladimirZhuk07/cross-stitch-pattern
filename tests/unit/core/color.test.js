import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  deltaE2000,
  hexToRgb,
  labToLinearRgb,
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

// CIEDE2000 test data: G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
// Implementation Notes, Supplementary Test Data, and Mathematical Observations",
// Color Research & Application 30(1), 2005, Table 1. Copied verbatim from the authors' data file
// https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
// (SHA-256 44aebb39107128328add54fbef5ac8ee89909e50508f448a1580adea2058a4b8).
// Each row: [pair number, Lab 1, Lab 2, published ΔE00].
const SHARMA_TEST_PAIRS = [
  [1, [50.0000, 2.6772, -79.7751], [50.0000, 0.0000, -82.7485], 2.0425],
  [2, [50.0000, 3.1571, -77.2803], [50.0000, 0.0000, -82.7485], 2.8615],
  [3, [50.0000, 2.8361, -74.0200], [50.0000, 0.0000, -82.7485], 3.4412],
  [4, [50.0000, -1.3802, -84.2814], [50.0000, 0.0000, -82.7485], 1.0000],
  [5, [50.0000, -1.1848, -84.8006], [50.0000, 0.0000, -82.7485], 1.0000],
  [6, [50.0000, -0.9009, -85.5211], [50.0000, 0.0000, -82.7485], 1.0000],
  [7, [50.0000, 0.0000, 0.0000], [50.0000, -1.0000, 2.0000], 2.3669],
  [8, [50.0000, -1.0000, 2.0000], [50.0000, 0.0000, 0.0000], 2.3669],
  [9, [50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0009], 7.1792],
  [10, [50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0010], 7.1792],
  [11, [50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0011], 7.2195],
  [12, [50.0000, 2.4900, -0.0010], [50.0000, -2.4900, 0.0012], 7.2195],
  [13, [50.0000, -0.0010, 2.4900], [50.0000, 0.0009, -2.4900], 4.8045],
  [14, [50.0000, -0.0010, 2.4900], [50.0000, 0.0010, -2.4900], 4.8045],
  [15, [50.0000, -0.0010, 2.4900], [50.0000, 0.0011, -2.4900], 4.7461],
  [16, [50.0000, 2.5000, 0.0000], [50.0000, 0.0000, -2.5000], 4.3065],
  [17, [50.0000, 2.5000, 0.0000], [73.0000, 25.0000, -18.0000], 27.1492],
  [18, [50.0000, 2.5000, 0.0000], [61.0000, -5.0000, 29.0000], 22.8977],
  [19, [50.0000, 2.5000, 0.0000], [56.0000, -27.0000, -3.0000], 31.9030],
  [20, [50.0000, 2.5000, 0.0000], [58.0000, 24.0000, 15.0000], 19.4535],
  [21, [50.0000, 2.5000, 0.0000], [50.0000, 3.1736, 0.5854], 1.0000],
  [22, [50.0000, 2.5000, 0.0000], [50.0000, 3.2972, 0.0000], 1.0000],
  [23, [50.0000, 2.5000, 0.0000], [50.0000, 1.8634, 0.5757], 1.0000],
  [24, [50.0000, 2.5000, 0.0000], [50.0000, 3.2592, 0.3350], 1.0000],
  [25, [60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [26, [63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [27, [61.2901, 3.7196, -5.3901], [61.4292, 2.2480, -4.9620], 1.8731],
  [28, [35.0831, -44.1164, 3.7933], [35.0232, -40.0716, 1.5901], 1.8645],
  [29, [22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [30, [36.4612, 47.8580, 18.3852], [36.2715, 50.5065, 21.2231], 1.4146],
  [31, [90.8027, -2.0831, 1.4410], [91.1528, -1.6435, 0.0447], 1.4441],
  [32, [90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
  [33, [6.7747, -0.2908, -2.4247], [5.8714, -0.0985, -2.2286], 0.6377],
  [34, [2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
];

// The published ΔE00 values have 4 decimals.
const SHARMA_TOLERANCE = 1e-4;

function labFromArray([L, a, b]) {
  return { L, a, b };
}

describe('deltaE2000', () => {
  it('uses all 34 published test pairs', () => {
    assert.equal(SHARMA_TEST_PAIRS.length, 34);
  });

  for (const [pairNumber, lab1, lab2, expected] of SHARMA_TEST_PAIRS) {
    it(`reproduces Sharma et al. pair ${pairNumber}: ΔE00 = ${expected}`, () => {
      const actual = deltaE2000(labFromArray(lab1), labFromArray(lab2));
      assertClose(actual, expected, SHARMA_TOLERANCE, `ΔE00 of pair ${pairNumber}`);
    });
  }

  it('returns 0 for a color compared with itself', () => {
    const lab = { L: 61.2901, a: 3.7196, b: -5.3901 };
    assert.equal(deltaE2000(lab, lab), 0);
  });

  it('is symmetric for (50, 2.5, 0) and (73, 25, -18)', () => {
    const first = { L: 50, a: 2.5, b: 0 };
    const second = { L: 73, a: 25, b: -18 };
    assertClose(deltaE2000(first, second), 27.1492, SHARMA_TOLERANCE, 'ΔE00 forward');
    assertClose(deltaE2000(second, first), 27.1492, SHARMA_TOLERANCE, 'ΔE00 backward');
  });

  it('rejects a Lab color with a NaN component', () => {
    assert.throws(() => deltaE2000({ L: Number.NaN, a: 0, b: 0 }, { L: 50, a: 0, b: 0 }), TypeError);
  });

  it('rejects a Lab color with a missing component', () => {
    assert.throws(() => deltaE2000({ L: 50, a: 0, b: 0 }, { L: 50, a: 0 }), TypeError);
  });

  it('does not modify its inputs', () => {
    const first = Object.freeze({ L: 50, a: 2.5, b: 0 });
    const second = Object.freeze({ L: 73, a: 25, b: -18 });
    deltaE2000(first, second);
    assert.deepEqual(first, { L: 50, a: 2.5, b: 0 });
    assert.deepEqual(second, { L: 73, a: 25, b: -18 });
  });
});

describe('labToLinearRgb', () => {
  const RGB_KEYS = ['r', 'g', 'b'];

  it('maps Lab white (100, 0, 0) to linear white', () => {
    assertCloseFields(labToLinearRgb({ L: 100, a: 0, b: 0 }), { r: 1, g: 1, b: 1 }, RGB_KEYS, 1e-4, 'white');
  });

  it('maps Lab black (0, 0, 0) to linear black', () => {
    assertCloseFields(labToLinearRgb({ L: 0, a: 0, b: 0 }), { r: 0, g: 0, b: 0 }, RGB_KEYS, 1e-9, 'black');
  });

  it('maps L* 50 grey to linear 0.184187 on every channel', () => {
    assertCloseFields(labToLinearRgb({ L: 50, a: 0, b: 0 }), { r: 0.184187, g: 0.184187, b: 0.184187 }, RGB_KEYS, 1e-5, 'grey');
  });

  it('inverts linearRgbToLab for DMC 321 #C72B3B', () => {
    const rgb = hexToRgb('#C72B3B');
    const linear = { r: srgbToLinear(rgb.r), g: srgbToLinear(rgb.g), b: srgbToLinear(rgb.b) };
    assertCloseFields(labToLinearRgb(linearRgbToLab(linear)), linear, RGB_KEYS, 1e-6, 'round trip');
  });

  it('returns channels outside 0–1 for a Lab color outside sRGB, unclamped', () => {
    const { r, g, b } = labToLinearRgb({ L: 60, a: 0, b: -120 });
    assert.ok([r, g, b].some((channel) => channel < 0 || channel > 1), `got ${r}, ${g}, ${b}`);
  });
});

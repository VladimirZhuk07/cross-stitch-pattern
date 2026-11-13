import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hexToRgb, linearToSrgb, srgbToLinear } from '../../../src/core/color.js';
import { assertClose } from '../../helpers/assert-close.js';

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

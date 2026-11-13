import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { hexToRgb } from '../../../src/core/color.js';

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

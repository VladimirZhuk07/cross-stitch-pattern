// Pixels of detail-level pictures (openspec/specs/large-pattern-rendering/spec.md,
// "Level pixels average their stitches"). Hex values are test fixtures, not palette data.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { colorTable } from '../../../src/core/level-pixels.js';

describe('colorTable', () => {
  it('puts a transparent empty entry first, then each color opaque', () => {
    const table = colorTable(['#000000', '#C72B3B'], null);
    assert.ok(table instanceof Uint8ClampedArray);
    assert.deepEqual([...table], [0, 0, 0, 0, 0, 0, 0, 255, 199, 43, 59, 255]);
  });

  it('makes the empty entry an opaque color when one is given', () => {
    assert.deepEqual([...colorTable(['#B0B0B0'], '#E0E0E0')], [224, 224, 224, 255, 176, 176, 176, 255]);
  });

  it('accepts lowercase hex', () => {
    assert.deepEqual([...colorTable(['#c72b3b'], null)], [0, 0, 0, 0, 199, 43, 59, 255]);
  });

  it('rejects a malformed color and names it', () => {
    assert.throws(() => colorTable(['000000'], null), (error) => error.message.includes('000000'));
  });
});

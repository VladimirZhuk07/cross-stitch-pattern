import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../../../src/core/random.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

function take(random, count) {
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(random());
  }
  return values;
}

describe('createSeededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    assert.deepEqual(take(createSeededRandom(20261113), 1000), take(createSeededRandom(20261113), 1000));
  });

  it('returns numbers from 0 (inclusive) to 1 (exclusive)', () => {
    for (const value of take(createSeededRandom(1), 1000)) {
      assert.ok(value >= 0 && value < 1, `got ${value}`);
    }
  });

  it('gives different sequences for different seeds', () => {
    assert.notEqual(createSeededRandom(1)(), createSeededRandom(2)());
  });

  it('rejects a seed that is not an integer', () => {
    assertThrowsWith(() => createSeededRandom(1.5), RangeError, '1.5');
    assertThrowsWith(() => createSeededRandom('7'), RangeError, '7');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createReservoirSampler } from '../../../src/core/reservoir-sample.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

function slotsOf(nextSlot, count) {
  return Array.from({ length: count }, () => nextSlot());
}

describe('createReservoirSampler', () => {
  it('fills the reservoir in order with the first items', () => {
    const nextSlot = createReservoirSampler(5, 1);
    assert.deepEqual(slotsOf(nextSlot, 5), [0, 1, 2, 3, 4]);
  });

  it('then skips items or replaces a slot inside the reservoir', () => {
    const nextSlot = createReservoirSampler(5, 1);
    slotsOf(nextSlot, 5);
    const later = slotsOf(nextSlot, 1000);
    assert.ok(later.every((slot) => slot === -1 || (Number.isInteger(slot) && slot >= 0 && slot < 5)));
    assert.ok(later.includes(-1));
  });

  it('gives the same sequence for the same seed', () => {
    const first = slotsOf(createReservoirSampler(100, 42), 10000);
    const second = slotsOf(createReservoirSampler(100, 42), 10000);
    assert.deepEqual(first, second);
  });

  it('keeps every item with the same probability (1000 items, 10 slots, 200 seeds)', () => {
    const itemCount = 1000;
    const capacity = 10;
    const seedCount = 200;
    const timesKept = new Array(itemCount).fill(0);
    for (let seed = 0; seed < seedCount; seed++) {
      const nextSlot = createReservoirSampler(capacity, seed);
      const reservoir = new Array(capacity);
      for (let item = 0; item < itemCount; item++) {
        const slot = nextSlot();
        if (slot !== -1) {
          reservoir[slot] = item;
        }
      }
      for (const item of reservoir) {
        timesKept[item] += 1;
      }
    }
    // Expected inclusion rate 1 %; compare the first and last hundred items in bulk, which
    // keeps the check stable (each hundred is expected 200 times).
    const rate = (from, to) => timesKept.slice(from, to).reduce((sum, count) => sum + count, 0) / ((to - from) * seedCount);
    for (const [from, to] of [[0, 100], [450, 550], [900, 1000]]) {
      const observed = rate(from, to);
      assert.ok(Math.abs(observed - 0.01) <= 0.005, `items ${from}–${to - 1}: rate ${observed}`);
    }
  });

  it('rejects a capacity that is not a positive integer', () => {
    assertThrowsWith(() => createReservoirSampler(0, 1), RangeError, 'capacity', '0');
    assertThrowsWith(() => createReservoirSampler(1.5, 1), RangeError, 'capacity', '1.5');
  });

  it('rejects a seed that is not an integer', () => {
    assertThrowsWith(() => createReservoirSampler(10, 0.5), RangeError, 'seed', '0.5');
  });
});

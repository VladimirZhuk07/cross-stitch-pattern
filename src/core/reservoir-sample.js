// Seeded reservoir sampling: picks a uniform sample of fixed size from a stream of items whose
// length is not known in advance, in one pass and deterministically.

import { createSeededRandom } from './random.js';

// Creates a sampler for a reservoir of `capacity` slots (positive integer), with randomness
// from `seed` (integer, see createSeededRandom in ./random.js).
// Returns nextSlot(): call it once per offered item, in stream order. It returns the slot
// (0 to capacity − 1) where that item must be stored, replacing whatever is there, or −1 when
// the item is not kept. The first `capacity` items get slots 0, 1, 2, … in order, so a stream
// no longer than the reservoir is kept whole and in order.
// After n items every item is in the reservoir with the same probability capacity / n
// (Algorithm R, J. S. Vitter, "Random sampling with a reservoir", ACM TOMS 11(1), 1985).
// Throws RangeError if capacity is not a positive integer or seed is not an integer.
export function createReservoirSampler(capacity, seed) {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new RangeError(`capacity must be a positive integer, got ${String(capacity)}`);
  }
  const random = createSeededRandom(seed);
  let offered = 0;

  return function nextSlot() {
    const index = offered;
    offered += 1;
    if (index < capacity) {
      return index;
    }
    const slot = Math.floor(random() * (index + 1));
    return slot < capacity ? slot : -1;
  };
}

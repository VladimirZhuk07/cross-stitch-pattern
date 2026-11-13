// A small seeded pseudo-random number generator, so that randomized steps (the k-means
// start) give the same result for the same input every time.

const UINT32_RANGE = 2 ** 32;

// Creates a pseudo-random number generator from an integer seed.
// Returns a function that, on each call, returns the next number from 0 (inclusive) to 1
// (exclusive). The same seed always gives the same sequence.
// Algorithm: mulberry32 by Tommy Ettinger (public domain), a 32-bit generator that is fast,
// tiny and good enough for picking starting points; it is not for cryptography.
// Throws RangeError if seed is not an integer.
export function createSeededRandom(seed) {
  if (!Number.isInteger(seed)) {
    throw new RangeError(`seed must be an integer, got ${String(seed)}`);
  }
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

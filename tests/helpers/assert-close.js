import assert from 'node:assert/strict';

// Asserts that a floating-point result is within `tolerance` of the expected value.
// `label` names the quantity in the failure message, e.g. 'L of red'.
export function assertClose(actual, expected, tolerance, label = 'value') {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} ± ${tolerance}, got ${actual}`,
  );
}

// Asserts that each of the given keys of two objects is within `tolerance`.
export function assertCloseFields(actual, expected, keys, tolerance, label = 'value') {
  for (const key of keys) {
    assertClose(actual[key], expected[key], tolerance, `${label}.${key}`);
  }
}

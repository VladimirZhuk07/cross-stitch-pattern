import assert from 'node:assert/strict';

// Asserts that fn throws an error of the given type whose message contains every fragment.
export function assertThrowsWith(fn, errorType, ...fragments) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof errorType, `expected ${errorType.name}, got ${error}`);
    for (const fragment of fragments) {
      assert.ok(error.message.includes(fragment), `expected "${fragment}" in "${error.message}"`);
    }
    return true;
  });
}

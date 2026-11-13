import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { isStitchSmallerThanDevicePixel, patternToStitchImage } from '../../../src/core/pattern-image.js';

// Hex values are test fixtures, not palette data.
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const WHITE = { code: 'BLANC', name: 'White', hex: '#FFFFFF' };

// Asserts that fn throws an error of the given type whose message contains every fragment.
function assertThrowsWith(fn, errorType, ...fragments) {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof errorType, `expected ${errorType.name}, got ${error}`);
    for (const fragment of fragments) {
      assert.ok(error.message.includes(fragment), `expected "${fragment}" in "${error.message}"`);
    }
    return true;
  });
}

describe('patternToStitchImage', () => {
  it('turns a single 321 stitch into one opaque red pixel', () => {
    const pattern = buildPattern({ width: 1, height: 1, cells: [0], colors: [RED] });
    const image = patternToStitchImage(pattern);
    assert.equal(image.width, 1);
    assert.equal(image.height, 1);
    assert.deepEqual([...image.data], [199, 43, 59, 255]);
  });

  it('writes one pixel per stitch in row-major order, empty cells fully transparent', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [0, -1, 1, 0], colors: [BLACK, WHITE] });
    const image = patternToStitchImage(pattern);
    assert.equal(image.width, 2);
    assert.equal(image.height, 2);
    assert.deepEqual([...image.data], [
      0, 0, 0, 255,
      0, 0, 0, 0,
      255, 255, 255, 255,
      0, 0, 0, 255,
    ]);
  });

  it('keeps a white BLANC stitch distinct from an empty cell', () => {
    const pattern = buildPattern({ width: 2, height: 1, cells: [0, -1], colors: [WHITE] });
    const { data } = patternToStitchImage(pattern);
    assert.deepEqual([...data.slice(0, 4)], [255, 255, 255, 255]);
    assert.deepEqual([...data.slice(4, 8)], [0, 0, 0, 0]);
  });

  it('colors merged clusters with their shared DMC color', () => {
    const pattern = buildPattern({ width: 3, height: 1, cells: [0, 1, 2], colors: [RED, BLACK, RED] });
    const { data } = patternToStitchImage(pattern);
    assert.deepEqual([...data], [199, 43, 59, 255, 0, 0, 0, 255, 199, 43, 59, 255]);
  });

  it('turns a fully empty pattern into transparent pixels', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const { data } = patternToStitchImage(pattern);
    assert.deepEqual([...data], new Array(16).fill(0));
  });

  it('returns a Uint8ClampedArray of width × height × 4 bytes', () => {
    const pattern = buildPattern({ width: 3, height: 2, cells: [0, 0, 0, 0, 0, -1], colors: [BLACK] });
    const { data } = patternToStitchImage(pattern);
    assert.ok(data instanceof Uint8ClampedArray);
    assert.equal(data.length, 3 * 2 * 4);
  });

  it('does not modify the pattern', () => {
    const pattern = buildPattern({ width: 2, height: 1, cells: [0, -1], colors: [RED] });
    const before = structuredClone(pattern);
    patternToStitchImage(pattern);
    assert.deepEqual(pattern, before);
  });

  it('rejects a cell that points past the legend', () => {
    const pattern = { width: 2, height: 1, cells: Int16Array.from([0, 1]), legend: [{ number: 1, code: '310', name: 'Black', hex: '#000000', stitchCount: 1 }] };
    assertThrowsWith(() => patternToStitchImage(pattern), RangeError, 'cell 1', 'value 1');
  });

  it('rejects a cell below the empty marker', () => {
    const pattern = { width: 1, height: 1, cells: Int16Array.from([-2]), legend: [{ number: 1, code: '310', name: 'Black', hex: '#000000', stitchCount: 1 }] };
    assertThrowsWith(() => patternToStitchImage(pattern), RangeError, '-2');
  });

  it('rejects a cell count that is not width × height', () => {
    const pattern = { width: 3, height: 2, cells: new Int16Array(5), legend: [{ number: 1, code: '310', name: 'Black', hex: '#000000', stitchCount: 5 }] };
    assertThrowsWith(() => patternToStitchImage(pattern), RangeError, '6', '5');
  });
});

describe('isStitchSmallerThanDevicePixel', () => {
  // Only width and height are read, so plain size objects stand in for patterns.
  const content484x242 = { x: 0, y: 0, width: 484, height: 242 };

  it('is false for 2 stitches in 968 CSS px at ratio 1', () => {
    const content = { x: 16, y: 158, width: 968, height: 484 };
    assert.equal(isStitchSmallerThanDevicePixel({ width: 2, height: 1 }, content, 1), false);
  });

  it('is false at exactly one device pixel per stitch (968 × 484 in 484 × 242 at ratio 2)', () => {
    assert.equal(isStitchSmallerThanDevicePixel({ width: 968, height: 484 }, content484x242, 2), false);
  });

  it('is true for 1000 × 500 stitches in 484 × 242 CSS px at ratio 2', () => {
    assert.equal(isStitchSmallerThanDevicePixel({ width: 1000, height: 500 }, content484x242, 2), true);
  });

  it('is true when only the height is too small', () => {
    assert.equal(isStitchSmallerThanDevicePixel({ width: 10, height: 500 }, content484x242, 2), true);
  });

  it('is true when only the width is too small', () => {
    assert.equal(isStitchSmallerThanDevicePixel({ width: 969, height: 10 }, content484x242, 2), true);
  });
});

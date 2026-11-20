// Unit tests for src/core/picture-size.js: sizes of the pictures on the workbook's Summary sheet.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fitInside, stitchBlockSize } from '../../../src/core/picture-size.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

describe('fitInside', () => {
  it('scales the longer side down to the limit, keeping the aspect ratio', () => {
    assert.deepEqual(fitInside({ width: 1600, height: 1072 }, 1024), { width: 1024, height: 686 });
    assert.deepEqual(fitInside({ width: 1600, height: 1072 }, 480), { width: 480, height: 322 });
    assert.deepEqual(fitInside({ width: 1072, height: 1600 }, 480), { width: 322, height: 480 });
  });

  it('never enlarges', () => {
    assert.deepEqual(fitInside({ width: 300, height: 200 }, 1024), { width: 300, height: 200 });
  });

  it('keeps very thin pictures at least 1 px', () => {
    assert.deepEqual(fitInside({ width: 10000, height: 100 }, 480), { width: 480, height: 5 });
    assert.deepEqual(fitInside({ width: 10000, height: 1 }, 480), { width: 480, height: 1 });
  });

  it('throws RangeError for non-positive sizes', () => {
    assertThrowsWith(() => fitInside({ width: 0, height: 10 }, 480), RangeError, '0');
    assertThrowsWith(() => fitInside({ width: 10, height: -2 }, 480), RangeError, '-2');
    assertThrowsWith(() => fitInside({ width: 10, height: 10 }, 0), RangeError, '0');
  });
});

describe('stitchBlockSize', () => {
  it('gives the whole pixels per stitch that fit the limit, at least 1', () => {
    assert.equal(stitchBlockSize({ width: 100, height: 67 }, 1024), 10);
    assert.equal(stitchBlockSize({ width: 1000, height: 1000 }, 1024), 1);
    assert.equal(stitchBlockSize({ width: 10000, height: 100 }, 1024), 1);
  });

  it('throws RangeError for non-positive sizes', () => {
    assertThrowsWith(() => stitchBlockSize({ width: 0, height: 5 }, 1024), RangeError, '0');
    assertThrowsWith(() => stitchBlockSize({ width: 5, height: 5 }, -1), RangeError, '-1');
  });
});

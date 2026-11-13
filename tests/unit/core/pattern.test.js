import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern, compareDmcCodes } from '../../../src/core/pattern.js';

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

describe('compareDmcCodes', () => {
  it('orders numeric codes by value, not as text', () => {
    assert.ok(compareDmcCodes('310', '3865') < 0);
    assert.ok(compareDmcCodes('3865', '310') > 0);
  });

  it('puts digit-only codes before other codes', () => {
    assert.ok(compareDmcCodes('3865', 'B5200') < 0);
    assert.ok(compareDmcCodes('B5200', '3865') > 0);
  });

  it('orders non-numeric codes in ordinal string order', () => {
    assert.ok(compareDmcCodes('B5200', 'BLANC') < 0);
    assert.ok(compareDmcCodes('BLANC', 'ECRU') < 0);
  });

  it('falls back to ordinal order for equal numeric values', () => {
    assert.ok(compareDmcCodes('01', '1') < 0);
    assert.ok(compareDmcCodes('1', '01') > 0);
  });

  it('returns 0 for equal codes', () => {
    assert.equal(compareDmcCodes('310', '310'), 0);
    assert.equal(compareDmcCodes('BLANC', 'BLANC'), 0);
  });

  it('sorts a mixed list of codes', () => {
    const codes = ['ECRU', '3865', 'B5200', '310', 'BLANC'];
    assert.deepEqual([...codes].sort(compareDmcCodes), ['310', '3865', 'B5200', 'BLANC', 'ECRU']);
  });
});

describe('buildPattern: size validation', () => {
  it('rejects width 0', () => {
    assertThrowsWith(
      () => buildPattern({ width: 0, height: 2, cells: [], colors: [BLACK] }),
      RangeError, 'width', 'got 0',
    );
  });

  it('rejects a fractional height', () => {
    assertThrowsWith(
      () => buildPattern({ width: 2, height: 1.5, cells: [0, 0, 0], colors: [BLACK] }),
      RangeError, 'height', '1.5',
    );
  });

  it('rejects a negative width', () => {
    assertThrowsWith(
      () => buildPattern({ width: -3, height: 1, cells: [], colors: [BLACK] }),
      RangeError, 'width', '-3',
    );
  });

  it('rejects a height that is not a number', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: '2', cells: [0, 0], colors: [BLACK] }),
      RangeError, 'height',
    );
  });

  it('rejects 5 cells for a 3 x 2 grid', () => {
    assertThrowsWith(
      () => buildPattern({ width: 3, height: 2, cells: [0, 0, 0, 0, 0], colors: [BLACK] }),
      RangeError, '6', 'got 5',
    );
  });
});

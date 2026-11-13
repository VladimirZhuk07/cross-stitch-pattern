import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareDmcCodes } from '../../../src/core/pattern.js';

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

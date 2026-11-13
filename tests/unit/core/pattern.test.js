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

describe('buildPattern: color and cell validation', () => {
  it('rejects a cell index beyond the colors list', () => {
    assertThrowsWith(
      () => buildPattern({ width: 2, height: 1, cells: [0, 2], colors: [BLACK, RED] }),
      RangeError, 'cell 1', 'index 2',
    );
  });

  it('rejects a cell value below the empty marker', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [-2], colors: [BLACK] }),
      RangeError, 'index -2',
    );
  });

  it('rejects a fractional cell value', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [0.5], colors: [BLACK] }),
      RangeError, 'index 0.5',
    );
  });

  it('rejects a missing colors list', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [-1] }),
      TypeError, 'colors',
    );
  });

  it('rejects an empty DMC code', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [0], colors: [{ code: '', name: 'Black', hex: '#000000' }] }),
      TypeError, 'code',
    );
  });

  it('rejects a name that is not a string', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [0], colors: [{ code: '310', name: 42, hex: '#000000' }] }),
      TypeError, 'name', '310',
    );
  });

  it('rejects a hex without the leading #', () => {
    assertThrowsWith(
      () => buildPattern({ width: 1, height: 1, cells: [0], colors: [{ code: '310', name: 'Black', hex: '000000' }] }),
      TypeError, '310', '000000',
    );
  });
});

// The 3 x 2 example from the spec: 321 has 2 stitches, 310 has 3, BLANC is unused.
function buildGridExample() {
  return buildPattern({ width: 3, height: 2, colors: [RED, BLACK, WHITE], cells: [0, 1, 1, -1, 1, 0] });
}

function legendCodes(pattern) {
  return pattern.legend.map((entry) => entry.code);
}

describe('buildPattern: legend and cells', () => {
  it('accepts plain arrays and typed arrays alike', () => {
    const fromArray = buildPattern({ width: 2, height: 1, colors: [BLACK], cells: [0, -1] });
    const fromTyped = buildPattern({ width: 2, height: 1, colors: [BLACK], cells: Int16Array.from([0, -1]) });
    assert.deepEqual(fromArray, fromTyped);
    assert.deepEqual(Array.from(fromArray.cells), [0, -1]);
    assert.deepEqual(legendCodes(fromArray), ['310']);
  });

  it('lays out a 3 x 2 grid row-major in legend order', () => {
    const pattern = buildGridExample();
    assert.equal(pattern.width, 3);
    assert.equal(pattern.height, 2);
    assert.ok(pattern.cells instanceof Int16Array);
    assert.deepEqual(Array.from(pattern.cells), [1, 0, 0, -1, 0, 1]);
    assert.deepEqual(legendCodes(pattern), ['310', '321']);
  });

  it('fills every legend entry field', () => {
    const pattern = buildGridExample();
    assert.deepEqual(pattern.legend, [
      { number: 1, code: '310', name: 'Black', hex: '#000000', stitchCount: 3 },
      { number: 2, code: '321', name: 'Red', hex: '#C72B3B', stitchCount: 2 },
    ]);
  });

  it('does not count empty cells as stitches', () => {
    const pattern = buildPattern({ width: 2, height: 2, colors: [BLACK], cells: [0, -1, 0, -1] });
    assert.deepEqual(pattern.legend.map((entry) => entry.stitchCount), [2]);
    assert.deepEqual(Array.from(pattern.cells), [0, -1, 0, -1]);
  });

  it('drops colors that no cell uses', () => {
    const pattern = buildPattern({ width: 2, height: 1, colors: [BLACK, WHITE], cells: [0, 0] });
    assert.deepEqual(legendCodes(pattern), ['310']);
    assert.equal(pattern.legend[0].stitchCount, 2);
  });

  it('gives number 1 to the color with the most stitches', () => {
    const pattern = buildPattern({ width: 3, height: 1, colors: [WHITE, BLACK], cells: [0, 1, 1] });
    assert.deepEqual(pattern.legend.map((entry) => [entry.number, entry.code, entry.stitchCount]), [
      [1, '310', 2],
      [2, 'BLANC', 1],
    ]);
  });

  it('orders equal stitch counts by DMC code', () => {
    const colors = ['ECRU', '3865', 'B5200', '310', 'BLANC'].map((code) => ({ code, name: code, hex: '#808080' }));
    const pattern = buildPattern({ width: 5, height: 1, colors, cells: [0, 1, 2, 3, 4] });
    assert.deepEqual(legendCodes(pattern), ['310', '3865', 'B5200', 'BLANC', 'ECRU']);
    assert.deepEqual(pattern.legend.map((entry) => entry.number), [1, 2, 3, 4, 5]);
  });

  it('compares numeric codes by value when breaking ties', () => {
    const winterWhite = { code: '3865', name: 'Winter White', hex: '#F9F7F1' };
    const pattern = buildPattern({ width: 2, height: 1, colors: [winterWhite, BLACK], cells: [0, 1] });
    assert.deepEqual(legendCodes(pattern), ['310', '3865']);
  });

  it('keeps empty cells distinct from white', () => {
    const pattern = buildPattern({ width: 2, height: 1, colors: [WHITE], cells: [0, -1] });
    assert.deepEqual(Array.from(pattern.cells), [0, -1]);
    assert.deepEqual(pattern.legend, [{ number: 1, code: 'BLANC', name: 'White', hex: '#FFFFFF', stitchCount: 1 }]);
  });

  it('builds a fully transparent image as an empty legend', () => {
    const pattern = buildPattern({ width: 2, height: 2, colors: [], cells: [-1, -1, -1, -1] });
    assert.equal(pattern.width, 2);
    assert.equal(pattern.height, 2);
    assert.deepEqual(Array.from(pattern.cells), [-1, -1, -1, -1]);
    assert.deepEqual(pattern.legend, []);
  });

  it('stores hex in uppercase', () => {
    const pattern = buildPattern({ width: 1, height: 1, colors: [{ ...RED, hex: '#c72b3b' }], cells: [0] });
    assert.equal(pattern.legend[0].hex, '#C72B3B');
  });
});

describe('buildPattern: colors with the same DMC code', () => {
  it('merges two clusters that land on DMC 310', () => {
    const pattern = buildPattern({ width: 2, height: 2, colors: [BLACK, RED, { ...BLACK }], cells: [0, 1, 2, 2] });
    assert.deepEqual(pattern.legend.map((entry) => [entry.number, entry.code, entry.stitchCount]), [
      [1, '310', 3],
      [2, '321', 1],
    ]);
    assert.deepEqual(Array.from(pattern.cells), [0, 1, 0, 0]);
  });

  it('merges duplicates whose hex differs only in letter case', () => {
    const pattern = buildPattern({ width: 2, height: 1, colors: [RED, { ...RED, hex: '#c72b3b' }], cells: [0, 1] });
    assert.deepEqual(pattern.legend, [{ number: 1, code: '321', name: 'Red', hex: '#C72B3B', stitchCount: 2 }]);
  });

  it('rejects one code with two different hex values', () => {
    assertThrowsWith(
      () => buildPattern({ width: 2, height: 1, colors: [BLACK, { ...BLACK, hex: '#111111' }], cells: [0, 1] }),
      Error, '310', '#000000', '#111111',
    );
  });

  it('rejects one code with two different names', () => {
    assertThrowsWith(
      () => buildPattern({ width: 2, height: 1, colors: [BLACK, { ...BLACK, name: 'Noir' }], cells: [0, 1] }),
      Error, '310', 'Black', 'Noir',
    );
  });
});

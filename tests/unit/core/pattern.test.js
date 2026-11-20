import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FABRIC_COUNT, FABRIC_COUNTS, MAX_PATTERN_COLORS, buildPattern, compareDmcCodes, finishedSize, legendEntryAt } from '../../../src/core/pattern.js';
import { DMC_COLORS } from '../../../src/data/dmc.js';

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

// Synthetic codes '1'..'count' for limit tests; they are not real palette entries.
function syntheticColors(count) {
  return Array.from({ length: count }, (_, i) => ({ code: String(i + 1), name: `Synthetic ${i + 1}`, hex: '#808080' }));
}

function indexes(count) {
  return Array.from({ length: count }, (_, i) => i);
}

describe('buildPattern: color limit', () => {
  it('accepts 99 colors', () => {
    const pattern = buildPattern({ width: 99, height: 1, colors: syntheticColors(99), cells: indexes(99) });
    assert.equal(pattern.legend.length, 99);
    assert.deepEqual(pattern.legend.map((entry) => entry.number), indexes(99).map((i) => i + 1));
  });

  it('allows as many colors as the DMC palette has (489)', () => {
    assert.equal(MAX_PATTERN_COLORS, DMC_COLORS.length);
    assert.equal(MAX_PATTERN_COLORS, 489);
  });

  it('accepts 489 colors, numbered 1 to 489', () => {
    const pattern = buildPattern({ width: 489, height: 1, colors: syntheticColors(489), cells: indexes(489) });
    assert.equal(pattern.legend.length, 489);
    assert.deepEqual(pattern.legend.map((entry) => entry.number), indexes(489).map((i) => i + 1));
  });

  it('fits the whole DMC palette, highest number 489', () => {
    const pattern = buildPattern({ width: 489, height: 1, colors: DMC_COLORS, cells: indexes(489) });
    assert.equal(pattern.legend.length, 489);
    assert.equal(String(pattern.legend.at(-1).number), '489');
  });

  it('rejects 490 colors', () => {
    assertThrowsWith(
      () => buildPattern({ width: 490, height: 1, colors: syntheticColors(490), cells: indexes(490) }),
      RangeError, '490', '489',
    );
  });

  it('counts the limit after merging duplicate codes', () => {
    const colors = Array.from({ length: 600 }, (_, i) => (i % 2 === 0 ? { ...BLACK } : { ...RED }));
    const pattern = buildPattern({ width: 600, height: 1, colors, cells: indexes(600) });
    assert.deepEqual(pattern.legend.map((entry) => [entry.code, entry.stitchCount]), [['310', 300], ['321', 300]]);
  });
});

describe('buildPattern: determinism and plain data', () => {
  it('returns equal patterns for equal input', () => {
    assert.deepEqual(buildGridExample(), buildGridExample());
  });

  it('does not depend on the order of the input colors', () => {
    const first = buildPattern({ width: 3, height: 1, colors: [RED, BLACK], cells: [0, 1, 1] });
    const second = buildPattern({ width: 3, height: 1, colors: [BLACK, RED], cells: [1, 0, 0] });
    assert.deepEqual(first, second);
    assert.deepEqual(first.legend.map((entry) => [entry.code, entry.stitchCount]), [['310', 2], ['321', 1]]);
    assert.deepEqual(Array.from(first.cells), [1, 0, 0]);
  });

  it('does not modify its input', () => {
    const cells = [0, 1, 1];
    const colors = [{ ...RED, hex: '#c72b3b' }, { ...BLACK }];
    const colorsBefore = structuredClone(colors);
    buildPattern({ width: 3, height: 1, colors, cells });
    assert.deepEqual(cells, [0, 1, 1]);
    assert.deepEqual(colors, colorsBefore);
  });

  it('survives structured cloning with the cell buffer transferred', () => {
    const pattern = buildGridExample();
    const copyBefore = structuredClone(pattern);
    assert.equal(pattern.cells.byteOffset, 0);
    assert.equal(pattern.cells.buffer.byteLength, 12);
    const clone = structuredClone(pattern, { transfer: [pattern.cells.buffer] });
    assert.deepEqual(clone, copyBefore);
    assert.equal(pattern.cells.length, 0, 'the transferred original is detached');
  });
});

describe('legendEntryAt', () => {
  it('returns the legend entry of a stitched cell', () => {
    const entry = legendEntryAt(buildGridExample(), 0, 0);
    assert.equal(entry.number, 2);
    assert.equal(entry.code, '321');
  });

  it('returns null for an empty cell', () => {
    assert.equal(legendEntryAt(buildGridExample(), 0, 1), null);
  });

  it('rejects a column past the right edge', () => {
    assertThrowsWith(() => legendEntryAt(buildGridExample(), 3, 0), RangeError, '3');
  });

  it('rejects a negative column', () => {
    assertThrowsWith(() => legendEntryAt(buildGridExample(), -1, 0), RangeError, '-1');
  });

  it('rejects a row past the bottom edge', () => {
    assertThrowsWith(() => legendEntryAt(buildGridExample(), 0, 2), RangeError, '2');
  });

  it('rejects a fractional coordinate', () => {
    assertThrowsWith(() => legendEntryAt(buildGridExample(), 0.5, 0), RangeError, '0.5');
  });
});

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `expected ${expected}, got ${actual}`);
}

function assertSize(size, expected) {
  assert.deepEqual(Object.keys(size).sort(), Object.keys(expected).sort());
  for (const key of Object.keys(expected)) {
    assertClose(size[key], expected[key]);
  }
}

describe('finishedSize', () => {
  it('measures 140 x 98 stitches on 14 ct Aida', () => {
    assertSize(finishedSize({ width: 140, height: 98 }, 14), { widthInches: 10, heightInches: 7, widthCm: 25.4, heightCm: 17.78 });
  });

  it('defaults to 14 ct', () => {
    const size = finishedSize({ width: 28, height: 14 });
    assert.equal(DEFAULT_FABRIC_COUNT, 14);
    assertClose(size.widthInches, 2);
    assertClose(size.heightInches, 1);
  });

  it('measures 110 x 55 stitches on 11 ct fabric', () => {
    assertSize(finishedSize({ width: 110, height: 55 }, 11), { widthInches: 10, heightInches: 5, widthCm: 25.4, heightCm: 12.7 });
  });

  it('accepts a Pattern as the size', () => {
    const size = finishedSize(buildGridExample(), 14);
    assertClose(size.widthInches, 3 / 14);
    assertClose(size.heightInches, 2 / 14);
  });

  it('offers 11, 14, 16 and 18 ct as fabric choices', () => {
    assert.deepEqual([...FABRIC_COUNTS], [11, 14, 16, 18]);
  });

  for (const badCount of [0, -14, Number.NaN, Number.POSITIVE_INFINITY]) {
    it(`rejects fabric count ${badCount}`, () => {
      assertThrowsWith(() => finishedSize({ width: 10, height: 10 }, badCount), RangeError, String(badCount));
    });
  }
});

describe('pattern fingerprint', () => {
  // The pattern-model spec's 3 × 2 example: colors [321, 310, BLANC], cells [0, 1, 1, -1, 1, 0].
  const PURPLE_RED = { code: '326', name: 'Rose Very Dark', hex: '#B33B4B' };
  const build = (overrides = {}) => buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK, WHITE], ...overrides });

  it('is the same 14 lowercase hex digits for the same input', () => {
    const first = build().fingerprint;
    assert.match(first, /^[0-9a-f]{14}$/);
    assert.equal(build().fingerprint, first);
  });

  it('changes when one cell changes', () => {
    assert.notEqual(build({ cells: [0, 1, 1, 0, 1, 0] }).fingerprint, build().fingerprint);
  });

  it('changes when another DMC code takes the same place', () => {
    assert.notEqual(build({ colors: [PURPLE_RED, BLACK, WHITE] }).fingerprint, build().fingerprint);
  });

  it('changes when the same cells form another size', () => {
    assert.notEqual(build({ width: 2, height: 3 }).fingerprint, build().fingerprint);
  });

  it('exists for a pattern without stitches', () => {
    const empty = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [BLACK] });
    assert.match(empty.fingerprint, /^[0-9a-f]{14}$/);
    assert.notEqual(empty.fingerprint, build().fingerprint);
  });

  it('survives structured cloning', () => {
    const pattern = build();
    assert.equal(structuredClone(pattern).fingerprint, pattern.fingerprint);
  });
});

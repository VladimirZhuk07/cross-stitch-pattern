// Unit tests for src/core/xml.js: text escaping and spreadsheet cell references.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, columnName, cellReference } from '../../../src/core/xml.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

describe('escapeXml', () => {
  it('replaces the five XML special characters', () => {
    assert.equal(escapeXml('Rose & "Wine" <test> \'x\''), 'Rose &amp; &quot;Wine&quot; &lt;test&gt; &apos;x&apos;');
  });

  it('drops characters XML 1.0 forbids but keeps tab, line feed and carriage return', () => {
    assert.equal(escapeXml('a\u0001b\tc'), 'ab\tc');
    assert.equal(escapeXml('a\nb\rc\u0000\u001F\uFFFE'), 'a\nb\rc');
  });

  it('keeps ordinary non-ASCII text', () => {
    assert.equal(escapeXml('3 × 2 stitches – Größe'), '3 × 2 stitches – Größe');
  });
});

describe('columnName', () => {
  it('names columns like a spreadsheet', () => {
    const expected = { 1: 'A', 26: 'Z', 27: 'AA', 52: 'AZ', 702: 'ZZ', 703: 'AAA', 10000: 'NTP', 16384: 'XFD' };
    for (const [number, name] of Object.entries(expected)) {
      assert.equal(columnName(Number(number)), name, `column ${number}`);
    }
  });

  it('throws RangeError naming the value outside 1–16384', () => {
    assertThrowsWith(() => columnName(0), RangeError, '0');
    assertThrowsWith(() => columnName(16385), RangeError, '16385');
    assertThrowsWith(() => columnName(1.5), RangeError, '1.5');
  });
});

describe('cellReference', () => {
  it('joins the column name and the row number', () => {
    assert.equal(cellReference(3, 2), 'C2');
    assert.equal(cellReference(10000, 100), 'NTP100');
  });
});

// Unit tests for src/core/xlsx-legend-sheet.js: the Legend worksheet (sheet3.xml)
// (openspec/changes/add-excel-export/specs/excel-export/spec.md, design D8).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { workbookStyles, BOLD_STYLE, COUNT_STYLE } from '../../../src/core/xlsx-styles.js';
import { legendSheetXml } from '../../../src/core/xlsx-legend-sheet.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });

function sheetOf(pattern) {
  const styles = workbookStyles(pattern.legend);
  return { styles, xml: legendSheetXml(pattern, styles) };
}

const rowOf = (xml, row) => new RegExp(`<row r="${row}">(.*?)</row>`).exec(xml)?.[1] ?? null;

describe('legendSheetXml', () => {
  it('writes a bold header row', () => {
    const { xml } = sheetOf(PATTERN);
    const header = ['No.', 'Color', 'DMC', 'Name', 'Stitches']
      .map((text, index) => `<c r="${'ABCDE'[index]}1" s="${BOLD_STYLE}" t="inlineStr"><is><t>${text}</t></is></c>`)
      .join('');
    assert.equal(rowOf(xml, 1), header);
  });

  it('writes number, swatch, code, name and stitch count of each color', () => {
    const { xml, styles } = sheetOf(PATTERN);
    assert.equal(rowOf(xml, 2), [
      `<c r="A2" s="${styles.legendNumberStyle(0)}"><v>1</v></c>`,
      `<c r="B2" s="${styles.swatchStyle(0)}"/>`,
      '<c r="C2" t="inlineStr"><is><t>310</t></is></c>',
      '<c r="D2" t="inlineStr"><is><t>Black</t></is></c>',
      `<c r="E2" s="${COUNT_STYLE}"><v>3</v></c>`,
    ].join(''));
    assert.equal(rowOf(xml, 3), [
      `<c r="A3" s="${styles.legendNumberStyle(1)}"><v>2</v></c>`,
      `<c r="B3" s="${styles.swatchStyle(1)}"/>`,
      '<c r="C3" t="inlineStr"><is><t>321</t></is></c>',
      '<c r="D3" t="inlineStr"><is><t>Red</t></is></c>',
      `<c r="E3" s="${COUNT_STYLE}"><v>2</v></c>`,
    ].join(''));
    assert.equal(rowOf(xml, 4), null);
    assert.match(xml, /<dimension ref="A1:E3"\/>/);
  });

  it('sets the column widths', () => {
    const { xml } = sheetOf(PATTERN);
    const widths = [...xml.matchAll(/<col min="(\d)" max="\d" width="(\d+)" customWidth="1"\/>/g)].map((match) => [Number(match[1]), Number(match[2])]);
    assert.deepEqual(widths, [[1, 6], [2, 8], [3, 9], [4, 32], [5, 12]]);
  });

  it('turns off the number-stored-as-text warning for the codes, after the page margins', () => {
    const { xml } = sheetOf(PATTERN);
    assert.match(xml, /<pageMargins [^>]*\/><ignoredErrors><ignoredError sqref="C2:C3" numberStoredAsText="1"\/><\/ignoredErrors><\/worksheet>$/);
  });

  it('writes only the header for a pattern without stitches', () => {
    const empty = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const { xml } = sheetOf(empty);
    assert.notEqual(rowOf(xml, 1), null);
    assert.equal(rowOf(xml, 2), null);
    assert.doesNotMatch(xml, /ignoredError/);
    assert.match(xml, /<dimension ref="A1:E1"\/>/);
  });

  it('escapes names with special characters', () => {
    const special = buildPattern({ width: 1, height: 1, cells: [0], colors: [{ code: '3865', name: 'Rose & "Wine" <test>', hex: '#F0E0E0' }] });
    const { xml } = sheetOf(special);
    assert.match(xml, /<c r="D2" t="inlineStr"><is><t>Rose &amp; &quot;Wine&quot; &lt;test&gt;<\/t><\/is><\/c>/);
  });

  it('writes the worksheet elements in schema order', () => {
    const { xml } = sheetOf(PATTERN);
    const tags = ['<dimension', '<sheetViews', '<sheetFormatPr', '<cols', '<sheetData', '<pageMargins', '<ignoredErrors'];
    const positions = tags.map((tag) => xml.indexOf(tag));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), String(positions));
  });
});

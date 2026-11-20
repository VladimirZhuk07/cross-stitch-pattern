// Unit tests for src/core/xlsx-chart-sheet.js: the Chart worksheet (sheet1.xml) as XML text chunks
// (openspec/changes/add-excel-export/specs/excel-export/spec.md, design D5–D6).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { workbookStyles } from '../../../src/core/xlsx-styles.js';
import { chartSheetXml } from '../../../src/core/xlsx-chart-sheet.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });

function sheetText(pattern) {
  return [...chartSheetXml(pattern, workbookStyles(pattern.legend))].join('');
}

describe('chartSheetXml', () => {
  it('sets the used range, opens as the selected tab and has square cells', () => {
    const xml = sheetText(PATTERN);
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'));
    assert.match(xml, /<dimension ref="A1:C2"\/>/);
    assert.match(xml, /<sheetView tabSelected="1" workbookViewId="0"\/>/);
    const columns = xml.match(/<col [^>]*\/>/g);
    assert.deepEqual(columns, ['<col min="1" max="3" width="3.42578125" customWidth="1"/>']);
    const rows = xml.match(/<row [^>]*>/g);
    assert.deepEqual(rows, ['<row r="1" ht="18" customHeight="1">', '<row r="2" ht="18" customHeight="1">']);
  });

  it('writes the legend numbers as numeric values with their chart cell styles', () => {
    const styles = workbookStyles(PATTERN.legend);
    const xml = [...chartSheetXml(PATTERN, styles)].join('');
    const style = (legendIndex, x, y) => styles.chartCellStyle(legendIndex, x, y, 3, 2);
    const expectedCells = [
      `<c r="A1" s="${style(1, 0, 0)}"><v>2</v></c>`,
      `<c r="B1" s="${style(0, 1, 0)}"><v>1</v></c>`,
      `<c r="C1" s="${style(0, 2, 0)}"><v>1</v></c>`,
      `<c r="A2" s="${style(-1, 0, 1)}"/>`,
      `<c r="B2" s="${style(0, 1, 1)}"><v>1</v></c>`,
      `<c r="C2" s="${style(1, 2, 1)}"><v>2</v></c>`,
    ];
    assert.deepEqual(xml.match(/<c [^>]*?(?:\/>|>.*?<\/c>)/g), expectedCells);
    assert.doesNotMatch(xml, / t="/, 'numbers carry no type (they are not text)');
  });

  it('writes the worksheet elements in schema order', () => {
    const xml = sheetText(PATTERN);
    const tags = ['<worksheet', '<dimension', '<sheetViews', '<sheetFormatPr', '<cols', '<sheetData', '<pageMargins', '</worksheet>'];
    const positions = tags.map((tag) => xml.indexOf(tag));
    assert.ok(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1])), String(positions));
  });

  it('names the last column of a 10,000 × 100 pattern NTP', () => {
    const wide = buildPattern({ width: 10000, height: 100, cells: new Int16Array(1_000_000), colors: [BLACK] });
    const chunks = chartSheetXml(wide, workbookStyles(wide.legend));
    assert.match(chunks.next().value, /<dimension ref="A1:NTP100"\/>/);
  });

  it('yields batches of whole rows for a large pattern', () => {
    const tall = buildPattern({ width: 100, height: 1000, cells: new Int16Array(100_000), colors: [BLACK] });
    const chunks = [...chartSheetXml(tall, workbookStyles(tall.legend))];
    assert.ok(chunks.length > 3, `${chunks.length} chunks`);
    const rowChunks = chunks.slice(1, -1);
    for (const chunk of rowChunks) {
      assert.ok(chunk.startsWith('<row r="'), chunk.slice(0, 20));
      assert.ok(chunk.endsWith('</row>'), chunk.slice(-20));
    }
    assert.equal(rowChunks.join('').match(/<row /g).length, 1000);
    assert.ok(chunks.at(-1).startsWith('</sheetData>'));
  });
});

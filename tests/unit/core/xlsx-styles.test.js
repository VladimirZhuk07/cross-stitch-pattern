// Unit tests for src/core/xlsx-styles.js: the workbook's fonts, fills, borders and cell formats
// (openspec/changes/add-excel-export/design.md, D4).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import { workbookStyles, BOLD_STYLE, COUNT_STYLE } from '../../../src/core/xlsx-styles.js';

// Test fixtures, not palette data (the 3 × 2 pattern of the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const PATTERN = buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });

const describeFill = (fill) => fill.rgb ?? fill.pattern;

// The border of a cell format, with each edge as 'medium FF000000', 'thin FFA0A0A0' or null.
function borderOf(styles, styleIndex) {
  const border = styles.borders[styles.cellXfs[styleIndex].borderId];
  const edge = (side) => (side === null ? null : `${side.style} ${side.rgb}`);
  return {
    left: edge(border.left),
    right: edge(border.right),
    top: edge(border.top),
    bottom: edge(border.bottom),
    diagonalUp: edge(border.diagonalUp),
  };
}

const MEDIUM = 'medium FF000000';
const THIN = 'thin FFA0A0A0';

describe('workbookStyles', () => {
  it('lists the required fills, the empty grey, the tints and the DMC colors in order', () => {
    const styles = workbookStyles(PATTERN.legend);
    assert.deepEqual(styles.fills.map(describeFill), [
      'none', 'gray125', 'FFE0E0E0', 'FFB0B0B0', 'FFFFC0BB', 'FF000000', 'FFC72B3B',
    ]);
  });

  it('has Calibri 11, Calibri 11 bold and black Calibri 9 fonts', () => {
    const styles = workbookStyles(PATTERN.legend);
    assert.deepEqual(styles.fonts, [
      { name: 'Calibri', size: 11, isBold: false, rgb: null },
      { name: 'Calibri', size: 11, isBold: true, rgb: null },
      { name: 'Calibri', size: 9, isBold: false, rgb: 'FF000000' },
    ]);
  });

  it('gives chart cells their tint, the small black font and centred text', () => {
    const styles = workbookStyles(PATTERN.legend);
    const format = styles.cellXfs[styles.chartCellStyle(1, 0, 0, 3, 2)];
    assert.equal(describeFill(styles.fills[format.fillId]), 'FFFFC0BB');
    assert.equal(format.fontId, 2);
    assert.deepEqual(format.alignment, { horizontal: 'center', vertical: 'center' });
    const empty = styles.cellXfs[styles.chartCellStyle(-1, 0, 1, 3, 2)];
    assert.equal(describeFill(styles.fills[empty.fillId]), 'FFE0E0E0');
  });

  it('draws medium lines every 10 stitches and at the edge of a 23 × 12 chart', () => {
    const styles = workbookStyles(PATTERN.legend);
    const at = (x, y, legendIndex = 0) => borderOf(styles, styles.chartCellStyle(legendIndex, x, y, 23, 12));
    assert.equal(at(9, 0).right, MEDIUM);
    assert.deepEqual(at(0, 0), { left: MEDIUM, right: THIN, top: MEDIUM, bottom: THIN, diagonalUp: null });
    assert.deepEqual(at(22, 11), { left: null, right: MEDIUM, top: null, bottom: MEDIUM, diagonalUp: null });
    assert.deepEqual(at(5, 5), { left: null, right: THIN, top: null, bottom: THIN, diagonalUp: null });
    assert.equal(at(19, 3).right, MEDIUM);
    assert.equal(at(3, 9).bottom, MEDIUM);
    assert.equal(at(3, 10).bottom, THIN);
  });

  it('crosses empty cells with a thin grey diagonal from bottom-left to top-right', () => {
    const styles = workbookStyles(PATTERN.legend);
    assert.deepEqual(borderOf(styles, styles.chartCellStyle(-1, 0, 1, 3, 2)), {
      left: MEDIUM, right: THIN, top: null, bottom: MEDIUM, diagonalUp: 'thin FF909090',
    });
  });

  it('has the legend number, swatch, bold and count formats', () => {
    const styles = workbookStyles(PATTERN.legend);
    const numberFormat = styles.cellXfs[styles.legendNumberStyle(0)];
    assert.equal(describeFill(styles.fills[numberFormat.fillId]), 'FFB0B0B0');
    assert.equal(numberFormat.alignment.horizontal, 'center');
    assert.equal(describeFill(styles.fills[styles.cellXfs[styles.swatchStyle(1)].fillId]), 'FFC72B3B');
    assert.equal(styles.cellXfs[BOLD_STYLE].fontId, 1);
    assert.equal(styles.cellXfs[COUNT_STYLE].numFmtId, 3);
    assert.equal(styles.cellXfs[0].fillId, 0);
  });

  it('writes count attributes that equal the number of children', () => {
    const { xml } = workbookStyles(PATTERN.legend);
    for (const [list, child] of [['fonts', 'font'], ['fills', 'fill'], ['borders', 'border'], ['cellStyleXfs', 'xf'], ['cellXfs', 'xf'], ['cellStyles', 'cellStyle']]) {
      const match = new RegExp(`<${list} count="(\\d+)">(.*?)</${list}>`).exec(xml);
      assert.ok(match !== null, `${list} is missing`);
      const children = match[2].match(new RegExp(`<${child}[ />]`, 'g')) ?? [];
      assert.equal(Number(match[1]), children.length, list);
    }
  });

  it('writes the stylesheet parts in schema order', () => {
    const { xml } = workbookStyles(PATTERN.legend);
    const order = ['<fonts', '<fills', '<borders', '<cellStyleXfs', '<cellXfs', '<cellStyles'].map((tag) => xml.indexOf(tag));
    assert.ok(order.every((position, index) => position > 0 && (index === 0 || position > order[index - 1])), String(order));
    assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'));
  });

  it('writes border edges in the order left, right, top, bottom, diagonal', () => {
    const { xml } = workbookStyles(PATTERN.legend);
    for (const border of xml.match(/<border[ >].*?<\/border>/g)) {
      const edges = [...border.matchAll(/<(left|right|top|bottom|diagonal)[ />]/g)].map((match) => match[1]);
      assert.deepEqual(edges, ['left', 'right', 'top', 'bottom', 'diagonal'], border);
    }
  });

  it('stays far below the 64,000 formats of Excel with 489 colors', () => {
    const legend = DMC_COLORS.map((color, index) => ({ number: index + 1, ...color, stitchCount: 1 }));
    assert.equal(legend.length, 489);
    const styles = workbookStyles(legend);
    assert.equal(styles.cellXfs.length, 8821);
    assert.match(styles.xml, /<cellXfs count="8821">/);
  });
});

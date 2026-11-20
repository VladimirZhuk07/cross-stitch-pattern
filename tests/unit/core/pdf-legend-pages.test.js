// Unit tests for src/core/pdf-legend-pages.js, read back with tests/helpers/pdf-reader.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { readContent } from '../../helpers/pdf-reader.js';
import { buildPattern } from '../../../src/core/pattern.js';
import { DMC_COLORS } from '../../../src/data/dmc.js';
import { textWidth } from '../../../src/core/pdf-text.js';
import { legendPageContents } from '../../../src/core/pdf-legend-pages.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

const MM = 72 / 25.4;
const PAGE_HEIGHT = 841.89;

function smallPattern() {
  return buildPattern({ width: 3, height: 2, cells: [1, 0, 0, -1, 0, 1], colors: [BLACK, RED] });
}

function pages(pattern) {
  return legendPageContents(pattern).map(readContent);
}

// The texts of one column, top to bottom.
function column(page, xMm, size = 9) {
  return page.texts.filter((text) => text.size === size && Math.abs(text.x - xMm * MM) < 0.01).map((text) => text.text);
}

describe('legendPageContents', () => {
  it('lists the 3 × 2 legend: tinted number boxes, swatches, codes, names and counts', () => {
    const [page] = pages(smallPattern());
    const fills = page.fills.map((rect) => rect.color);
    assert.deepEqual(fills, ['#B0B0B0', '#000000', '#FFC0BB', '#C72B3B']);
    assert.deepEqual(column(page, 35), ['310', '321']);
    assert.deepEqual(column(page, 52), ['Black', 'Red']);
    const numbers = page.texts.filter((text) => text.size === 8 && /^\d+$/.test(text.text));
    assert.deepEqual(numbers.map((text) => text.text), ['1', '2']);
    const counts = page.texts.filter((text) => text.size === 9 && text.x > 150 * MM);
    assert.deepEqual(counts.map((text) => text.text), ['3', '2']);
    assert.ok(page.texts.every((text) => text.color === '#000000'), 'all texts black');
  });

  it('places the first row box 10 × 4 mm at x 10 mm with grey borders and a centred number', () => {
    const [page] = pages(smallPattern());
    const box = page.fills[0];
    assertClose(box.x, 10 * MM, 0.01, 'box x');
    assertClose(box.width, 10 * MM, 0.01, 'box width');
    assertClose(box.height, 4 * MM, 0.01, 'box height');
    const swatch = page.fills[1];
    assertClose(swatch.x, 23 * MM, 0.01, 'swatch x');
    assertClose(swatch.width, 8 * MM, 0.01, 'swatch width');
    const borders = new Set(page.strokes.map((stroke) => `${stroke.color} ${stroke.width}`));
    assert.deepEqual([...borders].sort(), ['#808080 0.5', '#A0A0A0 0.5']);
    const number = page.texts.find((text) => text.size === 8 && text.text === '1');
    assertClose(number.x + textWidth('1', 'F1', 8) / 2, 15 * MM, 0.01, 'number centre x');
    assertClose(number.y + 0.359 * 8, box.y + box.height / 2, 0.01, 'number centre y');
  });

  it('writes the heading and the column headings in bold', () => {
    const [page] = pages(smallPattern());
    const heading = page.texts.find((text) => text.text === 'Legend');
    assert.equal(heading.font, 'F2');
    assert.equal(heading.size, 14);
    assertClose(heading.y, PAGE_HEIGHT - 18 * MM, 0.01, 'heading baseline');
    const headings = page.texts.filter((text) => text.size === 8 && text.font === 'F2');
    assert.deepEqual(headings.map((text) => text.text), ['No.', 'Color', 'DMC', 'Name', 'Stitches']);
    const stitches = headings[4];
    assertClose(stitches.x + textWidth('Stitches', 'F2', 8), 200 * MM, 0.01, 'Stitches right edge');
  });

  it('right-aligns 12,345 at 200 mm', () => {
    const pattern = buildPattern({ width: 12345, height: 1, cells: new Int16Array(12345), colors: [RED] });
    const [page] = pages(pattern);
    const count = page.texts.find((text) => text.text === '12,345');
    assert.ok(count, '12,345');
    assertClose(count.x + textWidth('12,345', 'F1', 9), 200 * MM, 0.01, 'right edge');
  });

  it('splits 489 colors into 10 pages of 50 rows, the last with 39 rows ending in 489', () => {
    const legend = DMC_COLORS.map((color, index) => ({ number: index + 1, ...color, stitchCount: 1 }));
    const all = pages({ width: 489, height: 1, legend });
    assert.equal(all.length, 10);
    for (const page of all.slice(0, 9)) {
      assert.equal(column(page, 35).length, 50);
    }
    const lastNumbers = all[9].texts.filter((text) => text.size === 8 && /^\d+$/.test(text.text));
    assert.equal(lastNumbers.length, 39);
    assert.equal(lastNumbers.at(-1).text, '489');
    assert.ok(all[0].texts.some((text) => text.text === 'Legend'));
    for (const page of all.slice(1)) {
      assert.ok(page.texts.some((text) => text.text === 'Legend (continued)'));
    }
  });

  it('keeps every row of a full page above the bottom margin', () => {
    const legend = DMC_COLORS.slice(0, 50).map((color, index) => ({ number: index + 1, ...color, stitchCount: 1 }));
    const [page] = pages({ width: 50, height: 1, legend });
    const lowest = Math.min(...page.fills.map((rect) => rect.y));
    assert.ok(lowest >= PAGE_HEIGHT - 287 * MM, `lowest box at ${(PAGE_HEIGHT - lowest) / MM} mm`);
  });

  it('says so for a pattern without stitches', () => {
    const pattern = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    const all = pages(pattern);
    assert.equal(all.length, 1);
    assert.ok(all[0].texts.some((text) => text.text === 'This pattern has no stitches.'));
    assert.equal(all[0].fills.length, 0);
  });
});

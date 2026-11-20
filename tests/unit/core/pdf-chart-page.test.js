// Unit tests for src/core/pdf-chart-page.js: the content stream of one chart page, read back
// with tests/helpers/pdf-reader.js. Coordinates are PDF points from the bottom-left corner.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { readContent } from '../../helpers/pdf-reader.js';
import { buildPattern } from '../../../src/core/pattern.js';
import { planPdfPages } from '../../../src/core/pdf-page-plan.js';
import { chartPageContent, legendTints } from '../../../src/core/pdf-chart-page.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };
const BLUE = { code: '820', name: 'Royal Blue VY DK', hex: '#0E365C' };

const CELL = 72 / 25.4 * 3.2;
const NUMBER_SIZE = 4.08;

// The 3 × 2 pattern of the spec: legend 1 = 310 Black (3 stitches), 2 = 321 Red (2 stitches).
function smallPattern() {
  return buildPattern({ width: 3, height: 2, cells: [1, 0, 0, -1, 0, 1], colors: [BLACK, RED] });
}

// width × height stitches of 3 colors, no empty cells.
function patternOfSize(width, height) {
  const cells = Array.from({ length: width * height }, (_, index) => (index % width + Math.floor(index / width)) % 3);
  return buildPattern({ width, height, cells, colors: [BLACK, RED, BLUE] });
}

function pageOf(pattern, pageNumber, fileName = 'cat.png') {
  return readContent(chartPageContent(pattern, planPdfPages(pattern), pageNumber, fileName));
}

function cellNumbers(page) {
  return page.texts.filter((text) => text.size === NUMBER_SIZE);
}

describe('chartPageContent cells', () => {
  it('fills cell (0, 0) of the 3 × 2 pattern with the tint of Red at the grid corner', () => {
    const fill = pageOf(smallPattern(), 1).fills.find((rect) => rect.color === '#FFC0BB');
    assert.ok(fill, 'a #FFC0BB fill');
    assertClose(fill.x, 85.04, 0.01, 'x');
    assertClose(fill.y, 767.62, 0.01, 'y');
    assertClose(fill.width, 9.07, 0.01, 'width');
    assertClose(fill.height, 9.07, 0.01, 'height');
  });

  it('centres a black 2 in cell (0, 0)', () => {
    const number = cellNumbers(pageOf(smallPattern(), 1))[0];
    assert.equal(number.text, '2');
    assert.equal(number.font, 'F1');
    assert.equal(number.color, '#000000');
    assertClose(number.x + (556 * NUMBER_SIZE) / 2000, 89.57, 0.01, 'centre x');
    assertClose(number.y + 0.359 * NUMBER_SIZE, 772.16, 0.01, 'centre y');
  });

  it('fills the empty cell grey with a diagonal and no number', () => {
    const page = pageOf(smallPattern(), 1);
    const empty = page.fills.find((rect) => rect.color === '#E0E0E0');
    assertClose(empty.x, 85.04, 0.01, 'empty x');
    assertClose(empty.y, 758.55, 0.01, 'empty y');
    const hatch = page.strokes.filter((stroke) => stroke.color === '#909090');
    assert.equal(hatch.length, 1);
    assert.equal(hatch[0].width, 0.3);
    assertClose(hatch[0].x1, 85.04, 0.01, 'x1');
    assertClose(hatch[0].y1, 758.55, 0.01, 'y1');
    assertClose(hatch[0].x2, 94.11, 0.01, 'x2');
    assertClose(hatch[0].y2, 767.62, 0.01, 'y2');
  });

  it('shows exactly the 5 numbers 2, 1, 1, 1, 2', () => {
    assert.deepEqual(cellNumbers(pageOf(smallPattern(), 1)).map((text) => text.text), ['2', '1', '1', '1', '2']);
  });

  it('places every number in its own cell', () => {
    const numbers = cellNumbers(pageOf(smallPattern(), 1));
    const cells = [[0, 0], [1, 0], [2, 0], [1, 1], [2, 1]];
    numbers.forEach((number, index) => {
      const [column, row] = cells[index];
      assertClose(number.x + (556 * NUMBER_SIZE) / 2000, 85.04 + (column + 0.5) * CELL, 0.01, `x of ${index}`);
      assertClose(number.y + 0.359 * NUMBER_SIZE, 776.69 - (row + 0.5) * CELL, 0.01, `y of ${index}`);
    });
  });

  it('writes one fill rectangle per horizontal run of equal cells', () => {
    const pattern = buildPattern({ width: 3, height: 1, cells: [0, 0, 0], colors: [RED] });
    const fills = pageOf(pattern, 1).fills;
    assert.equal(fills.length, 1);
    assertClose(fills[0].width, 3 * CELL, 0.01, 'run width');
    assert.equal(pageOf(smallPattern(), 1).fills.length, 5, 'runs [2][1 1] and [empty][1][2]');
  });

  it('keeps numbers exact along a full row of 50 cells', () => {
    const numbers = cellNumbers(pageOf(patternOfSize(120, 90), 1));
    assert.equal(numbers.length, 4000);
    const last = numbers[3999];
    assertClose(last.x + (556 * NUMBER_SIZE) / 2000, 85.04 + 49.5 * CELL, 0.01, 'last x');
    assertClose(last.y + 0.359 * NUMBER_SIZE, 776.69 - 79.5 * CELL, 0.01, 'last y');
  });

  it('starts page 3 of the 120 × 90 pattern at the same x as page 1 and draws 20 columns', () => {
    const page = pageOf(patternOfSize(120, 90), 3);
    const left = Math.min(...page.fills.map((rect) => rect.x));
    const right = Math.max(...page.fills.map((rect) => rect.x + rect.width));
    assertClose(left, 85.04, 0.01, 'left');
    assertClose(right, 85.04 + 20 * CELL, 0.01, 'right');
    assert.equal(cellNumbers(page).length, 20 * 80);
  });
});

describe('legendTints', () => {
  it('gives the pale tint of every legend entry by legend index', () => {
    assert.deepEqual(legendTints(smallPattern()), ['#B0B0B0', '#FFC0BB']);
  });
});

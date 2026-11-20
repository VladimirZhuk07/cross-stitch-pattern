// Unit tests for src/core/pdf-chart-page.js: the content stream of one chart page, read back
// with tests/helpers/pdf-reader.js. Coordinates are PDF points from the bottom-left corner.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose } from '../../helpers/assert-close.js';
import { readContent } from '../../helpers/pdf-reader.js';
import { buildPattern } from '../../../src/core/pattern.js';
import { planPdfPages } from '../../../src/core/pdf-page-plan.js';
import { textWidth } from '../../../src/core/pdf-text.js';
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

const MM = 72 / 25.4;
const GRID_X = 30 * MM;
const GRID_Y = 841.89 - 23 * MM;

function lineCounts(page) {
  const counts = { thinVertical: 0, boldVertical: 0, thinHorizontal: 0, boldHorizontal: 0 };
  for (const stroke of page.strokes) {
    if (stroke.color === '#909090') {
      continue;
    }
    const direction = stroke.x1 === stroke.x2 ? 'Vertical' : 'Horizontal';
    const weight = stroke.color === '#000000' ? 'bold' : 'thin';
    counts[`${weight}${direction}`] += 1;
  }
  return counts;
}

// Boundaries (in stitches from the pattern's corner) of the vertical or horizontal bold lines.
function boldBoundaries(page, direction, start) {
  const bold = page.strokes.filter((stroke) => stroke.color === '#000000');
  const lines = direction === 'vertical'
    ? bold.filter((stroke) => stroke.x1 === stroke.x2).map((stroke) => (stroke.x1 - GRID_X) / CELL)
    : bold.filter((stroke) => stroke.y1 === stroke.y2).map((stroke) => (GRID_Y - stroke.y1) / CELL);
  return lines.map((offset) => start + Math.round(offset)).sort((a, b) => a - b);
}

function topLabels(page) {
  return page.texts.filter((text) => text.size === 6 && text.y > GRID_Y).map((text) => text.text);
}

function leftLabels(page) {
  return page.texts.filter((text) => text.size === 6 && text.x < GRID_X && text.y < GRID_Y).map((text) => text.text);
}

function triangles(page) {
  return page.fillPaths.filter((path) => path.color === '#000000');
}

describe('chartPageContent grid lines', () => {
  it('draws 3 bold and 18 thin vertical, 9 bold and 72 thin horizontal lines on page 3 of 120 × 90', () => {
    const page = pageOf(patternOfSize(120, 90), 3);
    assert.deepEqual(lineCounts(page), { thinVertical: 18, boldVertical: 3, thinHorizontal: 72, boldHorizontal: 9 });
    assert.deepEqual(boldBoundaries(page, 'vertical', 100), [100, 110, 120]);
  });

  it('draws thin lines 0.3 pt #A0A0A0 and bold lines 0.9 pt black across the page grid', () => {
    const page = pageOf(patternOfSize(120, 90), 3);
    for (const stroke of page.strokes.filter((line) => line.color === '#A0A0A0')) {
      assert.equal(stroke.width, 0.3);
    }
    const bold = page.strokes.filter((line) => line.color === '#000000');
    for (const stroke of bold) {
      assert.equal(stroke.width, 0.9);
    }
    const top = bold.find((stroke) => stroke.y1 === stroke.y2);
    assertClose(Math.abs(top.x2 - top.x1), 20 * CELL, 0.02, 'horizontal line length');
  });

  it('draws bold lines at the far edges off the 10-stitch step', () => {
    const page = pageOf(patternOfSize(23, 12), 1);
    assert.deepEqual(boldBoundaries(page, 'vertical', 0), [0, 10, 20, 23]);
    assert.deepEqual(boldBoundaries(page, 'horizontal', 0), [0, 10, 12]);
  });
});

describe('chartPageContent rulers and centre', () => {
  it('labels absolute columns and rows on pages 2 and 4 of 120 × 90', () => {
    const pattern = patternOfSize(120, 90);
    const page2 = pageOf(pattern, 2);
    assert.deepEqual(topLabels(page2), ['50', '60', '70', '80', '90', '100']);
    assert.deepEqual(leftLabels(page2), ['10', '20', '30', '40', '50', '60', '70', '80']);
    const page4 = pageOf(pattern, 4);
    assert.deepEqual(topLabels(page4), ['10', '20', '30', '40', '50']);
    assert.deepEqual(leftLabels(page4), ['80', '90']);
  });

  it('centres column labels on their boundary, 2.3 mm above the grid', () => {
    const label = pageOf(patternOfSize(120, 90), 2).texts.find((text) => text.text === '60' && text.y > GRID_Y);
    assertClose(label.x + (2 * 556 * 6) / 2000, GRID_X + 10 * CELL, 0.01, 'centre x');
    assertClose(label.y, GRID_Y + 2.3 * MM, 0.01, 'baseline');
  });

  it('right-aligns row labels at 27.7 mm, centred on their boundary', () => {
    const label = pageOf(patternOfSize(120, 90), 1).texts.find((text) => text.text === '10' && text.x < GRID_X);
    assertClose(label.x + (2 * 556 * 6) / 1000, 27.7 * MM, 0.01, 'right edge');
    assertClose(label.y + 0.359 * 6, GRID_Y - 10 * CELL, 0.01, 'centre y');
  });

  it('points triangles at column 60 on pages 2 and 5 and at row 45 on pages 1–3', () => {
    const pattern = patternOfSize(120, 90);
    const counts = [1, 2, 3, 4, 5, 6].map((pageNumber) => triangles(pageOf(pattern, pageNumber)).length);
    assert.deepEqual(counts, [1, 2, 1, 0, 1, 0]);
    const page2 = triangles(pageOf(pattern, 2));
    const top = page2.find((path) => path.points.every(([, y]) => y >= GRID_Y - 0.01));
    const left = page2.find((path) => path.points.every(([x]) => x <= GRID_X + 0.01));
    const topTip = top.points.find(([, y]) => Math.abs(y - GRID_Y) < 0.01);
    assertClose(topTip[0], GRID_X + 10 * CELL, 0.01, 'top tip x');
    const leftTip = left.points.find(([x]) => Math.abs(x - GRID_X) < 0.01);
    assertClose(leftTip[1], GRID_Y - 45 * CELL, 0.01, 'left tip y');
  });

  it('makes the triangles 2.4 mm wide and 1.5 mm deep', () => {
    const [triangle] = triangles(pageOf(patternOfSize(120, 90), 5));
    const xs = triangle.points.map(([x]) => x);
    const ys = triangle.points.map(([, y]) => y);
    assertClose(Math.max(...xs) - Math.min(...xs), 2.4 * MM, 0.02, 'width');
    assertClose(Math.max(...ys) - Math.min(...ys), 1.5 * MM, 0.02, 'depth');
  });

  it('fits the 10000 row label of 50 × 10000 page 125 into the left ruler', () => {
    const pattern = buildPattern({ width: 50, height: 10000, cells: new Int16Array(500000), colors: [RED] });
    const page = pageOf(pattern, 125);
    assert.equal(leftLabels(page).at(-1), '10000');
    const text = page.texts.find((item) => item.text === '10000');
    assert.ok(text.x >= 21 * MM, `starts at ${text.x / MM} mm`);
    assertClose(text.x + (5 * 556 * 6) / 1000, 27.7 * MM, 0.01, 'right edge');
  });
});

describe('chartPageContent header and footer', () => {
  it('names the file, the area and the page number on page 6 of 120 × 90', () => {
    const page = pageOf(patternOfSize(120, 90), 6);
    const name = page.texts.find((text) => text.text === 'cat.png');
    assertClose(name.x, GRID_X, 0.01, 'name x');
    assertClose(name.y, 841.89 - 15.5 * MM, 0.01, 'name baseline');
    assert.equal(name.size, 8);
    const area = page.texts.find((text) => text.text === 'Columns 101–120 · rows 81–90');
    assert.ok(area, 'area text');
    assertClose(area.x + textWidth(area.text, 'F1', 8), 190 * MM, 0.01, 'area right edge');
    const footer = page.texts.find((text) => text.text === 'Page 6 of 6');
    assert.ok(footer, 'footer');
    assert.equal(footer.size, 9);
    assertClose(footer.x + textWidth(footer.text, 'F1', 9) / 2, 110 * MM, 0.01, 'footer centre');
    assertClose(footer.y, 841.89 - 285 * MM, 0.01, 'footer baseline');
  });

  it('cuts a 200-character file name to 80 mm', () => {
    const fileName = `${'n'.repeat(196)}.png`;
    const page = pageOf(patternOfSize(120, 90), 1, fileName);
    const name = page.texts.find((text) => text.size === 8 && Math.abs(text.x - GRID_X) < 0.01);
    assert.ok(name.text.endsWith('…'), name.text);
    assert.ok(textWidth(name.text, 'F1', 8) <= 80 * MM);
  });
});

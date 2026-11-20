// Unit tests for src/core/pdf-page-map.js, read back with tests/helpers/pdf-reader.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readContent } from '../../helpers/pdf-reader.js';
import { planPdfPages } from '../../../src/core/pdf-page-plan.js';
import { textWidth } from '../../../src/core/pdf-text.js';
import { pageMapDiagram, pageMapTablePages } from '../../../src/core/pdf-page-map.js';

const MM = 72 / 25.4;
const PAGE_HEIGHT = 841.89;

function fakePattern(width, height) {
  return { width, height, legend: [] };
}

function diagramOf(width, height) {
  const pattern = fakePattern(width, height);
  return readContent(pageMapDiagram(pattern, planPdfPages(pattern)));
}

// The tile rectangles: 4 strokes each, grouped back into boxes { left, right, bottom, top }.
function tiles(page) {
  const boxes = [];
  for (let index = 0; index < page.strokes.length; index += 4) {
    const corners = page.strokes.slice(index, index + 4);
    const xs = corners.flatMap((stroke) => [stroke.x1, stroke.x2]);
    const ys = corners.flatMap((stroke) => [stroke.y1, stroke.y2]);
    boxes.push({ left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) });
  }
  return boxes;
}

describe('pageMapDiagram', () => {
  it('draws 3 × 2 numbered tiles for the 120 × 90 pattern', () => {
    const page = diagramOf(120, 90);
    assert.equal(tiles(page).length, 6);
    const numbers = page.texts.filter((text) => text.size === 7).map((text) => text.text);
    assert.deepEqual(numbers, ['1', '2', '3', '4', '5', '6']);
    const [first, second, , fourth] = page.texts.filter((text) => text.size === 7);
    assert.ok(second.x > first.x && second.y === first.y, 'tile 2 right of tile 1');
    assert.ok(fourth.y < first.y && Math.abs(fourth.x - first.x) < 0.01, 'tile 4 below tile 1');
  });

  it('labels the column and row ranges of the 120 × 90 pattern', () => {
    const page = diagramOf(120, 90);
    const firstTile = tiles(page)[0];
    const columnLabels = page.texts.filter((text) => text.size === 6 && text.y > firstTile.top).map((text) => text.text);
    assert.deepEqual(columnLabels, ['1–50', '51–100', '101–120']);
    const rowLabels = page.texts.filter((text) => text.size === 6 && text.x < firstTile.left).map((text) => text.text);
    assert.deepEqual(rowLabels, ['1–80', '81–90']);
  });

  it('stays inside the map area x 10–200 mm, y 173–287 mm', () => {
    for (const [width, height] of [[120, 90], [750, 2000], [50, 80]]) {
      for (const tile of tiles(diagramOf(width, height))) {
        assert.ok(tile.left >= 10 * MM - 0.01 && tile.right <= 200 * MM + 0.01, `${width} × ${height} x`);
        assert.ok(tile.top <= PAGE_HEIGHT - 173 * MM + 0.01, `${width} × ${height} top`);
        assert.ok(tile.bottom >= PAGE_HEIGHT - 287 * MM - 0.01, `${width} × ${height} bottom`);
      }
    }
  });

  it('fits every label of the 750 × 2000 map (15 × 25 tiles) into its tile or header', () => {
    const page = diagramOf(750, 2000);
    const boxes = tiles(page);
    assert.equal(boxes.length, 375);
    const tileWidth = boxes[0].right - boxes[0].left;
    const tileHeight = boxes[0].top - boxes[0].bottom;
    const numbers = page.texts.filter((text) => text.size === 7);
    assert.equal(numbers.length, 375);
    numbers.forEach((text, index) => {
      const box = boxes[index];
      const right = text.x + textWidth(text.text, 'F1', 7);
      assert.ok(text.x >= box.left && right <= box.right, `number ${text.text} x`);
      assert.ok(text.y >= box.bottom && text.y + 0.718 * 7 <= box.top, `number ${text.text} y`);
    });
    const columnLabels = page.texts.filter((text) => text.size === 6 && text.y > boxes[0].top);
    assert.equal(columnLabels.length, 15);
    for (const text of columnLabels) {
      assert.ok(textWidth(text.text, 'F1', 6) <= tileWidth, `column label ${text.text}`);
    }
    const rowLabels = page.texts.filter((text) => text.size === 6 && text.x < boxes[0].left);
    assert.equal(rowLabels.length, 25);
    assert.equal(rowLabels.at(-1).text, '1921–2000');
    for (const text of rowLabels) {
      assert.ok(text.x >= 10 * MM, `row label ${text.text} starts at ${text.x / MM} mm`);
      assert.ok(0.718 * 6 <= tileHeight);
    }
  });
});

describe('pageMapTablePages', () => {
  function tablePages(width, height) {
    const pattern = fakePattern(width, height);
    return pageMapTablePages(pattern, planPdfPages(pattern)).map(readContent);
  }

  // The table entries of a page as [page, columns, rows] text triples.
  function entries(page) {
    const texts = page.texts.filter((text) => text.size === 8 && text.font === 'F1').map((text) => text.text);
    const triples = [];
    for (let index = 0; index < texts.length; index += 3) {
      triples.push(texts.slice(index, index + 3));
    }
    return triples;
  }

  it('lists the 260 chart pages of 1000 × 1000 on 2 pages, 224 on the first', () => {
    const pages = tablePages(1000, 1000);
    assert.equal(pages.length, 2);
    const first = entries(pages[0]);
    const second = entries(pages[1]);
    assert.equal(first.length, 224);
    assert.equal(second.length, 36);
    assert.deepEqual(first[0], ['1', '1–50', '1–80']);
    assert.deepEqual(second.at(-1), ['260', '951–1000', '961–1000']);
  });

  it('heads the pages Page map and Page map (continued), with column headings per block', () => {
    const pages = tablePages(1000, 1000);
    assert.ok(pages[0].texts.some((text) => text.text === 'Page map' && text.font === 'F2'));
    assert.ok(pages[1].texts.some((text) => text.text === 'Page map (continued)' && text.font === 'F2'));
    const headings = pages[0].texts.filter((text) => text.size === 8 && text.font === 'F2').map((text) => text.text);
    assert.deepEqual(headings, ['Page', 'Columns', 'Rows', 'Page', 'Columns', 'Rows', 'Page', 'Columns', 'Rows', 'Page', 'Columns', 'Rows']);
  });

  it('puts 56 lines in each of 4 blocks 47.5 mm apart', () => {
    const [page] = tablePages(1000, 1000);
    const pageColumn = page.texts.filter((text) => text.size === 8 && text.font === 'F1' && /^\d+$/.test(text.text));
    const blockStarts = [...new Set(pageColumn.map((text) => Math.round(text.x / MM * 10) / 10))];
    assert.deepEqual(blockStarts, [10, 57.5, 105, 152.5]);
    assert.equal(pageColumn.filter((text) => Math.abs(text.x - 10 * MM) < 0.01).length, 56);
    const lowest = Math.min(...pageColumn.map((text) => text.y));
    assert.ok(lowest >= PAGE_HEIGHT - 287 * MM, `lowest line at ${(PAGE_HEIGHT - lowest) / MM} mm`);
  });

  it('has no table pages when the map fits the info page', () => {
    assert.deepEqual(tablePages(120, 90), []);
  });
});

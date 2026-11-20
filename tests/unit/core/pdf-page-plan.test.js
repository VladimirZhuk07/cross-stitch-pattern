// Unit tests for src/core/pdf-page-plan.js. Patterns are small synthetic { width, height, legend }
// objects: the plan reads only the size and the number of legend entries.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_PAGE_COLUMNS,
  CHART_PAGE_ROWS,
  CONFIRM_PDF_PAGES,
  MAP_ENTRIES_PER_PAGE,
  MAX_PDF_PAGES,
  chartPageArea,
  planPdfPages,
} from '../../../src/core/pdf-page-plan.js';

function fakePattern(width, height, colorCount = 24) {
  return { width, height, legend: Array.from({ length: colorCount }, (_, index) => ({ number: index + 1 })) };
}

describe('pdf page plan constants', () => {
  it('cuts 50 × 80 stitches per chart page, asks above 100 pages and stops above 1000', () => {
    assert.equal(CHART_PAGE_COLUMNS, 50);
    assert.equal(CHART_PAGE_ROWS, 80);
    assert.equal(CONFIRM_PDF_PAGES, 100);
    assert.equal(MAX_PDF_PAGES, 1000);
    assert.equal(MAP_ENTRIES_PER_PAGE, 224);
  });
});

describe('planPdfPages', () => {
  it('plans the 3 × 2 pattern as info, legend and one chart page', () => {
    assert.deepEqual(planPdfPages(fakePattern(3, 2, 2)), {
      pagesAcross: 1,
      pagesDown: 1,
      chartPages: 1,
      isMapOnInfoPage: true,
      mapPages: 0,
      legendPages: 1,
      totalPages: 3,
    });
  });

  it('plans the 120 × 90 pattern with 6 chart pages, 8 in total', () => {
    const plan = planPdfPages(fakePattern(120, 90, 3));
    assert.equal(plan.pagesAcross, 3);
    assert.equal(plan.pagesDown, 2);
    assert.equal(plan.chartPages, 6);
    assert.equal(plan.totalPages, 8);
  });

  it('counts the pages of the spec examples', () => {
    const cases = [
      [300, 200, 24, 20, 18],
      [450, 800, 24, 92, 90],
      [500, 800, 24, 102, 100],
      [1000, 1000, 24, 264, 260],
      [2000, 1600, 24, 806, 800],
      [2000, 2000, 24, 1007, 1000],
      [10000, 10000, 24, 25114, 25000],
      [200, 150, 489, 19, 8],
    ];
    for (const [width, height, colors, total, chart] of cases) {
      const plan = planPdfPages(fakePattern(width, height, colors));
      assert.equal(plan.totalPages, total, `${width} × ${height} total`);
      assert.equal(plan.chartPages, chart, `${width} × ${height} chart pages`);
    }
  });

  it('keeps the largest map, 15 × 25 page tiles, on the info page', () => {
    const plan = planPdfPages(fakePattern(750, 2000));
    assert.equal(plan.isMapOnInfoPage, true);
    assert.equal(plan.mapPages, 0);
    assert.equal(plan.totalPages, 377);
  });

  it('moves the map of 16 page columns to one map page', () => {
    const plan = planPdfPages(fakePattern(751, 80));
    assert.equal(plan.pagesAcross, 16);
    assert.equal(plan.isMapOnInfoPage, false);
    assert.equal(plan.mapPages, 1);
    assert.equal(plan.totalPages, 19);
  });

  it('moves the map of 26 page rows to map pages', () => {
    assert.equal(planPdfPages(fakePattern(50, 2001)).isMapOnInfoPage, false);
  });

  it('lists 224 chart pages per map page', () => {
    assert.equal(planPdfPages(fakePattern(1000, 1000)).mapPages, 2);
    assert.equal(planPdfPages(fakePattern(2000, 2000)).mapPages, 5);
    assert.equal(planPdfPages(fakePattern(10000, 10000)).mapPages, 112);
  });

  it('gives 489 colors 10 legend pages', () => {
    assert.equal(planPdfPages(fakePattern(200, 150, 489)).legendPages, 10);
    assert.equal(planPdfPages(fakePattern(200, 150, 50)).legendPages, 1);
    assert.equal(planPdfPages(fakePattern(200, 150, 51)).legendPages, 2);
  });

  it('gives a pattern without stitches one legend page', () => {
    const plan = planPdfPages(fakePattern(2, 2, 0));
    assert.equal(plan.legendPages, 1);
    assert.equal(plan.totalPages, 3);
  });
});

describe('chartPageArea', () => {
  const pattern = fakePattern(120, 90, 3);
  const plan = planPdfPages(pattern);

  it('gives the half-open column and row ranges of a page, row-major from 1', () => {
    assert.deepEqual(chartPageArea(plan, pattern, 1), { columnStart: 0, columnEnd: 50, rowStart: 0, rowEnd: 80 });
    assert.deepEqual(chartPageArea(plan, pattern, 3), { columnStart: 100, columnEnd: 120, rowStart: 0, rowEnd: 80 });
    assert.deepEqual(chartPageArea(plan, pattern, 4), { columnStart: 0, columnEnd: 50, rowStart: 80, rowEnd: 90 });
    assert.deepEqual(chartPageArea(plan, pattern, 6), { columnStart: 100, columnEnd: 120, rowStart: 80, rowEnd: 90 });
  });

  it('rejects page numbers outside 1..chartPages', () => {
    for (const pageNumber of [0, 7, 1.5, -1, NaN]) {
      assert.throws(() => chartPageArea(plan, pattern, pageNumber), RangeError, String(pageNumber));
    }
  });
});

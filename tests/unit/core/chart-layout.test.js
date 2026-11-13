import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import {
  chartCellGeometry,
  cellCenter,
  visibleCellRange,
  numberFontSize,
  gridLines,
  chartLineWidths,
  snapLine,
} from '../../../src/core/chart-layout.js';

const TOLERANCE = 1e-9;

describe('chartCellGeometry', () => {
  it('divides the content rectangle into W × H cells and uses the smaller side as cell size', () => {
    const geometry = chartCellGeometry({ x: 10, y: 20, width: 1024, height: 682.5 }, { width: 100, height: 67 });
    assertClose(geometry.cellWidth, 10.24, TOLERANCE, 'cellWidth');
    assertClose(geometry.cellHeight, 682.5 / 67, TOLERANCE, 'cellHeight');
    assertClose(geometry.cellHeight, 10.18657, 1e-5, 'cellHeight');
    assert.equal(geometry.cellSize, geometry.cellHeight);
  });

  it('uses the height of 24 × 20 cells as cell size', () => {
    const geometry = chartCellGeometry({ x: 0, y: 0, width: 72, height: 40 }, { width: 3, height: 2 });
    assertCloseFields(geometry, { cellWidth: 24, cellHeight: 20, cellSize: 20 }, ['cellWidth', 'cellHeight', 'cellSize'], TOLERANCE);
  });

  it('rejects a grid width of 0', () => {
    assert.throws(() => chartCellGeometry({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 2 }), {
      name: 'RangeError',
      message: /grid\.width.*0/,
    });
  });
});

describe('cellCenter', () => {
  const content = { x: 0, y: 0, width: 60, height: 40 };
  const grid = { width: 3, height: 2 };

  it('returns the centre of the top-left cell', () => {
    assert.deepEqual(cellCenter(content, grid, 0, 0), { x: 10, y: 10 });
  });

  it('returns the centre of the bottom-right cell', () => {
    assert.deepEqual(cellCenter(content, grid, 2, 1), { x: 50, y: 30 });
  });

  it('adds the content offset', () => {
    assert.deepEqual(cellCenter({ x: 24, y: 100, width: 20, height: 20 }, { width: 1, height: 1 }, 0, 0), { x: 34, y: 110 });
  });
});

describe('visibleCellRange', () => {
  it('returns only the columns and rows that intersect the frame of a panned grid', () => {
    const range = visibleCellRange(
      { x: -95, y: -40, width: 1000, height: 1000 },
      { width: 400, height: 300 },
      { width: 100, height: 100 },
    );
    assert.deepEqual(range, { columnStart: 9, columnEnd: 50, rowStart: 4, rowEnd: 34 });
  });

  it('limits a 300 × 300 grid with 20 px cells to 20 × 15 cells of a 400 × 300 frame', () => {
    const range = visibleCellRange(
      { x: 0, y: 0, width: 6000, height: 6000 },
      { width: 400, height: 300 },
      { width: 300, height: 300 },
    );
    assert.deepEqual(range, { columnStart: 0, columnEnd: 20, rowStart: 0, rowEnd: 15 });
  });

  it('returns the whole grid when it is fitted inside the frame', () => {
    const range = visibleCellRange(
      { x: 24, y: 24, width: 952, height: 752 },
      { width: 1000, height: 800 },
      { width: 300, height: 237 },
    );
    assert.deepEqual(range, { columnStart: 0, columnEnd: 300, rowStart: 0, rowEnd: 237 });
  });

  it('returns an empty column range when the grid is right of the frame', () => {
    const range = visibleCellRange(
      { x: 500, y: 0, width: 1000, height: 1000 },
      { width: 400, height: 300 },
      { width: 100, height: 100 },
    );
    assert.equal(range.columnStart, range.columnEnd);
  });

  it('returns an empty column range when the grid is left of the frame', () => {
    const range = visibleCellRange(
      { x: -2000, y: 0, width: 1000, height: 1000 },
      { width: 400, height: 300 },
      { width: 100, height: 100 },
    );
    assert.equal(range.columnStart, range.columnEnd);
  });

  it('rejects a grid width that is not an integer', () => {
    assert.throws(
      () => visibleCellRange({ x: 0, y: 0, width: 10, height: 10 }, { width: 400, height: 300 }, { width: 1.5, height: 2 }),
      { name: 'RangeError', message: /grid\.width.*1\.5/ },
    );
  });
});

describe('numberFontSize', () => {
  it('is 0.6 × the cell size: 12 px for 20 px cells', () => {
    assertClose(numberFontSize(20), 12, TOLERANCE, 'font size');
  });

  it('is 30 px for 50 px cells', () => {
    assertClose(numberFontSize(50), 30, TOLERANCE, 'font size');
  });

  it('is 8.4 px at the 14 px threshold', () => {
    assertClose(numberFontSize(14), 8.4, TOLERANCE, 'font size');
  });

  it('hides numbers in cells just below 14 px', () => {
    assert.equal(numberFontSize(13.9), null);
  });

  it('hides numbers in a fitted 100 × 100 chart (7.52 px cells)', () => {
    assert.equal(numberFontSize(7.52), null);
  });

  it('shows numbers at about 11.02 px after zooming in 4 steps (18.359375 px cells)', () => {
    assertClose(numberFontSize(18.359375), 11.015625, TOLERANCE, 'font size');
  });

  it('rejects a negative cell size', () => {
    assert.throws(() => numberFontSize(-1), { name: 'RangeError', message: /-1/ });
  });

  it('rejects NaN', () => {
    assert.throws(() => numberFontSize(NaN), { name: 'RangeError', message: /NaN/ });
  });
});

function boldIndexes(lines) {
  return lines.filter((line) => line.isBold).map((line) => line.index);
}

function thinIndexes(lines) {
  return lines.filter((line) => !line.isBold).map((line) => line.index);
}

describe('gridLines', () => {
  it('makes every 10th vertical line of a 23-wide grid bold, and the border', () => {
    const lines = gridLines(0, 23, 23, 10);
    assert.deepEqual(boldIndexes(lines), [0, 10, 20, 23]);
    assert.equal(thinIndexes(lines).length, 20);
  });

  it('makes horizontal lines 0, 10 and 12 of a 12-high grid bold', () => {
    const lines = gridLines(0, 12, 12, 10);
    assert.deepEqual(boldIndexes(lines), [0, 10, 12]);
    assert.equal(thinIndexes(lines).length, 10);
  });

  it('keeps only bold lines in 3 px cells', () => {
    assert.deepEqual(gridLines(0, 23, 23, 3), [
      { index: 0, isBold: true },
      { index: 10, isBold: true },
      { index: 20, isBold: true },
      { index: 23, isBold: true },
    ]);
  });

  it('keeps thin lines in cells of exactly 4 px', () => {
    assert.equal(thinIndexes(gridLines(0, 23, 23, 4)).length, 20);
  });

  it('returns the lines of a visible range in order', () => {
    assert.deepEqual(gridLines(8, 12, 100, 10), [
      { index: 8, isBold: false },
      { index: 9, isBold: false },
      { index: 10, isBold: true },
      { index: 11, isBold: false },
      { index: 12, isBold: false },
    ]);
  });

  it('rejects a line count of 0', () => {
    assert.throws(() => gridLines(0, 0, 0, 10), { name: 'RangeError', message: /count.*0/ });
  });
});

describe('chartLineWidths', () => {
  it('is 1 and 2 device px at pixel ratio 1', () => {
    assert.deepEqual(chartLineWidths(1), { thin: 1, bold: 2 });
  });

  it('is 1 and 2 device px at pixel ratio 1.25', () => {
    assert.deepEqual(chartLineWidths(1.25), { thin: 1, bold: 2 });
  });

  it('is 2 and 4 device px at pixel ratio 2', () => {
    assert.deepEqual(chartLineWidths(2), { thin: 2, bold: 4 });
  });

  it('is 3 and 6 device px at pixel ratio 3', () => {
    assert.deepEqual(chartLineWidths(3), { thin: 3, bold: 6 });
  });

  it('never gets thinner than 1 device px', () => {
    assert.deepEqual(chartLineWidths(0.4), { thin: 1, bold: 2 });
  });

  it('rejects pixel ratio 0', () => {
    assert.throws(() => chartLineWidths(0), { name: 'RangeError', message: /pixelRatio.*0/ });
  });
});

describe('snapLine', () => {
  it('centres a 1 px line on the device pixel containing x 10.3 at ratio 1', () => {
    assertClose(snapLine(10.3, 1, 1), 10.5, TOLERANCE, 'centre');
  });

  it('centres a 2 px line on the nearest device pixel edge at ratio 1', () => {
    assertClose(snapLine(10.3, 2, 1), 10, TOLERANCE, 'centre');
  });

  it('covers device pixels 20 and 21 with a 2 device px line at ratio 2', () => {
    assertClose(snapLine(10.3, 2, 2), 10.5, TOLERANCE, 'centre');
  });

  it('covers device pixel 12 with a 1 device px line at ratio 1.25', () => {
    assertClose(snapLine(10.3, 1, 1.25), 10, TOLERANCE, 'centre');
  });

  it('covers device pixel 20 with a 1 device px line at ratio 2', () => {
    assertClose(snapLine(10.3, 1, 2), 10.25, TOLERANCE, 'centre');
  });

  it('rejects pixel ratio 0', () => {
    assert.throws(() => snapLine(10, 1, 0), { name: 'RangeError', message: /pixelRatio.*0/ });
  });
});

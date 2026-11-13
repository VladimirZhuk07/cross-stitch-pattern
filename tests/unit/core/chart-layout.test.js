import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import {
  chartCellGeometry,
  cellCenter,
  visibleCellRange,
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

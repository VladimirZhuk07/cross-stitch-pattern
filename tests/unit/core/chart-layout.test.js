import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertClose, assertCloseFields } from '../../helpers/assert-close.js';
import {
  chartCellGeometry,
  cellCenter,
  visibleCellRange,
  numberFontSize,
  NUMBER_FONT_FRACTION,
  MIN_NUMBERED_CELL_SIZE,
  isEmptyHatchVisible,
  gridLines,
  majorLineStep,
  MIN_MAJOR_LINE_SPACING,
  chartLineWidths,
  snapLine,
  RULER_SIZE,
  rulerPlacement,
  rulerLabels,
  rulerLabelStep,
  rulerFontSize,
  chartCenter,
} from '../../../src/core/chart-layout.js';
import { FIT_MARGIN } from '../../../src/core/viewport.js';

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
  it('is sized for 3 digits: 0.45 × the cell size, shown from 19 px cells', () => {
    assert.equal(NUMBER_FONT_FRACTION, 0.45);
    assert.equal(MIN_NUMBERED_CELL_SIZE, 19);
  });

  it('is 9 px for 20 px cells', () => {
    assertClose(numberFontSize(20), 9, TOLERANCE, 'font size');
  });

  it('is 22.5 px for 50 px cells', () => {
    assertClose(numberFontSize(50), 22.5, TOLERANCE, 'font size');
  });

  it('is 8.55 px at the 19 px threshold', () => {
    assertClose(numberFontSize(19), 8.55, TOLERANCE, 'font size');
  });

  it('hides numbers in cells just below 19 px', () => {
    assert.equal(numberFontSize(18.9), null);
  });

  it('fits a 3-digit number with room to the grid lines at the threshold', () => {
    // Digits are about 0.55 em wide: 3 × 0.55 × 8.55 ≈ 14.1 px of a 19 px cell.
    const textWidth = 3 * 0.55 * numberFontSize(19);
    assertClose(textWidth, 14.1075, TOLERANCE, 'text width');
    assert.ok((19 - textWidth) / 2 >= 2.4, `room per side ${(19 - textWidth) / 2}`);
  });

  it('hides numbers in a fitted 100 × 100 chart (7.52 px cells)', () => {
    assert.equal(numberFontSize(7.52), null);
  });

  it('still hides numbers after zooming in 4 steps (18.359375 px cells)', () => {
    assert.equal(numberFontSize(18.359375), null);
  });

  it('shows numbers at about 10.33 px after zooming in 5 steps (22.94921875 px cells)', () => {
    assertClose(numberFontSize(22.94921875), 10.3271484375, TOLERANCE, 'font size');
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

  it('draws bold lines every 100 stitches of a fitted 1000 × 1000 pattern (0.752 px cells)', () => {
    const lines = gridLines(0, 1000, 1000, 0.752);
    assert.deepEqual(boldIndexes(lines), [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);
    assert.equal(thinIndexes(lines).length, 0);
  });

  it('draws bold lines every 1000 stitches plus the far border at 0.0752 px cells', () => {
    const lines = gridLines(0, 10050, 10050, 0.0752);
    assert.deepEqual(boldIndexes(lines), [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 10050]);
    assert.equal(lines.length, 12);
  });

  it('returns only the 1000-stitch lines inside a visible range', () => {
    assert.deepEqual(gridLines(1500, 4200, 10000, 0.0752), [
      { index: 2000, isBold: true },
      { index: 3000, isBold: true },
      { index: 4000, isBold: true },
    ]);
  });
});

describe('majorLineStep', () => {
  it('keeps bold lines at least 8 px apart', () => {
    assert.equal(MIN_MAJOR_LINE_SPACING, 8);
  });

  it('uses every 10 stitches at 0.8 px cells and every 100 at 0.79 px', () => {
    assert.equal(majorLineStep(0.8), 10);
    assert.equal(majorLineStep(0.79), 100);
  });

  it('uses 100 for a fitted 1000-stitch and 1000 for a fitted 10000-stitch pattern', () => {
    assert.equal(majorLineStep(0.752), 100);
    assert.equal(majorLineStep(0.0752), 1000);
  });

  it('uses 10 for large cells and keeps growing for tiny ones', () => {
    assert.equal(majorLineStep(10), 10);
    assert.equal(majorLineStep(0.00001), 1000000);
  });

  it('rejects a cell size of 0, −1 or NaN', () => {
    for (const value of [0, -1, NaN]) {
      assert.throws(() => majorLineStep(value), { name: 'RangeError', message: new RegExp(`cellSize.*${value}`) });
    }
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

describe('RULER_SIZE', () => {
  it('equals the fit margin, 24 px, so a ruler fits beside the fitted grid', () => {
    assert.equal(RULER_SIZE, FIT_MARGIN);
    assert.equal(RULER_SIZE, 24);
  });
});

describe('rulerPlacement', () => {
  it('puts the rulers directly outside a fitted grid', () => {
    assert.deepEqual(rulerPlacement({ x: 24, y: 162, width: 952, height: 476 }), { top: 138, left: 0 });
  });

  it('places the top ruler at y 76 for a grid starting at y 100', () => {
    assert.deepEqual(rulerPlacement({ x: 24, y: 100, width: 1000, height: 670 }), { top: 76, left: 0 });
  });

  it('sticks both rulers to the frame edges when the grid edges are scrolled out', () => {
    assert.deepEqual(rulerPlacement({ x: -300, y: -120, width: 3000, height: 2000 }), { top: 0, left: 0 });
  });
});

describe('rulerLabels', () => {
  it('labels every 10th line of a 100-wide grid, but not line 0', () => {
    assert.deepEqual(rulerLabels(0, 100, 10), [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('labels only lines inside the visible range', () => {
    assert.deepEqual(rulerLabels(8, 50, 10), [10, 20, 30, 40, 50]);
  });

  it('does not label the far border of a 67-high grid', () => {
    assert.deepEqual(rulerLabels(0, 67, 10), [10, 20, 30, 40, 50, 60]);
  });

  it('returns no labels for a grid narrower than one step', () => {
    assert.deepEqual(rulerLabels(0, 5, 10), []);
  });

  it('rejects step 0', () => {
    assert.throws(() => rulerLabels(0, 10, 0), { name: 'RangeError', message: /step.*0/ });
  });
});

describe('rulerLabelStep', () => {
  it('labels every 10 stitches when 10 cells fit the widest label plus 4 px', () => {
    assert.equal(rulerLabelStep(3.2, 17), 10);
  });

  it('labels every 20 stitches when 10 cells are too short', () => {
    assert.equal(rulerLabelStep(1.6, 17), 20);
  });

  it('labels every 50 stitches in 0.5 px cells', () => {
    assert.equal(rulerLabelStep(0.5, 17), 50);
  });

  it('continues past 500: every 5000 stitches in 0.01 px cells', () => {
    assert.equal(rulerLabelStep(0.01, 17), 5000);
  });

  it('labels every 1000 stitches of a 10000-stitch pattern on a phone (0.0342 px cells)', () => {
    assert.equal(rulerLabelStep(0.0342, 19.25), 1000);
  });

  it('rejects a cell size of 0, which no step could satisfy', () => {
    assert.throws(() => rulerLabelStep(0, 17), { name: 'RangeError', message: /cellSize.*0/ });
  });

  it('labels every 10 stitches in 10 px cells', () => {
    assert.equal(rulerLabelStep(10, 17), 10);
  });
});

describe('rulerFontSize', () => {
  it('keeps 10 px when the widest row label is 12 px wide', () => {
    assert.equal(rulerFontSize(12), 10);
  });

  it('keeps 10 px when the widest row label exactly fills the 16 px label room', () => {
    assert.equal(rulerFontSize(16), 10);
  });

  it('shrinks to 8 px when the widest row label is 20 px wide at 10 px', () => {
    assertClose(rulerFontSize(20), 8, TOLERANCE, 'font size');
  });

  it('never goes below 7 px', () => {
    assert.equal(rulerFontSize(40), 7);
  });
});

describe('chartCenter', () => {
  it('is at column 50, row 33.5 of a 100 × 67 grid', () => {
    assert.deepEqual(chartCenter({ width: 100, height: 67 }), { column: 50, row: 33.5 });
  });

  it('is the middle of the only cell of a 1 × 1 grid', () => {
    assert.deepEqual(chartCenter({ width: 1, height: 1 }), { column: 0.5, row: 0.5 });
  });
});

describe('isEmptyHatchVisible', () => {
  it('hatches empty cells of exactly 6 px', () => {
    assert.equal(isEmptyHatchVisible(6), true);
  });

  it('does not hatch empty cells of 5.9 px', () => {
    assert.equal(isEmptyHatchVisible(5.9), false);
  });

  it('hatches empty cells of 20 px', () => {
    assert.equal(isEmptyHatchVisible(20), true);
  });

  it('rejects a negative cell size', () => {
    assert.throws(() => isEmptyHatchVisible(-1), { name: 'RangeError', message: /-1/ });
  });
});

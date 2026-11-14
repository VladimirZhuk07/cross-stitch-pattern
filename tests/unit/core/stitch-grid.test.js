import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GRID_SIDE, checkPixelImage, createGridAverager, maxTargetWidth, stitchGridSize } from '../../../src/core/stitch-grid.js';
import { srgbToLinear } from '../../../src/core/color.js';
import { assertClose } from '../../helpers/assert-close.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, TRANSPARENT, opaqueImageFrom, pixelImage, solidImage } from '../../helpers/pixel-image.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

describe('stitchGridSize', () => {
  it('follows the aspect ratio of a landscape image', () => {
    assert.deepEqual(stitchGridSize(1200, 800, 100), { width: 100, height: 67 });
  });

  it('matches the viewer alignment example for a capped 2048 × 1365 image', () => {
    assert.deepEqual(stitchGridSize(2048, 1365, 100), { width: 100, height: 67 });
  });

  it('follows the aspect ratio of a portrait image', () => {
    assert.deepEqual(stitchGridSize(800, 1200, 100), { width: 100, height: 150 });
  });

  it('keeps at least one row for a very wide image', () => {
    assert.deepEqual(stitchGridSize(2048, 1, 100), { width: 100, height: 1 });
  });

  it('reports heights above the limit instead of clamping them', () => {
    assert.deepEqual(stitchGridSize(41, 2048, 250), { width: 250, height: 12488 });
  });

  it('allows a grid wider than the image', () => {
    assert.deepEqual(stitchGridSize(1, 1, 3), { width: 3, height: 3 });
  });

  it('rejects image sizes that are not positive integers', () => {
    assertThrowsWith(() => stitchGridSize(0, 10, 10), RangeError, 'imageWidth', '0');
    assertThrowsWith(() => stitchGridSize(10, 12.5, 10), RangeError, 'imageHeight', '12.5');
  });

  it('rejects a target width that is not a positive integer', () => {
    assertThrowsWith(() => stitchGridSize(10, 10, 0), RangeError, 'targetWidth', '0');
  });
});

describe('maxTargetWidth', () => {
  it('is 10000 stitches per side', () => {
    assert.equal(MAX_GRID_SIDE, 10000);
  });

  it('finds the largest width whose height still fits', () => {
    assert.equal(maxTargetWidth(41, 2048), 200);
    assert.equal(stitchGridSize(41, 2048, 200).height, 9990);
    assert.ok(stitchGridSize(41, 2048, 201).height > MAX_GRID_SIDE);
  });

  it('can be below any sensible form width for a very narrow image', () => {
    assert.equal(maxTargetWidth(1, 2048), 4);
  });

  it('is 0 when not even one stitch of width fits', () => {
    assert.equal(maxTargetWidth(1, 10001), 0);
  });

  it('is capped at the grid side limit for landscape images', () => {
    assert.equal(maxTargetWidth(1200, 800), 10000);
  });

  it('rejects image sizes that are not positive integers', () => {
    assertThrowsWith(() => maxTargetWidth(0, 10), RangeError, 'imageWidth', '0');
  });
});

// Averages every row of the grid through createGridAverager and collects the cells as
// { linearRgb: [r, g, b per cell], alpha: [per cell] }, so tests can look at single cells.
function averageAllRows(image, size) {
  const averageRow = createGridAverager(image, size);
  const out = new Float64Array(size.width * 4);
  const linearRgb = [];
  const alpha = [];
  for (let row = 0; row < size.height; row++) {
    averageRow(row, out);
    for (let column = 0; column < size.width; column++) {
      linearRgb.push(out[column * 4], out[column * 4 + 1], out[column * 4 + 2]);
      alpha.push(out[column * 4 + 3]);
    }
  }
  return { linearRgb, alpha };
}

describe('createGridAverager', () => {
  it('averages black and white in linear RGB, not in sRGB', () => {
    const grid = averageAllRows(pixelImage(2, 1, [OPAQUE_BLACK, OPAQUE_WHITE]), { width: 1, height: 1 });
    assertCellColor(grid, 0, [0.5, 0.5, 0.5]);
    assertClose(grid.alpha[0], 1, 1e-12, 'alpha');
  });

  it('weights pixels by the part of them a cell covers', () => {
    const image = pixelImage(3, 1, [[255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255]]);
    const grid = averageAllRows(image, { width: 2, height: 1 });
    assertCellColor(grid, 0, [2 / 3, 0, 1 / 3]);
    assertCellColor(grid, 1, [0, 2 / 3, 1 / 3]);
  });

  it('ignores the color of transparent pixels', () => {
    const grid = averageAllRows(pixelImage(2, 1, [[199, 43, 59, 255], TRANSPARENT]), { width: 1, height: 1 });
    assertClose(grid.alpha[0], 0.5, 1e-12, 'alpha');
    assertCellColor(grid, 0, [srgbToLinear(199), srgbToLinear(43), srgbToLinear(59)], 1e-12);
  });

  it('averages alpha over the cell area', () => {
    const grid = averageAllRows(pixelImage(4, 1, [OPAQUE_BLACK, TRANSPARENT, TRANSPARENT, TRANSPARENT]), { width: 1, height: 1 });
    assertClose(grid.alpha[0], 0.25, 1e-12, 'alpha');
  });

  it('spreads one pixel over several cells when the grid is larger than the image', () => {
    const grid = averageAllRows(solidImage(1, 1, [255, 0, 0, 255]), { width: 3, height: 3 });
    assert.equal(grid.alpha.length, 9);
    for (let cell = 0; cell < 9; cell++) {
      assertCellColor(grid, cell, [1, 0, 0]);
      assertClose(grid.alpha[cell], 1, 1e-12, `alpha of cell ${cell}`);
    }
  });

  it('gives alpha 0 and color 0 for a fully transparent image', () => {
    const grid = averageAllRows(solidImage(4, 4, TRANSPARENT), { width: 2, height: 2 });
    assert.deepEqual(grid.alpha, [0, 0, 0, 0]);
    assert.deepEqual(grid.linearRgb, new Array(12).fill(0));
  });

  it('averages along both axes', () => {
    const image = pixelImage(2, 2, [OPAQUE_BLACK, OPAQUE_WHITE, OPAQUE_WHITE, OPAQUE_WHITE]);
    const grid = averageAllRows(image, { width: 1, height: 1 });
    assertCellColor(grid, 0, [0.75, 0.75, 0.75]);
  });

  it('writes 4 values per cell: linear r, g, b and alpha', () => {
    const averageRow = createGridAverager(pixelImage(2, 1, [[255, 255, 255, 255], TRANSPARENT]), { width: 2, height: 1 });
    const out = new Float64Array(8);
    averageRow(0, out);
    assert.deepEqual([...out], [1, 1, 1, 1, 0, 0, 0, 0]);
  });

  it('gives the same values for rows averaged in any order into a reused buffer', () => {
    const image = opaqueImageFrom(5, 7, (x, y) => [x * 50, y * 30, 128]);
    const size = { width: 3, height: 4 };
    const inOrder = averageAllRows(image, size);
    const averageRow = createGridAverager(image, size);
    const out = new Float64Array(size.width * 4).fill(123);
    for (const row of [3, 0, 2, 1]) {
      averageRow(row, out);
      for (let column = 0; column < size.width; column++) {
        const cell = row * size.width + column;
        assertClose(out[column * 4 + 3], inOrder.alpha[cell], 1e-12, `alpha of cell ${cell}`);
        for (let channel = 0; channel < 3; channel++) {
          assertClose(out[column * 4 + channel], inOrder.linearRgb[cell * 3 + channel], 1e-12, `cell ${cell} channel ${channel}`);
        }
      }
    }
  });

  it('rejects a pixel buffer of the wrong size', () => {
    const image = { width: 2, height: 2, pixels: new Uint8ClampedArray(12) };
    assertThrowsWith(() => createGridAverager(image, { width: 1, height: 1 }), RangeError, '16', '12');
  });

  it('rejects pixels that are not a byte array', () => {
    const image = { width: 1, height: 1, pixels: [0, 0, 0, 255] };
    assertThrowsWith(() => createGridAverager(image, { width: 1, height: 1 }), TypeError, 'pixels');
  });

  it('rejects a grid size that is not a pair of positive integers', () => {
    assertThrowsWith(() => createGridAverager(solidImage(1, 1, OPAQUE_BLACK), { width: 0, height: 1 }), RangeError, 'grid width', '0');
  });

  it('accepts a Uint8Array as well as a Uint8ClampedArray', () => {
    const image = { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) };
    assertCellColor(averageAllRows(image, { width: 1, height: 1 }), 0, [1, 1, 1]);
  });

  it('does not modify the input pixels', () => {
    const image = pixelImage(2, 1, [[10, 20, 30, 40], [50, 60, 70, 80]]);
    const before = [...image.pixels];
    averageAllRows(image, { width: 1, height: 1 });
    assert.deepEqual([...image.pixels], before);
  });
});

function assertCellColor(grid, cell, expected, tolerance = 1e-4) {
  for (let channel = 0; channel < 3; channel++) {
    assertClose(grid.linearRgb[cell * 3 + channel], expected[channel], tolerance, `cell ${cell} channel ${channel}`);
  }
}

describe('checkPixelImage', () => {
  it('accepts a well-formed pixel image', () => {
    assert.doesNotThrow(() => checkPixelImage(solidImage(2, 2, OPAQUE_BLACK)));
  });

  it('rejects a buffer of the wrong size, pixels of the wrong type and bad sizes', () => {
    assertThrowsWith(() => checkPixelImage({ width: 2, height: 2, pixels: new Uint8ClampedArray(12) }), RangeError, '16', '12');
    assertThrowsWith(() => checkPixelImage({ width: 1, height: 1, pixels: [0, 0, 0, 0] }), TypeError, 'pixels');
    assertThrowsWith(() => checkPixelImage({ width: 0, height: 1, pixels: new Uint8ClampedArray(0) }), RangeError, 'imageWidth');
  });

  it('rejects a missing image', () => {
    assertThrowsWith(() => checkPixelImage(undefined), TypeError, 'image');
  });
});

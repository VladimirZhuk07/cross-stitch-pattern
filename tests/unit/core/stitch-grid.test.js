import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_GRID_SIDE, maxTargetWidth, resizeToGrid, stitchGridSize } from '../../../src/core/stitch-grid.js';
import { srgbToLinear } from '../../../src/core/color.js';
import { assertClose } from '../../helpers/assert-close.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, TRANSPARENT, pixelImage, solidImage } from '../../helpers/pixel-image.js';
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
    assert.deepEqual(stitchGridSize(41, 2048, 100), { width: 100, height: 4995 });
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
  it('is 500 stitches per side', () => {
    assert.equal(MAX_GRID_SIDE, 500);
  });

  it('finds the largest width whose height still fits', () => {
    assert.equal(maxTargetWidth(41, 2048), 10);
    assert.equal(stitchGridSize(41, 2048, 10).height, 500);
    assert.ok(stitchGridSize(41, 2048, 11).height > MAX_GRID_SIDE);
  });

  it('can be below any sensible form width for a very narrow image', () => {
    assert.equal(maxTargetWidth(10, 2048), 2);
  });

  it('is 0 when not even one stitch of width fits', () => {
    assert.equal(maxTargetWidth(1, 2048), 0);
  });

  it('is capped at the grid side limit for landscape images', () => {
    assert.equal(maxTargetWidth(1200, 800), 500);
  });

  it('rejects image sizes that are not positive integers', () => {
    assertThrowsWith(() => maxTargetWidth(0, 10), RangeError, 'imageWidth', '0');
  });
});

describe('resizeToGrid', () => {
  it('averages black and white in linear RGB, not in sRGB', () => {
    const grid = resizeToGrid(pixelImage(2, 1, [OPAQUE_BLACK, OPAQUE_WHITE]), { width: 1, height: 1 });
    assert.equal(grid.width, 1);
    assert.equal(grid.height, 1);
    assertCellColor(grid, 0, [0.5, 0.5, 0.5]);
    assertClose(grid.alpha[0], 1, 1e-12, 'alpha');
  });

  it('weights pixels by the part of them a cell covers', () => {
    const image = pixelImage(3, 1, [[255, 0, 0, 255], [0, 0, 255, 255], [0, 255, 0, 255]]);
    const grid = resizeToGrid(image, { width: 2, height: 1 });
    assertCellColor(grid, 0, [2 / 3, 0, 1 / 3]);
    assertCellColor(grid, 1, [0, 2 / 3, 1 / 3]);
  });

  it('ignores the color of transparent pixels', () => {
    const grid = resizeToGrid(pixelImage(2, 1, [[199, 43, 59, 255], TRANSPARENT]), { width: 1, height: 1 });
    assertClose(grid.alpha[0], 0.5, 1e-12, 'alpha');
    assertCellColor(grid, 0, [srgbToLinear(199), srgbToLinear(43), srgbToLinear(59)], 1e-12);
  });

  it('averages alpha over the cell area', () => {
    const grid = resizeToGrid(pixelImage(4, 1, [OPAQUE_BLACK, TRANSPARENT, TRANSPARENT, TRANSPARENT]), { width: 1, height: 1 });
    assertClose(grid.alpha[0], 0.25, 1e-12, 'alpha');
  });

  it('spreads one pixel over several cells when the grid is larger than the image', () => {
    const grid = resizeToGrid(solidImage(1, 1, [255, 0, 0, 255]), { width: 3, height: 3 });
    assert.equal(grid.alpha.length, 9);
    for (let cell = 0; cell < 9; cell++) {
      assertCellColor(grid, cell, [1, 0, 0]);
      assertClose(grid.alpha[cell], 1, 1e-12, `alpha of cell ${cell}`);
    }
  });

  it('gives alpha 0 and color 0 for a fully transparent image', () => {
    const grid = resizeToGrid(solidImage(4, 4, TRANSPARENT), { width: 2, height: 2 });
    assert.deepEqual([...grid.alpha], [0, 0, 0, 0]);
    assert.deepEqual([...grid.linearRgb], new Array(12).fill(0));
  });

  it('averages along both axes', () => {
    const image = pixelImage(2, 2, [OPAQUE_BLACK, OPAQUE_WHITE, OPAQUE_WHITE, OPAQUE_WHITE]);
    const grid = resizeToGrid(image, { width: 1, height: 1 });
    assertCellColor(grid, 0, [0.75, 0.75, 0.75]);
  });

  it('rejects a pixel buffer of the wrong size', () => {
    const image = { width: 2, height: 2, pixels: new Uint8ClampedArray(12) };
    assertThrowsWith(() => resizeToGrid(image, { width: 1, height: 1 }), RangeError, '16', '12');
  });

  it('rejects pixels that are not a byte array', () => {
    const image = { width: 1, height: 1, pixels: [0, 0, 0, 255] };
    assertThrowsWith(() => resizeToGrid(image, { width: 1, height: 1 }), TypeError, 'pixels');
  });

  it('accepts a Uint8Array as well as a Uint8ClampedArray', () => {
    const image = { width: 1, height: 1, pixels: new Uint8Array([255, 255, 255, 255]) };
    assertCellColor(resizeToGrid(image, { width: 1, height: 1 }), 0, [1, 1, 1]);
  });

  it('does not modify the input pixels', () => {
    const image = pixelImage(2, 1, [[10, 20, 30, 40], [50, 60, 70, 80]]);
    const before = [...image.pixels];
    resizeToGrid(image, { width: 1, height: 1 });
    assert.deepEqual([...image.pixels], before);
  });
});

function assertCellColor(grid, cell, expected, tolerance = 1e-4) {
  for (let channel = 0; channel < 3; channel++) {
    assertClose(grid.linearRgb[cell * 3 + channel], expected[channel], tolerance, `cell ${cell} channel ${channel}`);
  }
}

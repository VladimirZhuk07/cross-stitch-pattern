import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePattern } from '../../../src/core/pattern-generator.js';
import { prepareLabPalette } from '../../../src/core/dmc-match.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, TRANSPARENT, pixelImage, solidImage } from '../../helpers/pixel-image.js';

// A two-color test palette (fixtures, not DMC data), so expected results are obvious.
const TEST_PALETTE = prepareLabPalette([
  { code: 'K', name: 'Test black', hex: '#000000' },
  { code: 'W', name: 'Test white', hex: '#FFFFFF' },
]);

const blackOverWhite = () => pixelImage(2, 2, [OPAQUE_BLACK, OPAQUE_BLACK, OPAQUE_WHITE, OPAQUE_WHITE]);

describe('generatePattern', () => {
  it('turns a two-color image into a two-entry pattern', () => {
    const pattern = generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 24 }, TEST_PALETTE);
    assert.equal(pattern.width, 2);
    assert.equal(pattern.height, 2);
    assert.deepEqual([...pattern.cells], [0, 0, 1, 1]);
    assert.deepEqual(pattern.legend, [
      { number: 1, code: 'K', name: 'Test black', hex: '#000000', stitchCount: 2 },
      { number: 2, code: 'W', name: 'Test white', hex: '#FFFFFF', stitchCount: 2 },
    ]);
  });

  it('leaves transparent cells empty', () => {
    const image = pixelImage(2, 2, [OPAQUE_BLACK, TRANSPARENT, OPAQUE_BLACK, TRANSPARENT]);
    const pattern = generatePattern(image, { targetWidth: 2, maxColors: 24 }, TEST_PALETTE);
    assert.deepEqual([...pattern.cells], [0, -1, 0, -1]);
    assert.deepEqual(pattern.legend.map((entry) => [entry.code, entry.stitchCount]), [['K', 2]]);
  });

  it('builds an empty pattern from a fully transparent image', () => {
    const pattern = generatePattern(solidImage(4, 4, TRANSPARENT), { targetWidth: 2, maxColors: 24 }, TEST_PALETTE);
    assert.equal(pattern.width, 2);
    assert.equal(pattern.height, 2);
    assert.deepEqual([...pattern.cells], [-1, -1, -1, -1]);
    assert.deepEqual(pattern.legend, []);
  });

  it('leaves a cell empty when less than half of it is covered', () => {
    const image = pixelImage(4, 1, [OPAQUE_BLACK, TRANSPARENT, TRANSPARENT, TRANSPARENT]);
    const pattern = generatePattern(image, { targetWidth: 1, maxColors: 24 }, TEST_PALETTE);
    assert.deepEqual([...pattern.cells], [-1]);
    assert.deepEqual(pattern.legend, []);
  });

  it('stitches a cell that is exactly half covered', () => {
    const image = pixelImage(2, 1, [OPAQUE_BLACK, TRANSPARENT]);
    const pattern = generatePattern(image, { targetWidth: 1, maxColors: 24 }, TEST_PALETTE);
    assert.deepEqual([...pattern.cells], [0]);
    assert.equal(pattern.legend[0].code, 'K');
  });

  it('rejects target widths outside 1–10000 or not whole', () => {
    for (const targetWidth of [0, 10001, 12.5]) {
      assertThrowsWith(
        () => generatePattern(blackOverWhite(), { targetWidth, maxColors: 24 }, TEST_PALETTE),
        RangeError,
        'targetWidth',
        String(targetWidth),
      );
    }
  });

  it('rejects color limits outside 1–489 or not whole', () => {
    assertThrowsWith(() => generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 0 }, TEST_PALETTE), RangeError, 'maxColors', '0');
    assertThrowsWith(() => generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 490 }, TEST_PALETTE), RangeError, '490', '489');
  });

  it('rejects a grid taller than 10000 stitches and names the largest width that fits', () => {
    const tall = solidImage(1, 2048, OPAQUE_BLACK);
    assertThrowsWith(() => generatePattern(tall, { targetWidth: 5, maxColors: 24 }, TEST_PALETTE), RangeError, '10240', '10000', '4');
  });

  it('says so when no width fits at all', () => {
    const needle = solidImage(1, 10001, OPAQUE_BLACK);
    assertThrowsWith(() => generatePattern(needle, { targetWidth: 1, maxColors: 24 }, TEST_PALETTE), RangeError, '10001', 'no target width');
  });

  it('rejects a pixel buffer of the wrong size', () => {
    const image = { width: 2, height: 2, pixels: new Uint8ClampedArray(12) };
    assertThrowsWith(() => generatePattern(image, { targetWidth: 2, maxColors: 24 }, TEST_PALETTE), RangeError, '16', '12');
  });

  it('does not modify the pixels or the settings', () => {
    const image = blackOverWhite();
    const pixelsBefore = [...image.pixels];
    const settings = { targetWidth: 2, maxColors: 24, fabricCount: 14 };
    generatePattern(image, settings, TEST_PALETTE);
    assert.deepEqual([...image.pixels], pixelsBefore);
    assert.deepEqual(settings, { targetWidth: 2, maxColors: 24, fabricCount: 14 });
  });

  it('gives equal patterns for equal input', () => {
    const first = generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 1 }, TEST_PALETTE);
    const second = generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 1 }, TEST_PALETTE);
    assert.deepEqual(first, second);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  GENERATING_TEXT,
  MAX_COLORS_INVALID_TEXT,
  MAX_COLORS_RANGE,
  NO_IMAGE_SIZE_TEXT,
  TARGET_WIDTH_INVALID_TEXT,
  TARGET_WIDTH_RANGE,
  describeGenerationError,
  describeGenerationResult,
  formatGridTooLarge,
  formatPatternSize,
  parseWholeNumber,
} from '../../../src/core/generation-settings.js';

describe('generation settings defaults', () => {
  it('starts with width 100, 24 colors and 14 ct fabric', () => {
    assert.deepEqual(DEFAULT_SETTINGS, { targetWidth: 100, maxColors: 24, fabricCount: 14 });
    assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
  });

  it('offers widths 10–500 and 1–99 colors in the form', () => {
    assert.deepEqual(TARGET_WIDTH_RANGE, { min: 10, max: 500 });
    assert.deepEqual(MAX_COLORS_RANGE, { min: 1, max: 99 });
  });
});

describe('parseWholeNumber', () => {
  it('accepts whole numbers inside the range, ignoring surrounding spaces', () => {
    assert.equal(parseWholeNumber('100', TARGET_WIDTH_RANGE), 100);
    assert.equal(parseWholeNumber(' 24 ', MAX_COLORS_RANGE), 24);
    assert.equal(parseWholeNumber('10', TARGET_WIDTH_RANGE), 10);
    assert.equal(parseWholeNumber('500', TARGET_WIDTH_RANGE), 500);
  });

  it('rejects empty, fractional, out-of-range and non-numeric text', () => {
    for (const text of ['', '12.5', '5', '600', 'abc', '1e2', '-20']) {
      assert.equal(parseWholeNumber(text, TARGET_WIDTH_RANGE), null, `"${text}"`);
    }
  });
});

describe('size texts', () => {
  it('describes the grid and finished size on 14 ct', () => {
    assert.equal(
      formatPatternSize({ width: 100, height: 67 }, 14),
      '100 × 67 stitches — 7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct',
    );
  });

  it('describes the grid and finished size on 18 ct', () => {
    assert.equal(
      formatPatternSize({ width: 100, height: 67 }, 18),
      '100 × 67 stitches — 5.6 × 3.7 in (14.1 × 9.5 cm) on 18 ct',
    );
  });

  it('suggests the largest width when the grid is too tall', () => {
    assert.equal(
      formatGridTooLarge({ width: 100, height: 4995 }, 10),
      '100 × 4995 stitches is too large: at most 500 stitches per side. Choose a width of at most 10.',
    );
  });

  it('says the image cannot fit when no width in the form range fits', () => {
    assert.equal(
      formatGridTooLarge({ width: 100, height: 20480 }, 2),
      '100 × 20480 stitches is too large: at most 500 stitches per side. This image is too tall and narrow to fit.',
    );
  });

  it('asks for an image while none is loaded', () => {
    assert.equal(NO_IMAGE_SIZE_TEXT, 'Load an image to see the pattern size.');
  });
});

describe('field messages', () => {
  it('explains the allowed width and color count', () => {
    assert.equal(TARGET_WIDTH_INVALID_TEXT, 'Width must be a whole number from 10 to 500.');
    assert.equal(MAX_COLORS_INVALID_TEXT, 'Max colors must be a whole number from 1 to 99.');
  });
});

describe('generation status texts', () => {
  const legendOf = (count) => Array.from({ length: count }, (_, index) => ({ number: index + 1 }));

  it('reports a running generation', () => {
    assert.equal(GENERATING_TEXT, 'Generating pattern…');
  });

  it('reports the size and number of colors', () => {
    assert.equal(
      describeGenerationResult({ width: 100, height: 67, legend: legendOf(18) }),
      'Pattern ready: 100 × 67 stitches, 18 DMC colors.',
    );
  });

  it('uses the singular for one color', () => {
    assert.equal(
      describeGenerationResult({ width: 10, height: 10, legend: legendOf(1) }),
      'Pattern ready: 10 × 10 stitches, 1 DMC color.',
    );
  });

  it('explains a pattern without stitches', () => {
    assert.equal(
      describeGenerationResult({ width: 2, height: 2, legend: [] }),
      'Pattern ready: the image is fully transparent, so there is nothing to stitch.',
    );
  });

  it('prefixes the reason of a failure', () => {
    assert.equal(describeGenerationError('boom'), 'Could not generate the pattern: boom');
  });
});

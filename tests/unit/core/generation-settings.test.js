import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  GENERATING_TEXT,
  GENERATION_STOPPED_TEXT,
  LARGE_PATTERN_STITCHES,
  MAX_COLORS_INVALID_TEXT,
  MAX_COLORS_RANGE,
  NO_IMAGE_SIZE_TEXT,
  TARGET_WIDTH_INVALID_TEXT,
  TARGET_WIDTH_RANGE,
  describeGenerationError,
  describeGenerationProgress,
  describeLargePattern,
  describeGenerationResult,
  formatGridTooLarge,
  formatNoExtraDetailNote,
  formatPatternSize,
  isLargePattern,
  parseWholeNumber,
} from '../../../src/core/generation-settings.js';
import { MAX_PATTERN_COLORS } from '../../../src/core/pattern.js';
import { formatSettingsSummary } from '../../../src/core/generation-settings.js';
import { formatFinishedSize } from '../../../src/core/generation-settings.js';
import { MAX_GRID_SIDE } from '../../../src/core/stitch-grid.js';

describe('generation settings defaults', () => {
  it('starts with width 100, 24 colors and 14 ct fabric', () => {
    assert.deepEqual(DEFAULT_SETTINGS, { targetWidth: 100, maxColors: 24, fabricCount: 14 });
    assert.ok(Object.isFrozen(DEFAULT_SETTINGS));
  });

  it('offers widths 10–10000 and 1–489 colors (the whole DMC palette) in the form', () => {
    assert.deepEqual(TARGET_WIDTH_RANGE, { min: 10, max: 10000 });
    assert.deepEqual(MAX_COLORS_RANGE, { min: 1, max: 489 });
    assert.equal(MAX_COLORS_RANGE.max, MAX_PATTERN_COLORS);
  });
});

describe('parseWholeNumber', () => {
  it('accepts whole numbers inside the range, ignoring surrounding spaces', () => {
    assert.equal(parseWholeNumber('100', TARGET_WIDTH_RANGE), 100);
    assert.equal(parseWholeNumber(' 24 ', MAX_COLORS_RANGE), 24);
    assert.equal(parseWholeNumber('10', TARGET_WIDTH_RANGE), 10);
    assert.equal(parseWholeNumber('10000', TARGET_WIDTH_RANGE), 10000);
    assert.equal(parseWholeNumber('489', MAX_COLORS_RANGE), 489);
  });

  it('rejects empty, fractional, out-of-range and non-numeric text', () => {
    for (const text of ['', '12.5', '5', '10001', 'abc', '1e2', '-20']) {
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

  it('describes a grid as wide as a 3200 × 4000 image', () => {
    assert.equal(
      formatPatternSize({ width: 3200, height: 4000 }, 14),
      '3200 × 4000 stitches — 228.6 × 285.7 in (580.6 × 725.7 cm) on 14 ct',
    );
  });

  it('describes a 5000 × 6250 grid', () => {
    assert.equal(
      formatPatternSize({ width: 5000, height: 6250 }, 14),
      '5000 × 6250 stitches — 357.1 × 446.4 in (907.1 × 1133.9 cm) on 14 ct',
    );
  });

  it('notes that a grid wider than the image adds no detail', () => {
    assert.equal(
      formatNoExtraDetailNote(5000, 3200),
      'Wider than the image (3200 px), so the extra stitches add no detail.',
    );
  });

  it('has no note for a grid as wide as the image or narrower', () => {
    assert.equal(formatNoExtraDetailNote(3200, 3200), '');
    assert.equal(formatNoExtraDetailNote(100, 3200), '');
  });

  it('suggests the largest width when the grid is too tall', () => {
    assert.equal(
      formatGridTooLarge({ width: 250, height: 12488 }, 200),
      '250 × 12488 stitches is too large: at most 10000 stitches per side. Choose a width of at most 200.',
    );
  });

  it('says the image cannot fit when no width in the form range fits', () => {
    assert.equal(
      formatGridTooLarge({ width: 100, height: 204800 }, 4),
      '100 × 204800 stitches is too large: at most 10000 stitches per side. This image is too tall and narrow to fit.',
    );
  });

  it('asks for an image while none is loaded', () => {
    assert.equal(NO_IMAGE_SIZE_TEXT, 'Load an image to see the pattern size.');
  });
});

describe('field messages', () => {
  it('explains the allowed width and color count', () => {
    assert.equal(TARGET_WIDTH_INVALID_TEXT, 'Width must be a whole number from 10 to 10000.');
    assert.equal(MAX_COLORS_INVALID_TEXT, 'Max colors must be a whole number from 1 to 489.');
  });
});

describe('large patterns', () => {
  it('starts above 4,000,000 stitches', () => {
    assert.equal(LARGE_PATTERN_STITCHES, 4000000);
  });

  it('generates 2000 × 2000 automatically', () => {
    assert.equal(isLargePattern({ width: 2000, height: 2000 }), false);
  });

  it('asks before generating 2001 × 2001', () => {
    assert.equal(isLargePattern({ width: 2001, height: 2001 }), true);
  });

  it('explains why Generate must be pressed', () => {
    assert.equal(
      describeLargePattern(4004001),
      'This pattern has 4,004,001 stitches. Large patterns take longer to generate and need more memory. Press Generate to start.',
    );
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

  it('shows step and percent while averaging', () => {
    assert.equal(
      describeGenerationProgress({ phase: 'averaging', done: 1, total: 3 }),
      'Generating pattern… step 1 of 3: averaging stitches, 33 %',
    );
  });

  it('shows step and percent while reducing colors', () => {
    assert.equal(
      describeGenerationProgress({ phase: 'clustering', done: 6, total: 30 }),
      'Generating pattern… step 2 of 3: reducing colors, 20 %',
    );
  });

  it('shows step and percent while assigning colors', () => {
    assert.equal(
      describeGenerationProgress({ phase: 'assigning', done: 37, total: 100 }),
      'Generating pattern… step 3 of 3: assigning colors, 37 %',
    );
  });

  it('reports a stopped generation', () => {
    assert.equal(GENERATION_STOPPED_TEXT, 'Generation stopped.');
  });

  it('prefixes the reason of a failure', () => {
    assert.equal(describeGenerationError('boom'), 'Could not generate the pattern: boom');
  });
});

describe('formatSettingsSummary', () => {
  const defaults = { targetWidth: 100, maxColors: 24, fabricCount: 14 };

  it('shows stitches, colors, fabric and finished inches for a loaded image', () => {
    assert.equal(formatSettingsSummary({ width: 100, height: 67 }, defaults), '100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in');
  });

  it('shows the width setting without an image', () => {
    assert.equal(formatSettingsSummary(null, defaults), 'Width 100 · max 24 colors · 14 ct');
  });

  it('uses the singular for one color and follows the fabric count', () => {
    const settings = { targetWidth: 100, maxColors: 1, fabricCount: 18 };
    assert.equal(formatSettingsSummary({ width: 100, height: 67 }, settings), '100 × 67 · max 1 color · 18 ct · 5.6 × 3.7 in');
  });

  it('says too large instead of a size when the height exceeds the limit', () => {
    const height = MAX_GRID_SIDE + 1;
    assert.equal(
      formatSettingsSummary({ width: 100, height }, defaults),
      `100 × ${height} · too large · max 24 colors · 14 ct`,
    );
  });

  it('says too large when the width exceeds the limit', () => {
    const width = MAX_GRID_SIDE + 1;
    assert.equal(
      formatSettingsSummary({ width, height: 10 }, { ...defaults, targetWidth: width }),
      `${width} × 10 · too large · max 24 colors · 14 ct`,
    );
  });

  it('shows the size of a grid wider than the image like any other size', () => {
    assert.equal(
      formatSettingsSummary({ width: 5000, height: 6250 }, { ...defaults, targetWidth: 5000 }),
      '5000 × 6250 · max 24 colors · 14 ct · 357.1 × 446.4 in',
    );
  });

  it('does not modify its arguments', () => {
    const size = { width: 100, height: 67 };
    const settings = { ...defaults };
    formatSettingsSummary(size, settings);
    assert.deepEqual(size, { width: 100, height: 67 });
    assert.deepEqual(settings, defaults);
  });
});

describe('formatFinishedSize', () => {
  it('describes the finished size on 14 ct without the stitch count', () => {
    assert.equal(formatFinishedSize({ width: 100, height: 67 }, 14), '7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct');
  });

  it('is the part of formatPatternSize after the stitch count', () => {
    for (const fabricCount of [11, 14, 16, 18]) {
      const size = { width: 100, height: 67 };
      assert.equal(formatPatternSize(size, fabricCount), `100 × 67 stitches — ${formatFinishedSize(size, fabricCount)}`);
    }
  });
});

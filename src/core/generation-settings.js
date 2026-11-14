// Pattern settings: their defaults, the ranges the settings form offers, and the texts the
// form shows (stitch size, finished size, generation status). Kept in core so they are
// unit-tested; the form in src/ui/settings-form.js only displays them.

import { DEFAULT_FABRIC_COUNT, MAX_PATTERN_COLORS, finishedSize } from './pattern.js';
import { MAX_GRID_SIDE } from './stitch-grid.js';

// Settings (state.settings in src/ui/app-state.js), a plain object:
//   targetWidth  stitches per row, a whole number in TARGET_WIDTH_RANGE
//   maxColors    largest number of DMC colors in the pattern, a whole number in MAX_COLORS_RANGE
//   fabricCount  stitches per inch of the fabric, one of FABRIC_COUNTS (src/core/pattern.js);
//                it changes only the finished size, never the pattern
export const DEFAULT_SETTINGS = Object.freeze({
  targetWidth: 100,
  maxColors: 24,
  fabricCount: DEFAULT_FABRIC_COUNT,
});

// Ranges offered by the form. The pipeline itself accepts widths from 1 (for tiny tests);
// below 10 stitches a pattern is not useful.
export const TARGET_WIDTH_RANGE = Object.freeze({ min: 10, max: MAX_GRID_SIDE });
export const MAX_COLORS_RANGE = Object.freeze({ min: 1, max: MAX_PATTERN_COLORS });

export const TARGET_WIDTH_INVALID_TEXT =
  `Width must be a whole number from ${TARGET_WIDTH_RANGE.min} to ${TARGET_WIDTH_RANGE.max}.`;
export const MAX_COLORS_INVALID_TEXT =
  `Max colors must be a whole number from ${MAX_COLORS_RANGE.min} to ${MAX_COLORS_RANGE.max}.`;
export const NO_IMAGE_SIZE_TEXT = 'Load an image to see the pattern size.';
export const GENERATING_TEXT = 'Generating pattern…';
export const GENERATION_STOPPED_TEXT = 'Generation stopped.';

// Patterns with more stitches than this are generated only when the user presses Generate:
// up to 2000 × 2000 generation takes a few seconds and under 100 MB; above it time and memory
// grow towards half a minute and half a gigabyte (see design D11 of raise-pattern-limits).
export const LARGE_PATTERN_STITCHES = 4_000_000;

// The UI is in English; a fixed locale keeps the output the same in every browser.
const COUNT_FORMAT = new Intl.NumberFormat('en-US');

// The three steps of generation (phases of GenerationProgress in ./pattern-generator.js).
const PROGRESS_STEPS = Object.freeze({
  averaging: { step: 1, label: 'averaging stitches' },
  clustering: { step: 2, label: 'reducing colors' },
  assigning: { step: 3, label: 'assigning colors' },
});
const PROGRESS_STEP_COUNT = 3;

const WHOLE_NUMBER = /^\d+$/;
const SIZE_DECIMALS = 1;

// Parses the text of a number field as a whole number inside range { min, max }.
// Surrounding spaces are ignored. Returns the number, or null for empty, fractional,
// negative, exponent-style, non-numeric or out-of-range text.
export function parseWholeNumber(text, range) {
  const trimmed = String(text).trim();
  if (!WHOLE_NUMBER.test(trimmed)) {
    return null;
  }
  const value = Number(trimmed);
  if (value < range.min || value > range.max) {
    return null;
  }
  return value;
}

// Text for a grid size { width, height } in stitches on fabric with fabricCount stitches
// per inch, e.g. '100 × 67 stitches — 7.1 × 4.8 in (18.1 × 12.2 cm) on 14 ct'.
export function formatPatternSize(size, fabricCount) {
  const finished = finishedSize(size, fabricCount);
  const inches = `${round(finished.widthInches)} × ${round(finished.heightInches)} in`;
  const centimetres = `${round(finished.widthCm)} × ${round(finished.heightCm)} cm`;
  return `${size.width} × ${size.height} stitches — ${inches} (${centimetres}) on ${fabricCount} ct`;
}

// Note for a grid wider than the image it comes from: more stitches than pixels only repeat
// pixels. gridWidth in stitches, imageWidth in px. Returns the note, or '' when the grid is at
// most as wide as the image.
export function formatNoExtraDetailNote(gridWidth, imageWidth) {
  if (gridWidth <= imageWidth) {
    return '';
  }
  return `Wider than the image (${imageWidth} px), so the extra stitches add no detail.`;
}

// True when a grid size { width, height } has more than LARGE_PATTERN_STITCHES cells, so it
// waits for the Generate button instead of being generated automatically.
export function isLargePattern(size) {
  return size.width * size.height > LARGE_PATTERN_STITCHES;
}

// Status text while a large pattern of stitchCount cells waits for the Generate button.
export function describeLargePattern(stitchCount) {
  return `This pattern has ${COUNT_FORMAT.format(stitchCount)} stitches. ` +
    'Large patterns take longer to generate and need more memory. Press Generate to start.';
}

// Status text for a GenerationProgress { phase, done, total } (see ./pattern-generator.js),
// e.g. 'Generating pattern… step 2 of 3: reducing colors, 20 %'. The percent is rounded down.
export function describeGenerationProgress(progress) {
  const { step, label } = PROGRESS_STEPS[progress.phase];
  const percent = Math.floor((100 * progress.done) / progress.total);
  return `${GENERATING_TEXT} step ${step} of ${PROGRESS_STEP_COUNT}: ${label}, ${percent} %`;
}

// Text for a grid size whose height exceeds MAX_GRID_SIDE. maxWidth is the largest target
// width that fits the image (see maxTargetWidth in ./stitch-grid.js); when it is below the
// form's minimum width the image cannot be used at any width the form offers.
export function formatGridTooLarge(size, maxWidth) {
  const problem = `${size.width} × ${size.height} stitches is too large: at most ${MAX_GRID_SIDE} stitches per side.`;
  if (maxWidth < TARGET_WIDTH_RANGE.min) {
    return `${problem} This image is too tall and narrow to fit.`;
  }
  return `${problem} Choose a width of at most ${maxWidth}.`;
}

// Status text after a pattern (see src/core/pattern.js) has been generated.
export function describeGenerationResult(pattern) {
  const colorCount = pattern.legend.length;
  if (colorCount === 0) {
    return 'Pattern ready: the image is fully transparent, so there is nothing to stitch.';
  }
  const colors = colorCount === 1 ? '1 DMC color' : `${colorCount} DMC colors`;
  return `Pattern ready: ${pattern.width} × ${pattern.height} stitches, ${colors}.`;
}

// Status text when generation failed; reason is the error message.
export function describeGenerationError(reason) {
  return `Could not generate the pattern: ${reason}`;
}

function round(value) {
  return value.toFixed(SIZE_DECIMALS);
}

// One-line summary of the settings in use, shown on the collapsed Settings button on phones.
// size      the stitch grid { width, height } for the loaded image, or null without an image.
// settings  the Settings described above (always valid values, never a typed invalid one).
// Parts are joined by ' · ', e.g. '100 × 67 · max 24 colors · 14 ct · 7.1 × 4.8 in'.
// Without an image: 'Width 100 · max 24 colors · 14 ct'. A side above MAX_GRID_SIDE reads
// 'too large' instead of the finished size. Inches are rounded like formatPatternSize.
export function formatSettingsSummary(size, settings) {
  const colors = settings.maxColors === 1 ? 'max 1 color' : `max ${settings.maxColors} colors`;
  const fabric = `${settings.fabricCount} ct`;
  if (size === null) {
    return [`Width ${settings.targetWidth}`, colors, fabric].join(' · ');
  }
  const stitches = `${size.width} × ${size.height}`;
  if (size.width > MAX_GRID_SIDE || size.height > MAX_GRID_SIDE) {
    return [stitches, 'too large', colors, fabric].join(' · ');
  }
  const finished = finishedSize(size, settings.fabricCount);
  const inches = `${round(finished.widthInches)} × ${round(finished.heightInches)} in`;
  return [stitches, colors, fabric, inches].join(' · ');
}

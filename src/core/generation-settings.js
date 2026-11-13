// Pattern settings: their defaults, the ranges the settings form offers, and the texts the
// form shows (stitch size, finished size, generation status). Kept in core so they are
// unit-tested; the form in src/ui/settings-form.js only displays them.

import { DEFAULT_FABRIC_COUNT, finishedSize } from './pattern.js';
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
export const MAX_COLORS_RANGE = Object.freeze({ min: 1, max: 99 });

export const TARGET_WIDTH_INVALID_TEXT =
  `Width must be a whole number from ${TARGET_WIDTH_RANGE.min} to ${TARGET_WIDTH_RANGE.max}.`;
export const MAX_COLORS_INVALID_TEXT =
  `Max colors must be a whole number from ${MAX_COLORS_RANGE.min} to ${MAX_COLORS_RANGE.max}.`;
export const NO_IMAGE_SIZE_TEXT = 'Load an image to see the pattern size.';
export const GENERATING_TEXT = 'Generating pattern…';

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

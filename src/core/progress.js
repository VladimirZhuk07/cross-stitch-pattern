// Which stitches of a pattern the user has marked as sewn, and the texts about it. Pure: no
// DOM, no storage. The authoritative description is openspec/specs/stitch-progress/spec.md;
// the choices are explained in design D1 of add-progress-view.
//
// Progress (a plain object created by createProgress; never modified, toggleStitch makes a new one)
//   pattern        the Pattern (./pattern.js) it belongs to, compared by identity
//   bits           Uint8Array of ceil(width × height / 8) bytes: cell index i = row × width +
//                  column (row-major, as pattern.cells) is bit (i & 7), least significant
//                  first, of byte (i >> 3); 1 = stitched. Padding bits are 0. Saved files and
//                  storage keep exactly this layout.
//   stitchedCount  number of stitched cells
//   totalCount     number of non-empty cells (the ones that can be stitched)
//   version        0 when created, +1 per toggle
//   lastToggled    cell index of the latest toggle, or null

import { EMPTY_CELL } from './pattern.js';

const BITS_PER_BYTE = 8;

/**
 * Returns the Progress of a pattern with no stitch marked.
 * pattern  a Pattern (./pattern.js); it is not modified
 */
export function createProgress(pattern) {
  let totalCount = 0;
  for (const cell of pattern.cells) {
    if (cell !== EMPTY_CELL) {
      totalCount += 1;
    }
  }
  return {
    pattern,
    bits: new Uint8Array(Math.ceil((pattern.width * pattern.height) / BITS_PER_BYTE)),
    stitchedCount: 0,
    totalCount,
    version: 0,
    lastToggled: null,
  };
}

/**
 * True when cell cellIndex (row × width + column) is marked as stitched.
 * Throws RangeError when cellIndex is not an integer inside the pattern.
 */
export function isStitched(progress, cellIndex) {
  assertCellIndex(progress, cellIndex);
  return (progress.bits[cellIndex >> 3] & (1 << (cellIndex & 7))) !== 0;
}

/**
 * Returns a new Progress in which cell cellIndex is stitched if it was not, and not stitched if
 * it was; its version is one higher and lastToggled is cellIndex. An empty cell cannot be
 * stitched: the same Progress is returned. The given Progress is not modified (its bits are
 * copied, 12.5 MB at most, once per toggle).
 * Throws RangeError when cellIndex is not an integer inside the pattern.
 */
export function toggleStitch(progress, cellIndex) {
  assertCellIndex(progress, cellIndex);
  if (progress.pattern.cells[cellIndex] === EMPTY_CELL) {
    return progress;
  }
  const bits = progress.bits.slice();
  const mask = 1 << (cellIndex & 7);
  const wasStitched = (bits[cellIndex >> 3] & mask) !== 0;
  bits[cellIndex >> 3] ^= mask;
  return {
    ...progress,
    bits,
    stitchedCount: progress.stitchedCount + (wasStitched ? -1 : 1),
    version: progress.version + 1,
    lastToggled: cellIndex,
  };
}

function assertCellIndex(progress, cellIndex) {
  const cellCount = progress.pattern.width * progress.pattern.height;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= cellCount) {
    throw new RangeError(`cellIndex must be an integer 0–${cellCount - 1}, got ${String(cellIndex)}`);
  }
}

// Locale-independent thousands separators, as the other texts of the app.
const COUNT_FORMAT = new Intl.NumberFormat('en-US');
const PERCENT_STEPS = 1000; // one decimal

/**
 * The counter line, e.g. 'Stitched 1,234 of 6,700 (18.4 %)'.
 * stitched, total  stitched and stitchable (non-empty) cells, 0 ≤ stitched ≤ total
 * The percent is floor(1000 × stitched / total) / 10, so it reads 100 only when every stitch
 * is done; 0 and 100 have no decimal. Without stitchable cells it reads
 * 'Nothing to stitch in this pattern.'
 */
export function formatProgressSummary(stitched, total) {
  if (total === 0) {
    return 'Nothing to stitch in this pattern.';
  }
  const tenths = Math.floor((PERCENT_STEPS * stitched) / total);
  const percent = tenths % 10 === 0 ? String(tenths / 10) : (tenths / 10).toFixed(1);
  return `Stitched ${COUNT_FORMAT.format(stitched)} of ${COUNT_FORMAT.format(total)} (${percent} %)`;
}

/** The question before a width or max colors change replaces a pattern with marked stitches. */
export function formatSettingsWarning(stitched, total) {
  return `Change the pattern settings? Your progress on this pattern (${stitchesText(stitched, total)}) will be lost.`;
}

/**
 * The question before another image replaces a pattern with marked stitches.
 * fileName  the chosen file's name, kept literally (plain text, never markup)
 */
export function formatImageWarning(fileName, stitched, total) {
  return `Load ${fileName}? Your progress on the current pattern (${stitchesText(stitched, total)}) will be lost.`;
}

function stitchesText(stitched, total) {
  return `${COUNT_FORMAT.format(stitched)} of ${COUNT_FORMAT.format(total)} stitches`;
}

/** Version of the SavedProgress layout; a record of another version is never restored. */
export const SAVED_PROGRESS_FORMAT = 1;

// SavedProgress (a plain object created by toSavedProgress; what the browser keeps)
//   formatVersion  SAVED_PROGRESS_FORMAT
//   fingerprint    the pattern's fingerprint (./pattern.js)
//   width, height  the pattern's size in stitches
//   bits           a copy of the Progress bits (same layout)
//   stitchedCount, totalCount  as in the Progress (informative: restoreProgress recounts)
//   imageName      the loaded image's file name, for the "replace" question
//   savedAt        milliseconds since 1970-01-01 UTC

/**
 * The record to keep in the browser for a Progress.
 * imageName  the image's file name; savedAt  the time in ms since the epoch
 * Returns a new SavedProgress whose bits are a copy, so later toggles never change it.
 */
export function toSavedProgress(progress, imageName, savedAt) {
  return {
    formatVersion: SAVED_PROGRESS_FORMAT,
    fingerprint: progress.pattern.fingerprint,
    width: progress.pattern.width,
    height: progress.pattern.height,
    bits: progress.bits.slice(),
    stitchedCount: progress.stitchedCount,
    totalCount: progress.totalCount,
    imageName,
    savedAt,
  };
}

/**
 * True when a SavedProgress (or anything) belongs to the pattern: same fingerprint, width and
 * height. Cheap; used before asking whether to replace saved progress.
 */
export function isSavedProgressOf(saved, pattern) {
  return typeof saved === 'object' && saved !== null
    && saved.fingerprint === pattern.fingerprint
    && saved.width === pattern.width
    && saved.height === pattern.height;
}

/**
 * The Progress of pattern from a SavedProgress, or null when the record is not a valid
 * SAVED_PROGRESS_FORMAT record of this pattern (see isSavedProgressOf) or its bits have the
 * wrong type or length. Bits of empty cells and padding bits are cleared and the counts are
 * recounted, so a damaged or tampered record can never mark wrong cells. The result is fresh
 * (version 0, lastToggled null); the saved bits are not modified.
 */
export function restoreProgress(pattern, saved) {
  const fresh = createProgress(pattern);
  const isUsable = isSavedProgressOf(saved, pattern)
    && saved.formatVersion === SAVED_PROGRESS_FORMAT
    && saved.bits instanceof Uint8Array
    && saved.bits.length === fresh.bits.length;
  if (!isUsable) {
    return null;
  }
  const bits = fresh.bits;
  let stitchedCount = 0;
  for (let index = 0; index < pattern.cells.length; index++) {
    const isSet = (saved.bits[index >> 3] & (1 << (index & 7))) !== 0;
    if (isSet && pattern.cells[index] !== EMPTY_CELL) {
      bits[index >> 3] |= 1 << (index & 7);
      stitchedCount += 1;
    }
  }
  return { ...fresh, bits, stitchedCount };
}

/** The note under the counter after saved marks came back. */
export const RESTORED_NOTE = 'Restored your saved progress.';

/** The note under the counter when the browser cannot keep the marks. */
export const UNSAVED_NOTE = 'Your marks cannot be saved in this browser; they last until you close the page.';

/**
 * The question before the first mark replaces the saved progress of another pattern.
 * imageName  the saved progress's image file name, kept literally (plain text, never markup)
 * stitched, total  its counts
 */
export function formatReplaceWarning(imageName, stitched, total) {
  return `Start a new progress? This browser keeps one progress: the saved one for ${imageName} (${stitchesText(stitched, total)}) will be replaced.`;
}

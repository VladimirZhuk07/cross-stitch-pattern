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

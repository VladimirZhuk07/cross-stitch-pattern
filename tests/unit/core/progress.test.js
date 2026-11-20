// Unit tests for src/core/progress.js (see openspec/specs/stitch-progress/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import {
  createProgress,
  isStitched,
  toggleStitch,
  formatProgressSummary,
  formatSettingsWarning,
  formatImageWarning,
  toSavedProgress,
  restoreProgress,
  isSavedProgressOf,
} from '../../../src/core/progress.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

// Legend 1 = 310 at cells 1, 2, 4; legend 2 = 321 at cells 0, 5; cell 3 empty.
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

describe('createProgress', () => {
  it('starts with no stitch marked, counting the non-empty cells', () => {
    const pattern = threeByTwoPattern();
    const progress = createProgress(pattern);
    assert.equal(progress.pattern, pattern);
    assert.deepEqual([...progress.bits], [0]);
    assert.equal(progress.stitchedCount, 0);
    assert.equal(progress.totalCount, 5);
    assert.equal(progress.version, 0);
    assert.equal(progress.lastToggled, null);
  });

  it('uses one bit per cell, rounded up to whole bytes', () => {
    assert.equal(createProgress(solidPattern(3, 3)).bits.length, 2);
    assert.equal(createProgress(solidPattern(8, 1)).bits.length, 1);
    assert.equal(createProgress(solidPattern(4, 4)).bits.length, 2);
  });

  it('has nothing to stitch in a pattern without stitches', () => {
    const empty = buildPattern({ width: 2, height: 2, cells: [-1, -1, -1, -1], colors: [] });
    assert.equal(createProgress(empty).totalCount, 0);
  });

  it('does not modify the pattern', () => {
    const pattern = threeByTwoPattern();
    const before = [...pattern.cells];
    createProgress(pattern);
    assert.deepEqual([...pattern.cells], before);
  });
});

describe('toggleStitch and isStitched', () => {
  it('marks a cell in a new Progress and leaves the old one alone', () => {
    const before = createProgress(threeByTwoPattern());
    const after = toggleStitch(before, 5);
    assert.notEqual(after, before);
    assert.deepEqual([...after.bits], [0b00100000]);
    assert.equal(after.stitchedCount, 1);
    assert.equal(after.version, 1);
    assert.equal(after.lastToggled, 5);
    assert.equal(after.pattern, before.pattern);
    assert.equal(after.totalCount, 5);
    assert.equal(isStitched(after, 5), true);
    assert.equal(isStitched(after, 4), false);
    assert.deepEqual([...before.bits], [0]);
    assert.equal(before.stitchedCount, 0);
    assert.equal(isStitched(before, 5), false);
  });

  it('unmarks a stitched cell when toggled again', () => {
    const twice = toggleStitch(toggleStitch(createProgress(threeByTwoPattern()), 5), 5);
    assert.deepEqual([...twice.bits], [0]);
    assert.equal(twice.stitchedCount, 0);
    assert.equal(twice.version, 2);
    assert.equal(twice.lastToggled, 5);
  });

  it('cannot mark an empty cell', () => {
    const progress = createProgress(threeByTwoPattern());
    assert.equal(toggleStitch(progress, 3), progress);
  });

  it('puts cell 8 into bit 0 of the second byte', () => {
    const progress = toggleStitch(createProgress(solidPattern(3, 3)), 8);
    assert.deepEqual([...progress.bits], [0, 1]);
    assert.equal(isStitched(progress, 8), true);
  });

  it('rejects a cell index outside the grid, naming it', () => {
    const progress = createProgress(threeByTwoPattern());
    for (const index of [-1, 6, 1.5]) {
      assert.throws(() => toggleStitch(progress, index), (error) => error instanceof RangeError && error.message.includes(String(index)), `for ${index}`);
      assert.throws(() => isStitched(progress, index), RangeError, `for ${index}`);
    }
  });
});

describe('formatProgressSummary', () => {
  it('shows stitched, total and a percent with one decimal, rounded down', () => {
    assert.equal(formatProgressSummary(1234, 6700), 'Stitched 1,234 of 6,700 (18.4 %)');
    assert.equal(formatProgressSummary(1, 3), 'Stitched 1 of 3 (33.3 %)');
  });

  it('never shows 100 % before the last stitch', () => {
    assert.equal(formatProgressSummary(6699, 6700), 'Stitched 6,699 of 6,700 (99.9 %)');
  });

  it('writes 0 and 100 as whole numbers', () => {
    assert.equal(formatProgressSummary(0, 6700), 'Stitched 0 of 6,700 (0 %)');
    assert.equal(formatProgressSummary(6700, 6700), 'Stitched 6,700 of 6,700 (100 %)');
  });

  it('says so when there is nothing to stitch', () => {
    assert.equal(formatProgressSummary(0, 0), 'Nothing to stitch in this pattern.');
  });
});

describe('progress warnings', () => {
  it('asks before the settings change', () => {
    assert.equal(
      formatSettingsWarning(12, 6700),
      'Change the pattern settings? Your progress on this pattern (12 of 6,700 stitches) will be lost.',
    );
  });

  it('asks before another image is loaded, naming it literally', () => {
    assert.equal(
      formatImageWarning('cat.png', 12, 6700),
      'Load cat.png? Your progress on the current pattern (12 of 6,700 stitches) will be lost.',
    );
    assert.equal(
      formatImageWarning('<b>x</b>.png', 1234, 6700),
      'Load <b>x</b>.png? Your progress on the current pattern (1,234 of 6,700 stitches) will be lost.',
    );
  });
});

describe('toSavedProgress', () => {
  it('keeps everything a later restore needs, with a copy of the bits', () => {
    const pattern = threeByTwoPattern();
    const progress = toggleStitch(toggleStitch(createProgress(pattern), 0), 5);
    const saved = toSavedProgress(progress, 'cat.png', 1700000000000);
    assert.deepEqual({ ...saved, bits: [...saved.bits] }, {
      formatVersion: 1,
      fingerprint: pattern.fingerprint,
      width: 3,
      height: 2,
      bits: [0b00100001],
      stitchedCount: 2,
      totalCount: 5,
      imageName: 'cat.png',
      savedAt: 1700000000000,
    });
    assert.ok(saved.bits instanceof Uint8Array);
    saved.bits[0] = 0;
    assert.deepEqual([...progress.bits], [0b00100001], 'the Progress keeps its own bits');
  });
});

describe('restoreProgress and isSavedProgressOf', () => {
  const savedOf = (pattern, cells) => {
    let progress = createProgress(pattern);
    for (const cell of cells) {
      progress = toggleStitch(progress, cell);
    }
    return toSavedProgress(progress, 'cat.png', 1);
  };

  it('marks the saved cells again on the same pattern, as a fresh Progress', () => {
    const pattern = threeByTwoPattern();
    const restored = restoreProgress(threeByTwoPattern(), savedOf(pattern, [0, 5]));
    assert.deepEqual([...restored.bits], [0b00100001]);
    assert.equal(restored.stitchedCount, 2);
    assert.equal(restored.totalCount, 5);
    assert.equal(restored.version, 0);
    assert.equal(restored.lastToggled, null);
  });

  it('belongs to the pattern it is restored onto', () => {
    const target = threeByTwoPattern();
    assert.equal(restoreProgress(target, savedOf(threeByTwoPattern(), [0])).pattern, target);
  });

  it('refuses records of another pattern or format, and broken records', () => {
    const pattern = threeByTwoPattern();
    const good = savedOf(pattern, [0]);
    const variants = {
      'other fingerprint': { ...good, fingerprint: '00000000000000' },
      'other width': { ...good, width: 2 },
      'other height': { ...good, height: 3 },
      'format 2': { ...good, formatVersion: 2 },
      'bits too long': { ...good, bits: new Uint8Array(2) },
      'bits not a Uint8Array': { ...good, bits: [1] },
      'null': null,
      'a string': 'saved',
    };
    for (const [label, saved] of Object.entries(variants)) {
      assert.equal(restoreProgress(pattern, saved), null, label);
    }
  });

  it('clears bits of empty cells and padding, and recounts', () => {
    const pattern = threeByTwoPattern(); // cell 3 is empty; bits 6 and 7 are padding
    const saved = { ...savedOf(pattern, [0]), bits: new Uint8Array([0b11001001]), stitchedCount: 999 };
    const restored = restoreProgress(pattern, saved);
    assert.deepEqual([...restored.bits], [0b00000001]);
    assert.equal(restored.stitchedCount, 1);
    assert.deepEqual([...saved.bits], [0b11001001], 'the saved bits are not modified');
  });

  it('tells whether a record belongs to a pattern', () => {
    const pattern = threeByTwoPattern();
    assert.equal(isSavedProgressOf(savedOf(pattern, [0]), threeByTwoPattern()), true);
    assert.equal(isSavedProgressOf({ ...savedOf(pattern, [0]), width: 2 }, pattern), false);
    assert.equal(isSavedProgressOf({ ...savedOf(pattern, [0]), fingerprint: '00000000000000' }, pattern), false);
    assert.equal(isSavedProgressOf(null, pattern), false);
  });
});

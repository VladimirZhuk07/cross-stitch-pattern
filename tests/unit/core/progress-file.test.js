// Unit tests for src/core/progress-file.js (see the requirements "The .stitch file format" and
// "Loading a progress file checks it first" in openspec/specs/stitch-progress/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { createProgress, toggleStitch, toSavedProgress, isStitched } from '../../../src/core/progress.js';
import { compressBytes, decompressBytes } from '../../../src/core/compression.js';
import {
  PROGRESS_FILE_EXTENSION,
  PROGRESS_FILE_FORMAT,
  MAX_PROGRESS_FILE_BYTES,
  encodeProgressFile,
  decodeProgressFile,
  ProgressFileError,
} from '../../../src/core/progress-file.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

const HEADER_LENGTH = 30;

// Legend 1 = 310 at cells 1, 2, 4; legend 2 = 321 at cells 0, 5; cell 3 empty.
function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function solidPattern(width, height) {
  return buildPattern({ width, height, cells: new Int16Array(width * height), colors: [BLACK] });
}

// A Progress of pattern with exactly the given cells stitched (toggled in order).
function progressWith(pattern, cellIndexes) {
  let progress = createProgress(pattern);
  for (const cellIndex of cellIndexes) {
    progress = toggleStitch(progress, cellIndex);
  }
  return progress;
}

// The { fingerprint, width, height, bits } of a Progress, the smallest input of the encoder.
function fileInput(progress) {
  const { fingerprint, width, height } = progress.pattern;
  return { fingerprint, width, height, bits: progress.bits };
}

// Asserts that promise rejects with errorType and a message containing every fragment.
async function assertRejectsWith(promise, errorType, ...fragments) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof errorType, `expected ${errorType.name}, got ${error}`);
    for (const fragment of fragments) {
      assert.ok(error.message.includes(fragment), `expected "${fragment}" in "${error.message}"`);
    }
    return true;
  });
}

describe('progress file constants', () => {
  it('names the extension, the format version and the size limit', () => {
    assert.equal(PROGRESS_FILE_EXTENSION, 'stitch');
    assert.equal(PROGRESS_FILE_FORMAT, 1);
    assert.equal(MAX_PROGRESS_FILE_BYTES, 16 * 1024 * 1024);
  });
});

describe('encodeProgressFile', () => {
  it('writes the header and the compressed bits of the 3 × 2 pattern', async () => {
    const pattern = threeByTwoPattern();
    const bytes = await encodeProgressFile(fileInput(progressWith(pattern, [0, 4])));
    assert.ok(bytes instanceof Uint8Array);
    assert.deepEqual(
      [...bytes.subarray(0, 16)],
      [0x53, 0x54, 0x49, 0x54, 0x43, 0x48, 0x01, 0x00, 0x03, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00],
    );
    assert.equal(new TextDecoder().decode(bytes.subarray(16, HEADER_LENGTH)), pattern.fingerprint);
    assert.deepEqual([...await decompressBytes(bytes.subarray(HEADER_LENGTH), 'deflate')], [0x11]);
  });

  it('keeps sparse progress small', async () => {
    const pattern = solidPattern(1000, 1000);
    const cells = Array.from({ length: 100 }, (_, index) => index * 9973);
    const bytes = await encodeProgressFile(fileInput(progressWith(pattern, cells)));
    assert.ok(bytes.length < 5000, `${bytes.length} bytes`);
  });

  it('accepts a SavedProgress', async () => {
    const progress = progressWith(threeByTwoPattern(), [0, 4]);
    const fromSaved = await encodeProgressFile(toSavedProgress(progress, 'cat.png', 0));
    const fromInput = await encodeProgressFile(fileInput(progress));
    assert.deepEqual(fromSaved.subarray(0, HEADER_LENGTH), fromInput.subarray(0, HEADER_LENGTH));
    assert.deepEqual([...await decompressBytes(fromSaved.subarray(HEADER_LENGTH), 'deflate')], [0x11]);
  });

  it('rejects a fingerprint that is not 14 hex digits', async () => {
    const input = { ...fileInput(createProgress(threeByTwoPattern())), fingerprint: 'xyz' };
    await assertRejectsWith(encodeProgressFile(input), TypeError, 'fingerprint', 'xyz');
  });

  it('rejects bits that are not a Uint8Array', async () => {
    const input = { ...fileInput(createProgress(threeByTwoPattern())), bits: [0] };
    await assertRejectsWith(encodeProgressFile(input), TypeError, 'bits');
  });

  it('rejects a width or height outside 1–10000', async () => {
    const input = fileInput(createProgress(threeByTwoPattern()));
    await assertRejectsWith(encodeProgressFile({ ...input, width: 0 }), RangeError, 'width', '0');
    await assertRejectsWith(encodeProgressFile({ ...input, height: 10001 }), RangeError, 'height', '10001');
  });

  it('rejects a bits length that does not fit the size', async () => {
    const input = { ...fileInput(createProgress(threeByTwoPattern())), bits: new Uint8Array(2) };
    await assertRejectsWith(encodeProgressFile(input), RangeError, 'bits', '1', '2');
  });
});

// The cell indexes stitched in a Progress, in order.
function stitchedCells(progress) {
  const cells = [];
  const cellCount = progress.pattern.width * progress.pattern.height;
  for (let index = 0; index < cellCount; index++) {
    if (isStitched(progress, index)) {
      cells.push(index);
    }
  }
  return cells;
}

// A .stitch file with a hand-made header and data part (for files the encoder never writes).
function handMadeFile({ magic = 'STITCH', version = 1, width, height, fingerprint, data }) {
  const bytes = new Uint8Array(HEADER_LENGTH + data.length);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(magic).subarray(0, 6), 0);
  view.setUint16(6, version, true);
  view.setUint32(8, width, true);
  view.setUint32(12, height, true);
  bytes.set(new TextEncoder().encode(fingerprint), 16);
  bytes.set(data, HEADER_LENGTH);
  return bytes;
}

describe('decodeProgressFile', () => {
  it('round-trips the 3 × 2 pattern into a fresh Progress', async () => {
    const pattern = threeByTwoPattern();
    const bytes = await encodeProgressFile(fileInput(progressWith(pattern, [0, 4])));
    const loaded = await decodeProgressFile(bytes, pattern);
    assert.equal(loaded.pattern, pattern);
    assert.deepEqual(stitchedCells(loaded), [0, 4]);
    assert.equal(loaded.stitchedCount, 2);
    assert.equal(loaded.totalCount, 5);
    assert.equal(loaded.version, 0);
    assert.equal(loaded.lastToggled, null);
  });

  it('round-trips 1,234 marks of a 4000 × 4000 pattern', async () => {
    const pattern = solidPattern(4000, 4000);
    const bits = new Uint8Array(2_000_000);
    const cells = Array.from({ length: 1234 }, (_, index) => index * 12_967 + (index % 7));
    for (const cell of cells) {
      bits[cell >> 3] |= 1 << (cell & 7);
    }
    const bytes = await encodeProgressFile({ ...fileInput(createProgress(pattern)), bits });
    const loaded = await decodeProgressFile(bytes, pattern);
    assert.equal(loaded.stitchedCount, 1234);
    assert.deepEqual(loaded.bits, bits);
  });

  it('ignores the bits of empty cells and padding bits and recounts', async () => {
    const pattern = threeByTwoPattern();
    // cell 0, empty cell 3 and padding bit 7
    const data = await compressBytes(Uint8Array.of(0b1000_1001), 'deflate');
    const bytes = handMadeFile({ width: 3, height: 2, fingerprint: pattern.fingerprint, data });
    const loaded = await decodeProgressFile(bytes, pattern);
    assert.deepEqual(stitchedCells(loaded), [0]);
    assert.deepEqual([...loaded.bits], [0b0000_0001]);
    assert.equal(loaded.stitchedCount, 1);
  });

  it('does not modify the file bytes', async () => {
    const pattern = threeByTwoPattern();
    const bytes = await encodeProgressFile(fileInput(progressWith(pattern, [0, 4])));
    const copy = bytes.slice();
    await decodeProgressFile(bytes, pattern);
    assert.deepEqual(bytes, copy);
  });
});

// Asserts that promise rejects with a ProgressFileError of the reason (and the extra fields).
async function assertProgressFileError(promise, reason, fields = {}) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof ProgressFileError, `expected ProgressFileError, got ${error}`);
    assert.ok(error instanceof Error);
    assert.equal(error.reason, reason);
    for (const [name, value] of Object.entries(fields)) {
      assert.equal(error[name], value, name);
    }
    return true;
  });
}

// A valid file of the 3 × 2 pattern with cells 0 and 4 stitched.
async function validThreeByTwoFile(pattern) {
  return encodeProgressFile(fileInput(progressWith(pattern, [0, 4])));
}

describe('decodeProgressFile errors', () => {
  it('refuses files shorter than the header', async () => {
    await assertProgressFileError(decodeProgressFile(new Uint8Array(29), threeByTwoPattern()), 'not-progress-file');
  });

  it('refuses files without the magic, such as a text file', async () => {
    const notes = new TextEncoder().encode('Buy more floss: 310, 321, BLANC. Start the border on Sunday.');
    await assertProgressFileError(decodeProgressFile(notes, threeByTwoPattern()), 'not-progress-file');
  });

  it('refuses files over MAX_PROGRESS_FILE_BYTES, even with a valid header', async () => {
    const pattern = threeByTwoPattern();
    const huge = new Uint8Array(MAX_PROGRESS_FILE_BYTES + 1);
    huge.set(await validThreeByTwoFile(pattern));
    await assertProgressFileError(decodeProgressFile(huge, pattern), 'not-progress-file');
  });

  it('tells a newer format version from a damaged one', async () => {
    const pattern = threeByTwoPattern();
    const data = await compressBytes(Uint8Array.of(0x11), 'deflate');
    const header = { width: 3, height: 2, fingerprint: pattern.fingerprint, data };
    await assertProgressFileError(decodeProgressFile(handMadeFile({ ...header, version: 2 }), pattern), 'newer-version');
    await assertProgressFileError(decodeProgressFile(handMadeFile({ ...header, version: 0 }), pattern), 'damaged');
  });

  it('refuses a file of another size and names that size', async () => {
    const pattern = solidPattern(100, 67);
    const data = await compressBytes(new Uint8Array(1200), 'deflate');
    const bytes = handMadeFile({ width: 120, height: 80, fingerprint: pattern.fingerprint, data });
    await assertProgressFileError(decodeProgressFile(bytes, pattern), 'other-pattern', { fileWidth: 120, fileHeight: 80 });
  });

  it('refuses a file of the same size with another fingerprint', async () => {
    const pattern = threeByTwoPattern();
    const data = await compressBytes(Uint8Array.of(0x11), 'deflate');
    const bytes = handMadeFile({ width: 3, height: 2, fingerprint: '0123456789abcd', data });
    await assertProgressFileError(decodeProgressFile(bytes, pattern), 'other-pattern', { fileWidth: 3, fileHeight: 2 });
  });

  it('reports a cut-short stream as damaged', async () => {
    const pattern = threeByTwoPattern();
    const bytes = await validThreeByTwoFile(pattern);
    await assertProgressFileError(decodeProgressFile(bytes.subarray(0, bytes.length - 3), pattern), 'damaged');
  });

  it('reports junk bytes after the stream as damaged', async () => {
    const pattern = threeByTwoPattern();
    const bytes = await validThreeByTwoFile(pattern);
    const withJunk = new Uint8Array(bytes.length + 2);
    withJunk.set(bytes);
    withJunk.set([0xde, 0xad], bytes.length);
    await assertProgressFileError(decodeProgressFile(withJunk, pattern), 'damaged');
  });

  it('reports bits one byte short as damaged', async () => {
    const pattern = threeByTwoPattern();
    const data = await compressBytes(new Uint8Array(0), 'deflate');
    const bytes = handMadeFile({ width: 3, height: 2, fingerprint: pattern.fingerprint, data });
    await assertProgressFileError(decodeProgressFile(bytes, pattern), 'damaged');
  });

  it('stops a stream that would inflate to 10 MB as damaged, quickly', async () => {
    const pattern = threeByTwoPattern();
    const data = await compressBytes(new Uint8Array(10 * 1024 * 1024), 'deflate');
    const bytes = handMadeFile({ width: 3, height: 2, fingerprint: pattern.fingerprint, data });
    const started = performance.now();
    await assertProgressFileError(decodeProgressFile(bytes, pattern), 'damaged');
    assert.ok(performance.now() - started < 1000, 'stopped by the length guard');
  });
});

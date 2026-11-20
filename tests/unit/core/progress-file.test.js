// Unit tests for src/core/progress-file.js (see the requirements "The .stitch file format" and
// "Loading a progress file checks it first" in openspec/specs/stitch-progress/spec.md).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../../src/core/pattern.js';
import { createProgress, toggleStitch, toSavedProgress } from '../../../src/core/progress.js';
import { decompressBytes } from '../../../src/core/compression.js';
import {
  PROGRESS_FILE_EXTENSION,
  PROGRESS_FILE_FORMAT,
  MAX_PROGRESS_FILE_BYTES,
  encodeProgressFile,
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

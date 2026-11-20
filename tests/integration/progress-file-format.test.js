// Export format: a pattern from the real pipeline → marks → .stitch file → a second generation
// of the same input gets the same marks back; other settings refuse the file
// (openspec/specs/stitch-progress/spec.md, "The .stitch file format" and the loading checks).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePattern } from '../../src/core/pattern-generator.js';
import { createProgress, toggleStitch, isStitched } from '../../src/core/progress.js';
import { encodeProgressFile, decodeProgressFile, ProgressFileError } from '../../src/core/progress-file.js';
import { opaqueImageFrom } from '../helpers/pixel-image.js';

const gradient = () => opaqueImageFrom(64, 64, (x, y) => [4 * x, 4 * y, 128]);
const SETTINGS = { targetWidth: 40, maxColors: 12 };
const MARKED_CELLS = [0, 39, 41, 400, 1599];

async function savedFileOf(pattern) {
  let progress = createProgress(pattern);
  for (const cellIndex of MARKED_CELLS) {
    progress = toggleStitch(progress, cellIndex);
  }
  const { fingerprint, width, height } = pattern;
  return encodeProgressFile({ fingerprint, width, height, bits: progress.bits });
}

describe('.stitch file with the real pipeline', () => {
  it('brings the marks back on a second generation of the same image and settings', async () => {
    const bytes = await savedFileOf(generatePattern(gradient(), SETTINGS));
    const again = generatePattern(gradient(), SETTINGS);
    const loaded = await decodeProgressFile(bytes, again);
    assert.equal(loaded.pattern, again);
    assert.equal(loaded.stitchedCount, MARKED_CELLS.length);
    for (const cellIndex of MARKED_CELLS) {
      assert.ok(isStitched(loaded, cellIndex), `cell ${cellIndex}`);
    }
  });

  it('refuses the file for another max colors', async () => {
    const bytes = await savedFileOf(generatePattern(gradient(), SETTINGS));
    const other = generatePattern(gradient(), { ...SETTINGS, maxColors: 6 });
    assert.equal(other.width, 40);
    await assert.rejects(decodeProgressFile(bytes, other), (error) => {
      assert.ok(error instanceof ProgressFileError);
      assert.equal(error.reason, 'other-pattern');
      return true;
    });
  });
});

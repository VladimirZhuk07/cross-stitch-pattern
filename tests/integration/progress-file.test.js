// Drives src/ui/progress-file.js with the real store and codec, a fake download, a fake Export
// menu, a fake warning and a fake persistence (see openspec/specs/stitch-progress/spec.md,
// "Progress can be saved as a .stitch file" and the requirements after it).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPattern } from '../../src/core/pattern.js';
import { createProgress, toggleStitch, toSavedProgress, isStitched } from '../../src/core/progress.js';
import { decodeProgressFile } from '../../src/core/progress-file.js';
import { createStore } from '../../src/ui/store.js';
import { createInitialState } from '../../src/ui/app-state.js';
import { createProgressFileSaver } from '../../src/ui/progress-file.js';

// Test fixtures, not palette data (same as the pattern-model spec).
const BLACK = { code: '310', name: 'Black', hex: '#000000' };
const RED = { code: '321', name: 'Red', hex: '#C72B3B' };

function threeByTwoPattern() {
  return buildPattern({ width: 3, height: 2, cells: [0, 1, 1, -1, 1, 0], colors: [RED, BLACK] });
}

function otherPattern() {
  return buildPattern({ width: 2, height: 2, cells: [0, 0, 0, 0], colors: [BLACK] });
}

function progressWith(pattern, cellIndexes) {
  let progress = createProgress(pattern);
  for (const cellIndex of cellIndexes) {
    progress = toggleStitch(progress, cellIndex);
  }
  return progress;
}

// A download stand-in that records { bytes, fileName }.
function fakeDownload() {
  const files = [];
  const download = (bytes, fileName) => {
    files.push({ bytes, fileName });
  };
  return { files, download };
}

function storeWith(pattern, cellIndexes, fileName = 'cat.png') {
  return createStore({
    ...createInitialState(),
    image: { fileName },
    pattern,
    progress: progressWith(pattern, cellIndexes),
  });
}

describe('progress file saver', () => {
  it('saves the current progress as cat.stitch for cat.png', async () => {
    const pattern = threeByTwoPattern();
    const { files, download } = fakeDownload();
    const saver = createProgressFileSaver(storeWith(pattern, [0, 4]), download);
    assert.equal(await saver.saveCurrent(), 'cat.stitch');
    assert.equal(files.length, 1);
    assert.equal(files[0].fileName, 'cat.stitch');
    const loaded = await decodeProgressFile(files[0].bytes, pattern);
    assert.equal(loaded.stitchedCount, 2);
    assert.ok(isStitched(loaded, 0) && isStitched(loaded, 4));
  });

  it('names the file after the image', async () => {
    const pattern = threeByTwoPattern();
    for (const [imageName, fileName] of [['IMG_0042.JPG', 'IMG_0042.stitch'], ['cat.photo.png', 'cat.photo.stitch'], ['.png', 'pattern.stitch']]) {
      const { files, download } = fakeDownload();
      await createProgressFileSaver(storeWith(pattern, [0], imageName), download).saveCurrent();
      assert.equal(files[0].fileName, fileName);
    }
  });

  it('saves a record of the browser storage under its image name', async () => {
    const other = otherPattern();
    const { files, download } = fakeDownload();
    const saver = createProgressFileSaver(storeWith(threeByTwoPattern(), []), download);
    const record = toSavedProgress(progressWith(other, [0, 3]), 'dog.png', 1);
    assert.equal(await saver.saveRecord(record), 'dog.stitch');
    assert.equal(files[0].fileName, 'dog.stitch');
    assert.equal((await decodeProgressFile(files[0].bytes, other)).stitchedCount, 2);
    assert.equal(await saver.saveRecord({ ...record, imageName: '' }), 'pattern.stitch');
  });
});

// Unit tests for src/core/file-names.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FALLBACK_BASE_NAME, baseFileName, exportFileName } from '../../../src/core/file-names.js';

describe('baseFileName', () => {
  it('drops the last extension only', () => {
    assert.equal(baseFileName('cat.png'), 'cat');
    assert.equal(baseFileName('cat.photo.png'), 'cat.photo');
    assert.equal(baseFileName('cat'), 'cat');
  });

  it('falls back to "pattern" for names without a base', () => {
    assert.equal(FALLBACK_BASE_NAME, 'pattern');
    for (const name of ['', '.png', '  .jpg']) {
      assert.equal(baseFileName(name), 'pattern', JSON.stringify(name));
    }
  });
});

describe('exportFileName', () => {
  it('puts the extension on the base name', () => {
    assert.equal(exportFileName('cat.png', 'pdf'), 'cat.pdf');
    assert.equal(exportFileName('IMG_0042.JPG', 'xlsx'), 'IMG_0042.xlsx');
    assert.equal(exportFileName('.png', 'stitch'), 'pattern.stitch');
  });
});

// Pipeline: synthetic RGBA buffer → stitch grid → k-means → DMC (full bundled palette) →
// Pattern. Expected DMC codes come from the bundled palette (src/data/dmc.js).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generatePattern } from '../../src/core/pattern-generator.js';
import { OPAQUE_BLACK, OPAQUE_WHITE, TRANSPARENT, opaqueImageFrom, pixelImage, solidImage } from '../helpers/pixel-image.js';

function legendSummary(pattern) {
  return pattern.legend.map((entry) => [entry.code, entry.stitchCount]);
}

const blackOverWhite = () => pixelImage(2, 2, [OPAQUE_BLACK, OPAQUE_BLACK, OPAQUE_WHITE, OPAQUE_WHITE]);
const gradient = () => opaqueImageFrom(64, 64, (x, y) => [4 * x, 4 * y, 128]);

describe('pattern pipeline with the DMC palette', () => {
  it('maps a black image to DMC 310', () => {
    const pattern = generatePattern(solidImage(2, 2, OPAQUE_BLACK), { targetWidth: 2, maxColors: 24 });
    assert.deepEqual(legendSummary(pattern), [['310', 4]]);
  });

  it('keeps black and white apart when enough colors are allowed', () => {
    const pattern = generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 24 });
    assert.deepEqual(legendSummary(pattern), [['310', 2], ['B5200', 2]]);
    assert.deepEqual([...pattern.cells], [0, 0, 1, 1]);
  });

  it('merges black and white into one grey when only one color is allowed', () => {
    const pattern = generatePattern(blackOverWhite(), { targetWidth: 2, maxColors: 1 });
    assert.deepEqual(legendSummary(pattern), [['317', 4]]);
    assert.equal(pattern.legend[0].name, 'Pewter Gray');
  });

  it('averages black and white in linear light to DMC 03, not to the sRGB midpoint 169', () => {
    const pattern = generatePattern(pixelImage(2, 1, [OPAQUE_BLACK, OPAQUE_WHITE]), { targetWidth: 1, maxColors: 24 });
    assert.deepEqual(legendSummary(pattern), [['03', 1]]);
    assert.equal(pattern.legend[0].name, 'Tin Medium');
  });

  it('keeps an exact DMC color with its full legend entry', () => {
    const pattern = generatePattern(solidImage(1, 1, [199, 43, 59, 255]), { targetWidth: 1, maxColors: 24 });
    assert.deepEqual(pattern.legend, [{ number: 1, code: '321', name: 'Red', hex: '#C72B3B', stitchCount: 1 }]);
  });

  it('maps pure red, which DMC does not have, to 606 Orange Red Bright', () => {
    const pattern = generatePattern(solidImage(1, 1, [255, 0, 0, 255]), { targetWidth: 1, maxColors: 24 });
    assert.deepEqual(legendSummary(pattern), [['606', 1]]);
    assert.equal(pattern.legend[0].hex, '#FA3203');
  });

  it('does not let a transparent pixel darken its cell', () => {
    const pattern = generatePattern(pixelImage(2, 1, [[199, 43, 59, 255], TRANSPARENT]), { targetWidth: 1, maxColors: 24 });
    assert.deepEqual(legendSummary(pattern), [['321', 1]]);
  });

  it('merges clusters that land on the same DMC code', () => {
    const pattern = generatePattern(pixelImage(2, 1, [OPAQUE_BLACK, [5, 5, 5, 255]]), { targetWidth: 2, maxColors: 2 });
    assert.deepEqual(legendSummary(pattern), [['310', 2]]);
    assert.deepEqual([...pattern.cells], [0, 0]);
  });

  it('spreads a 1 × 1 image over a larger grid', () => {
    const pattern = generatePattern(solidImage(1, 1, OPAQUE_BLACK), { targetWidth: 3, maxColors: 24 });
    assert.equal(pattern.width, 3);
    assert.equal(pattern.height, 3);
    assert.deepEqual(legendSummary(pattern), [['310', 9]]);
  });

  it('accepts the largest width that fits a tall image', () => {
    const pattern = generatePattern(solidImage(41, 2048, OPAQUE_BLACK), { targetWidth: 10, maxColors: 24 });
    assert.equal(pattern.width, 10);
    assert.equal(pattern.height, 500);
  });

  it('keeps a gradient within the color limit', () => {
    const pattern = generatePattern(gradient(), { targetWidth: 32, maxColors: 8 });
    assert.equal(pattern.width, 32);
    assert.equal(pattern.height, 32);
    assert.ok(pattern.legend.length >= 1 && pattern.legend.length <= 8, `got ${pattern.legend.length} colors`);
    const total = pattern.legend.reduce((sum, entry) => sum + entry.stitchCount, 0);
    assert.equal(total, 1024);
  });

  it('gives the same gradient pattern on every run', () => {
    const first = generatePattern(gradient(), { targetWidth: 32, maxColors: 8 });
    const second = generatePattern(gradient(), { targetWidth: 32, maxColors: 8 });
    assert.deepEqual(first, second);
  });

  it('builds an empty pattern from a fully transparent image', () => {
    const pattern = generatePattern(solidImage(4, 4, TRANSPARENT), { targetWidth: 2, maxColors: 24 });
    assert.deepEqual([...pattern.cells], [-1, -1, -1, -1]);
    assert.deepEqual(pattern.legend, []);
  });
});

// Unit tests for src/core/pdf-pictures.js. JPEG headers are hand-made bytes, not image files.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PICTURE_SIDE,
  dmcPictureScale,
  dmcPictureSize,
  pictureSize,
  readJpegInfo,
} from '../../../src/core/pdf-pictures.js';

// SOI, an APP0 (JFIF) segment, then a start-of-frame segment with the given marker, size and
// component count, then a few bytes of scan data.
function jpegHeader({ sof = 0xc0, width = 1200, height = 804, components = 3, hasSoi = true } = {}) {
  const soi = hasSoi ? [0xff, 0xd8] : [];
  const app0 = [0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const frameLength = 8 + 3 * components;
  const frame = [0xff, sof, 0x00, frameLength, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, components];
  for (let index = 0; index < components; index++) {
    frame.push(index + 1, 0x11, 0x00);
  }
  return Uint8Array.from([...soi, ...app0, ...frame, 0xff, 0xda, 0x00, 0x02, 0x12, 0x34]);
}

describe('readJpegInfo', () => {
  it('reads width, height and components of a baseline JPEG', () => {
    assert.deepEqual(readJpegInfo(jpegHeader()), { width: 1200, height: 804, components: 3 });
  });

  it('reads a progressive JPEG (SOF2)', () => {
    assert.deepEqual(readJpegInfo(jpegHeader({ sof: 0xc2, width: 900, height: 1200 })), {
      width: 900,
      height: 1200,
      components: 3,
    });
  });

  it('reads a grayscale JPEG', () => {
    assert.equal(readJpegInfo(jpegHeader({ components: 1 })).components, 1);
  });

  it('rejects bytes without the SOI marker', () => {
    assert.throws(() => readJpegInfo(jpegHeader({ hasSoi: false })), TypeError);
  });

  it('rejects 4 components (CMYK)', () => {
    assert.throws(() => readJpegInfo(jpegHeader({ components: 4 })), /components/);
    assert.throws(() => readJpegInfo(jpegHeader({ components: 4 })), TypeError);
  });

  it('rejects lossless and arithmetic-coded JPEGs', () => {
    assert.throws(() => readJpegInfo(jpegHeader({ sof: 0xc3 })), TypeError);
    assert.throws(() => readJpegInfo(jpegHeader({ sof: 0xc9 })), TypeError);
  });

  it('rejects data that ends before a frame header', () => {
    assert.throws(() => readJpegInfo(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00])), TypeError);
    assert.throws(() => readJpegInfo(new Uint8Array(0)), TypeError);
  });
});

describe('pictureSize', () => {
  it('caps the long side at 1200 px', () => {
    assert.equal(MAX_PICTURE_SIDE, 1200);
    assert.deepEqual(pictureSize(4000, 3000), { width: 1200, height: 900 });
    assert.deepEqual(pictureSize(3000, 4000), { width: 900, height: 1200 });
  });

  it('never enlarges a smaller picture', () => {
    assert.deepEqual(pictureSize(800, 600), { width: 800, height: 600 });
  });

  it('rounds and keeps at least 1 px', () => {
    assert.deepEqual(pictureSize(4096, 1000), { width: 1200, height: 293 });
    assert.deepEqual(pictureSize(4096, 1), { width: 1200, height: 1 });
  });
});

describe('dmcPictureScale and dmcPictureSize', () => {
  it('gives 12 px per stitch for 100 × 67 stitches (1200 × 804 px)', () => {
    assert.equal(dmcPictureScale({ width: 100, height: 67 }), 12);
    assert.deepEqual(dmcPictureSize({ width: 100, height: 67 }), { width: 1200, height: 804 });
  });

  it('gives 400 px per stitch for 3 × 2 stitches', () => {
    assert.equal(dmcPictureScale({ width: 3, height: 2 }), 400);
    assert.deepEqual(dmcPictureSize({ width: 3, height: 2 }), { width: 1200, height: 800 });
  });

  it('gives 1 and scales down a pattern larger than 1200 stitches', () => {
    assert.equal(dmcPictureScale({ width: 2000, height: 1600 }), 1);
    assert.deepEqual(dmcPictureSize({ width: 2000, height: 1600 }), { width: 1200, height: 960 });
  });

  it('keeps a pattern of exactly 1200 stitches at 1 px per stitch', () => {
    assert.equal(dmcPictureScale({ width: 1200, height: 10 }), 1);
    assert.deepEqual(dmcPictureSize({ width: 1200, height: 10 }), { width: 1200, height: 10 });
  });
});

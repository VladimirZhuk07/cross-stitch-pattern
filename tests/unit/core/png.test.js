// Unit tests for src/core/png.js (openspec/changes/add-pwa-install/design.md, D2).
// Chunk layout and CRC: PNG specification (W3C, 2nd edition), sections 5.2–5.4 and annex D.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';
import { encodePng, readPngHeader } from '../../../src/core/png.js';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

// Two pixels in one row: red, then a blue-ish grey.
const TWO_BY_ONE = { width: 2, height: 1, rgb: Uint8Array.from([255, 0, 0, 10, 20, 30]) };

// Splits a PNG file into its chunks: { type, data, crc, typeAndData }.
function readChunks(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks = [];
  let offset = SIGNATURE.length;
  while (offset < bytes.length) {
    const length = view.getUint32(offset);
    const typeAndData = bytes.subarray(offset + 4, offset + 8 + length);
    chunks.push({
      type: new TextDecoder().decode(typeAndData.subarray(0, 4)),
      data: typeAndData.subarray(4),
      crc: view.getUint32(offset + 8 + length),
      typeAndData,
    });
    offset += 12 + length;
  }
  return chunks;
}

describe('encodePng', () => {
  it('starts with the PNG signature', async () => {
    const png = await encodePng(TWO_BY_ONE);
    assert.deepEqual([...png.subarray(0, 8)], SIGNATURE);
  });

  it('writes IHDR first: 2 × 1, bit depth 8, color type 2, compression, filter and interlace 0', async () => {
    const chunks = readChunks(await encodePng(TWO_BY_ONE));
    assert.equal(chunks[0].type, 'IHDR');
    assert.deepEqual([...chunks[0].data], [0, 0, 0, 2, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  });

  it('writes the chunks IHDR, IDAT, IEND in that order', async () => {
    const chunks = readChunks(await encodePng(TWO_BY_ONE));
    assert.deepEqual(chunks.map((chunk) => chunk.type), ['IHDR', 'IDAT', 'IEND']);
    assert.equal(chunks[2].data.length, 0);
  });

  it('stores each row as filter byte 0 followed by its RGB pixels, zlib compressed', async () => {
    const idat = readChunks(await encodePng(TWO_BY_ONE))[1];
    assert.deepEqual([...zlib.inflateSync(idat.data)], [0, 255, 0, 0, 10, 20, 30]);
  });

  it('gives every chunk the CRC-32 of its type and data', async () => {
    for (const chunk of readChunks(await encodePng(TWO_BY_ONE))) {
      assert.equal(chunk.crc, zlib.crc32(chunk.typeAndData), chunk.type);
    }
  });

  it('ends with the fixed IEND CRC 0xAE426082', async () => {
    const chunks = readChunks(await encodePng(TWO_BY_ONE));
    assert.equal(chunks[2].crc, 0xae426082);
  });

  it('encodes several rows, each with its own filter byte', async () => {
    const image = { width: 1, height: 2, rgb: Uint8Array.from([1, 2, 3, 4, 5, 6]) };
    const idat = readChunks(await encodePng(image))[1];
    assert.deepEqual([...zlib.inflateSync(idat.data)], [0, 1, 2, 3, 0, 4, 5, 6]);
  });

  it('rejects with a RangeError when rgb does not hold width × height × 3 bytes', async () => {
    const image = { width: 2, height: 2, rgb: new Uint8Array(6) };
    await assert.rejects(encodePng(image), (error) => {
      assert.ok(error instanceof RangeError, String(error));
      assert.ok(error.message.includes('12'), error.message);
      assert.ok(error.message.includes('6'), error.message);
      return true;
    });
  });
});

describe('readPngHeader', () => {
  it('reads width, height, bit depth and color type back from an encoded PNG', async () => {
    const png = await encodePng({ width: 3, height: 2, rgb: new Uint8Array(18) });
    assert.deepEqual(readPngHeader(png), { width: 3, height: 2, bitDepth: 8, colorType: 2 });
  });

  it('throws for bytes that do not start with the PNG signature', () => {
    const bytes = new Uint8Array(33);
    bytes.set([0xff, 0xd8, 0xff]); // a JPEG start
    assertThrowsWith(() => readPngHeader(bytes), TypeError, 'signature');
  });

  it('throws when the first chunk is not IHDR', async () => {
    const png = await encodePng(TWO_BY_ONE);
    png.set(new TextEncoder().encode('IDAT'), 12);
    assertThrowsWith(() => readPngHeader(png), TypeError, 'IHDR', 'IDAT');
  });

  it('throws for a file too short to hold the header', () => {
    assertThrowsWith(() => readPngHeader(Uint8Array.from(SIGNATURE)), TypeError, 'short');
  });
});

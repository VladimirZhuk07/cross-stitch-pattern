// Unit tests for src/core/compression.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync, inflateRawSync } from 'node:zlib';
import { COMPRESSION_FORMATS, canCompress, compressBytes, decompressBytes } from '../../../src/core/compression.js';

const TEXT = new TextEncoder().encode('cross stitch '.repeat(200));

describe('compression', () => {
  it('knows its formats and that Node can compress', () => {
    assert.deepEqual([...COMPRESSION_FORMATS], ['deflate', 'deflate-raw']);
    assert.equal(canCompress(), true);
  });

  it('round-trips both formats and really compresses', async () => {
    for (const format of COMPRESSION_FORMATS) {
      const packed = await compressBytes(TEXT, format);
      assert.ok(packed.length < TEXT.length / 4, `${format}: ${packed.length} bytes`);
      assert.deepEqual(await decompressBytes(packed, format), TEXT);
    }
  });

  it('writes zlib for deflate and raw deflate for deflate-raw (readable by node:zlib)', async () => {
    const zlib = await compressBytes(TEXT, 'deflate');
    assert.equal(zlib[0], 0x78, 'zlib header');
    const raw = await compressBytes(TEXT, 'deflate-raw');
    assert.deepEqual(new Uint8Array(inflateRawSync(raw)), TEXT);
  });

  it('reads zlib data written by node:zlib', async () => {
    assert.deepEqual(await decompressBytes(new Uint8Array(deflateSync(TEXT)), 'deflate'), TEXT);
  });

  it('stops at maxLength', async () => {
    const packed = await compressBytes(TEXT, 'deflate');
    await assert.rejects(decompressBytes(packed, 'deflate', 100), RangeError);
    assert.equal((await decompressBytes(packed, 'deflate', TEXT.length)).length, TEXT.length);
  });

  it('rejects damaged data and unknown formats', async () => {
    const packed = await compressBytes(TEXT, 'deflate');
    packed[packed.length - 1] ^= 0xff; // break the Adler-32 checksum
    await assert.rejects(decompressBytes(packed, 'deflate'));
    await assert.rejects(compressBytes(TEXT, 'gzip'), RangeError);
  });

  it('handles empty input', async () => {
    for (const format of COMPRESSION_FORMATS) {
      assert.equal((await decompressBytes(await compressBytes(new Uint8Array(0), format), format)).length, 0);
    }
  });
});

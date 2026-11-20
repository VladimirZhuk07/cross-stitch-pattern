// Unit tests for src/core/zip.js (PKWARE APPNOTE 6.3.x, §4.3: local file headers, central
// directory, end of central directory record).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { zipArchive } from '../../../src/core/zip.js';
import { assertThrowsWith } from '../../helpers/assert-throws-with.js';

const ascii = (text) => new TextEncoder().encode(text);

// CRC-32 of 'hi' (checked with node:zlib's crc32): 0xD8932AAC, little-endian AC 2A 93 D8.
const CRC_OF_HI = 0xd8932aac;
const CRC_BYTES = [0xac, 0x2a, 0x93, 0xd8];
const NAME_BYTES = [...ascii('a.txt')];
const DATA_BYTES = [...ascii('hi')];

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true);
}

function storedEntry(name, text) {
  const data = ascii(text);
  return { name, method: 0, crc: 0, size: data.length, data };
}

describe('zipArchive', () => {
  it('writes one stored entry byte for byte', () => {
    const archive = zipArchive([{ name: 'a.txt', method: 0, crc: CRC_OF_HI, size: 2, data: ascii('hi') }]);
    const expected = [
      // local file header
      0x50, 0x4b, 0x03, 0x04, // signature
      20, 0, // version needed to extract: 2.0
      0, 0, // flags
      0, 0, // method: stored
      0, 0, // time 00:00:00
      0x21, 0x00, // date 1980-01-01
      ...CRC_BYTES,
      2, 0, 0, 0, // compressed size
      2, 0, 0, 0, // uncompressed size
      5, 0, // name length
      0, 0, // extra field length
      ...NAME_BYTES,
      ...DATA_BYTES,
      // central directory file header, at offset 37
      0x50, 0x4b, 0x01, 0x02, // signature
      20, 0, // version made by: 2.0, MS-DOS attributes
      20, 0, // version needed
      0, 0, // flags
      0, 0, // method
      0, 0, // time
      0x21, 0x00, // date
      ...CRC_BYTES,
      2, 0, 0, 0,
      2, 0, 0, 0,
      5, 0, // name length
      0, 0, // extra field length
      0, 0, // comment length
      0, 0, // disk number start
      0, 0, // internal attributes
      0, 0, 0, 0, // external attributes
      0, 0, 0, 0, // offset of the local header
      ...NAME_BYTES,
      // end of central directory record, at offset 88
      0x50, 0x4b, 0x05, 0x06, // signature
      0, 0, // number of this disk
      0, 0, // disk with the central directory
      1, 0, // entries on this disk
      1, 0, // entries in total
      51, 0, 0, 0, // size of the central directory
      37, 0, 0, 0, // offset of the central directory
      0, 0, // comment length
    ];
    assert.deepEqual([...archive], expected);
  });

  it('places the second local header right after the first entry', () => {
    const archive = zipArchive([storedEntry('a.txt', 'hi'), storedEntry('bb.xml', 'abc')]);
    const secondHeader = 30 + 'a.txt'.length + 2;
    assert.equal(readUint32(archive, secondHeader), 0x04034b50);
    const centralStart = secondHeader + 30 + 'bb.xml'.length + 3;
    const secondCentral = centralStart + 46 + 'a.txt'.length;
    assert.equal(readUint32(archive, secondCentral), 0x02014b50);
    assert.equal(readUint32(archive, secondCentral + 42), secondHeader, 'local header offset in the central directory');
    const end = archive.length - 22;
    assert.equal(readUint32(archive, end + 12), end - centralStart, 'central directory size');
    assert.equal(readUint32(archive, end + 16), centralStart, 'central directory offset');
  });

  it('keeps the uncompressed size of a deflated entry apart from its data length', () => {
    const archive = zipArchive([{ name: 'big.xml', method: 8, crc: 1, size: 1000, data: new Uint8Array(7) }]);
    assert.equal(archive[8], 8, 'method');
    assert.equal(readUint32(archive, 18), 7, 'compressed size');
    assert.equal(readUint32(archive, 22), 1000, 'uncompressed size');
  });

  it('rejects empty, absolute and non-ASCII names with TypeError', () => {
    for (const name of ['', '/a.xml', 'ä.xml']) {
      assertThrowsWith(() => zipArchive([storedEntry(name, 'x')]), TypeError, JSON.stringify(name));
    }
  });

  it('rejects 65,536 entries (no ZIP64)', () => {
    const entries = Array.from({ length: 65536 }, (_, index) => storedEntry(`f${index}`, ''));
    assertThrowsWith(() => zipArchive(entries), RangeError, '65536');
  });

  it('rejects an entry of 4 GiB (no ZIP64)', () => {
    const entry = { name: 'huge.xml', method: 8, crc: 0, size: 2 ** 32, data: new Uint8Array(1) };
    assertThrowsWith(() => zipArchive([entry]), RangeError, 'huge.xml', String(2 ** 32));
  });
});

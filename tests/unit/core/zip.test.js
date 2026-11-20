// Unit tests for src/core/zip.js (PKWARE APPNOTE 6.3.x, §4.3: local file headers, central
// directory, end of central directory record).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { zipArchive, buildZip } from '../../../src/core/zip.js';
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

// Reads the local file headers of an archive written by zipArchive (no data descriptors), in
// order: [{ name, method, crc, size, data }].
function readLocalEntries(archive) {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const entries = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true);
    const crc = view.getUint32(offset + 14, true);
    const storedSize = view.getUint32(offset + 18, true);
    const size = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const nameStart = offset + 30;
    const name = new TextDecoder().decode(archive.subarray(nameStart, nameStart + nameLength));
    const data = archive.subarray(nameStart + nameLength, nameStart + nameLength + storedSize);
    entries.push({ name, method, crc, size, data });
    offset = nameStart + nameLength + storedSize;
  }
  return entries;
}

const XML_TEXT = '<?xml version="1.0"?><a>' + '<b>Größe × 2</b>'.repeat(50) + '</a>';

describe('buildZip', () => {
  it('encodes string chunks as UTF-8 and records their CRC and size', async () => {
    const archive = await buildZip([{ name: 'a.xml', content: ['<a>', 'Größe', '</a>'], shouldCompress: false }]);
    const [entry] = readLocalEntries(archive);
    const expected = ascii('<a>Größe</a>');
    assert.equal(entry.method, 0);
    assert.equal(entry.size, expected.length);
    assert.equal(entry.crc, zlib.crc32(expected));
    assert.deepEqual(entry.data, expected);
  });

  it('deflates entries marked shouldCompress by default, readable by node:zlib', async () => {
    const archive = await buildZip([{ name: 'xl/sheet.xml', content: [XML_TEXT], shouldCompress: true }]);
    const [entry] = readLocalEntries(archive);
    assert.equal(entry.method, 8);
    assert.ok(entry.data.length < entry.size / 4, `deflated to ${entry.data.length} of ${entry.size} bytes`);
    assert.deepEqual(new Uint8Array(zlib.inflateRawSync(entry.data)), ascii(XML_TEXT));
    assert.equal(entry.crc, zlib.crc32(ascii(XML_TEXT)));
  });

  it('stores every entry when useCompression is false', async () => {
    const files = [
      { name: 'a.xml', content: [XML_TEXT], shouldCompress: true },
      { name: 'b.xml', content: ['<b/>'], shouldCompress: true },
    ];
    const entries = readLocalEntries(await buildZip(files, { useCompression: false }));
    assert.deepEqual(entries.map((entry) => entry.method), [0, 0]);
    assert.deepEqual(entries[0].data, ascii(XML_TEXT));
  });

  it('stores Uint8Array content unchanged when shouldCompress is false', async () => {
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 7]);
    const [entry] = readLocalEntries(await buildZip([{ name: 'xl/media/image1.png', content: png, shouldCompress: false }]));
    assert.equal(entry.method, 0);
    assert.deepEqual(entry.data, png);
    assert.equal(entry.crc, zlib.crc32(png));
  });

  it('gives byte-identical archives for the same files', async () => {
    const files = () => [
      { name: 'a.xml', content: [XML_TEXT], shouldCompress: true },
      { name: 'b.png', content: Uint8Array.from([1, 2, 3]), shouldCompress: false },
    ];
    assert.deepEqual(await buildZip(files()), await buildZip(files()));
  });
});

// Reads the ZIP archives written by src/core/zip.js, for the Excel export tests. Independent of the
// writer: inflates with node:zlib and checks every CRC with zlib.crc32 (Node 22.2+), not with
// src/core/crc32.js. Supports what a plain ZIP without ZIP64 needs (PKWARE APPNOTE 6.3.x, §4.3).

import zlib from 'node:zlib';

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const END_OF_CENTRAL_DIRECTORY_LENGTH = 22;

/**
 * Unzips archive (a Uint8Array). Checks that the end record, the central directory and every
 * local header agree, that each entry inflates to its recorded size and that its CRC-32 matches.
 * Returns { files: Map<name, Uint8Array>, methods: Map<name, 0 | 8> }, in archive order.
 * Throws an Error naming the entry and the field that is wrong.
 */
export function unzip(archive) {
  if (typeof zlib.crc32 !== 'function') {
    throw new Error('zlib.crc32 is missing: the ZIP checks need Node.js 22.2 or later');
  }
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const end = archive.length - END_OF_CENTRAL_DIRECTORY_LENGTH;
  expect(view.getUint32(end, true) === END_OF_CENTRAL_DIRECTORY_SIGNATURE, 'end of central directory record not found (no archive comment expected)');
  const entryCount = view.getUint16(end + 10, true);
  expect(view.getUint16(end + 8, true) === entryCount, 'entries on this disk differ from the total');
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  expect(centralOffset + centralSize === end, `central directory ends at ${centralOffset + centralSize}, the end record starts at ${end}`);

  const files = new Map();
  const methods = new Map();
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    expect(view.getUint32(offset, true) === CENTRAL_HEADER_SIGNATURE, `central header ${index} has a wrong signature`);
    const central = readCommonFields(view, archive, offset + 6, offset + 46);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    offset = central.nameEnd + extraLength + commentLength;

    expect(view.getUint32(localOffset, true) === LOCAL_HEADER_SIGNATURE, `${central.name}: local header has a wrong signature`);
    const local = readCommonFields(view, archive, localOffset + 4, localOffset + 30);
    for (const field of ['version', 'flags', 'method', 'time', 'date', 'crc', 'storedSize', 'size', 'name']) {
      expect(local[field] === central[field], `${central.name}: local ${field} ${local[field]} differs from central ${central[field]}`);
    }
    const dataStart = local.nameEnd + local.extraLength;
    const stored = archive.subarray(dataStart, dataStart + local.storedSize);
    const bytes = readData(central, stored);
    expect(!files.has(central.name), `${central.name} appears twice`);
    files.set(central.name, bytes);
    methods.set(central.name, central.method);
  }
  expect(offset === end, 'central directory size does not match its headers');
  return { files, methods };
}

function readData(entry, stored) {
  let bytes;
  if (entry.method === 0) {
    bytes = stored;
  } else if (entry.method === 8) {
    bytes = new Uint8Array(zlib.inflateRawSync(stored));
  } else {
    throw new Error(`${entry.name}: unsupported method ${entry.method}`);
  }
  expect(bytes.length === entry.size, `${entry.name}: size ${bytes.length}, recorded ${entry.size}`);
  const crc = zlib.crc32(bytes);
  expect(crc === entry.crc, `${entry.name}: CRC-32 ${crc.toString(16)}, recorded ${entry.crc.toString(16)}`);
  return bytes;
}

// The fields shared by local and central headers, starting at "version needed" (offset);
// nameStart is where the header's name begins.
function readCommonFields(view, archive, offset, nameStart) {
  const nameLength = view.getUint16(offset + 22, true);
  return {
    version: view.getUint16(offset, true),
    flags: view.getUint16(offset + 2, true),
    method: view.getUint16(offset + 4, true),
    time: view.getUint16(offset + 6, true),
    date: view.getUint16(offset + 8, true),
    crc: view.getUint32(offset + 10, true),
    storedSize: view.getUint32(offset + 14, true),
    size: view.getUint32(offset + 18, true),
    extraLength: view.getUint16(offset + 24, true),
    name: new TextDecoder().decode(archive.subarray(nameStart, nameStart + nameLength)),
    nameEnd: nameStart + nameLength,
  };
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(`ZIP check failed: ${message}`);
  }
}
